// src/utils/HealthChecker.js - v3.0.1 완전 통합 시스템
const logger = require("./Logger");
const TimeHelper = require("./TimeHelper");

/**
 * 🏥 헬스체커 v3.0.1 - 중앙 집중식 건강 관리 시스템
 *
 * 🎯 핵심 기능:
 * - 모든 컴포넌트의 건강 상태 중앙 관리
 * - 실시간 모니터링 및 자동 복구
 * - Railway 환경 최적화
 * - 메모리 누수 방지
 * - 성능 병목 지점 감지
 *
 * 📊 모니터링 대상:
 * - BotController (봇 응답성, 에러율)
 * - ModuleManager (모듈 상태, 로딩 상태)
 * - TodoService (DB 연결, 쿼리 성능)
 * - 시스템 리소스 (메모리, CPU, 네트워크)
 */
class HealthChecker {
  constructor(options = {}) {
    // 💡 중앙 집중식 구성 - 모든 컴포넌트를 한곳에서 관리
    this.components = {
      botController: options.botController || null,
      moduleManager: options.moduleManager || null,
      dbManager: options.dbManager || null,
      todoService: options.todoService || null,
    };

    // ⚙️ Railway 환경 최적화 설정
    this.config = {
      // 체크 주기 (Railway 리소스 고려)
      normalCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30초
      criticalCheckInterval:
        parseInt(process.env.CRITICAL_CHECK_INTERVAL) || 5000, // 5초

      // 임계값
      memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD) || 400, // 400MB
      responseTimeThreshold:
        parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 3000, // 3초
      errorRateThreshold: parseFloat(process.env.ERROR_RATE_THRESHOLD) || 0.1, // 10%

      // 복구 설정
      autoRecovery: process.env.AUTO_RECOVERY !== "false",
      maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS) || 3,
      recoveryDelay: parseInt(process.env.RECOVERY_DELAY) || 10000, // 10초

      // 알림 설정
      enableAlerts: process.env.ENABLE_HEALTH_ALERTS !== "false",
      alertCooldown: parseInt(process.env.ALERT_COOLDOWN) || 300000, // 5분

      ...options.config,
    };

    // 📊 통합 상태 관리
    this.overallStatus = {
      health: "unknown", // healthy, warning, critical, unknown
      lastCheck: null,
      uptime: Date.now(),
      totalChecks: 0,
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

    logger.info("🏥 HealthChecker v3.0.1 초기화됨");
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
      const overallHealth = this.calculateOverallHealth(allChecks);

      // 상태 업데이트
      this.updateOverallStatus({
        health: overallHealth.status,
        lastCheck: timestamp,
        issues: overallHealth.issues,
        checkDuration: Date.now() - checkStart,
        components: {
          bot: botHealth,
          modules: moduleHealth,
          database: dbHealth,
          todo: todoHealth,
          system: systemHealth,
        },
      });

      // 🚨 문제 감지 시 대응
      if (overallHealth.status !== "healthy") {
        await this.handleHealthIssues(overallHealth);
      }

      // 📈 메트릭 업데이트
      this.updateMetrics(Date.now() - checkStart);

      this.overallStatus.totalChecks++;

      logger.debug(
        `🏥 헬스체크 완료 (${Date.now() - checkStart}ms) - 상태: ${
          overallHealth.status
        }`
      );
    } catch (error) {
      logger.error("❌ 전체 헬스체크 실패:", error);
      await this.handleCheckFailure(error);
    }
  }

  /**
   * 🎮 BotController 상태 체크
   */
  async checkBotController() {
    try {
      if (!this.components.botController) {
        return this.createHealthResult(
          "error",
          "BotController가 등록되지 않음"
        );
      }

      const controller = this.components.botController;
      const issues = [];
      let severity = "healthy";

      // 초기화 상태 확인
      if (!controller.isInitialized || !controller.isRunning) {
        issues.push("봇이 초기화되지 않았거나 실행되지 않음");
        severity = "critical";
      }

      // 통계 데이터 확인
      if (controller.stats) {
        const {
          errorsCount = 0,
          messagesReceived = 0,
          callbacksReceived = 0,
          averageResponseTime = 0,
        } = controller.stats;

        // 에러율 체크
        const totalRequests = messagesReceived + callbacksReceived;
        const errorRate = totalRequests > 0 ? errorsCount / totalRequests : 0;

        if (errorRate > this.config.errorRateThreshold) {
          issues.push(`높은 에러율: ${Math.round(errorRate * 100)}%`);
          severity = errorRate > 0.25 ? "critical" : "warning";
        }

        // 응답 시간 체크
        if (averageResponseTime > this.config.responseTimeThreshold) {
          issues.push(`느린 응답시간: ${averageResponseTime}ms`);
          severity = severity === "critical" ? "critical" : "warning";
        }

        // 처리 중인 요청 수 체크
        const activeRequests =
          (controller.processingMessages?.size || 0) +
          (controller.processingCallbacks?.size || 0);

        if (activeRequests > 50) {
          issues.push(`과도한 대기 요청: ${activeRequests}개`);
          severity = activeRequests > 100 ? "critical" : "warning";
        }
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        initialized: controller.isInitialized,
        running: controller.isRunning,
        stats: controller.stats || {},
      });
    } catch (error) {
      logger.error("❌ BotController 상태 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 🎛️ ModuleManager 상태 체크
   */
  async checkModuleManager() {
    try {
      if (!this.components.moduleManager) {
        return this.createHealthResult(
          "error",
          "ModuleManager가 등록되지 않음"
        );
      }

      const moduleManager = this.components.moduleManager;
      const issues = [];
      let severity = "healthy";

      // 초기화 상태 확인
      if (!moduleManager.isInitialized) {
        issues.push("ModuleManager가 초기화되지 않음");
        severity = "critical";
      }

      // 모듈 상태 확인
      if (moduleManager.stats) {
        const {
          activeModules = 0,
          totalModules = 0,
          failedModules = 0,
        } = moduleManager.stats;

        // 실패한 모듈 체크
        if (failedModules > 0) {
          issues.push(`실패한 모듈: ${failedModules}개`);
          severity = failedModules >= totalModules / 2 ? "critical" : "warning";
        }

        // 활성 모듈 비율 체크
        const activeRatio = totalModules > 0 ? activeModules / totalModules : 0;
        if (activeRatio < 0.8) {
          issues.push(`낮은 모듈 활성화율: ${Math.round(activeRatio * 100)}%`);
          severity = activeRatio < 0.5 ? "critical" : "warning";
        }
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        initialized: moduleManager.isInitialized,
        stats: moduleManager.stats || {},
      });
    } catch (error) {
      logger.error("❌ ModuleManager 상태 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 🗄️ DatabaseManager 상태 체크
   */
  async checkDatabaseManager() {
    try {
      if (!this.components.dbManager) {
        return this.createHealthResult(
          "error",
          "DatabaseManager가 등록되지 않음"
        );
      }

      const dbManager = this.components.dbManager;
      const issues = [];
      let severity = "healthy";

      // 연결 상태 확인
      if (!dbManager.isConnected()) {
        issues.push("데이터베이스 연결 끊어짐");
        severity = "critical";
      } else {
        // 연결 테스트
        try {
          const pingResult = await dbManager.db.admin().ping();
          if (!pingResult.ok) {
            issues.push("데이터베이스 ping 실패");
            severity = "warning";
          }
        } catch (pingError) {
          issues.push(`데이터베이스 ping 오류: ${pingError.message}`);
          severity = "critical";
        }
      }

      // 통계 확인
      if (dbManager.stats) {
        const { connectionPool, operations } = dbManager.stats;

        // 커넥션 풀 상태
        if (connectionPool) {
          const poolUsage =
            connectionPool.active /
            (connectionPool.active + connectionPool.available);
          if (poolUsage > 0.9) {
            issues.push(
              `높은 커넥션 풀 사용률: ${Math.round(poolUsage * 100)}%`
            );
            severity = severity === "critical" ? "critical" : "warning";
          }
        }

        // 오퍼레이션 에러율
        if (operations && operations.total > 0) {
          const errorRate = operations.errors / operations.total;
          if (errorRate > 0.05) {
            issues.push(`높은 DB 에러율: ${Math.round(errorRate * 100)}%`);
            severity = errorRate > 0.15 ? "critical" : "warning";
          }
        }
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        connected: dbManager.isConnected(),
        stats: dbManager.stats || {},
      });
    } catch (error) {
      logger.error("❌ DatabaseManager 상태 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 🔧 TodoService 상태 체크
   */
  async checkTodoService() {
    try {
      if (!this.components.todoService) {
        return this.createHealthResult(
          "warning",
          "TodoService가 등록되지 않음"
        );
      }

      const todoService = this.components.todoService;
      const issues = [];
      let severity = "healthy";

      // 초기화 상태 확인
      if (!todoService.collection) {
        issues.push("TodoService 컬렉션이 초기화되지 않음");
        severity = "warning";
      }

      // 통계 확인
      if (todoService.stats) {
        const {
          errorCount = 0,
          operationsCount = 0,
          averageResponseTime = 0,
          cacheHits = 0,
          cacheMisses = 0,
        } = todoService.stats;

        // 에러율 체크
        if (operationsCount > 0) {
          const errorRate = errorCount / operationsCount;
          if (errorRate > 0.1) {
            issues.push(
              `높은 TodoService 에러율: ${Math.round(errorRate * 100)}%`
            );
            severity = errorRate > 0.25 ? "critical" : "warning";
          }
        }

        // 응답 시간 체크
        if (averageResponseTime > 2000) {
          issues.push(`느린 TodoService 응답: ${averageResponseTime}ms`);
          severity = severity === "critical" ? "critical" : "warning";
        }

        // 캐시 효율성 체크
        const totalCacheOps = cacheHits + cacheMisses;
        if (totalCacheOps > 0) {
          const cacheHitRate = cacheHits / totalCacheOps;
          if (cacheHitRate < 0.3) {
            issues.push(`낮은 캐시 적중률: ${Math.round(cacheHitRate * 100)}%`);
          }
        }
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        initialized: !!todoService.collection,
        stats: todoService.stats || {},
      });
    } catch (error) {
      logger.error("❌ TodoService 상태 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 🖥️ 시스템 리소스 상태 체크
   */
  async checkSystemResources() {
    try {
      const issues = [];
      let severity = "healthy";

      // 메모리 사용량 체크
      const memUsage = process.memoryUsage();
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

      if (usedMB > this.config.memoryThreshold) {
        issues.push(`높은 메모리 사용량: ${usedMB}MB`);
        severity =
          usedMB > this.config.memoryThreshold * 1.5 ? "critical" : "warning";
      }

      // 업타임 체크
      const uptimeHours = Math.round(
        (Date.now() - this.overallStatus.uptime) / (1000 * 60 * 60)
      );

      // Railway 환경에서는 24시간 이상 실행을 권장하지 않음
      if (process.env.RAILWAY_ENVIRONMENT && uptimeHours > 24) {
        issues.push(`긴 업타임: ${uptimeHours}시간 (재시작 권장)`);
        severity = severity === "critical" ? "critical" : "warning";
      }

      // 이벤트 루프 지연 체크 (간단한 방법)
      const start = Date.now();
      await new Promise((resolve) => setImmediate(resolve));
      const eventLoopDelay = Date.now() - start;

      if (eventLoopDelay > 100) {
        issues.push(`이벤트 루프 지연: ${eventLoopDelay}ms`);
        severity = eventLoopDelay > 500 ? "critical" : "warning";
      }

      return this.createHealthResult(severity, issues.join(", ") || "정상", {
        memory: {
          used: usedMB,
          total: totalMB,
          usage: Math.round((usedMB / totalMB) * 100),
        },
        uptime: uptimeHours,
        eventLoopDelay,
      });
    } catch (error) {
      logger.error("❌ 시스템 리소스 체크 실패:", error);
      return this.createHealthResult("error", `체크 실패: ${error.message}`);
    }
  }

  /**
   * 📊 전체 건강 상태 계산
   */
  calculateOverallHealth(checks) {
    const severityOrder = ["healthy", "warning", "critical", "error"];
    let worstSeverity = "healthy";
    const allIssues = [];

    for (const check of checks) {
      const currentSeverityIndex = severityOrder.indexOf(check.status);
      const worstSeverityIndex = severityOrder.indexOf(worstSeverity);

      if (currentSeverityIndex > worstSeverityIndex) {
        worstSeverity = check.status;
      }

      if (check.message && check.message !== "정상") {
        allIssues.push(check.message);
      }
    }

    return {
      status: worstSeverity,
      issues: allIssues,
    };
  }

  /**
   * 🚨 건강 문제 처리
   */
  async handleHealthIssues(healthResult) {
    const { status, issues } = healthResult;

    // 크리티컬 상태인 경우 긴급 스케줄러 시작
    if (status === "critical" && !this.criticalInterval) {
      this.startCriticalScheduler();
    }

    // 알림 전송 (쿨다운 체크)
    if (this.config.enableAlerts && this.shouldSendAlert(status)) {
      await this.sendHealthAlert(status, issues);
    }

    // 자동 복구 시도
    if (this.config.autoRecovery && status === "critical") {
      await this.attemptAutoRecovery(issues);
    }

    logger.warn(
      `⚠️ 건강 문제 감지 - 상태: ${status}, 문제: ${issues.join(", ")}`
    );
  }

  /**
   * 🔧 자동 복구 시도
   */
  async attemptAutoRecovery(issues) {
    const recoveryKey = "general";
    const attempts = this.recoveryAttempts.get(recoveryKey) || 0;

    if (attempts >= this.config.maxRecoveryAttempts) {
      logger.error(
        `❌ 최대 복구 시도 횟수 초과 (${attempts}/${this.config.maxRecoveryAttempts})`
      );
      return;
    }

    try {
      logger.info(
        `🔧 자동 복구 시도 ${attempts + 1}/${
          this.config.maxRecoveryAttempts
        }...`
      );

      // 메모리 정리
      if (global.gc) {
        global.gc();
        logger.debug("🧹 가비지 컬렉션 실행됨");
      }

      // 캐시 정리
      if (this.components.todoService && this.components.todoService.cache) {
        this.components.todoService.cache.clear();
        this.components.todoService.cacheTimestamps.clear();
        logger.debug("🧹 TodoService 캐시 정리됨");
      }

      // 연결 상태 복구 시도
      if (
        this.components.dbManager &&
        !this.components.dbManager.isConnected()
      ) {
        await this.components.dbManager.reconnect();
        logger.debug("🔗 데이터베이스 재연결 시도됨");
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
      if (this.isRunning && this.overallStatus.health === "critical") {
        await this.performFullHealthCheck();
      } else if (this.overallStatus.health === "healthy") {
        // 정상 상태로 복구됨 - 크리티컬 스케줄러 중지
        this.stopCriticalScheduler();
      }
    }, this.config.criticalCheckInterval);

    logger.warn(
      `🚨 크리티컬 헬스체크 스케줄러 시작됨 (${this.config.criticalCheckInterval}ms)`
    );
  }

  /**
   * 🛑 크리티컬 스케줄러 중지
   */
  stopCriticalScheduler() {
    if (this.criticalInterval) {
      clearInterval(this.criticalInterval);
      this.criticalInterval = null;
      logger.info("✅ 크리티컬 헬스체크 스케줄러 중지됨");
    }
  }

  /**
   * 📊 상태 업데이트
   */
  updateOverallStatus(status) {
    Object.assign(this.overallStatus, status);

    // 컴포넌트별 상태 저장
    if (status.components) {
      for (const [name, componentStatus] of Object.entries(status.components)) {
        this.componentStatus.set(name, {
          ...componentStatus,
          lastUpdated: TimeHelper.getLogTimeString(),
        });
      }
    }
  }

  /**
   * 📈 메트릭 업데이트
   */
  updateMetrics(checkDuration) {
    // 체크 소요 시간
    this.metrics.checkDuration.push(checkDuration);
    if (this.metrics.checkDuration.length > 100) {
      this.metrics.checkDuration = this.metrics.checkDuration.slice(-50);
    }

    // 메모리 사용량
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    this.metrics.memoryUsage.push(memUsage);
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-50);
    }
  }

  /**
   * 🏥 건강 결과 생성 헬퍼
   */
  createHealthResult(status, message, details = {}) {
    return {
      status,
      message,
      details,
      timestamp: TimeHelper.getLogTimeString(),
    };
  }

  /**
   * 🚨 알림 전송 여부 확인
   */
  shouldSendAlert(status) {
    if (status === "healthy") return false;

    // 크리티컬은 항상 알림, 워닝은 연속 3회 이상일 때만
    if (status === "critical") return true;

    // 워닝 연속 체크 로직
    const recentChecks = this.overallStatus.alerts.slice(-3);
    return (
      recentChecks.length >= 3 &&
      recentChecks.every((alert) => alert.status === "warning")
    );
  }

  /**
   * 📊 전체 상태 조회
   */
  getStatus() {
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

      this.isRunning = false;

      // 스케줄러 정리
      if (this.normalInterval) {
        clearInterval(this.normalInterval);
        this.normalInterval = null;
      }

      if (this.criticalInterval) {
        clearInterval(this.criticalInterval);
        this.criticalInterval = null;
      }

      // 메트릭 정리
      this.metrics.checkDuration.length = 0;
      this.metrics.memoryUsage.length = 0;
      this.metrics.responseTime.length = 0;
      this.metrics.errorCounts.clear();

      // 알림 히스토리 정리
      this.alertHistory.clear();
      this.recoveryAttempts.clear();
      this.componentStatus.clear();

      logger.info("✅ HealthChecker 정리 완료");
    } catch (error) {
      logger.error("❌ HealthChecker 정리 실패:", error);
    }
  }

  /**
   * 🔧 컴포넌트 등록
   */
  registerComponent(name, component) {
    this.components[name] = component;
    logger.debug(`🔧 컴포넌트 등록됨: ${name}`);
  }

  /**
   * 🔧 컴포넌트 등록 해제
   */
  unregisterComponent(name) {
    delete this.components[name];
    this.componentStatus.delete(name);
    logger.debug(`🔧 컴포넌트 등록 해제됨: ${name}`);
  }
}

module.exports = HealthChecker;
