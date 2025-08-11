// src/core/EventBus.js
const EventEmitter = require("events");
const { LogUtils, IdUtils, TimeUtils, StatsUtils } = require("../utils");

/**
 * 🚌 이벤트버스 - 모든 모듈 간 통신의 중심
 *
 * 지하철 시스템 비유:
 * - EventBus = 지하철 네트워크
 * - publish = 지하철 출발
 * - subscribe = 역에서 대기
 * - 이벤트 = 지하철 (데이터를 실어나름)
 */
class EventBus extends EventEmitter {
  constructor(options = {}) {
    super();

    // 설정
    this.config = {
      maxListeners: options.maxListeners || 100,
      enableLogging: options.enableLogging !== false,
      enableStats: options.enableStats !== false,
      circularEventProtection: options.circularEventProtection !== false,
      maxEventChainDepth: options.maxEventChainDepth || 10
    };

    this.setMaxListeners(this.config.maxListeners);

    // 미들웨어 스택
    this.middleware = [];

    // 이벤트 스키마 저장소
    this.eventSchemas = new Map();

    // 통계 추적
    this.stats = {
      emitted: new Map(),
      handled: new Map(),
      errors: new Map(),
      durations: new Map()
    };

    // 순환 이벤트 방지
    this.eventChains = new Map();

    // 구독자 맵 (디버깅용)
    this.subscriptions = new Map();

    LogUtils.success("🚌 EventBus 초기화 완료");
  }

  /**
   * 미들웨어 추가
   * @param {Function} middleware - 미들웨어 함수
   */
  use(middleware) {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * 이벤트 스키마 등록
   * @param {string} eventName - 이벤트 이름
   * @param {Object} schema - 검증 스키마
   */
  registerSchema(eventName, schema) {
    this.eventSchemas.set(eventName, schema);
    LogUtils.debug(`📋 스키마 등록: ${eventName}`);
    return this;
  }

  /**
   * 이벤트 발행 (지하철 출발!)
   * @param {string} eventName - 이벤트 이름
   * @param {any} payload - 이벤트 데이터
   * @param {Object} metadata - 메타데이터
   */
  async publish(eventName, payload = {}, metadata = {}) {
    const event = {
      id: IdUtils.generateId("evt"),
      name: eventName,
      payload,
      metadata: {
        ...metadata,
        timestamp: TimeUtils.timestamp(),
        publishedBy: metadata.source || "system"
      }
    };

    // 순환 이벤트 체크
    if (this.config.circularEventProtection) {
      if (this.detectCircularEvent(event)) {
        LogUtils.warn(`🔄 순환 이벤트 감지: ${eventName}`);
        return null;
      }
    }

    // 스키마 검증
    if (this.eventSchemas.has(eventName)) {
      const schema = this.eventSchemas.get(eventName);
      if (!this.validateSchema(payload, schema)) {
        LogUtils.error(`❌ 스키마 검증 실패: ${eventName}`);
        throw new Error(`Invalid event payload for ${eventName}`);
      }
    }

    // 미들웨어 실행
    for (const mw of this.middleware) {
      const next = () => {};
      await mw(event, next);
    }

    // 통계 업데이트
    if (this.config.enableStats) {
      this.updateStats("emitted", eventName);
    }

    // 로깅
    if (this.config.enableLogging) {
      LogUtils.info(`🚇 이벤트 발행: ${eventName}`, {
        id: event.id,
        payloadSize: JSON.stringify(payload).length
      });
    }

    // 이벤트 발행
    const startTime = Date.now();
    this.emit(eventName, event);

    // 성능 측정
    if (this.config.enableStats) {
      const duration = Date.now() - startTime;
      this.recordDuration(eventName, duration);
    }

    return event.id;
  }

  /**
   * 이벤트 구독 (역에서 대기!)
   * @param {string} eventName - 이벤트 이름
   * @param {Function} handler - 핸들러 함수
   * @param {Object} options - 옵션
   */
  subscribe(eventName, handler, options = {}) {
    const handlerId = IdUtils.generateId("handler");

    const wrappedHandler = async (event) => {
      const startTime = Date.now();

      try {
        // 핸들러 실행
        await handler(event);

        // 성공 통계
        if (this.config.enableStats) {
          this.updateStats("handled", eventName);
          const duration = Date.now() - startTime;
          this.recordDuration(`${eventName}:handler`, duration);
        }

        if (this.config.enableLogging && options.logSuccess) {
          LogUtils.success(`✅ 이벤트 처리 완료: ${eventName}`);
        }
      } catch (error) {
        // 에러 통계
        if (this.config.enableStats) {
          this.updateStats("errors", eventName);
        }

        LogUtils.error(`❌ 이벤트 처리 실패: ${eventName}`, {
          error: error.message,
          handlerId
        });

        // 에러 이벤트 발행 (옵션)
        if (!options.ignoreErrors) {
          this.publish("system:error", {
            originalEvent: eventName,
            error: error.message,
            stack: error.stack,
            handlerId
          });
        }

        // 에러 재발생 (옵션)
        if (options.throwErrors) {
          throw error;
        }
      }
    };

    // 구독 등록
    this.on(eventName, wrappedHandler);

    // 구독 정보 저장
    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, new Set());
    }
    this.subscriptions.get(eventName).add({
      id: handlerId,
      handler: wrappedHandler,
      options
    });

    if (this.config.enableLogging) {
      LogUtils.debug(`👂 이벤트 구독: ${eventName} (${handlerId})`);
    }

    // unsubscribe 함수 반환
    return () => {
      this.off(eventName, wrappedHandler);
      const subs = this.subscriptions.get(eventName);
      if (subs) {
        subs.forEach((sub) => {
          if (sub.id === handlerId) subs.delete(sub);
        });
      }
      LogUtils.debug(`🔌 구독 해제: ${eventName} (${handlerId})`);
    };
  }

  /**
   * 한 번만 구독
   */
  subscribeOnce(eventName, handler, options = {}) {
    const unsubscribe = this.subscribe(
      eventName,
      async (event) => {
        unsubscribe(); // 자동 구독 해제
        await handler(event);
      },
      options
    );

    return unsubscribe;
  }

  /**
   * 와일드카드 구독 (모든 이벤트 리스닝)
   */
  subscribeAll(handler, options = {}) {
    const wrappedHandler = (eventName, event) => {
      handler({ ...event, name: eventName });
    };

    this.onAny(wrappedHandler);

    return () => this.offAny(wrappedHandler);
  }

  /**
   * 순환 이벤트 감지
   */
  detectCircularEvent(event) {
    const chainId = event.metadata.correlationId || event.id;

    if (!this.eventChains.has(chainId)) {
      this.eventChains.set(chainId, []);
    }

    const chain = this.eventChains.get(chainId);

    // 같은 이벤트가 체인에 있는지 확인
    if (chain.includes(event.name)) {
      return true; // 순환 감지!
    }

    // 체인 깊이 체크
    if (chain.length >= this.config.maxEventChainDepth) {
      LogUtils.warn(`⚠️ 이벤트 체인 깊이 초과: ${chain.length}`);
      return true;
    }

    chain.push(event.name);

    // 일정 시간 후 체인 정리
    setTimeout(() => {
      this.eventChains.delete(chainId);
    }, 5000);

    return false;
  }

  /**
   * 스키마 검증
   */
  validateSchema(payload, schema) {
    // 간단한 스키마 검증 (실제로는 joi, yup 등 사용 권장)
    for (const [key, rule] of Object.entries(schema)) {
      if (rule.required && !(key in payload)) {
        LogUtils.error(`필수 필드 누락: ${key}`);
        return false;
      }

      if (key in payload && rule.type) {
        const actualType = Array.isArray(payload[key])
          ? "array"
          : typeof payload[key];
        if (actualType !== rule.type) {
          LogUtils.error(
            `타입 불일치: ${key} (예상: ${rule.type}, 실제: ${actualType})`
          );
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 통계 업데이트
   */
  updateStats(type, eventName) {
    const current = this.stats[type].get(eventName) || 0;
    this.stats[type].set(eventName, current + 1);
  }

  /**
   * 실행 시간 기록
   */
  recordDuration(eventName, duration) {
    if (!this.stats.durations.has(eventName)) {
      this.stats.durations.set(eventName, []);
    }

    const durations = this.stats.durations.get(eventName);
    durations.push(duration);

    // 최대 100개만 유지
    if (durations.length > 100) {
      durations.shift();
    }
  }

  /**
   * 통계 조회
   */
  getStats() {
    const stats = {
      emitted: Object.fromEntries(this.stats.emitted),
      handled: Object.fromEntries(this.stats.handled),
      errors: Object.fromEntries(this.stats.errors),
      performance: {}
    };

    // 성능 통계 계산
    for (const [eventName, durations] of this.stats.durations.entries()) {
      if (durations.length > 0) {
        stats.performance[eventName] = {
          avg: StatsUtils.average(durations).toFixed(2),
          median: StatsUtils.median(durations).toFixed(2),
          p95: StatsUtils.percentile(durations, 95).toFixed(2),
          p99: StatsUtils.percentile(durations, 99).toFixed(2),
          samples: durations.length
        };
      }
    }

    return stats;
  }

  /**
   * 통계 리셋
   */
  resetStats() {
    this.stats.emitted.clear();
    this.stats.handled.clear();
    this.stats.errors.clear();
    this.stats.durations.clear();
    LogUtils.info("📊 통계 초기화 완료");
  }

  /**
   * 이벤트버스 상태 조회
   */
  getStatus() {
    return {
      listeners: this.listenerCount(),
      subscriptions: this.subscriptions.size,
      schemas: this.eventSchemas.size,
      middleware: this.middleware.length,
      activeChains: this.eventChains.size,
      stats: this.getStats()
    };
  }

  /**
   * 종료
   */
  shutdown() {
    this.removeAllListeners();
    this.eventChains.clear();
    this.subscriptions.clear();
    LogUtils.info("🛑 EventBus 종료");
  }
}

// ========================
// 테스트 코드
// ========================

async function testEventBus() {
  console.log("\n🧪 EventBus 테스트 시작\n");
  console.log("=".repeat(50));

  // 1. EventBus 인스턴스 생성
  const eventBus = new EventBus({
    enableLogging: true,
    enableStats: true
  });

  // 2. 미들웨어 추가 (이벤트 로깅)
  eventBus.use(async (event, next) => {
    console.log(`📮 미들웨어: ${event.name} 처리 중...`);
    await next();
  });

  // 3. 스키마 등록
  eventBus.registerSchema("user:login", {
    userId: { type: "string", required: true },
    timestamp: { type: "string", required: true }
  });

  eventBus.registerSchema("todo:created", {
    id: { type: "string", required: true },
    text: { type: "string", required: true },
    userId: { type: "string", required: true }
  });

  console.log("\n--- 테스트 1: 기본 발행/구독 ---\n");

  // 4. 이벤트 구독
  const unsubscribe1 = eventBus.subscribe("user:login", async (event) => {
    console.log("👤 로그인 이벤트 수신:", event.payload);
    await TimeUtils.delay(100); // 비동기 작업 시뮬레이션
  });

  // 5. 이벤트 발행
  await eventBus.publish("user:login", {
    userId: "user123",
    timestamp: TimeUtils.timestamp()
  });

  console.log("\n--- 테스트 2: 다중 구독자 ---\n");

  // 여러 구독자 등록
  eventBus.subscribe("todo:created", async (event) => {
    console.log("📝 할일 생성 알림:", event.payload.text);
  });

  eventBus.subscribe("todo:created", async (event) => {
    console.log("📊 통계 업데이트: 새 할일 추가됨");
  });

  eventBus.subscribe("todo:created", async (event) => {
    console.log("💾 데이터베이스 저장 중...");
    await TimeUtils.delay(50);
    console.log("💾 저장 완료!");
  });

  // 이벤트 발행
  await eventBus.publish("todo:created", {
    id: IdUtils.generateId("todo"),
    text: "이벤트버스 테스트하기",
    userId: "user123"
  });

  console.log("\n--- 테스트 3: 에러 처리 ---\n");

  // 에러가 발생하는 핸들러
  eventBus.subscribe("test:error", async (event) => {
    console.log("💥 에러 테스트 시작...");
    throw new Error("의도적인 에러!");
  });

  // 시스템 에러 구독
  eventBus.subscribe("system:error", async (event) => {
    console.log("🚨 시스템 에러 감지:", event.payload.error);
  });

  await eventBus.publish("test:error", { test: true });

  console.log("\n--- 테스트 4: 와일드카드 구독 ---\n");

  // 모든 이벤트 모니터링
  const unsubscribeAll = eventBus.subscribeAll((event) => {
    console.log(`🌟 [모니터] ${event.name} 이벤트 감지`);
  });

  await eventBus.publish("random:event1", { data: "test1" });
  await eventBus.publish("random:event2", { data: "test2" });

  console.log("\n--- 테스트 5: 한 번만 구독 ---\n");

  eventBus.subscribeOnce("once:only", async (event) => {
    console.log("🎯 한 번만 실행되는 핸들러:", event.payload);
  });

  await eventBus.publish("once:only", { count: 1 });
  await eventBus.publish("once:only", { count: 2 }); // 이건 무시됨

  console.log("\n--- 테스트 6: 스키마 검증 ---\n");

  try {
    // 잘못된 페이로드 (userId 누락)
    await eventBus.publish("user:login", {
      timestamp: TimeUtils.timestamp()
      // userId 누락!
    });
  } catch (error) {
    console.log("✅ 스키마 검증 성공적으로 실패 감지");
  }

  console.log("\n--- 테스트 7: 성능 측정 ---\n");

  // 많은 이벤트 발행
  console.log("🏃 1000개 이벤트 발행 중...");
  const startTime = Date.now();

  for (let i = 0; i < 1000; i++) {
    await eventBus.publish("performance:test", { index: i });
  }

  const totalTime = Date.now() - startTime;
  console.log(`⏱️ 총 소요 시간: ${totalTime}ms`);
  console.log(`⚡ 평균: ${(totalTime / 1000).toFixed(2)}ms/이벤트`);

  console.log("\n--- 통계 확인 ---\n");

  const stats = eventBus.getStats();
  console.log("📊 이벤트버스 통계:");
  console.log(JSON.stringify(stats, null, 2));

  console.log("\n--- 상태 확인 ---\n");

  const status = eventBus.getStatus();
  console.log("📈 이벤트버스 상태:");
  console.log(JSON.stringify(status, null, 2));

  // 정리
  unsubscribe1();
  unsubscribeAll();

  console.log("\n=".repeat(50));
  console.log("✅ 모든 테스트 완료!\n");

  // 종료
  eventBus.shutdown();
}

// 독립 실행 시 테스트 실행
if (require.main === module) {
  testEventBus().catch(console.error);
}

module.exports = EventBus;
