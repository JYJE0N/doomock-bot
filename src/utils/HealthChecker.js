// src/utils/HealthChecker.js - v3.0.1 수정된 버전
const TimeHelper = require("./TimeHelper");
const logger = require("./Logger");

/**
 * 🏥 HealthChecker v3.0.1 - 수정된 컴포넌트 등록 시스템
 *
 * 🔧 주요 수정사항:
 * - 컴포넌트 등록을 function이 아닌 직접 참조로 변경
 * - 지연 체크 지원 (컴포넌트가 나중에 등록되는 경우)
 * - 더 안전한 null 체크
 * - 초기화 시점 문제 해결
 */
class HealthChecker {
  constructor(options = {}) {
    // ⚙️ 설정
    this.config = {
      normalCheckInterval: options.checkInterval || 60000,
      criticalCheckInterval: 30000,
      alertCooldown: options.alertCooldown || 300000,
      recoveryDelay: options.recoveryDelay || 5000,
      maxRecoveryAttempts: options.maxRecoveryAttempts || 3,
      ...options,
    };

    // 🔧 컴포넌트 등록 시스템 수정
    this.components = new Map();

    // 초기 컴포넌트 등록 (options.components가 있는 경우)
    if (options.components) {
      for (const [name, componentRef] of Object.entries(options.components)) {
        // 함수인 경우와 직접 참조인 경우 모두 지원
        this.components.set(name, {
          type: typeof componentRef === "function" ? "function" : "direct",
          reference: componentRef,
          registered: false,
          lastCheck: null,
          status: "unknown",
        });
      }
    }

    // 📊 전체 상태
    this.overallStatus = {
      health: "unknown",
      lastCheck: null,
      issues: [],
      alerts: [],
    };

    // 🔧 개별 컴포넌트 상태
    this.componentStatus = new Map();

    // ⏰ 체크 스케줄러
    this.normalInterval = null;
    this.criticalInterval = null;
    this.isRunning = false;

    // 📈 성능 메트릭
    this.metrics = {
      checkDuration: [],
      memoryUsage: [],
      responseTime: [],
      errorCounts: new Map(),
    };

    // 🚨 알림 관리
    this.alertHistory = new Map();
    this.recoveryAttempts = new Map();

    logger.info("🏥 HealthChecker v3.0.1 초기화됨 (수정된 등록 시스템)");
  }

  /**
   * 🔧 컴포넌트 등록 (개선된 버전)
   */
  registerComponent(name, componentRef, options = {}) {
    try {
      this.components.set(name, {
        type: typeof componentRef === "function" ? "function" : "direct",
        reference: componentRef,
        registered: true,
        lastCheck: null,
        status: "unknown",
        required: options.required !== false,
        ...options,
      });

      logger.debug(
        `🔧 컴포넌트 등록됨: ${name} (타입: ${
          typeof componentRef === "function" ? "function" : "direct"
        })`
      );
    } catch (error) {
      logger.error(`❌ 컴포넌트 등록 실패: ${name}`, error);
    }
  }

  /**
   * 🔧 컴포넌트 직접 설정 (주 애플리케이션에서 사용)
   */
  setComponents(components) {
    for (const [name, component] of Object.entries(components)) {
      if (component !== null && component !== undefined) {
        this.registerComponent(name, component);
      }
    }
  }

  /**
   * 🔍 컴포넌트 실제 인스턴스 가져오기
   */
  getComponent(name) {
    const componentInfo = this.components.get(name);
    if (!componentInfo) {
      return null;
    }

    try {
      if (componentInfo.type === "function") {
        return componentInfo.reference();
      } else {
        return componentInfo.reference;
      }
    } catch (error) {
      logger.debug(`⚠️ 컴포넌트 접근 실패: ${name} - ${error.message}`);
      return null;
    }
  }

  /**
   * 🎯 헬스체커 시작
   */
  async start() {
    if (this.isRunning) {
      logger.warn("HealthChecker 이미 실행 중");
      return;
    }

    try {
      logger.info("🏥 HealthChecker v3.0.1 시작...");

      // 초기 상태 체크
      await this.performFullHealthCheck();

      // 정상 주기 스케줄러 시작
      this.startNormalScheduler();

      // 상태에 따라 크리티컬 스케줄러도 시작
      if (this.overallStatus.health === "critical") {
        this.startCriticalScheduler();
      }

      this.isRunning = true;
      logger.success("✅ HealthChecker v3.0.1 실행됨");
    } catch (error) {
      logger.error("❌ HealthChecker 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 🏥 전체 헬스체크 수행
   */
  async performFullHealthCheck() {
    const checkStart = Date.now();
    const timestamp = TimeHelper.getLogTimeString();

    try {
      logger.debug("🔍 전체 헬스체크 수행 중...");

      // 🎮 BotController 상태 체크
      const botHealth = await this.checkBotController();

      // 🎛️ ModuleManager 상태 체크
      const moduleHealth = await this.checkModuleManager();

      // 🗄️ DatabaseManager 상태 체크
      const dbHealth = await this.checkDatabaseManager();

      // 🔧 TodoService 상태 체크
      const todoHealth = await this.checkTodoService();

      // 🖥️ 시스템 리소스 체크
      const systemHealth = await this.checkSystemResources();

      // 📊 결과 통합 및 분석
      const allChecks = [
        botHealth,
        moduleHealth,
        dbHealth,
        todoHealth,
        systemHealth,
      ];

      // 전체 상태 계산
      this.calculateOverallStatus(allChecks, timestamp);

      // 성능 메트릭 업데이트
      const checkDuration = Date.now() - checkStart;
      this.updateMetrics(checkDuration);

      // 상태별 대응
      await this.handleHealthStatus();

      logger.debug(
        `🔍 헬스체크 완료 (${checkDuration}ms) - 상태: ${this.overallStatus.health}`
      );
    } catch (error) {
      logger.error("❌ 헬스체크 수행 실패:", error);
      this.overallStatus = {
        health: "error",
        lastCheck: timestamp,
        issues: [`헬스체크 수행 실패: ${error.message}`],
        alerts: this.overallStatus.alerts || [],
      };
    }
  }

  /**
   * 🎮 BotController 상태 체크 (수정된 버전)
   */
  async checkBotController() {
    try {
      const botController = this.getComponent("botController");

      if (!botController) {
        return this.createHealthResult(
          "warning",
          "BotController가 등록되지 않음"
        );
      }

      const issues = [];
      let severity = "healthy";

      // Bot 인스턴스 확인
      if (!botController.bot) {
        issues.push("Bot 인스턴스가 없음");
        severity = "critical";
      }

      // 초기화 상태 확인
      if (botController.initialized === false) {
        issues.push("BotController가 초기화되지 않음");
        severity = severity === "critical" ? "critical" : "warning";
      }

      // 통계 확인 (있는 경우)
      if (botController.stats) {
        const { messagesHandled = 0, errorsCount = 0 } = botController.stats;

        if (messagesHandled > 0) {
          const errorRate = errorsCount / messagesHandled;
          if (errorRate > 0.1) {
            issues.push(`높은 에러율: ${Math.round(errorRate * 100)}%`);
            severity = errorRate > 0.25 ? "critical" : "warning";
          }
        }
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        initialized: botController.initialized,
        hasBot: !!botController.bot,
        stats: botController.stats || {},
      });
    } catch (error) {
      logger.error("❌ BotController 상태 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 🎛️ ModuleManager 상태 체크 (수정된 버전)
   */
  async checkModuleManager() {
    try {
      const moduleManager = this.getComponent("moduleManager");

      if (!moduleManager) {
        return this.createHealthResult(
          "warning",
          "ModuleManager가 등록되지 않음"
        );
      }

      const issues = [];
      let severity = "healthy";

      // ✅ 수정: 더 정확한 초기화 상태 확인
      const isFullyInitialized = moduleManager.isFullyInitialized
        ? moduleManager.isFullyInitialized()
        : moduleManager.initialized;

      if (!isFullyInitialized) {
        issues.push("ModuleManager가 완전히 초기화되지 않음");
        severity = "warning";
      }

      // 등록된 모듈 수 확인
      const moduleCount = moduleManager.moduleInstances?.size || 0;
      if (moduleCount === 0) {
        issues.push("등록된 모듈이 없음");
        severity = "critical";
      }

      // ✅ 추가: 실패한 모듈 확인
      if (moduleManager.stats && moduleManager.stats.failedModules > 0) {
        issues.push(`${moduleManager.stats.failedModules}개 모듈 로드 실패`);
        severity = severity === "critical" ? "critical" : "warning";
      }

      // ✅ 추가: 모듈 상세 정보 확인
      let moduleDetails = {};
      if (moduleManager.getModuleInitializationDetails) {
        moduleDetails = moduleManager.getModuleInitializationDetails();

        // 초기화되지 않은 모듈 찾기
        const uninitializedModules = Object.entries(moduleDetails)
          .filter(
            ([key, detail]) =>
              !detail.configInitialized || !detail.instanceInitialized
          )
          .map(([key]) => key);

        if (uninitializedModules.length > 0) {
          issues.push(
            `초기화되지 않은 모듈: ${uninitializedModules.join(", ")}`
          );
          severity = severity === "critical" ? "critical" : "warning";
        }
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        initialized: isFullyInitialized,
        moduleCount: moduleCount,
        stats: moduleManager.stats || {},
        moduleDetails: moduleDetails,
      });
    } catch (error) {
      logger.error("❌ ModuleManager 상태 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 🗄️ DatabaseManager 상태 체크 (수정된 버전)
   */
  async checkDatabaseManager() {
    try {
      const dbManager = this.getComponent("database");

      if (!dbManager) {
        return this.createHealthResult(
          "warning",
          "DatabaseManager가 등록되지 않음"
        );
      }

      const issues = [];
      let severity = "healthy";

      // ✅ 수정: isConnected는 속성이므로 함수 호출 제거
      if (!dbManager.isConnected) {
        issues.push("데이터베이스 연결 끊김");
        severity = "critical";
      }

      // DB 인스턴스 확인
      if (!dbManager.db) {
        issues.push("DB 인스턴스 없음");
        severity = "critical";
      }

      // ✅ 추가: 실제 연결 상태 핑 테스트
      try {
        const pingResult = await dbManager.checkConnection();
        if (!pingResult) {
          issues.push("DB 핑 테스트 실패");
          severity = "critical";
        }
      } catch (pingError) {
        issues.push(`DB 연결 테스트 실패: ${pingError.message}`);
        severity = "critical";
      }

      // DB 상태 정보 가져오기
      const dbStatus = dbManager.getStatus();

      // 연결 시도 횟수가 많으면 경고
      if (dbStatus.connectionAttempts > 1) {
        issues.push(`DB 재연결 시도: ${dbStatus.connectionAttempts}회`);
        severity = severity === "healthy" ? "warning" : severity;
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        connected: dbManager.isConnected,
        database: dbStatus.database,
        railway: dbStatus.railway,
        connectionAttempts: dbStatus.connectionAttempts,
        hasMongoUrl: dbStatus.mongoUrl === "SET",
      });
    } catch (error) {
      logger.error("❌ DatabaseManager 상태 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 🔧 TodoService 상태 체크 (수정된 버전)
   */
  async checkTodoService() {
    try {
      // ✅ 수정: ModuleManager를 통해 TodoService 찾기
      const moduleManager = this.getComponent("moduleManager");
      let todoService = this.getComponent("todoService");

      // 직접 등록된 TodoService가 없으면 ModuleManager에서 찾기
      if (!todoService && moduleManager && moduleManager.findService) {
        todoService = moduleManager.findService("TodoService");
      }

      // 그래도 없으면 ModuleManager를 통해 직접 찾기
      if (!todoService && moduleManager && moduleManager.moduleInstances) {
        const todoModule = moduleManager.moduleInstances.get("TodoModule");
        if (todoModule && todoModule.todoService) {
          todoService = todoModule.todoService;
        }
      }

      if (!todoService) {
        return this.createHealthResult(
          "warning",
          "TodoService가 등록되지 않음"
        );
      }

      const issues = [];
      let severity = "healthy";

      // 초기화 상태 확인
      if (todoService.initialized === false) {
        issues.push("TodoService가 초기화되지 않음");
        severity = "warning";
      }

      // DB 컬렉션 확인
      if (!todoService.collection) {
        issues.push("TodoService 컬렉션이 연결되지 않음");
        severity = "critical";
      }

      // 캐시 상태 확인 (있는 경우)
      if (todoService.cache && todoService.cache.size > 1000) {
        issues.push(`큰 캐시 크기: ${todoService.cache.size}개`);
        severity = severity === "critical" ? "critical" : "warning";
      }

      // 헬스체크 실행 (메서드가 있는 경우)
      if (typeof todoService.healthCheck === "function") {
        try {
          const healthResult = await todoService.healthCheck();
          if (!healthResult.healthy) {
            issues.push(`서비스 헬스체크 실패: ${healthResult.message}`);
            severity = "critical";
          }
        } catch (healthError) {
          issues.push(`헬스체크 실행 실패: ${healthError.message}`);
          severity = "warning";
        }
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        initialized: todoService.initialized !== false,
        hasCollection: !!todoService.collection,
        cacheSize: todoService.cache?.size || 0,
        stats: todoService.stats || {},
      });
    } catch (error) {
      logger.error("❌ TodoService 상태 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 🖥️ 시스템 리소스 체크
   */
  async checkSystemResources() {
    try {
      const memUsage = process.memoryUsage();
      const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const uptime = Math.round(process.uptime());

      const issues = [];
      let severity = "healthy";

      // Railway 환경별 메모리 임계값
      const memoryThreshold = process.env.RAILWAY_ENVIRONMENT ? 450 : 1000;

      // 메모리 사용량 체크
      if (memUsedMB > memoryThreshold) {
        issues.push(`높은 메모리 사용량: ${memUsedMB}MB`);
        severity = memUsedMB > memoryThreshold * 1.2 ? "critical" : "warning";
      }

      // 업타임 체크 (너무 자주 재시작되는지)
      if (uptime < 60) {
        issues.push(`짧은 업타임: ${uptime}초`);
        severity = severity === "critical" ? "critical" : "warning";
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        memoryUsed: memUsedMB,
        memoryTotal: memTotalMB,
        uptime: uptime,
        platform: process.platform,
        nodeVersion: process.version,
      });
    } catch (error) {
      logger.error("❌ 시스템 리소스 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 📊 헬스 결과 생성 (헬퍼 메서드)
   */
  createHealthResult(severity, message, data = {}) {
    return {
      severity,
      message,
      data,
      timestamp: TimeHelper.getLogTimeString(),
    };
  }

  /**
   * 📊 전체 상태 계산
   */
  calculateOverallStatus(allChecks, timestamp) {
    const severities = allChecks.map((check) => check.severity);
    const issues = allChecks
      .filter((check) => check.severity !== "healthy")
      .map((check) => check.message);

    // 가장 심각한 상태 결정
    let overallHealth = "healthy";
    if (severities.includes("error") || severities.includes("critical")) {
      overallHealth = "critical";
    } else if (severities.includes("warning")) {
      overallHealth = "warning";
    }

    // 상태 업데이트
    this.overallStatus = {
      health: overallHealth,
      lastCheck: timestamp,
      issues: issues,
      alerts: this.overallStatus.alerts || [],
    };

    // 컴포넌트별 상태 저장
    const componentNames = [
      "botController",
      "moduleManager",
      "database",
      "todoService",
      "system",
    ];

    allChecks.forEach((check, index) => {
      if (componentNames[index]) {
        this.componentStatus.set(componentNames[index], check);
      }
    });
  }

  /**
   * 📈 성능 메트릭 업데이트
   */
  updateMetrics(checkDuration) {
    // 체크 시간 기록
    this.metrics.checkDuration.push(checkDuration);
    if (this.metrics.checkDuration.length > 100) {
      this.metrics.checkDuration = this.metrics.checkDuration.slice(-50);
    }

    // 메모리 사용량 기록
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    this.metrics.memoryUsage.push(memUsage);
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-50);
    }
  }

  /**
   * 🚨 상태별 대응
   */
  async handleHealthStatus() {
    const { health, issues } = this.overallStatus;

    if (health === "critical" || health === "error") {
      // 크리티컬 상황 대응
      this.startCriticalScheduler();
      await this.sendHealthAlert(health, issues);

      // 자동 복구 시도
      if (this.shouldAttemptRecovery(health)) {
        await this.attemptAutoRecovery(health, issues);
      }
    } else if (health === "warning") {
      // 경고 상황 대응
      await this.sendHealthAlert(health, issues);
    } else {
      // 정상 상황 - 크리티컬 스케줄러 정지
      this.stopCriticalScheduler();
    }
  }

  /**
   * 🔄 자동 복구 시도 여부 결정
   */
  shouldAttemptRecovery(health) {
    const recoveryKey = `${health}_recovery`;
    const attempts = this.recoveryAttempts.get(recoveryKey) || 0;

    return attempts < this.config.maxRecoveryAttempts;
  }

  /**
   * 🔄 자동 복구 시도
   */
  async attemptAutoRecovery(health, issues) {
    const recoveryKey = `${health}_recovery`;
    const attempts = this.recoveryAttempts.get(recoveryKey) || 0;

    try {
      logger.info(
        `🔄 자동 복구 시도 중... (${attempts + 1}/${
          this.config.maxRecoveryAttempts
        })`
      );

      // 캐시 정리
      if (this.getComponent("todoService")?.cache) {
        this.getComponent("todoService").cache.clear();
        this.getComponent("todoService").cacheTimestamps?.clear();
        logger.debug("🧹 TodoService 캐시 정리됨");
      }

      // 연결 상태 복구 시도
      const dbManager = this.getComponent("database");
      if (dbManager && (!dbManager.isConnected || !dbManager.isConnected())) {
        if (dbManager.reconnect) {
          await dbManager.reconnect();
          logger.debug("🔗 데이터베이스 재연결 시도됨");
        }
      }

      this.recoveryAttempts.set(recoveryKey, attempts + 1);

      // 복구 지연
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.recoveryDelay)
      );

      logger.info("✅ 자동 복구 시도 완료");
    } catch (error) {
      logger.error("❌ 자동 복구 실패:", error);
      this.recoveryAttempts.set(recoveryKey, attempts + 1);
    }
  }

  /**
   * 🚨 건강 알림 전송
   */
  async sendHealthAlert(status, issues) {
    const alertKey = `${status}_${issues.join(",")}`;
    const lastAlert = this.alertHistory.get(alertKey);
    const now = Date.now();

    // 쿨다운 체크
    if (lastAlert && now - lastAlert < this.config.alertCooldown) {
      return;
    }

    try {
      const emoji = status === "critical" ? "🚨" : "⚠️";
      const alertMessage = `${emoji} 헬스체크 알림\n상태: ${status}\n문제: ${issues.join(
        ", "
      )}\n시간: ${TimeHelper.getLogTimeString()}`;

      logger.warn(alertMessage);

      // 여기에 실제 알림 전송 로직 추가 가능 (텔레그램, 슬랙 등)

      this.alertHistory.set(alertKey, now);
      this.overallStatus.alerts.push({
        status,
        issues,
        timestamp: TimeHelper.getLogTimeString(),
      });

      // 알림 히스토리 크기 제한
      if (this.overallStatus.alerts.length > 50) {
        this.overallStatus.alerts = this.overallStatus.alerts.slice(-25);
      }
    } catch (error) {
      logger.error("❌ 건강 알림 전송 실패:", error);
    }
  }

  /**
   * ⏰ 정상 스케줄러 시작
   */
  startNormalScheduler() {
    if (this.normalInterval) {
      clearInterval(this.normalInterval);
    }

    this.normalInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.performFullHealthCheck();
      }
    }, this.config.normalCheckInterval);

    logger.debug(
      `⏰ 정상 헬스체크 스케줄러 시작됨 (${this.config.normalCheckInterval}ms)`
    );
  }

  /**
   * 🚨 크리티컬 스케줄러 시작
   */
  startCriticalScheduler() {
    if (this.criticalInterval) {
      return; // 이미 실행 중
    }

    this.criticalInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.performFullHealthCheck();
      }
    }, this.config.criticalCheckInterval);

    logger.debug(
      `🚨 크리티컬 헬스체크 스케줄러 시작됨 (${this.config.criticalCheckInterval}ms)`
    );
  }

  /**
   * 🚨 크리티컬 스케줄러 정지
   */
  stopCriticalScheduler() {
    if (this.criticalInterval) {
      clearInterval(this.criticalInterval);
      this.criticalInterval = null;
      logger.debug("🚨 크리티컬 헬스체크 스케줄러 정지됨");
    }
  }

  /**
   * 🛑 헬스체커 정지
   */
  async stop() {
    try {
      logger.info("🛑 HealthChecker 정지 중...");

      this.isRunning = false;

      // 스케줄러 정리
      if (this.normalInterval) {
        clearInterval(this.normalInterval);
        this.normalInterval = null;
      }

      this.stopCriticalScheduler();

      logger.success("✅ HealthChecker 정지 완료");
    } catch (error) {
      logger.error("❌ HealthChecker 정지 실패:", error);
    }
  }

  /**
   * 📊 상태 요약 조회
   */
  getHealthSummary() {
    return {
      overall: this.overallStatus,
      components: Object.fromEntries(this.componentStatus),
      metrics: {
        avgCheckDuration:
          this.metrics.checkDuration.length > 0
            ? Math.round(
                this.metrics.checkDuration.reduce((a, b) => a + b, 0) /
                  this.metrics.checkDuration.length
              )
            : 0,
        avgMemoryUsage:
          this.metrics.memoryUsage.length > 0
            ? Math.round(
                this.metrics.memoryUsage.reduce((a, b) => a + b, 0) /
                  this.metrics.memoryUsage.length
              )
            : 0,
        currentMemoryUsage: Math.round(
          process.memoryUsage().heapUsed / 1024 / 1024
        ),
      },
      config: this.config,
      isRunning: this.isRunning,
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 HealthChecker 정리 시작...");

      await this.stop();

      // 메트릭 정리
      this.metrics.checkDuration.length = 0;
      this.metrics.memoryUsage.length = 0;
      this.metrics.responseTime.length = 0;
      this.metrics.errorCounts.clear();

      // 알림 히스토리 정리
      this.alertHistory.clear();
      this.recoveryAttempts.clear();
      this.componentStatus.clear();
      this.components.clear();

      logger.info("✅ HealthChecker 정리 완료");
    } catch (error) {
      logger.error("❌ HealthChecker 정리 실패:", error);
    }
  }
}

module.exports = HealthChecker;
