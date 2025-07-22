// src/services/HealthService.js - 완전 수정 버전
const AppConfig = require("../config/AppConfig");
const logger = require("../utils/Logger");
const BaseService = require("./BaseService");

class HealthService extends BaseService {
  constructor() {
    super(); // ✅ super() 호출 필수
    this.startTime = Date.now();
    this.healthCheckHistory = [];
    this.maxHistoryLength = 10;
  }

  /**
   * 전체 시스템 상태 확인
   */
  async getSystemHealth() {
    const timestamp = new Date().toISOString();
    const uptime = Math.round((Date.now() - this.startTime) / 1000);

    try {
      const health = {
        status: "ok",
        timestamp,
        uptime,
        environment: AppConfig.NODE_ENV,
        version: AppConfig.VERSION,
        system: await this.getSystemMetrics(),
        database: await this.checkDatabase(),
        bot: await this.checkBot(),
        services: await this.checkServices(),
        railway: this.getRailwayInfo(),
      };

      // 상태 히스토리 저장
      this.saveHealthHistory(health);

      // 전체 상태 판정
      health.status = this.determineOverallStatus(health);

      return health;
    } catch (error) {
      logger.error("헬스체크 실행 오류:", error);
      return {
        status: "error",
        timestamp,
        error: error.message,
        uptime,
      };
    }
  }

  /**
   * 시스템 메트릭 수집
   */
  async getSystemMetrics() {
    const memUsage = process.memoryUsage();

    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: Math.round(process.uptime()),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100), // %
      },
      cpu: await this.getCpuUsage(),
    };
  }

  /**
   * CPU 사용률 측정 (간단한 방식)
   */
  async getCpuUsage() {
    return new Promise((resolve) => {
      const start = process.cpuUsage();
      setTimeout(() => {
        const usage = process.cpuUsage(start);
        const total = usage.user + usage.system;
        const percentage = Math.round((total / 100000) * 100) / 100; // 백분율
        resolve({
          user: usage.user,
          system: usage.system,
          percentage,
        });
      }, 100);
    });
  }

  /**
   * 데이터베이스 상태 확인
   */
  async checkDatabase() {
    if (!AppConfig.MONGO_URL) {
      return {
        status: "disabled",
        message: "MongoDB URL이 설정되지 않음",
      };
    }

    try {
      // DatabaseManager를 사용해서 연결 상태 확인
      const { getInstance } = require("../database/DatabaseManager");
      const dbManager = getInstance();

      if (!dbManager || !dbManager.isConnected()) {
        return {
          status: "disconnected",
          message: "데이터베이스 연결되지 않음",
        };
      }

      const start = Date.now();
      // 간단한 ping 테스트
      const dbManager = getInstance(); await dbManager.getDb().admin().ping();
      const responseTime = Date.now() - start;

      return {
        status: "healthy",
        responseTime: `${responseTime}ms`,
        connected: true,
        url: AppConfig.MONGO_URL.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@"), // 패스워드 마스킹
      };
    } catch (error) {
      logger.error("데이터베이스 헬스체크 실패:", error);
      return {
        status: "unhealthy",
        error: error.message,
        connected: false,
      };
    }
  }

  /**
   * 텔레그램 봇 상태 확인
   */
  async checkBot() {
    try {
      // 봇 토큰이 설정되어 있는지 확인
      if (!AppConfig.BOT_TOKEN) {
        return {
          status: "error",
          message: "봇 토큰이 설정되지 않음",
        };
      }

      return {
        status: "healthy",
        token: `${AppConfig.BOT_TOKEN.slice(0, 10)}***`,
        username: AppConfig.BOT_USERNAME,
        polling: true, // 실제 봇 인스턴스 상태는 BotController에서 확인 필요
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }

  /**
   * 주요 서비스들 상태 확인
   */
  async checkServices() {
    const services = {};

    // 활성화된 모듈들 확인
    const enabledModules = Object.entries(AppConfig.FEATURES)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => feature);

    services.modules = {
      status: "healthy",
      enabled: enabledModules,
      count: enabledModules.length,
    };

    // 외부 API 서비스 확인
    services.apis = {
      weather: AppConfig.WEATHER_API_KEY ? "configured" : "not_configured",
      airKorea: AppConfig.AIR_KOREA_API_KEY ? "configured" : "not_configured",
    };

    return services;
  }

  /**
   * Railway 배포 정보
   */
  getRailwayInfo() {
    if (!AppConfig.isRailway) {
      return { status: "not_railway" };
    }

    return {
      status: "railway",
      deploymentId: AppConfig.RAILWAY?.DEPLOYMENT_ID,
      environment: AppConfig.RAILWAY?.ENVIRONMENT,
      publicDomain: AppConfig.RAILWAY?.PUBLIC_DOMAIN,
      gitCommit: AppConfig.RAILWAY?.GIT_COMMIT_SHA?.slice(0, 7),
      gitBranch: AppConfig.RAILWAY?.GIT_BRANCH,
    };
  }

  /**
   * 전체 상태 판정
   */
  determineOverallStatus(health) {
    // 데이터베이스가 활성화되어 있고 비정상이면 degraded
    if (health.database.status === "unhealthy") {
      return "degraded";
    }

    // 봇 상태가 비정상이면 degraded
    if (health.bot.status === "unhealthy") {
      return "degraded";
    }

    // 메모리 사용률이 90% 이상이면 degraded
    if (health.system.memory.usage > 90) {
      return "degraded";
    }

    return "ok";
  }

  /**
   * 헬스체크 히스토리 저장
   */
  saveHealthHistory(health) {
    const summary = {
      timestamp: health.timestamp,
      status: health.status,
      uptime: health.uptime,
      memoryUsage: health.system.memory.usage,
      dbStatus: health.database.status,
    };

    this.healthCheckHistory.unshift(summary);

    // 히스토리 길이 제한
    if (this.healthCheckHistory.length > this.maxHistoryLength) {
      this.healthCheckHistory = this.healthCheckHistory.slice(
        0,
        this.maxHistoryLength
      );
    }
  }

  /**
   * 간단한 상태 확인 (빠른 응답용)
   */
  getQuickHealth() {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    const memUsage = process.memoryUsage();

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime,
      memory: Math.round(memUsage.heapUsed / 1024 / 1024),
      version: AppConfig.VERSION,
    };
  }

  /**
   * 헬스체크 히스토리 조회
   */
  getHealthHistory() {
    return {
      history: this.healthCheckHistory,
      summary: {
        totalChecks: this.healthCheckHistory.length,
        healthyChecks: this.healthCheckHistory.filter((h) => h.status === "ok")
          .length,
        degradedChecks: this.healthCheckHistory.filter(
          (h) => h.status === "degraded"
        ).length,
        errorChecks: this.healthCheckHistory.filter((h) => h.status === "error")
          .length,
      },
    };
  }
}

module.exports = HealthService;
