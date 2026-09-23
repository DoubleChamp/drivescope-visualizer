type TimestampedFrame = {
  timestampMs: number;
};

export class FrameCache<T extends TimestampedFrame> {
  private readonly entries = new Map<number, T>();

  get(timestampMs: number) {
    return this.entries.get(timestampMs) ?? null;
  }

  set(frame: T) {
    this.entries.set(frame.timestampMs, frame);
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    return this.entries.size;
  }
}
