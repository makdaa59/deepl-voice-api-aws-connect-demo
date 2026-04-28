class DequeDict {
  constructor(maxlen = null) {
    this.maxlen = maxlen;
    this.map = new Map();
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, value);
    if (this.maxlen && this.map.size > this.maxlen) {
      this.map.delete(this.map.keys().next().value);
    }
  }

  get(key) {
    return this.map.get(key);
  }

  has(key) {
    return this.map.has(key);
  }

  keys() {
    return this.map.keys();
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}

export class FrameTimer {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize;
    this.sampleRate = options.sampleRate ?? 16000;
    this.sampleWidth = options.sampleWidth ?? 2;
    this.channels = options.channels ?? 1;
    this.analysisWindowFrames = options.analysisWindowFrames ?? 1000;
    this.chunkSec = this._getChunkSec();
    this.frames = new DequeDict(this.analysisWindowFrames);
    this.seqNo = 0;
    this._lock = Promise.resolve();
  }

  _getChunkSec() {
    const width = this.sampleWidth * this.channels;
    return this.chunkSize / width / this.sampleRate;
  }

  async _withLock(fn) {
    const result = this._lock.then(fn);
    this._lock = result.catch(() => {});
    return result;
  }

  reset() {
    return this._withLock(() => {
      this.frames.clear();
      this.seqNo = 0;
    });
  }

  addFrame(now = Date.now() / 1000) {
    return this._withLock(() => {
      this.seqNo += 1;
      const frameTs = Math.round(this.seqNo * this.chunkSec * 100) / 100;
      this.frames.set(frameTs, now);
    });
  }

  getFrame(frameTs) {
    return this._withLock(() => this.frames.get(frameTs));
  }

  getClosestBefore(frameTs) {
    if (frameTs == null) return Promise.resolve(null);
    return this._withLock(() => {
      const validTs = [...this.frames.keys()].filter(ts => ts <= frameTs);
      if (!validTs.length) return null;
      const closestTs = Math.max(...validTs);
      return this.frames.get(closestTs);
    });
  }
}
