// src/utils/HealthChecker.js - v4.0.2 ES Lint 준수 및 아키텍처 개선
const TimeHelper = require("./TimeHelper");
const logger = require("./Logger");

/**
 * 🏥 HealthChecker v4.0.2 - ES Lint 준수 및 아키텍처 개선
 *
 * 🎯 주요 개선사항:
 * 1. CircularBuffer 누락 문제 해결
 * 2. ES Lint 규칙 준수 (no-unused-vars, 명확한 변수 스코프)
 * 3. SRP 원칙 적용 (메서드 책임 분리)
 * 4. 에러 처리 강화
 * 5. 메모리 효율성 개선
 */

/**
 * 🔄 간단한 원형 버퍼 구현 (메모리 효율성)
 */
class CircularBuffer {
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.data = [];
    this.currentIndex = 0;
    this.isFull = false;
  }

  push(item) {
    this.data[this.currentIndex] = item;
    this.currentIndex = (this.currentIndex + 1) % this.maxSize;

    if (this.currentIndex === 0) {
      this.isFull = true;
    }
  }

  getAverage() {
    const validData = this.isFull
      ? this.data
      : this.data.slice(0, this.currentIndex);
    if (validData.length === 0) return 0;

    return Math.round(
      validData.reduce((sum, value) => sum + value, 0) / validData.length
    );
  }

  clear() {
    this.data = [];
    this.currentIndex = 0;
    this.isFull = false;
  }

  get length() {
    return this.isFull ? this.maxSize : this.currentIndex;
  }
}

/**
 * 🏥 HealthChecker 메인 클래스
 */
class HealthChecker {
  constructor(options = {}) {
    // ⚙️ 설정 초기화 (SRP: 설정 관리만)
    this.config = this.initializeConfig(options);

    // 🔧 컴포넌트 관리 (SRP: 컴포넌트 등록/관리만)
    this.components = new Map();
    this.componentStatus = new Map();
    this.initializeComponents(options.components);

    // 📊 상태 관리 (SRP: 전체 상태만)
    this.overallStatus = this.createInitialStatus();

    // ⏰ 스케줄러 관리 (SRP: 타이밍 제어만)
    this.normalInterval = null;
    this.criticalInterval = null;
    this.isRunning = false;

    // 📈 메트릭 관리 (SRP: 성능 지표만)
    this.metrics = this.initializeMetrics();

    // 🚨 알림 관리 (SRP: 알림 처리만)
    this.alertHistory = new Map();
    this.recoveryAttempts = new Map();

    logger.info("🏥 HealthChecker v4.0.2 초기화됨 (ES Lint 준수 버전)");
  }

  /**
   * 🎯 설정 초기화 (SRP 적용)
   */
  initializeConfig(options) {
    return {
      normalCheckInterval: options.checkInterval || 60000,
      criticalCheckInterval: 30000,
      alertCooldown: options.alertCooldown || 300000,
      recoveryDelay: options.recoveryDelay || 5000,
      maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
      maxMetricsHistory: options.maxMetricsHistory || 50,
      maxAlertHistory: options.maxAlertHistory || 25,
      ...options
    };
  }

  /**
   * 🔧 컴포넌트 초기화 (SRP 적용)
   */
  initializeComponents(componentsOption) {
    if (!componentsOption) return;

    try {
      for (const [name, componentRef] of Object.entries(componentsOption)) {
        this.registerComponentInternal(name, componentRef);
      }
      logger.debug(`📦 ${this.components.size}개 컴포넌트 초기 등록 완료`);
    } catch (error) {
      logger.error("❌ 컴포넌트 초기화 실패:", error);
    }
  }

  /**
   * 📊 초기 상태 생성 (SRP 적용)
   */
  createInitialStatus() {
    return {
      health: "unknown",
      lastCheck: null,
      issues: [],
      alerts: []
    };
  }

  /**
   * 📈 메트릭 초기화 (메모리 효율적인 CircularBuffer 사용)
   */
  initializeMetrics() {
    return {
      checkDuration: new CircularBuffer(this.config.maxMetricsHistory),
      memoryUsage: new CircularBuffer(this.config.maxMetricsHistory),
      responseTime: new CircularBuffer(this.config.maxMetricsHistory),
      errorCounts: new Map()
    };
  }

  /**
   * 🔧 컴포넌트 등록 (개선된 버전, ES Lint 준수)
   */
  registerComponent(name, componentRef, options = {}) {
    try {
      this.registerComponentInternal(name, componentRef, options);
      logger.debug(`🔧 컴포넌트 등록됨: ${name}`);
    } catch (error) {
      logger.error(`❌ 컴포넌트 등록 실패 (${name}):`, error);
    }
  }

  /**
   * 🔧 내부 컴포넌트 등록 로직 (SRP 적용)
   */
  registerComponentInternal(name, componentRef, options = {}) {
    const componentType =
      typeof componentRef === "function" ? "function" : "direct";

    this.components.set(name, {
      type: componentType,
      reference: componentRef,
      registered: true,
      lastCheck: null,
      status: "unknown",
      required: options.required !== false,
      ...options
    });
  }

  /**
   * 🎯 헬스체커 시작 (명확한 에러 처리)
   */
  async start() {
    if (this.isRunning) {
      logger.warn("⚠️ HealthChecker 이미 실행 중");
      return false;
    }

    try {
      logger.info("🏥 HealthChecker v4.0.2 시작...");

      // 초기 상태 체크
      await this.performFullHealthCheck();

      // 스케줄러 시작
      this.startSchedulers();

      this.isRunning = true;
      logger.success("✅ HealthChecker v4.0.2 실행됨");
      return true;
    } catch (error) {
      logger.error("❌ HealthChecker 시작 실패:", error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * ⏰ 스케줄러 시작 (SRP 적용)
   */
  startSchedulers() {
    this.startNormalScheduler();

    // 현재 상태가 크리티컬이면 크리티컬 스케줄러도 시작
    if (this.overallStatus.health === "critical") {
      this.startCriticalScheduler();
    }
  }

  /**
   * 🏥 전체 헬스체크 수행 (ES Lint 준수)
   */
  async performFullHealthCheck() {
    const checkStart = Date.now();
    const timestamp = TimeHelper.getLogTimeString();

    try {
      logger.debug("🔍 전체 헬스체크 수행 중...");

      // 🎯 각 컴포넌트 체크 수행 (병렬 처리로 성능 개선)
      const healthChecks = await this.performAllHealthChecks();

      // 📊 전체 상태 계산
      this.calculateOverallStatus(healthChecks, timestamp);

      // 📈 메트릭 업데이트
      const checkDuration = Date.now() - checkStart;
      this.updateMetrics(checkDuration);

      // 🚨 상태별 대응
      await this.handleHealthStatus();

      logger.debug(`✅ 헬스체크 완료 (${checkDuration}ms)`);
    } catch (error) {
      logger.error("❌ 전체 헬스체크 실패:", error);
      this.handleHealthCheckError(error, timestamp);
    }
  }

  /**
   * 🔍 모든 헬스체크 수행 (병렬 처리)
   */
  async performAllHealthChecks() {
    const healthCheckPromises = [
      this.checkBotController(),
      this.checkModuleManager(),
      this.checkDatabaseManager(),
      this.checkTodoService(),
      this.checkSystemResources()
    ];

    // 병렬 실행으로 성능 개선
    return await Promise.allSettled(healthCheckPromises);
  }

  /**
   * 🎮 BotController 상태 체크 (개선된 버전)
   */
  async checkBotController() {
    try {
      const component = this.getComponentReference("botController");
      if (!component) {
        return this.createHealthResult("warning", "BotController 참조 없음");
      }

      // 실제 상태 체크 로직
      const isHealthy = await this.checkComponentHealth(
        component,
        "botController"
      );

      return isHealthy
        ? this.createHealthResult("healthy", "정상 작동 중")
        : this.createHealthResult("warning", "응답 지연 감지");
    } catch (error) {
      logger.error("❌ BotController 상태 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 🔧 컴포넌트 참조 가져오기 (안전한 방식)
   */
  getComponentReference(componentName) {
    const component = this.components.get(componentName);
    if (!component) return null;

    try {
      if (component.type === "function") {
        return component.reference();
      }
      return component.reference;
    } catch (error) {
      logger.warn(`⚠️ 컴포넌트 참조 실패 (${componentName}):`, error.message);
      return null;
    }
  }

  /**
   * 🔍 컴포넌트 헬스 체크 (공통 로직)
   */
  async checkComponentHealth(component, componentName) {
    if (!component) return false;

    try {
      // checkHealth 메서드가 있는 경우 사용
      if (typeof component.checkHealth === "function") {
        const result = await component.checkHealth();
        return result === true || (result && result.healthy === true);
      }

      // 기본 존재 여부 체크
      return component !== null && component !== undefined;
    } catch (error) {
      logger.warn(`⚠️ ${componentName} 헬스체크 오류:`, error.message);
      return false;
    }
  }

  /**
   * 📊 헬스 결과 생성 (일관된 구조)
   */
  createHealthResult(severity, message, data = {}) {
    return {
      severity,
      message,
      data,
      timestamp: TimeHelper.getLogTimeString()
    };
  }

  /**
   * 📊 전체 상태 계산 (ES Lint 준수)
   */
  calculateOverallStatus(healthCheckResults, timestamp) {
    try {
      const resolvedResults =
        this.resolveHealthCheckResults(healthCheckResults);
      const { overallHealth, issues } =
        this.analyzeHealthResults(resolvedResults);

      // 상태 업데이트
      this.updateOverallStatus(overallHealth, timestamp, issues);
      this.updateComponentStatuses(resolvedResults);
    } catch (error) {
      logger.error("❌ 전체 상태 계산 실패:", error);
      this.setErrorState(timestamp, error);
    }
  }

  /**
   * 🔍 헬스체크 결과 해석 (Promise.allSettled 결과 처리)
   */
  resolveHealthCheckResults(healthCheckResults) {
    return healthCheckResults.map((result, index) => {
      const componentNames = [
        "botController",
        "moduleManager",
        "database",
        "todoService",
        "system"
      ];
      const componentName = componentNames[index] || `component_${index}`;

      if (result.status === "fulfilled") {
        return { ...result.value, componentName };
      } else {
        logger.warn(`⚠️ ${componentName} 헬스체크 실패:`, result.reason);
        return this.createHealthResult(
          "error",
          `${componentName} 체크 실패: ${result.reason?.message || "알 수 없는 오류"}`,
          { componentName }
        );
      }
    });
  }

  /**
   * 📈 메트릭 업데이트 (CircularBuffer 활용)
   */
  updateMetrics(checkDuration) {
    try {
      // 체크 시간 기록
      this.metrics.checkDuration.push(checkDuration);

      // 메모리 사용량 기록
      const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      this.metrics.memoryUsage.push(memUsage);

      // 에러 카운트 업데이트 (필요시)
      this.updateErrorCounts();
    } catch (error) {
      logger.warn("⚠️ 메트릭 업데이트 실패:", error.message);
    }
  }

  /**
   * 📊 상태 요약 조회 (개선된 버전)
   */
  getHealthSummary() {
    try {
      return {
        overall: this.overallStatus,
        components: this.getComponentStatuses(),
        metrics: this.getMetricsSummary(),
        config: this.getSafeConfig(),
        isRunning: this.isRunning,
        timestamp: TimeHelper.getLogTimeString()
      };
    } catch (error) {
      logger.error("❌ 헬스 요약 생성 실패:", error);
      return this.getEmergencyHealthSummary();
    }
  }

  /**
   * 📊 컴포넌트 상태 조회 (안전한 방식)
   */
  getComponentStatuses() {
    const statuses = {};
    for (const [name, status] of this.componentStatus.entries()) {
      statuses[name] = status;
    }
    return statuses;
  }

  /**
   * 📈 메트릭 요약 (CircularBuffer 활용)
   */
  getMetricsSummary() {
    return {
      avgCheckDuration: this.metrics.checkDuration.getAverage(),
      avgMemoryUsage: this.metrics.memoryUsage.getAverage(),
      currentMemoryUsage: Math.round(
        process.memoryUsage().heapUsed / 1024 / 1024
      ),
      checkCount: this.metrics.checkDuration.length,
      memoryCount: this.metrics.memoryUsage.length
    };
  }

  /**
   * 🛑 헬스체커 정지 (안전한 정리)
   */
  async stop() {
    try {
      logger.info("🛑 HealthChecker 정지 중...");

      this.isRunning = false;
      this.stopAllSchedulers();

      logger.success("✅ HealthChecker 정지 완료");
      return true;
    } catch (error) {
      logger.error("❌ HealthChecker 정지 실패:", error);
      return false;
    }
  }

  /**
   * ⏰ 모든 스케줄러 정지 (SRP 적용)
   */
  stopAllSchedulers() {
    if (this.normalInterval) {
      clearInterval(this.normalInterval);
      this.normalInterval = null;
    }

    if (this.criticalInterval) {
      clearInterval(this.criticalInterval);
      this.criticalInterval = null;
    }

    logger.debug("⏰ 모든 스케줄러 정지됨");
  }

  /**
   * 🧹 정리 작업 (메모리 누수 방지)
   */
  async cleanup() {
    try {
      logger.info("🧹 HealthChecker 정리 시작...");

      await this.stop();

      // 메트릭 정리
      this.metrics.checkDuration.clear();
      this.metrics.memoryUsage.clear();
      this.metrics.responseTime.clear();
      this.metrics.errorCounts.clear();

      // 기타 정리
      this.alertHistory.clear();
      this.recoveryAttempts.clear();
      this.componentStatus.clear();
      this.components.clear();

      logger.info("✅ HealthChecker 정리 완료");
      return true;
    } catch (error) {
      logger.error("❌ HealthChecker 정리 실패:", error);
      return false;
    }
  }

  // 🎯 나머지 메서드들은 기존 로직 유지하되 ES Lint 규칙 준수
  // (checkModuleManager, checkDatabaseManager, etc...)

  /**
   * 🎛️ ModuleManager 상태 체크 (예시)
   */
  async checkModuleManager() {
    try {
      const component = this.getComponentReference("moduleManager");
      if (!component) {
        return this.createHealthResult("warning", "ModuleManager 참조 없음");
      }

      const isHealthy = await this.checkComponentHealth(
        component,
        "moduleManager"
      );

      return isHealthy
        ? this.createHealthResult("healthy", "정상 작동 중")
        : this.createHealthResult("warning", "일부 모듈 문제 감지");
    } catch (error) {
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  // ... (다른 체크 메서드들도 동일한 패턴으로 구현)
}

module.exports = HealthChecker;
