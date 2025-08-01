// src/modules/SystemModule.js - 표준 매개변수 적용 버전
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");
const os = require("os");

class SystemModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.config = {
      maxLogLines: 50,
      botVersion: process.env.BOT_VERSION || "4.0.0",
      enableDetailedStats: true,
      ...options.config,
    };

    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      uniqueUsers: new Set(),
    };
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      // 필요한 서비스 초기화
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
      // about: this.showAbout,
      status: this.showSystemStatus,
      // info: this.showSystemInfo,
      // health: this.showHealthStatus,
      modules: this.showModuleStatus,
      // stats: this.showSystemStats,
      // logs: this.showRecentLogs,
      ping: this.handlePing,
      // version: this.showVersion,
    });
  }

  /**
   * 🏠 메인 메뉴 (표준 매개변수 5개)
   */
  async showMainMenu(bot, callbackQuery, subAction, params, moduleManager) {
    const userName = getUserName(callbackQuery.from);
    const activeModules = Array.from(moduleManager.modules.keys());

    return {
      type: "menu",
      module: "system",
      data: {
        userName,
        activeModules: activeModules.map((key) => ({
          key,
          name: key.charAt(0).toUpperCase() + key.slice(1),
          emoji: this.getModuleEmoji(key),
        })),
        systemStats: this.getBasicStats(),
      },
    };
  }

  /**
   * ❓ 도움말 표시 (표준 매개변수 5개)
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    return {
      type: "help",
      module: "system",
      data: {
        version: this.config.botVersion,
        commands: this.getAvailableCommands(),
        modules: this.getModulesInfo(moduleManager),
      },
    };
  }

  /**
   * 📊 시스템 상태 표시 (표준 매개변수 5개)
   */
  async showSystemStatus(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      return {
        type: "status",
        module: "system",
        data: {
          system: this.getSystemInfo(),
          process: this.getProcessInfo(),
          modules: this.getModulesStatusData(moduleManager),
        },
      };
    } catch (error) {
      logger.error("시스템 상태 조회 실패:", error);
      return {
        type: "error",
        message: "시스템 상태를 확인할 수 없습니다.",
      };
    }
  }

  /**
   * 📱 모듈 상태 표시 (표준 매개변수 5개)
   */
  async showModuleStatus(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const modulesData = this.getModulesStatusData(moduleManager);

      return {
        type: "modules",
        module: "system",
        data: modulesData,
      };
    } catch (error) {
      logger.error("모듈 상태 조회 실패:", error);
      return {
        type: "error",
        message: "모듈 상태를 확인할 수 없습니다.",
      };
    }
  }

  /**
   * 🏓 핑 처리 (표준 매개변수 5개)
   */
  async handlePing(bot, callbackQuery, subAction, params, moduleManager) {
    const startTime = Date.now();
    const responseTime = Date.now() - startTime;

    return {
      type: "ping",
      module: "system",
      data: {
        responseTime,
        status: "pong",
      },
    };
  }

  // 헬퍼 메서드들...
  getModuleEmoji(moduleKey) {
    const emojiMap = {
      todo: "📝",
      timer: "⏰",
      worktime: "🏢",
      system: "🤖",
    };
    return emojiMap[moduleKey] || "📦";
  }

  getBasicStats() {
    return {
      uptime: this.getUptime(),
      totalCallbacks: this.systemStats.totalCallbacks,
      uniqueUsers: this.systemStats.uniqueUsers.size,
    };
  }

  getUptime() {
    const uptimeMs = Date.now() - this.systemStats.startTime;
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    return `${hours}시간 ${minutes}분`;
  }

  getModulesStatusData(moduleManager) {
    const modules = [];
    for (const [key, module] of moduleManager.modules) {
      modules.push({
        name: key,
        status: module.getStatus(),
        initialized: module.isInitialized,
      });
    }
    return modules;
  }
}

module.exports = SystemModule;
