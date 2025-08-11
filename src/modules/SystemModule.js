// ===== 🖥️ SystemModule.js - 완전 통합 버전 =====

const BaseModule = require("../core/BaseModule");
const logger = require('../utils/core/Logger');
const { getUserId, getUserName } = require('../utils/helpers/UserHelper');

// 🔧 강화된 헬퍼들 import
const {
  getCompleteSystemSnapshot,
  formatMemoryUsage,
  formatUptime,
  _getSystemHealth
} = require("../utils/SystemHelper");

const { StatusHelper } = require("../utils/StatusHelper");

class SystemModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.config = {
      maxLogLines: 50,
      botVersion: process.env.BOT_VERSION || "4.0.0",
      enableDetailedStats: true,
      enableHealthScoring: true, // 🆕 건강도 점수 활성화
      ...options.config
    };

    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      uniqueUsers: new Set(),
      lastHealthCheck: null // 🆕 마지막 건강도 체크
    };
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      // 초기 시스템 스냅샷 수집
      const initialSnapshot = getCompleteSystemSnapshot();
      logger.info("🖥️ SystemModule 초기화 - 시스템 스냅샷:", {
        platform: initialSnapshot.basic?.platform,
        memory: initialSnapshot.memory?.process?.heapUsed + "MB",
        health: initialSnapshot.health?.overall?.score
      });

      logger.success("✅ SystemModule 초기화 완료");
    } catch (error) {
      logger.error("❌ SystemModule 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showMainMenu,
      help: this.showHelp,
      status: this.showSystemStatus,
      modules: this.showModuleStatus,
      ping: this.handlePing,
      health: this.showSystemHealth // 🆕 건강도 전용 액션
    });
  }

  /**
   * 🏠 메인 메뉴 (SystemHelper + StatusHelper 활용!)
   */
  async showMainMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userName = getUserName(callbackQuery.from);

    // 🔧 SystemHelper로 완전한 시스템 정보 수집
    const systemSnapshot = getCompleteSystemSnapshot();

    // 📊 StatusHelper로 모듈 상태 분석
    const rawModuleStatuses = {};
    for (const [key, module] of moduleManager.modules) {
      if (key !== "system") {
        // 자기 자신 제외
        rawModuleStatuses[key] = module.getStatus();
      }
    }

    const moduleStatusSummary =
      StatusHelper.summarizeMultipleStatuses(rawModuleStatuses);

    // 🎯 통계 업데이트
    this.updateStats(getUserId(callbackQuery.from), "callback");

    return {
      type: "menu",
      module: "system",
      data: {
        userName,

        // 🆕 강화된 모듈 정보 (StatusHelper 활용)
        activeModules: moduleStatusSummary.details.map((detail) => ({
          key: detail.name,
          name: detail.name.charAt(0).toUpperCase() + detail.name.slice(1),
          emoji: this.getModuleEmoji(detail.name),
          status: detail.status,
          healthy: detail.score >= 70,
          score: detail.score
        })),

        // 🆕 강화된 시스템 통계 (SystemHelper 활용)
        systemStats: {
          uptime: this.getUptime(),
          totalCallbacks: this.systemStats.totalCallbacks,
          uniqueUsers: this.systemStats.uniqueUsers.size,

          // SystemHelper에서 제공하는 고급 정보
          memoryUsage: systemSnapshot.memory?.process?.heapUsed || 0,
          memoryPercent: systemSnapshot.memory?.process?.percentage || 0,
          cpuUsage: systemSnapshot.cpu?.usage || 0,
          healthScore: systemSnapshot.health?.overall?.score || 0,
          environment: systemSnapshot.environment?.cloud?.provider || "Local"
        },

        // 🆕 모듈 건강도 요약
        moduleHealth: {
          overall: moduleStatusSummary.overall,
          totalCount: moduleStatusSummary.summary.total,
          healthyCount: moduleStatusSummary.summary.healthy,
          warningCount: moduleStatusSummary.summary.warning,
          criticalCount: moduleStatusSummary.summary.critical
        }
      }
    };
  }

  /**
   * ❓ 도움말 표시 (완전 강화!)
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    // 📊 실시간 모듈 정보 수집
    const moduleStatuses = {};
    for (const [key, module] of moduleManager.modules) {
      if (key !== "system") {
        moduleStatuses[key] = module.getStatus();
      }
    }

    const rendererData = StatusHelper.prepareForRenderer(moduleStatuses);

    return {
      type: "help",
      module: "system",
      data: {
        version: this.config.botVersion,
        userName: getUserName(callbackQuery.from),

        // 🆕 동적 명령어 생성
        commands: this.getAvailableCommands(),

        // 🆕 StatusHelper로 처리된 모듈 정보
        modules: rendererData.modules,

        // 🆕 시스템 추천사항
        recommendations: rendererData.recommendations,

        // 🆕 전체 시스템 건강도
        systemHealth: rendererData.overall
      }
    };
  }

  /**
   * 📊 시스템 상태 표시 (완전 강화!)
   */
  async showSystemStatus(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      // 🔧 SystemHelper로 완전한 시스템 스냅샷 수집
      const snapshot = getCompleteSystemSnapshot();

      // 📊 StatusHelper로 모듈 상태 분석
      const moduleStatuses = {};
      for (const [key, module] of moduleManager.modules) {
        moduleStatuses[key] = module.getStatus();
      }

      const statusData = StatusHelper.prepareForRenderer(moduleStatuses);

      // 🏥 마지막 건강도 체크 시간 업데이트
      this.systemStats.lastHealthCheck = Date.now();

      return {
        type: "status",
        module: "system",
        data: {
          // 🆕 완전한 시스템 정보 (SystemHelper)
          system: {
            platform: snapshot.basic.platform,
            nodeVersion: snapshot.basic.nodeVersion,
            pid: snapshot.basic.pid,
            uptime: formatUptime(snapshot.basic.uptime * 1000),
            memory: formatMemoryUsage(),
            arch: snapshot.basic.arch,

            // 고급 정보
            environment: snapshot.environment.nodeEnv,
            cloudProvider: snapshot.environment.cloud.provider,
            isDocker: snapshot.environment.cloud.isDocker,

            // 성능 정보
            cpuModel: snapshot.cpu.model,
            cpuCores: snapshot.cpu.cores,
            cpuUsage: snapshot.cpu.usage,

            // 네트워크 정보
            networkInterfaces: snapshot.network.count,
            hostname: snapshot.network.hostname,

            // 건강도 정보
            overallHealthScore: snapshot.health.overall.score,
            healthStatus: snapshot.health.overall.status,
            recommendations: snapshot.health.recommendations
          },

          // 🆕 상세 메모리 정보 (SystemHelper)
          memory: {
            process: snapshot.memory.process,
            system: snapshot.memory.system,
            health: snapshot.memory.health
          },

          // 🆕 StatusHelper로 처리된 모듈 정보
          modules: statusData.modules,
          moduleHealth: statusData.overall,

          // 기본 정보
          uptime: formatUptime(snapshot.basic.uptime * 1000),
          status:
            snapshot.health.overall.status === "excellent"
              ? "healthy"
              : "warning",
          moduleCount: statusData.modules.length,
          lastHealthCheck: this.systemStats.lastHealthCheck
        }
      };
    } catch (error) {
      logger.error("시스템 상태 조회 실패:", error);
      return {
        type: "error",
        message: "시스템 상태를 확인할 수 없습니다."
      };
    }
  }

  /**
   * 🏥 시스템 건강도 상세 표시 (새로 추가!)
   */
  async showSystemHealth(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      logger.debug("🏥 시스템 건강도 분석 시작...");

      // 시스템 스냅샷 수집
      const snapshot = getCompleteSystemSnapshot();

      // 모듈 상태를 안전하게 수집
      const moduleStatuses = this.collectModuleStatuses(moduleManager);

      // 상태 요약 생성
      const statusSummary =
        StatusHelper.summarizeMultipleStatuses(moduleStatuses);

      // 안전한 건강도 데이터 생성
      const healthData = this.createSafeHealthData(snapshot, statusSummary);

      logger.debug("✅ 시스템 건강도 분석 완료", {
        overallScore: healthData.overall.score,
        moduleCount: Object.keys(moduleStatuses).length,
        recommendationCount: healthData.recommendations.length
      });

      return {
        type: "health",
        module: "system",
        data: healthData
      };
    } catch (error) {
      logger.error("시스템 건강도 조회 실패:", error);

      // 폴백 데이터 제공
      return {
        type: "health",
        module: "system",
        data: {
          overall: {
            score: 0,
            status: "오류",
            timestamp: new Date().toISOString()
          },
          components: {
            memory: { score: 0, status: "알 수 없음" },
            cpu: { score: 0, status: "알 수 없음" },
            disk: { score: 0, status: "알 수 없음" },
            network: { score: 0, status: "알 수 없음" },
            modules: "오류"
          },
          recommendations: [
            "시스템 건강도를 확인할 수 없습니다. 시스템 재시작을 권장합니다."
          ],
          analysis: {
            strengths: [],
            concerns: ["시스템 건강도 분석 실패"],
            trends: {
              uptime: "알 수 없음",
              callbackRate: 0,
              activeUsers: 0,
              trend: "unknown"
            }
          }
        }
      };
    }
  }

  // ===== 🔧 강화된 헬퍼 메서드들 =====

  /**
   * 🔧 사용 가능한 명령어 목록 (동적 생성)
   */
  getAvailableCommands() {
    const systemCommands = [
      { command: "/start", description: "봇 시작 및 메인 메뉴" },
      { command: "/help", description: "도움말 보기" },
      { command: "/status", description: "시스템 상태 확인" }
    ];

    // 🆕 환경에 따른 동적 명령어 추가
    const snapshot = getCompleteSystemSnapshot();
    if (snapshot.environment?.cloud?.isRailway) {
      systemCommands.push({
        command: "/railway",
        description: "Railway 환경 정보"
      });
    }

    return systemCommands;
  }

  /**
   * 📊 통계 업데이트 (StatusHelper 통합)
   */
  updateStats(userId, action = "callback") {
    const oldStats = { ...this.systemStats };

    if (action === "callback") {
      this.systemStats.totalCallbacks++;
    } else if (action === "message") {
      this.systemStats.totalMessages++;
    }

    if (userId) {
      this.systemStats.uniqueUsers.add(userId);
    }

    this.systemStats.lastActivity = Date.now();

    // 🆕 StatusHelper로 변화 감지
    const change = StatusHelper.detectStatusChange(oldStats, this.systemStats);
    if (change.changed && change.needsAlert) {
      logger.info(`📊 시스템 통계 변화: ${change.message}`);
    }
  }

  /**
   * 💪 시스템 강점 분석 (새로 추가!)
   */
  analyzeStrengths(snapshot) {
    const strengths = [];

    if (snapshot.health.overall.score >= 90) {
      strengths.push("🏆 전체 시스템이 매우 안정적입니다");
    }

    if (snapshot.memory.health.score >= 80) {
      strengths.push("💾 메모리 사용량이 최적화되어 있습니다");
    }

    if (snapshot.cpu.health.score >= 80) {
      strengths.push("🖥️ CPU 성능이 우수합니다");
    }

    if (snapshot.basic.uptime > 86400) {
      // 1일 이상
      strengths.push("⏱️ 시스템이 장시간 안정적으로 작동 중입니다");
    }

    return strengths;
  }

  /**
   * ⚠️ 시스템 우려사항 분석 (새로 추가!)
   */
  analyzeConcerns(snapshot, statusSummary) {
    const concerns = [];

    if (snapshot.health.overall.score < 60) {
      concerns.push("🚨 전체 시스템 건강도가 낮습니다");
    }

    if (statusSummary.summary.critical > 0) {
      concerns.push(
        `❌ ${statusSummary.summary.critical}개 모듈이 위험 상태입니다`
      );
    }

    if (snapshot.memory.health.score < 50) {
      concerns.push("💾 메모리 사용량이 높습니다");
    }

    if (snapshot.cpu.usage > 80) {
      concerns.push("🖥️ CPU 사용률이 높습니다");
    }

    return concerns;
  }

  /**
   * 📈 시스템 트렌드 분석 (새로 추가!)
   */
  analyzeTrends() {
    const uptime = Date.now() - this.systemStats.startTime;
    const hourlyCallbacks =
      this.systemStats.totalCallbacks / (uptime / 3600000);

    return {
      uptime: formatUptime(uptime),
      callbackRate: Math.round(hourlyCallbacks * 100) / 100,
      activeUsers: this.systemStats.uniqueUsers.size,
      trend:
        hourlyCallbacks > 10 ? "high" : hourlyCallbacks > 5 ? "normal" : "low"
    };
  }

  /**
   * 📦 모듈 상태 표시 (누락된 메서드)
   */
  async showModuleStatus(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const _userId = getUserId(callbackQuery.from);

      // ModuleManager에서 모든 모듈 정보 수집
      const modules = [];
      if (moduleManager && moduleManager.modules) {
        for (const [moduleKey, moduleInstance] of moduleManager.modules) {
          const status = moduleInstance.getStatus
            ? moduleInstance.getStatus()
            : {
                moduleName: moduleKey,
                isInitialized: !!moduleInstance.isInitialized,
                actionCount: moduleInstance.actionMap
                  ? moduleInstance.actionMap.size
                  : 0
              };

          modules.push({
            key: moduleKey,
            displayName: status.moduleName || moduleKey,
            initialized: status.isInitialized,
            actionCount: status.actionCount,
            emoji: this.getModuleEmoji(moduleKey),
            category: this.getModuleCategory(moduleKey),
            hasService: !!moduleInstance.serviceBuilder,
            isCore: ["system", "navigation"].includes(moduleKey)
          });
        }
      }

      logger.info(`📊 모듈 상태 조회 - 총 ${modules.length}개 모듈`);

      return {
        type: "modules",
        module: "system",
        data: {
          modules,
          totalModules: modules.length,
          activeModules: modules.filter((m) => m.initialized).length,
          timestamp: new Date()
        }
      };
    } catch (error) {
      logger.error("SystemModule.showModuleStatus 오류:", error);
      return {
        type: "error",
        module: "system",
        data: { message: "모듈 상태를 조회하는 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * 🏓 핑 응답 처리 (누락된 메서드)
   */
  async handlePing(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const startTime = Date.now();
      const userId = getUserId(callbackQuery.from);
      const userName = getUserName(callbackQuery.from);

      // 간단한 응답 시간 측정
      const responseTime = Date.now() - startTime;

      // 통계 업데이트
      this.systemStats.totalCallbacks++;
      this.systemStats.uniqueUsers.add(userId);

      logger.debug(
        `🏓 핑 요청 - ${userName} (${userId}), 응답시간: ${responseTime}ms`
      );

      return {
        type: "ping",
        module: "system",
        data: {
          status: "pong",
          responseTime,
          userName,
          timestamp: new Date(),
          uptime: this.getUptime()
        }
      };
    } catch (error) {
      logger.error("SystemModule.handlePing 오류:", error);
      return {
        type: "error",
        module: "system",
        data: { message: "핑 처리 중 오류가 발생했습니다." }
      };
    }
  }

  /**
   * 🛡️ 안전한 시스템 스냅샷 검증
   */
  validateSystemSnapshot(snapshot) {
    const defaultSnapshot = {
      health: {
        overall: { score: 0, status: "알 수 없음" },
        recommendations: []
      },
      memory: { health: { score: 0, status: "알 수 없음" } },
      cpu: { health: { score: 0, status: "알 수 없음" } },
      disk: { health: { score: 0, status: "알 수 없음" } },
      network: { health: { score: 0, status: "알 수 없음" } },
      meta: { collectedAt: new Date().toISOString() }
    };

    return {
      ...defaultSnapshot,
      ...snapshot,
      health: {
        ...defaultSnapshot.health,
        ...snapshot?.health,
        overall: {
          ...defaultSnapshot.health.overall,
          ...snapshot?.health?.overall
        }
      }
    };
  }

  /**
   * 🔍 모듈 상태 수집 및 검증
   */
  collectModuleStatuses(moduleManager) {
    const moduleStatuses = {};

    try {
      if (moduleManager && moduleManager.modules) {
        for (const [key, module] of moduleManager.modules) {
          if (key !== "system") {
            // 자기 자신 제외
            try {
              const status = module.getStatus
                ? module.getStatus()
                : {
                    moduleName: key,
                    isInitialized: !!module.isInitialized,
                    actionCount: 0
                  };
              moduleStatuses[key] = status;
            } catch (moduleError) {
              logger.warn(`모듈 ${key} 상태 수집 실패:`, moduleError.message);
              moduleStatuses[key] = {
                moduleName: key,
                isInitialized: false,
                error: moduleError.message
              };
            }
          }
        }
      }
    } catch (error) {
      logger.error("모듈 상태 수집 중 오류:", error);
    }

    return moduleStatuses;
  }

  /**
   * 📊 건강도 데이터 안전 생성
   */
  createSafeHealthData(snapshot, statusSummary) {
    // 검증된 스냅샷 사용
    const safeSnapshot = this.validateSystemSnapshot(snapshot);

    // 안전한 추천사항 생성
    const systemRecommendations = Array.isArray(
      safeSnapshot.health.recommendations
    )
      ? safeSnapshot.health.recommendations
      : [];

    const moduleRecommendations = Array.isArray(statusSummary?.recommendations)
      ? statusSummary.recommendations
      : StatusHelper.generateRecommendations(statusSummary || {});

    return {
      overall: {
        score: safeSnapshot.health.overall.score,
        status: safeSnapshot.health.overall.status,
        timestamp: safeSnapshot.meta.collectedAt
      },
      components: {
        memory: safeSnapshot.memory.health,
        cpu: safeSnapshot.cpu.health,
        disk: safeSnapshot.disk.health,
        network: safeSnapshot.network.health,
        modules: statusSummary?.overall || "알 수 없음"
      },
      recommendations: [...systemRecommendations, ...moduleRecommendations],
      analysis: {
        strengths: this.analyzeStrengths(safeSnapshot),
        concerns: this.analyzeConcerns(safeSnapshot, statusSummary || {}),
        trends: this.analyzeTrends()
      }
    };
  }

  /**
   * 🎯 모듈 카테고리 분류 헬퍼
   */
  getModuleCategory(moduleKey) {
    const categoryMap = {
      system: "system",
      todo: "productivity",
      timer: "productivity",
      worktime: "work",
      fortune: "entertainment",
      tts: "utility"
    };
    return categoryMap[moduleKey] || "misc";
  }

  // 기존 메서드들 유지...
  getModuleEmoji(moduleKey) {
    const emojiMap = {
      todo: "📝",
      timer: "⏰",
      worktime: "🏢",
      system: "🤖"
    };
    return emojiMap[moduleKey] || "📦";
  }

  getBasicStats() {
    return {
      uptime: this.getUptime(),
      totalCallbacks: this.systemStats.totalCallbacks,
      uniqueUsers: this.systemStats.uniqueUsers.size
    };
  }

  getUptime() {
    const uptimeMs = Date.now() - this.systemStats.startTime;
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    return `${hours}시간 ${minutes}분`;
  }
}

module.exports = SystemModule;
