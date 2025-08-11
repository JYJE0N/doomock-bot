// src/core/EventBus.js
const EventEmitter = require("events");
const logger = require("../utils/Logger");

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // 많은 리스너 허용
    this.middleware = [];
    this.eventSchemas = new Map();
    this.stats = {
      emitted: new Map(),
      handled: new Map(),
      errors: new Map()
    };
  }

  // 미들웨어 등록
  use(middleware) {
    this.middleware.push(middleware);
    return this;
  }

  // 이벤트 발행 (지하철 출발!)
  async publish(eventName, payload = {}) {
    const event = {
      name: eventName,
      payload,
      timestamp: new Date(),
      id: this.generateEventId()
    };

    // 미들웨어 실행
    for (const mw of this.middleware) {
      await mw(event, () => {});
    }

    // 통계 업데이트
    this.updateStats("emitted", eventName);

    // 이벤트 발행
    this.emit(eventName, event);
    logger.debug(`🚇 이벤트 발행: ${eventName}`, { id: event.id });

    return event.id;
  }

  // 이벤트 구독 (역에서 대기!)
  subscribe(eventName, handler, options = {}) {
    const wrappedHandler = async (event) => {
      try {
        await handler(event);
        this.updateStats("handled", eventName);
      } catch (error) {
        this.updateStats("errors", eventName);
        logger.error(`❌ 이벤트 처리 실패: ${eventName}`, error);

        if (!options.ignoreErrors) {
          this.publish("system:error", {
            originalEvent: eventName,
            error: error.message
          });
        }
      }
    };

    this.on(eventName, wrappedHandler);
    logger.debug(`👂 이벤트 구독: ${eventName}`);

    return () => this.off(eventName, wrappedHandler); // unsubscribe 함수 반환
  }

  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updateStats(type, eventName) {
    const current = this.stats[type].get(eventName) || 0;
    this.stats[type].set(eventName, current + 1);
  }

  getStats() {
    return {
      emitted: Object.fromEntries(this.stats.emitted),
      handled: Object.fromEntries(this.stats.handled),
      errors: Object.fromEntries(this.stats.errors)
    };
  }
}

module.exports = EventBus;
