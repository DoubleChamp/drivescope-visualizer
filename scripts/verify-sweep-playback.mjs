import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { withChromePage, delay } from "./lib/chrome-page.mjs";
import { installPerformanceProbe } from "./lib/browser-performance-probe.mjs";
import { summarize, summarizeMainThread } from "./lib/performance-summary.mjs";

const base = new URL(process.env.DRIVESCOPE_BENCHMARK_URL ?? "http://localhost:3100");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
const response = await fetch(new URL("/api/drivescope-data/manifest.json", base));
assert.equal(response.status, 200);
const manifest = await response.json();
assert.ok(manifest.lidar.frames.length > 300 && manifest.camera.frames.length > 200, "개별 sweep 데이터가 필요합니다.");
const latest = (frames, time) => frames.filter(frame => frame.timestampMs <= time).at(-1);

function installProbe() {
  window.__playbackProbe = { clock:0, points:0, intervals:new Map() };
  const value = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");
  Object.defineProperty(HTMLInputElement.prototype,"value",{...value,set(next){
    if(this.type==="range") window.__playbackProbe.clock=Number(next);
    return value.set.call(this,next);
  }});
  const set = window.setInterval, clear = window.clearInterval;
  window.setInterval = function(handler,ms,...args){ const id=set.call(this,handler,ms,...args);window.__playbackProbe.intervals.set(id,ms);return id; };
  window.clearInterval = function(id){ window.__playbackProbe.intervals.delete(id);return clear.call(this,id); };
  for(const prototype of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){
    const clear=prototype.clear,draw=prototype.drawArrays;
    prototype.clear=function(...args){window.__playbackProbe.points=0;return clear.apply(this,args)};
    prototype.drawArrays=function(mode,start,count){if(mode===0)window.__playbackProbe.points+=count;return draw.call(this,mode,start,count)};
  }
}

function monitor(cameraFrames) {
  const panel=document.querySelector('[aria-labelledby="sync-title"]');
  const images=[...document.querySelectorAll('[aria-labelledby="camera-title"] img')];
  const result=window.__playbackDisplay={samples:0,blankCamera:0,blankLidar:0,backwardsCamera:0,backwardsLidar:0,
    domReplacements:0,lidar:[],camera:[],clock:[],heights:[],running:true};
  let oldLidar=null,oldCamera=null;
  const sample=()=>{
    if(!result.running)return;
    const clock=window.__playbackProbe.clock;
    const diff=panel.querySelector('dl>div:nth-child(2) dd span span')?.textContent;
    const lidar=diff ? clock+Number(diff.replaceAll(",","").replace("ms","")) : null;
    const image=images.find(image=>image.dataset.active==="true");
    const camera=cameraFrames.find(frame=>image?.src.endsWith("/"+frame.imageFile))?.timestampMs??null;
    result.samples++;
    if(!image?.complete||!image.naturalWidth)result.blankCamera++;
    if(!window.__playbackProbe.points)result.blankLidar++;
    if(lidar!==null&&oldLidar!==null&&lidar<oldLidar)result.backwardsLidar++;
    if(camera!==null&&oldCamera!==null&&camera<oldCamera)result.backwardsCamera++;
    if(lidar!==null&&lidar!==oldLidar)result.lidar.push({timestampMs:lidar,observedAtMs:performance.now()});
    if(camera!==null&&camera!==oldCamera)result.camera.push({timestampMs:camera,observedAtMs:performance.now()});
    if(result.clock.at(-1)?.timeMs!==clock)result.clock.push({timeMs:clock,observedAtMs:performance.now()});
    oldLidar=lidar;oldCamera=camera;
    result.heights.push(panel.getBoundingClientRect().height);
    if(images.some((image,index)=>document.querySelectorAll('[aria-labelledby="camera-title"] img')[index]!==image))result.domReplacements++;
    requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
}

await withChromePage(async({send,evaluate,waitFor,exceptions})=>{
  await send("Page.addScriptToEvaluateOnNewDocument",{source:`(${installProbe.toString()})(); (${installPerformanceProbe.toString()})()`});
  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  const seek=async time=>{
    await evaluate(`(()=>{const input=document.querySelector('input[type=range]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'${time}');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  };
  const ready=async time=>{
    const frame=latest(manifest.lidar.frames,time),camera=latest(manifest.camera.frames,time);
    await waitFor(`document.querySelector('img[data-active="true"]')?.src.endsWith(${JSON.stringify('/'+camera.imageFile)}) && window.__playbackProbe.points===${frame.pointCount} &&
      Number(document.querySelector('[aria-label="동기화된 Frame"]>div:nth-child(2) dd span span')?.textContent.replaceAll(',','').replace('ms',''))+window.__playbackProbe.clock===${frame.timestampMs}`);
  };
  const trials=[];
  for(let round=1;round<=3;round++){
    await send("Page.navigate",{url:new URL("/viewer",base).href});
    await waitFor(`document.querySelector('input[type=range]')?.max==='${manifest.durationMs}'`);
    assert.equal(await evaluate("document.querySelector('input[type=range]').step"),"50");
    await seek(1000);await ready(1000);await delay(1200);
    await evaluate(`(${monitor.toString()})(${JSON.stringify(manifest.camera.frames)})`);
    await evaluate("window.__drivescopePerformance.start();document.querySelector('button[aria-pressed]').click()");
    assert.deepEqual(await evaluate("[...window.__playbackProbe.intervals.values()]"),[50]);
    const fps=[];
    for(let i=0;i<10;i++){await delay(1000);fps.push(await evaluate("Number([...document.querySelector('[aria-label=\"뷰어 통계\"]').children].find(row=>row.querySelector('dt').textContent==='FPS').querySelector('dd').textContent)"));}
    await evaluate("document.querySelector('button[aria-pressed]').click();window.__playbackDisplay.running=false");
    const mainThread=await evaluate("window.__drivescopePerformance.stop()");
    const display=await evaluate("window.__playbackDisplay");
    assert.equal(display.blankCamera+display.blankLidar+display.backwardsCamera+display.backwardsLidar+display.domReplacements,0);
    assert.ok(display.lidar.length>=180 && display.lidar.length<=210);
    assert.ok(display.camera.length>=100);
    assert.equal(new Set(display.heights).size,1);
    assert.ok(display.lidar.every(frame=>manifest.lidar.frames.some(source=>source.timestampMs===frame.timestampMs)));
    assert.deepEqual(await evaluate("[...window.__playbackProbe.intervals.values()]"),[]);
    const paused=await evaluate("window.__playbackProbe.clock");await delay(180);
    assert.equal(await evaluate("window.__playbackProbe.clock"),paused);
    trials.push({round,fps,mainThread,display:{...display,heights:[...new Set(display.heights)]}});
    console.log(`round ${round}: ${display.lidar.length} LiDAR / ${display.camera.length} camera displays; blank/backwards 0`);
  }
  for(const time of [1250,5000,0,19000]){
    await seek(time);
    if(time===0)await waitFor("window.__playbackProbe.points===0");else await ready(time);
  }
  const lastStep=Math.floor(manifest.durationMs/50)*50;
  await seek(lastStep);await ready(manifest.durationMs);
  assert.equal(await evaluate("window.__playbackProbe.clock"),manifest.durationMs);
  await evaluate("document.querySelector('button[aria-pressed]').click()");
  await waitFor("window.__playbackProbe.clock>0&&window.__playbackProbe.clock<1000");
  await evaluate("document.querySelector('button[aria-pressed]').click()");
  await evaluate("document.querySelector('input[type=radio][value=mock]').click()");
  await waitFor("document.querySelector('input[type=range]')?.max==='15000'");
  assert.equal(await evaluate("document.querySelector('input[type=range]').step"),"100");
  await evaluate("document.querySelector('button[aria-pressed]').click()");
  assert.deepEqual(await evaluate("[...window.__playbackProbe.intervals.values()]"),[100]);
  await evaluate("document.querySelector('input[type=radio][value=actual]').click()");
  await waitFor(`document.querySelector('input[type=range]')?.max==='${manifest.durationMs}'`);
  assert.equal(await evaluate("window.__playbackProbe.clock"),0);
  assert.deepEqual(await evaluate("[...window.__playbackProbe.intervals.values()]"),[]);
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));
  const gaps=rows=>rows.slice(1).map((row,index)=>row.observedAtMs-rows[index].observedAtMs);
  const result={measuredAt:new Date().toISOString(),scenarioId:manifest.scenarioId,lidarFrames:manifest.lidar.frames.length,cameraFrames:manifest.camera.frames.length,
    protocol:{browser:"isolated Chrome, production source; no asset proxy or interval substitution",httpCache:"disabled",osCache:"not reset",startMs:1000,secondsPerTrial:10,trials:3},
    summary:{fps:summarize(trials.flatMap(t=>t.fps)),lidarDisplays:summarize(trials.map(t=>t.display.lidar.length)),cameraDisplays:summarize(trials.map(t=>t.display.camera.length)),
      lidarIntervalMs:summarize(trials.flatMap(t=>gaps(t.display.lidar))),mainThread:summarizeMainThread(trials.map(t=>t.mainThread))},
    checks:["50ms actual interval and timeline", "100ms mock interval and timeline", "pause stable", "50ms seek", "before first lidar empty", "last timestamp reachable", "play from end restarts", "mode cleanup/reset"],trials,runtimeExceptions:0};
  await mkdir("node_modules/.cache/drivescope-benchmark",{recursive:true});
  await writeFile("node_modules/.cache/drivescope-benchmark/sweep-playback.json",JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify({summary:result.summary,checks:result.checks},null,2));
});
