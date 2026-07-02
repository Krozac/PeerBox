// shared/eventEmitter.js
export class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  on(event, fn) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(fn);
    return this;
  }

  off(event, fn) {
    this.events.get(event)?.delete(fn);
  }

  emit(event, ...args) {
    this.events.get(event)?.forEach(fn => fn(...args));
  }
}