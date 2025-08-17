const EventEmitter = require("events");
const logger = require("../utils/core/Logger");

/**
 * 🚇 DoomockBot EventBus - Performance Enhanced v2.0
 * 지하철 시스템처럼 모든 모듈이 이벤트로 소통하는 핵심 클래스
 *
 * v2.0 개선사항:
 * - 비동기 큐 처리로 성능 향상
 * - 백프레셔(backpressure) 제어
 * - 이벤트 우선순위 지원
 * - 배치 처리로 효율성 증대
 * - 메모리 사용량 최적화
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200); // 더 많은 리스너 허용

    // 기존 기능들
    this.middleware = [];
    this.eventSchemas = new Map();
    this.circuitBreaker = new Map();

    // v2.0 성능 개선 기능들
    this.eventQueue = []; // 이벤트 처리 큐
    this.priorityQueue = []; // 우선순위 이벤트 큐
    this.batchQueue = []; // 배치 처리 큐
    this.isProcessing = false;
    this.processingStats = new Map();

    // 성능 설정
    this.config = {
      maxQueueSize: 1000,
      batchSize: 10,
      batchInterval: 50, // 50ms마다 배치 처리
      maxConcurrentEvents: 20,
      enableBackpressure: true,
      slowEventThreshold: 100
    };

    // 통계 개선
    this.stats = {
      emitted: new Map(),
      handled: new Map(),
      errors: new Map(),
      queued: 0,
      processed: 0,
      batched: 0,
      dropped: 0,
      avgProcessingTime: 0,
      startTime: Date.now()
    };

    // 백프레셔 제어
    this.backpressure = {
      isActive: false,
      droppedEvents: 0,
      lastDropTime: 0
    };

    this.setupErrorHandling();
    this.startBatchProcessor();
    this.startQueueProcessor();
  }

  // 🎫 이벤트 발행 (지하철 출발!) - v2.0 큐 기반 처리
  async publish(eventName, payload = {}, metadata = {}) {
    const event = {
      name: eventName,
      payload,
      metadata: {
        timestamp: new Date(),
        id: this.generateEventId(),
        source: metadata.source || "unknown",
        priority: metadata.priority || "normal", // 우선순위 추가
        batch: metadata.batch || false, // 배치 처리 가능 여부
        ...metadata
      }
    };

    // 순환 참조 검사
    if (this.checkCircularReference(eventName, event.metadata.id)) {
      logger.error(`🚨 순환 이벤트 감지: ${eventName}`);
      throw new Error(`순환 이벤트 감지: ${eventName}`);
    }

    // 백프레셔 제어
    if (this.config.enableBackpressure && this.shouldApplyBackpressure()) {
      return this.handleBackpressure(event);
    }

    try {
      // 이벤트 검증
      this.validateEvent(eventName, payload);

      // 통계 업데이트
      this.updateStats("emitted", eventName);

      logger.debug(`🚇 이벤트 발행: ${eventName}`, {
        payload: Object.keys(payload),
        priority: event.metadata.priority,
        queueSize: this.eventQueue.length
      });

      // v2.0: 큐 기반 처리
      if (event.metadata.priority === "high") {
        this.priorityQueue.push(event);
      } else if (event.metadata.batch) {
        this.batchQueue.push(event);
      } else {
        this.eventQueue.push(event);
      }

      this.stats.queued++;

      return event.metadata.id;
    } catch (error) {
      this.updateStats("errors", eventName);
      logger.error(`❌ 이벤트 발행 실패: ${eventName}`, error.message);
      throw error;
    }
  }

  // 🚉 이벤트 구독 (역에서 대기!)
  subscribe(eventName, handler, options = {}) {
    const wrappedHandler = this.createWrappedHandler(handler, options);
    this.on(eventName, wrappedHandler);

    logger.debug(`📥 이벤트 구독: ${eventName}`);

    // 구독 취소 함수 반환
    return () => {
      this.removeListener(eventName, wrappedHandler);
      logger.debug(`📤 이벤트 구독 해제: ${eventName}`);
    };
  }

  // 🔄 미들웨어 등록
  use(middleware) {
    this.middleware.push(middleware);
    return this;
  }

  // 📊 통계 조회 - v2.0 확장된 통계
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
      listenerCount: this.eventNames().length,

      // v2.0 새로운 통계들
      performance: {
        queued: this.stats.queued,
        processed: this.stats.processed,
        batched: this.stats.batched,
        dropped: this.stats.dropped,
        avgProcessingTime: Math.round(this.stats.avgProcessingTime) + "ms",
        queueSizes: {
          normal: this.eventQueue.length,
          priority: this.priorityQueue.length,
          batch: this.batchQueue.length
        }
      },

      backpressure: {
        isActive: this.backpressure.isActive,
        droppedEvents: this.backpressure.droppedEvents,
        lastDropTime: this.backpressure.lastDropTime
      }
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
          logger.warn(`⚠️ 느린 이벤트 처리: ${event.name} (${duration}ms)`);
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
          logger.error(
            `❌ 이벤트 처리 오류 (억제됨): ${event.name}`,
            error.message
          );
        }
      }
    };
  }

  checkCircularReference(eventName, eventId) {
    // 개선된 순환 참조 방지 로직
    const key = eventName;
    const now = Date.now();

    if (!this.circuitBreaker.has(key)) {
      this.circuitBreaker.set(key, {
        count: 1,
        lastTime: now,
        eventIds: [eventId]
      });
      return false;
    }

    const info = this.circuitBreaker.get(key);

    // 100ms 내에 같은 이벤트ID가 발생하면 진짜 순환
    if (now - info.lastTime < 100 && info.eventIds.includes(eventId)) {
      return true;
    }

    // 500ms 내에 같은 이벤트가 20번 이상 발생하면 순환 의심
    if (now - info.lastTime < 500) {
      info.count++;
      info.eventIds.push(eventId);
      // eventIds 배열이 너무 커지지 않도록 제한
      if (info.eventIds.length > 20) {
        info.eventIds = info.eventIds.slice(-10);
      }
      if (info.count > 20) {
        return true;
      }
    } else {
      // 시간이 많이 지났으면 리셋
      info.count = 1;
      info.lastTime = now;
      info.eventIds = [eventId];
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
      logger.error(`❌ 이벤트 처리 오류: ${event.name}`, error);
    });
  }

  // 🎯 EventBus 건강 상태 체크
  getHealthStatus() {
    const stats = this.getStats();
    const errorRate = parseFloat(stats.errorRate.replace("%", ""));

    let status = "healthy";
    let score = 100;

    if (errorRate > 20) {
      status = "critical";
      score = 20;
    } else if (errorRate > 10) {
      status = "warning";
      score = 60;
    } else if (errorRate > 5) {
      status = "caution";
      score = 80;
    }

    return {
      status,
      score,
      stats,
      listeners: this.eventNames().length,
      timestamp: new Date().toISOString()
    };
  }

  // v2.0 성능 개선 메서드들

  /**
   * 🔄 큐 프로세서 시작
   */
  startQueueProcessor() {
    setImmediate(async () => {
      await this.processQueues();
      if (!this.isShuttingDown) {
        this.startQueueProcessor(); // 재귀 호출
      }
    });
  }

  /**
   * 📦 배치 프로세서 시작
   */
  startBatchProcessor() {
    this.batchInterval = setInterval(() => {
      this.processBatchQueue();
    }, this.config.batchInterval);
  }

  /**
   * 🏃 큐 처리 로직
   */
  async processQueues() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const startTime = Date.now();
      let processedCount = 0;

      // 1. 우선순위 큐 먼저 처리
      while (
        this.priorityQueue.length > 0 &&
        processedCount < this.config.maxConcurrentEvents
      ) {
        const event = this.priorityQueue.shift();
        await this.processEvent(event);
        processedCount++;
      }

      // 2. 일반 큐 처리
      while (
        this.eventQueue.length > 0 &&
        processedCount < this.config.maxConcurrentEvents
      ) {
        const event = this.eventQueue.shift();
        await this.processEvent(event);
        processedCount++;
      }

      // 평균 처리 시간 업데이트
      if (processedCount > 0) {
        const processingTime = Date.now() - startTime;
        this.updateAvgProcessingTime(processingTime);
        this.stats.processed += processedCount;
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 📦 배치 큐 처리
   */
  async processBatchQueue() {
    if (this.batchQueue.length === 0) return;

    const batchSize = Math.min(this.config.batchSize, this.batchQueue.length);
    const batch = this.batchQueue.splice(0, batchSize);

    logger.debug(`📦 배치 처리: ${batch.length}개 이벤트`);

    // 배치를 병렬로 처리
    const promises = batch.map((event) => this.processEvent(event));

    try {
      await Promise.allSettled(promises);
      this.stats.batched += batch.length;
    } catch (error) {
      logger.error("배치 처리 오류:", error);
    }
  }

  /**
   * 🎯 개별 이벤트 처리
   */
  async processEvent(event) {
    const startTime = Date.now();

    try {
      // 미들웨어 실행
      await this.runMiddleware(event);

      // 실제 이벤트 발행
      this.emit(event.name, event);
      this.emit("*", event);

      // 성능 모니터링
      const duration = Date.now() - startTime;
      if (duration > this.config.slowEventThreshold) {
        logger.warn(`⚠️ 느린 이벤트: ${event.name} (${duration}ms)`);
      }
    } catch (error) {
      this.updateStats("errors", event.name);
      logger.error(`❌ 이벤트 처리 실패: ${event.name}`, error);
    }
  }

  /**
   * 💪 백프레셔 제어
   */
  shouldApplyBackpressure() {
    const totalQueueSize =
      this.eventQueue.length +
      this.priorityQueue.length +
      this.batchQueue.length;
    return totalQueueSize > this.config.maxQueueSize;
  }

  /**
   * 🚫 백프레셔 처리
   */
  handleBackpressure(event) {
    // 중요한 이벤트는 드롭하지 않음
    if (
      event.metadata.priority === "high" ||
      event.name.startsWith("system.")
    ) {
      this.priorityQueue.push(event);
      return event.metadata.id;
    }

    // 일반 이벤트는 드롭
    this.backpressure.isActive = true;
    this.backpressure.droppedEvents++;
    this.backpressure.lastDropTime = Date.now();
    this.stats.dropped++;

    logger.warn(
      `🚫 백프레셔: 이벤트 드롭됨 ${event.name} (큐 크기: ${this.eventQueue.length})`
    );

    // 백프레셔 완화 시도
    setTimeout(() => {
      this.backpressure.isActive = false;
    }, 1000);

    return null; // 드롭됨을 표시
  }

  /**
   * 📈 평균 처리 시간 업데이트
   */
  updateAvgProcessingTime(newTime) {
    if (this.stats.avgProcessingTime === 0) {
      this.stats.avgProcessingTime = newTime;
    } else {
      // 이동 평균 (가중치 0.1)
      this.stats.avgProcessingTime =
        this.stats.avgProcessingTime * 0.9 + newTime * 0.1;
    }
  }

  // 🎯 EventBus 정리 및 종료
  async shutdown() {
    logger.info("🚇 EventBus 종료 시작...");

    this.isShuttingDown = true;

    // 배치 프로세서 중지
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }

    // 큐 비우기 (처리 안 된 이벤트들 처리)
    logger.info(
      `🔄 미처리 이벤트 처리 중... (${this.eventQueue.length + this.priorityQueue.length + this.batchQueue.length}개)`
    );

    while (this.eventQueue.length > 0 || this.priorityQueue.length > 0) {
      await this.processQueues();
    }

    // 모든 리스너 제거
    this.removeAllListeners();

    // 큐들 정리
    this.eventQueue.length = 0;
    this.priorityQueue.length = 0;
    this.batchQueue.length = 0;

    // 통계 초기화
    this.stats.emitted.clear();
    this.stats.handled.clear();
    this.stats.errors.clear();

    logger.success("✅ EventBus 종료 완료");
  }
}

// 🎯 싱글톤 인스턴스 제공
let globalEventBus = null;

EventBus.getInstance = function () {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
    logger.info("🚇 GlobalEventBus 인스턴스 생성");
  }
  return globalEventBus;
};

EventBus.resetInstance = function () {
  if (globalEventBus) {
    globalEventBus.shutdown();
    globalEventBus = null;
    logger.info("🔄 GlobalEventBus 인스턴스 리셋");
  }
};

module.exports = EventBus;
