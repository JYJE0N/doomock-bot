const EventEmitter = require("events");

/**
 * 🚇 DoomockBot EventBus
 * 지하철 시스템처럼 모든 모듈이 이벤트로 소통하는 핵심 클래스
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // 많은 리스너 허용
    this.middleware = [];
    this.eventSchemas = new Map();
    this.stats = {
      emitted: new Map(),
      handled: new Map(),
      errors: new Map(),
      startTime: Date.now()
    };

    this.circuitBreaker = new Map(); // 순환 참조 방지
    this.setupErrorHandling();
  }

  // 🎫 이벤트 발행 (지하철 출발!)
  async publish(eventName, payload = {}, metadata = {}) {
    const event = {
      name: eventName,
      payload,
      metadata: {
        timestamp: new Date(),
        id: this.generateEventId(),
        source: metadata.source || "unknown",
        ...metadata
      }
    };

    // 순환 참조 검사
    if (this.checkCircularReference(eventName, event.metadata.id)) {
      throw new Error(`순환 이벤트 감지: ${eventName}`);
    }

    try {
      // 미들웨어 실행
      await this.runMiddleware(event);

      // 통계 업데이트
      this.updateStats("emitted", eventName);

      // 이벤트 발행
      this.emit(eventName, event);
      this.emit("*", event); // 모든 이벤트 모니터링용

      return event.metadata.id;
    } catch (error) {
      this.updateStats("errors", eventName);
      throw error;
    }
  }

  // 🚉 이벤트 구독 (역에서 대기!)
  subscribe(eventName, handler, options = {}) {
    const wrappedHandler = this.createWrappedHandler(handler, options);
    this.on(eventName, wrappedHandler);

    return () => this.removeListener(eventName, wrappedHandler);
  }

  // 🔄 미들웨어 등록
  use(middleware) {
    this.middleware.push(middleware);
    return this;
  }

  // 📊 통계 조회
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const totalEmitted = Array.from(this.stats.emitted.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const totalErrors = Array.from(this.stats.errors.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      uptime: Math.floor(uptime / 1000) + "초",
      totalEvents: totalEmitted,
      errorRate:
        totalEmitted > 0
          ? ((totalErrors / totalEmitted) * 100).toFixed(2) + "%"
          : "0%",
      topEvents: this.getTopEvents(5),
      listenerCount: this.eventNames().length
    };
  }

  // 🛡️ 이벤트 스키마 등록
  registerSchema(eventName, schema) {
    this.eventSchemas.set(eventName, schema);
    return this;
  }

  // 🔍 이벤트 유효성 검증
  validateEvent(eventName, payload) {
    const schema = this.eventSchemas.get(eventName);
    if (!schema) return true;

    // 간단한 스키마 검증 (실제로는 joi, ajv 등 사용 권장)
    for (const [key, type] of Object.entries(schema)) {
      if (!(key in payload)) {
        throw new Error(`필수 필드 누락: ${key} in ${eventName}`);
      }

      if (typeof payload[key] !== type) {
        throw new Error(
          `타입 불일치: ${key} should be ${type} in ${eventName}`
        );
      }
    }

    return true;
  }

  // --- 내부 메서드들 ---

  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async runMiddleware(event) {
    for (const middleware of this.middleware) {
      await middleware(event, () => {});
    }
  }

  createWrappedHandler(handler, options) {
    return async (event) => {
      const start = Date.now();

      try {
        // 이벤트 검증
        if (this.eventSchemas.has(event.name)) {
          this.validateEvent(event.name, event.payload);
        }

        await handler(event);

        // 성능 측정
        const duration = Date.now() - start;
        if (duration > (options.slowThreshold || 100)) {
          console.warn(`⚠️ 느린 이벤트 처리: ${event.name} (${duration}ms)`);
        }

        this.updateStats("handled", event.name);
      } catch (error) {
        this.updateStats("errors", event.name);

        // 에러 이벤트 발행 (무한 루프 방지를 위해 조건부)
        if (event.name !== "error") {
          this.emit("error", { event, error });
        }

        // 기본적으로는 에러를 억제하되, 옵션에 따라 다르게 처리
        if (options.throwOnError) {
          throw error;
        } else {
          console.error(
            `❌ 이벤트 처리 오류 (억제됨): ${event.name}`,
            error.message
          );
        }
      }
    };
  }

  checkCircularReference(eventName, eventId) {
    // 순환 참조 방지 로직 (간단한 버전)
    const key = eventName;
    const now = Date.now();

    if (!this.circuitBreaker.has(key)) {
      this.circuitBreaker.set(key, { count: 1, lastTime: now });
      return false;
    }

    const info = this.circuitBreaker.get(key);

    // 1초 내에 같은 이벤트가 10번 이상 발생하면 순환 의심
    if (now - info.lastTime < 1000) {
      info.count++;
      if (info.count > 10) {
        return true;
      }
    } else {
      info.count = 1;
      info.lastTime = now;
    }

    return false;
  }

  updateStats(type, eventName) {
    if (!this.stats[type].has(eventName)) {
      this.stats[type].set(eventName, 0);
    }
    this.stats[type].set(eventName, this.stats[type].get(eventName) + 1);
  }

  getTopEvents(limit = 5) {
    return Array.from(this.stats.emitted.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }

  setupErrorHandling() {
    this.on("error", ({ event, error }) => {
      console.error(`❌ 이벤트 처리 오류: ${event.name}`, error);
    });
  }
}

module.exports = EventBus;
