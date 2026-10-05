const isLittleEndian = (() => {
  const value = new Uint16Array([1]);
  return new Uint8Array(value.buffer)[0] === 1;
})();

// 전처리된 xyz Float32 바이너리다. little-endian에서는 복사/좌표 순회 없이 view만 만든다.
export function prepareLidarPositions(buffer: ArrayBuffer, pointCount: number) {
  const expectedByteLength = pointCount * 3 * Float32Array.BYTES_PER_ELEMENT;
  if (buffer.byteLength !== expectedByteLength) {
    throw new Error(`크기가 예상과 다릅니다: ${buffer.byteLength} / ${expectedByteLength}바이트`);
  }
  if (isLittleEndian) return new Float32Array(buffer);

  const view = new DataView(buffer);
  const positions = new Float32Array(pointCount * 3);
  for (let index = 0; index < positions.length; index += 1) {
    positions[index] = view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true);
  }
  return positions;
}
