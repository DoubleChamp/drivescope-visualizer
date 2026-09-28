type TimestampedFrame = {
  timestampMs: number;
};

export class FrameCache<T extends TimestampedFrame> {
  private readonly entries = new Map<number, T>();
  readonly capacity: number;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError("FrameCache capacity must be a positive integer.");
    }

    this.capacity = capacity;
  }

  get(timestampMs: number) {
    const frame = this.entries.get(timestampMs);
    if (!frame) return null;

    // Map의 삽입 순서를 최근 사용 순서로 활용한다.
    this.entries.delete(timestampMs);
    this.entries.set(timestampMs, frame);
    return frame;
  }

  set(frame: T) {
    this.entries.delete(frame.timestampMs);
    this.entries.set(frame.timestampMs, frame);

    if (this.entries.size <= this.capacity) return;

    const leastRecentlyUsedTimestamp = this.entries.keys().next().value;
    if (leastRecentlyUsedTimestamp !== undefined) {
      this.entries.delete(leastRecentlyUsedTimestamp);
    }
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    return this.entries.size;
  }
}
