// src/core/EventBus.js
const EventEmitter = require("events");
const logger = require("../utils/Logger");

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // 리스너 제한 증가
  }

  emitAsync(event, ...args) {
    return Promise.all(
      this.listeners(event).map((listener) =>
        Promise.resolve(listener(...args))
      )
    );
  }
}

// 싱글톤 인스턴스
const eventBus = new EventBus();
module.exports = eventBus;
