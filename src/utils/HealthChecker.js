// src/utils/HealthCheck.js - 헬스체크 유틸리티

const logger = require("./Logger");
const TimeHelper = require("./TimeHelper");

/**
 * 🏥 헬스체크 유틸리티 - 시스템 상태 모니터링
 * - Railway 환경 완벽 지원
 * - 자동 복구 시스템
 * - 상세 진단 정보
 * - 메모리 최적화
 * - 알림 시스템
 */
class HealthCheck {
  constructor(options = {}) {
    this.controller = options.controller;
    this.dbManager = options.dbManager;
    this.moduleManager = options.moduleManager;

    // 설정
    this.config = {
      // 체크 간격
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000, // 1분
      criticalInterval: parseInt(process.env.CRITICAL_CHECK_INTERVAL) || 10000, // 10초

      // 임계값 설정
      memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD) || 400, // MB
      responseTimeThreshold:
        parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 5000, // ms
      errorThreshold: parseInt(process.env.ERROR_THRESHOLD) || 10, // 1분당 에러 수

      // 복구 설정
      autoRestart: process.env.AUTO_RESTART_ENABLED === "true",
      maxRestartAttempts: parseInt(process.env.MAX_RESTART_ATTEMPTS) || 3,
      restartCooldown: parseInt(process.env.RESTART_COOLDOWN) || 300000, // 5분

      // 알림 설정
      alertEnabled: process.env.HEALTH_ALERT_ENABLED !== "false",
      alertThreshold: parseInt(process.env.ALERT_THRESHOLD) || 3, // 연속 실패 횟수

      // Railway 특화 설정
      railwayOptimizations: process.env.RAILWAY_ENVIRONMENT ? true : false,
      healthEndpoint: process.env.HEALTH_ENDPOINT || "/health",

      ...options,
    };

    // 상태 추적
    this.status = {
      overall: "healthy", // healthy, warning, critical, error
      lastCheck: null,
      lastHealthyCheck: null,
      consecutiveFailures: 0,
      totalChecks: 0,

      // 컴포넌트별 상태
      components: {
        bot: { status: "unknown", lastCheck: null, details: {} },
        database: { status: "unknown", lastCheck: null, details: {} },
        modules: { status: "unknown", lastCheck: null, details: {} },
        memory: { status: "unknown", lastCheck: null, details: {} },
        performance: { status: "unknown", lastCheck: null, details: {} },
      },
    };

    // 히스토리 (최근 100개)
    this.history = [];
    this.maxHistorySize = 100;

    // 복구 추적
    this.restartAttempts = 0;
    this.lastRestartTime = null;

    // 타이머들
    this.healthCheckTimer = null;
    this.criticalCheckTimer = null;

    // Railway 환경 감지
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    this.isInitialized = false;

    logger.info("🏥 HealthCheck 유틸리티 생성됨", {
      interval: this.config.interval,
      railway: this.isRailway,
      autoRestart: this.config.autoRestart,
    });
  }

  /**
   * 🎯 헬스체크 시스템 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn("HealthCheck 이미 초기화됨");
      return;
    }

    try {
      logger.info("🏥 HealthCheck 시스템 초기화 시작...");

      // 초기 헬스체크 수행
      await this.performHealthCheck();

      // 정기 헬스체크 시작
      this.startRegularHealthChecks();

      // Railway 환경에서는 크리티컬 체크도 시작
      if (this.isRailway) {
        this.startCriticalHealthChecks();
      }

      // HTTP 헬스체크 엔드포인트 설정 (Railway용)
      if (this.isRailway) {
        this.setupHealthEndpoint();
      }

      this.isInitialized = true;
      logger.success("✅ HealthCheck 시스템 초기화 완료");
    } catch (error) {
      logger.error("❌ HealthCheck 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🔄 정기 헬스체크 시작
   */
  startRegularHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.interval);

    logger.debug(
      `🔄 정기 헬스체크 시작 (${this.config.interval / 1000}초 간격)`
    );
  }

  /**
   * ⚡ 크리티컬 헬스체크 시작 (Railway 환경)
   */
  startCriticalHealthChecks() {
    this.criticalCheckTimer = setInterval(async () => {
      await this.performCriticalHealthCheck();
    }, this.config.criticalInterval);

    logger.debug(
      `⚡ 크리티컬 헬스체크 시작 (${
        this.config.criticalInterval / 1000
      }초 간격)`
    );
  }

  /**
   * 🌐 HTTP 헬스체크 엔드포인트 설정
   */
  setupHealthEndpoint() {
    // Railway에서 HTTP 헬스체크를 위한 간단한 서버
    // 이는 별도의 Express 서버가 필요할 수 있음
    // 여기서는 로그만 남기고 실제 구현은 메인 앱에서 처리
    logger.info(`🌐 헬스체크 엔드포인트 준비: ${this.config.healthEndpoint}`);
  }

  /**
   * 🏥 메인 헬스체크 수행
   */
  async performHealthCheck() {
    const checkStartTime = Date.now();
    const timestamp = TimeHelper.getLogTimeString();

    try {
      logger.debug("🏥 헬스체크 수행 중...");

      // 각 컴포넌트 체크
      const botHealth = await this.checkBotHealth();
      const dbHealth = await this.checkDatabaseHealth();
      const moduleHealth = await this.checkModuleHealth();
      const memoryHealth = await this.checkMemoryHealth();
      const performanceHealth = await this.checkPerformanceHealth();

      // 전체 상태 결정
      const overallStatus = this.calculateOverallStatus([
        botHealth,
        dbHealth,
        moduleHealth,
        memoryHealth,
        performanceHealth,
      ]);

      // 상태 업데이트
      this.updateHealthStatus({
        overall: overallStatus,
        timestamp,
        checkDuration: Date.now() - checkStartTime,
        components: {
          bot: botHealth,
          database: dbHealth,
          modules: moduleHealth,
          memory: memoryHealth,
          performance: performanceHealth,
        },
      });

      // 문제 감지 시 대응
      if (overallStatus !== "healthy") {
        await this.handleHealthIssue(overallStatus);
      } else {
        // 정상 상태로 복구됨
        if (this.consecutiveFailures > 0) {
          logger.success("✅ 시스템 상태 정상으로 복구됨");
          this.consecutiveFailures = 0;
        }
      }

      this.status.totalChecks++;
      this.status.lastCheck = timestamp;

      if (overallStatus === "healthy") {
        this.status.lastHealthyCheck = timestamp;
      }
    } catch (error) {
      logger.error("❌ 헬스체크 수행 실패:", error);
      this.handleHealthCheckFailure(error);
    }
  }

  /**
   * ⚡ 크리티컬 헬스체크 (간단한 생존 확인)
   */
  async performCriticalHealthCheck() {
    try {
      const memUsage = process.memoryUsage();
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      // 메모리 크리티컬 체크
      if (usedMB > this.config.memoryThreshold * 1.5) {
        // 150% 초과시 크리티컬
        logger.error(
          `🚨 크리티컬: 메모리 사용량 ${usedMB}MB (임계값: ${this.config.memoryThreshold}MB)`
        );

        if (this.config.autoRestart && this.canRestart()) {
          await this.performEmergencyRestart("memory_critical");
        }
      }

      // 봇 응답성 체크
      if (this.controller && this.controller.stats) {
        const { processingMessages, processingCallbacks } =
          this.controller.stats;
        const totalProcessing =
          (processingMessages || 0) + (processingCallbacks || 0);

        if (totalProcessing > 100) {
          // 100개 이상 대기 중
          logger.warn(`⚠️ 크리티컬: 처리 대기 중인 요청 ${totalProcessing}개`);
        }
      }
    } catch (error) {
      logger.error("❌ 크리티컬 헬스체크 실패:", error);
    }
  }

  /**
   * 🤖 봇 상태 체크
   */
  async checkBotHealth() {
    try {
      if (!this.controller) {
        return { status: "error", message: "Controller 없음", details: {} };
      }

      const controllerStatus = this.controller.getStatus();
      const issues = [];

      // 초기화 상태 체크
      if (!controllerStatus.initialized || !controllerStatus.running) {
        issues.push("봇이 초기화되지 않음");
      }

      // 에러율 체크
      const { errorsCount, messagesReceived, callbacksReceived } =
        controllerStatus.activity || {};
      const totalRequests = (messagesReceived || 0) + (callbacksReceived || 0);
      const errorRate =
        totalRequests > 0 ? (errorsCount || 0) / totalRequests : 0;

      if (errorRate > 0.1) {
        // 10% 이상 에러율
        issues.push(`높은 에러율: ${Math.round(errorRate * 100)}%`);
      }

      // 응답 시간 체크
      const avgResponseTime =
        controllerStatus.performance?.averageResponseTime || 0;
      if (avgResponseTime > this.config.responseTimeThreshold) {
        issues.push(`느린 응답: ${avgResponseTime}ms`);
      }

      return {
        status:
          issues.length === 0
            ? "healthy"
            : issues.length > 2
            ? "critical"
            : "warning",
        message: issues.length > 0 ? issues.join(", ") : "Bot 정상",
        details: {
          initialized: controllerStatus.initialized,
          running: controllerStatus.running,
          errorRate: Math.round(errorRate * 100),
          avgResponseTime,
          activeRequests:
            (controllerStatus.processing?.activeMessages || 0) +
            (controllerStatus.processing?.activeCallbacks || 0),
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: `Bot 체크 실패: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  /**
   * 💾 데이터베이스 상태 체크
   */
  async checkDatabaseHealth() {
    try {
      if (!this.dbManager) {
        return { status: "warning", message: "DB Manager 없음", details: {} };
      }

      const dbStatus = this.dbManager.getStatus();
      const issues = [];

      // 연결 상태 체크
      if (!dbStatus.connected) {
        issues.push("DB 연결 끊어짐");
      }

      // 연결 풀 상태 체크 (가능한 경우)
      if (
        dbStatus.poolSize !== undefined &&
        dbStatus.activeConnections !== undefined
      ) {
        const poolUsage = dbStatus.activeConnections / dbStatus.poolSize;
        if (poolUsage > 0.9) {
          // 90% 이상 사용
          issues.push(`높은 연결 풀 사용률: ${Math.round(poolUsage * 100)}%`);
        }
      }

      // 간단한 ping 테스트 (가능한 경우)
      if (this.dbManager.ping) {
        const pingStart = Date.now();
        await this.dbManager.ping();
        const pingTime = Date.now() - pingStart;

        if (pingTime > 1000) {
          // 1초 이상
          issues.push(`느린 DB 응답: ${pingTime}ms`);
        }
      }

      return {
        status:
          issues.length === 0
            ? "healthy"
            : issues.length > 1
            ? "critical"
            : "warning",
        message: issues.length > 0 ? issues.join(", ") : "Database 정상",
        details: {
          connected: dbStatus.connected,
          database: dbStatus.database,
          poolUsage: dbStatus.poolSize
            ? Math.round(
                ((dbStatus.activeConnections || 0) / dbStatus.poolSize) * 100
              )
            : null,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: `DB 체크 실패: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  /**
   * 📦 모듈 상태 체크
   */
  async checkModuleHealth() {
    try {
      if (!this.moduleManager) {
        return {
          status: "warning",
          message: "Module Manager 없음",
          details: {},
        };
      }

      const moduleStatus = this.moduleManager.getStatus();
      const issues = [];

      // 모듈 로드 상태 체크
      const { activeModules, totalModules, failedModules } = moduleStatus;

      if (failedModules > 0) {
        issues.push(`실패한 모듈: ${failedModules}개`);
      }

      const moduleSuccessRate =
        totalModules > 0 ? activeModules / totalModules : 0;
      if (moduleSuccessRate < 0.8) {
        // 80% 미만
        issues.push(
          `낮은 모듈 성공률: ${Math.round(moduleSuccessRate * 100)}%`
        );
      }

      // 모듈 에러 체크
      if (moduleStatus.errorsCount > this.config.errorThreshold) {
        issues.push(`높은 모듈 에러: ${moduleStatus.errorsCount}개`);
      }

      return {
        status:
          issues.length === 0
            ? "healthy"
            : issues.length > 1
            ? "critical"
            : "warning",
        message: issues.length > 0 ? issues.join(", ") : "Modules 정상",
        details: {
          activeModules,
          totalModules,
          failedModules,
          successRate: Math.round(moduleSuccessRate * 100),
          errorsCount: moduleStatus.errorsCount,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: `Module 체크 실패: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  /**
   * 💾 메모리 상태 체크
   */
  checkMemoryHealth() {
    try {
      const memUsage = process.memoryUsage();
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const externalMB = Math.round(memUsage.external / 1024 / 1024);

      const issues = [];

      // 메모리 사용량 체크
      if (usedMB > this.config.memoryThreshold) {
        issues.push(`높은 메모리 사용: ${usedMB}MB`);
      }

      // 메모리 사용률 체크
      const memoryUsageRate = usedMB / totalMB;
      if (memoryUsageRate > 0.9) {
        // 90% 이상
        issues.push(
          `높은 메모리 사용률: ${Math.round(memoryUsageRate * 100)}%`
        );
      }

      // Railway 환경에서는 더 엄격하게
      if (this.isRailway && usedMB > 450) {
        // Railway 512MB 제한
        issues.push("Railway 메모리 제한 근접");
      }

      let status = "healthy";
      if (usedMB > this.config.memoryThreshold * 1.2) {
        status = "critical";
      } else if (usedMB > this.config.memoryThreshold) {
        status = "warning";
      }

      return {
        status,
        message: issues.length > 0 ? issues.join(", ") : "Memory 정상",
        details: {
          usedMB,
          totalMB,
          externalMB,
          usageRate: Math.round(memoryUsageRate * 100),
          threshold: this.config.memoryThreshold,
          railway: this.isRailway,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: `Memory 체크 실패: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  /**
   * 📊 성능 상태 체크
   */
  checkPerformanceHealth() {
    try {
      const uptime = Math.round(process.uptime());
      const issues = [];

      // 업타임 체크 (너무 자주 재시작되는지)
      if (uptime < 300 && this.restartAttempts > 0) {
        // 5분 미만이고 재시작 이력 있음
        issues.push("자주 재시작됨");
      }

      // CPU 사용률 체크 (가능한 경우)
      const cpuUsage = process.cpuUsage();
      if (cpuUsage.user > 1000000 || cpuUsage.system > 1000000) {
        // 1초 이상
        issues.push("높은 CPU 사용");
      }

      // 컨트롤러 성능 체크
      if (this.controller && this.controller.stats) {
        const avgResponseTime = this.controller.stats.averageResponseTime || 0;
        if (avgResponseTime > this.config.responseTimeThreshold) {
          issues.push(`느린 응답: ${avgResponseTime}ms`);
        }
      }

      return {
        status:
          issues.length === 0
            ? "healthy"
            : issues.length > 1
            ? "warning"
            : "warning",
        message: issues.length > 0 ? issues.join(", ") : "Performance 정상",
        details: {
          uptime,
          restartAttempts: this.restartAttempts,
          cpuUser: Math.round(cpuUsage.user / 1000), // ms
          cpuSystem: Math.round(cpuUsage.system / 1000), // ms
          platform: process.platform,
          nodeVersion: process.version,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: `Performance 체크 실패: ${error.message}`,
        details: { error: error.message },
      };
    }
  }

  /**
   * 📊 전체 상태 계산
   */
  calculateOverallStatus(componentHealths) {
    const statuses = componentHealths.map((h) => h.status);

    if (statuses.includes("error") || statuses.includes("critical")) {
      return "critical";
    }

    if (statuses.includes("warning")) {
      return "warning";
    }

    return "healthy";
  }

  /**
   * 📝 헬스 상태 업데이트
   */
  updateHealthStatus(healthData) {
    // 이전 상태 저장
    const previousStatus = this.status.overall;

    // 새 상태 적용
    this.status.overall = healthData.overall;
    this.status.components = healthData.components;

    // 연속 실패 카운트 업데이트
    if (healthData.overall !== "healthy") {
      this.status.consecutiveFailures++;
    } else {
      this.status.consecutiveFailures = 0;
    }

    // 히스토리에 추가
    this.addToHistory({
      timestamp: healthData.timestamp,
      status: healthData.overall,
      checkDuration: healthData.checkDuration,
      components: Object.fromEntries(
        Object.entries(healthData.components).map(([key, comp]) => [
          key,
          comp.status,
        ])
      ),
    });

    // 상태 변화 로깅
    if (previousStatus !== healthData.overall) {
      const statusEmoji = {
        healthy: "✅",
        warning: "⚠️",
        critical: "🚨",
        error: "❌",
      };

      logger.info(
        `${
          statusEmoji[healthData.overall]
        } 시스템 상태 변경: ${previousStatus} → ${healthData.overall}`
      );
    }

    // 상세 로깅 (디버그 모드)
    if (process.env.LOG_LEVEL === "debug") {
      logger.debug("🏥 헬스체크 결과:", {
        status: healthData.overall,
        duration: healthData.checkDuration,
        components: Object.fromEntries(
          Object.entries(healthData.components).map(([key, comp]) => [
            key,
            {
              status: comp.status,
              message: comp.message,
            },
          ])
        ),
      });
    }
  }

  /**
   * 🚨 헬스 문제 처리
   */
  async handleHealthIssue(status) {
    this.status.consecutiveFailures++;

    logger.warn(
      `🚨 헬스 문제 감지: ${status} (연속 실패: ${this.status.consecutiveFailures})`
    );

    // 알림 발송
    if (
      this.config.alertEnabled &&
      this.status.consecutiveFailures >= this.config.alertThreshold
    ) {
      await this.sendHealthAlert(status);
    }

    // 자동 복구 시도
    if (status === "critical" && this.config.autoRestart && this.canRestart()) {
      await this.performEmergencyRestart("health_critical");
    }

    // 메모리 정리 시도
    if (this.status.components.memory?.status === "critical") {
      await this.performMemoryCleanup();
    }
  }

  /**
   * 🔄 긴급 재시작 수행
   */
  async performEmergencyRestart(reason) {
    try {
      logger.warn(`🔄 긴급 재시작 시작: ${reason}`);

      this.restartAttempts++;
      this.lastRestartTime = Date.now();

      // Railway 환경에서는 프로세스 종료로 재시작 유도
      if (this.isRailway) {
        logger.warn("🚂 Railway 환경에서 자동 재시작 유도...");

        // 정리 작업 후 종료
        setTimeout(() => {
          process.exit(1);
        }, 2000);
      } else {
        // 로컬 환경에서는 컴포넌트 재시작 시도
        logger.warn("🔄 컴포넌트 재시작 시도...");

        if (this.controller && this.controller.cleanup) {
          await this.controller.cleanup();
          await this.controller.initialize();
        }
      }
    } catch (error) {
      logger.error("❌ 긴급 재시작 실패:", error);
    }
  }

  /**
   * 🧹 메모리 정리 수행
   */
  async performMemoryCleanup() {
    try {
      logger.warn("🧹 메모리 정리 시작...");

      // 컨트롤러 메모리 정리
      if (this.controller && this.controller.performMemoryCleanup) {
        this.controller.performMemoryCleanup();
      }

      // 히스토리 정리
      if (this.history.length > this.maxHistorySize / 2) {
        this.history = this.history.slice(-this.maxHistorySize / 2);
      }

      // 가비지 컬렉션 요청
      if (global.gc) {
        global.gc();
      }

      logger.info("✅ 메모리 정리 완료");
    } catch (error) {
      logger.error("❌ 메모리 정리 실패:", error);
    }
  }

  /**
   * 📧 헬스 알림 발송
   */
  async sendHealthAlert(status) {
    try {
      const alertData = {
        status,
        consecutiveFailures: this.status.consecutiveFailures,
        timestamp: TimeHelper.getLogTimeString(),
        environment: this.isRailway ? "Railway" : "Local",
        components: this.status.components,
      };

      // 로그로 일단 출력 (나중에 텔레그램/이메일 등으로 확장 가능)
      logger.warn("🚨 헬스 알림:", alertData);

      // TODO: 텔레그램 관리자 알림, 이메일, 슬랙 등 구현
    } catch (error) {
      logger.error("❌ 헬스 알림 발송 실패:", error);
    }
  }

  /**
   * 🔍 재시작 가능 여부 확인
   */
  canRestart() {
    // 최대 재시작 횟수 체크
    if (this.restartAttempts >= this.config.maxRestartAttempts) {
      logger.warn(
        `⚠️ 최대 재시작 횟수 초과: ${this.restartAttempts}/${this.config.maxRestartAttempts}`
      );
      return false;
    }

    // 재시작 쿨다운 체크
    if (this.lastRestartTime) {
      const timeSinceRestart = Date.now() - this.lastRestartTime;
      if (timeSinceRestart < this.config.restartCooldown) {
        const remainingTime = Math.round(
          (this.config.restartCooldown - timeSinceRestart) / 1000
        );
        logger.warn(`⚠️ 재시작 쿨다운 중: ${remainingTime}초 남음`);
        return false;
      }
    }

    return true;
  }

  /**
   * 📝 히스토리에 추가
   */
  addToHistory(healthRecord) {
    this.history.push(healthRecord);

    // 최대 크기 유지
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * ❌ 헬스체크 실패 처리
   */
  handleHealthCheckFailure(error) {
    this.status.consecutiveFailures++;
    this.status.overall = "error";

    logger.error(
      `❌ 헬스체크 실패 (연속 ${this.status.consecutiveFailures}회):`,
      error
    );

    // 크리티컬 실패시 긴급 대응
    if (this.status.consecutiveFailures >= 5) {
      logger.error("🚨 크리티컬: 헬스체크 연속 실패");

      if (this.config.autoRestart && this.canRestart()) {
        setTimeout(async () => {
          await this.performEmergencyRestart("healthcheck_failure");
        }, 5000);
      }
    }
  }

  /**
   * 📊 상태 조회 (완전판)
   */
  getStatus() {
    const recentHistory = this.history.slice(-10); // 최근 10개
    const uptime = Math.round(process.uptime());

    return {
      // 기본 정보
      overall: this.status.overall,
      consecutiveFailures: this.status.consecutiveFailures,
      totalChecks: this.status.totalChecks,
      lastCheck: this.status.lastCheck,
      lastHealthyCheck: this.status.lastHealthyCheck,

      // 환경 정보
      environment: {
        railway: this.isRailway,
        uptime,
        nodeVersion: process.version,
        platform: process.platform,
      },

      // 설정 정보
      config: {
        interval: this.config.interval,
        memoryThreshold: this.config.memoryThreshold,
        autoRestart: this.config.autoRestart,
        alertEnabled: this.config.alertEnabled,
      },

      // 컴포넌트 상태
      components: this.status.components,

      // 복구 정보
      recovery: {
        restartAttempts: this.restartAttempts,
        maxRestartAttempts: this.config.maxRestartAttempts,
        lastRestartTime: this.lastRestartTime,
        canRestart: this.canRestart(),
      },

      // 최근 히스토리
      recentHistory: recentHistory.map((h) => ({
        timestamp: h.timestamp,
        status: h.status,
        duration: h.checkDuration,
      })),

      // 통계
      statistics: this.calculateStatistics(),
    };
  }

  /**
   * 📈 통계 계산
   */
  calculateStatistics() {
    if (this.history.length === 0) {
      return null;
    }

    const last24Hours = this.history.filter((h) => {
      const checkTime = new Date(h.timestamp).getTime();
      const now = Date.now();
      return now - checkTime <= 24 * 60 * 60 * 1000; // 24시간
    });

    const statusCounts = last24Hours.reduce((acc, h) => {
      acc[h.status] = (acc[h.status] || 0) + 1;
      return acc;
    }, {});

    const totalChecks = last24Hours.length;
    const healthyChecks = statusCounts.healthy || 0;
    const uptime = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 0;

    const avgCheckDuration =
      last24Hours.length > 0
        ? last24Hours.reduce((sum, h) => sum + (h.checkDuration || 0), 0) /
          last24Hours.length
        : 0;

    return {
      period: "24h",
      totalChecks,
      uptimePercentage: Math.round(uptime * 100) / 100,
      statusDistribution: statusCounts,
      averageCheckDuration: Math.round(avgCheckDuration),
      healthyChecks,
      issues: totalChecks - healthyChecks,
    };
  }

  /**
   * 🏥 온디맨드 헬스체크 (외부 요청용)
   */
  async performOnDemandHealthCheck() {
    logger.info("🏥 온디맨드 헬스체크 요청됨");
    await this.performHealthCheck();
    return this.getStatus();
  }

  /**
   * 🔄 재시작 카운터 리셋
   */
  resetRestartCounter() {
    const previousAttempts = this.restartAttempts;
    this.restartAttempts = 0;
    this.lastRestartTime = null;

    if (previousAttempts > 0) {
      logger.info(`🔄 재시작 카운터 리셋: ${previousAttempts} → 0`);
    }
  }

  /**
   * 📊 상세 진단 보고서 생성
   */
  generateDiagnosticReport() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: TimeHelper.getLogTimeString(),

      // 시스템 정보
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: Math.round(process.uptime()),
        pid: process.pid,
      },

      // 메모리 상세 정보
      memory: {
        heap: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024),
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024),
      },

      // CPU 정보
      cpu: {
        user: Math.round(cpuUsage.user / 1000), // ms
        system: Math.round(cpuUsage.system / 1000), // ms
      },

      // 환경변수 (민감정보 제외)
      environment: {
        nodeEnv: process.env.NODE_ENV,
        railway: !!process.env.RAILWAY_ENVIRONMENT,
        railwayService: process.env.RAILWAY_SERVICE_NAME,
        railwayRegion: process.env.RAILWAY_REGION,
      },

      // 헬스체크 상태
      healthCheck: this.getStatus(),

      // 컴포넌트 진단
      components: {
        controller: this.controller?.getStatus() || null,
        database: this.dbManager?.getStatus() || null,
        modules: this.moduleManager?.getStatus() || null,
      },
    };
  }

  /**
   * 🌐 HTTP 헬스체크 응답 생성 (Railway용)
   */
  generateHealthResponse() {
    const status = this.getStatus();
    const httpStatus = {
      healthy: 200,
      warning: 200, // 경고는 여전히 정상으로 처리
      critical: 503,
      error: 503,
    };

    return {
      status: httpStatus[status.overall],
      body: {
        status: status.overall,
        timestamp: TimeHelper.getLogTimeString(),
        uptime: Math.round(process.uptime()),
        version: "3.0.1",
        environment: this.isRailway ? "railway" : "local",
        components: Object.fromEntries(
          Object.entries(status.components).map(([key, comp]) => [
            key,
            { status: comp.status, message: comp.message },
          ])
        ),
        statistics: status.statistics,
      },
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 HealthCheck 정리 시작...");

      // 타이머 정리
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }

      if (this.criticalCheckTimer) {
        clearInterval(this.criticalCheckTimer);
        this.criticalCheckTimer = null;
      }

      // 상태 초기화
      this.status.overall = "unknown";
      this.history = [];

      this.isInitialized = false;

      logger.info("✅ HealthCheck 정리 완료");
    } catch (error) {
      logger.error("❌ HealthCheck 정리 실패:", error);
    }
  }
}

module.exports = HealthCheck;
