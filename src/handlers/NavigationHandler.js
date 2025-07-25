// src/handlers/NavigationHandler.js - "system" 키 통일 수정판
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎹 네비게이션 핸들러 v3.0.1 - "system" 키 통일
 *
 * 🔧 핵심 수정사항:
 * ✅ SystemModule → system 키로 변경
 * ✅ 깔끔한 콜백: system:menu, system:help, system:status
 * ✅ ModuleManager와 완벽 동기화
 */
class NavigationHandler {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.commandsRegistry = options.commandsRegistry;

    // 🎨 메뉴 테마 설정
    this.menuThemes = {
      main: {
        title: "🤖 **두목봇 v3.0.1**",
        subtitle: "원하는 기능을 선택해주세요.",
        colors: ["🔵", "🟢", "🟡", "🟠", "🔴", "🟣"],
      },
      system: {
        title: "⚙️ **시스템 메뉴**",
        subtitle: "시스템 관련 기능입니다.",
        colors: ["⚙️", "📊", "🔧", "🛠️"],
      },
    };

    // 📊 통계
    this.stats = {
      navigationsHandled: 0,
      menusGenerated: 0,
      errorsCount: 0,
      averageResponseTime: 0,
    };

    logger.info("🎹 NavigationHandler v3.0.1 생성됨 (system 키 통일)");
  }

  /**
   * 🎯 네비게이션 처리 (핵심 메서드)
   */
  async handleNavigation(bot, callbackQuery, subAction, params, moduleManager) {
    const startTime = Date.now();

    try {
      // 콜백 데이터 파싱
      const { moduleKey, action, additionalParams } = this.parseNavigationData(
        callbackQuery.data
      );

      logger.debug(
        `🎹 네비게이션: ${moduleKey}.${action}(${additionalParams.join(", ")})`
      );

      // 시스템 네비게이션 (직접 처리)
      if (moduleKey === "system" || moduleKey === "main") {
        return await this.handleSystemNavigation(
          bot,
          callbackQuery,
          action,
          additionalParams,
          moduleManager
        );
      }

      // 모듈 네비게이션 (ModuleManager로 위임)
      if (moduleManager && moduleManager.hasModule(moduleKey)) {
        const moduleInstance = moduleManager.getModule(moduleKey);

        if (moduleInstance && moduleInstance.handleCallback) {
          const handled = await moduleInstance.handleCallback(
            bot,
            callbackQuery,
            action,
            additionalParams,
            moduleManager
          );

          if (handled) {
            this.stats.navigationsHandled++;
            return true;
          }
        }
      }

      // 처리되지 않은 네비게이션
      await this.handleUnknownNavigation(bot, callbackQuery, moduleKey, action);
      return false;
    } catch (error) {
      logger.error("❌ 네비게이션 처리 오류:", error);
      this.stats.errorsCount++;

      await this.sendNavigationError(
        bot,
        callbackQuery,
        "네비게이션 처리 중 오류가 발생했습니다."
      );
      return false;
    } finally {
      // 응답 시간 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    }
  }

  /**
   * 🏛️ 시스템 네비게이션 처리 - ✅ "system" 키로 수정!
   */
  async handleSystemNavigation(
    bot,
    callbackQuery,
    action,
    params,
    moduleManager
  ) {
    logger.debug(`🏛️ 시스템 네비게이션: ${action}`);

    try {
      // ✅ 수정: "SystemModule" → "system"으로 변경!
      if (moduleManager && moduleManager.hasModule("system")) {
        const systemModule = moduleManager.getModule("system");

        if (systemModule && systemModule.handleCallback) {
          logger.debug(`🔄 SystemModule로 위임: ${action}`);
          return await systemModule.handleCallback(
            bot,
            callbackQuery,
            action,
            params,
            moduleManager
          );
        }
      }

      // ✅ 폴백: SystemModule이 없으면 NavigationHandler에서 직접 처리
      logger.warn("⚠️ SystemModule이 없음 - NavigationHandler에서 직접 처리");

      switch (action) {
        case "menu":
        case "start":
          return await this.showFallbackMainMenu(
            bot,
            callbackQuery,
            params,
            moduleManager
          );

        case "help":
          return await this.showFallbackHelp(bot, callbackQuery);

        case "status":
          return await this.showFallbackStatus(
            bot,
            callbackQuery,
            moduleManager
          );

        default:
          logger.warn(`❓ 알 수 없는 시스템 액션: ${action}`);
          await this.showUnknownAction(bot, callbackQuery, action);
          return false;
      }
    } catch (error) {
      logger.error("❌ 시스템 네비게이션 처리 오류:", error);
      await this.showNavigationError(
        bot,
        callbackQuery,
        "시스템 메뉴 처리 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  /**
   * 🏠 폴백 메인 메뉴 (SystemModule이 없을 때)
   */
  async showFallbackMainMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
        from,
      } = callbackQuery;

      const userName = getUserName(from);

      const menuText = `🤖 **두목봇 v3.0.1**

👋 안녕하세요, **${userName}**님!

⚠️ 시스템이 초기화 중입니다.
잠시 후 다시 시도해주세요.

**📊 시스템 현황**
- 🔄 SystemModule 로딩 중...
- ⏱️ 가동시간: ${this.formatUptime(process.uptime())}
- 🌍 환경: ${process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local"}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 재시작", callback_data: "system:menu" }],
          [{ text: "📊 시스템 상태", callback_data: "system:status" }],
        ],
      };

      await bot.editMessageText(menuText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 폴백 메인 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 🔍 네비게이션 데이터 파싱
   */
  parseNavigationData(callbackData) {
    if (!callbackData || typeof callbackData !== "string") {
      return {
        moduleKey: "system",
        action: "menu",
        additionalParams: [],
      };
    }

    const parts = callbackData.split(":");

    return {
      moduleKey: parts[0] || "system",
      action: parts[1] || "menu",
      additionalParams: parts.slice(2) || [],
    };
  }

  /**
   * ❓ 알 수 없는 네비게이션 처리
   */
  async handleUnknownNavigation(bot, callbackQuery, moduleKey, action) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const errorText = `❓ **알 수 없는 요청**

요청하신 기능을 찾을 수 없습니다:
- 모듈: ${moduleKey}
- 액션: ${action}

🔧 가능한 원인:
- 모듈이 아직 로드되지 않음
- 지원하지 않는 기능
- 일시적인 시스템 오류

메인 메뉴로 돌아가서 다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
          [{ text: "📊 시스템 상태", callback_data: "system:status" }],
        ],
      };

      await bot.editMessageText(errorText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 알 수 없는 네비게이션 처리 오류:", error);
      return false;
    }
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    try {
      if (this.stats.averageResponseTime === 0) {
        this.stats.averageResponseTime = responseTime;
      } else {
        this.stats.averageResponseTime = Math.round(
          (this.stats.averageResponseTime + responseTime) / 2
        );
      }
    } catch (error) {
      logger.debug("📊 응답 시간 통계 업데이트 오류:", error);
    }
  }

  /**
   * ⏰ 업타임 포맷팅
   */
  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  }

  /**
   * 🚨 네비게이션 오류 표시
   */
  async sendNavigationError(bot, callbackQuery, errorMessage) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const errorText = `🚨 **시스템 오류**

${errorMessage}

🔧 **해결 방법:**
- 🔄 메인 메뉴로 돌아가기
- 📊 시스템 상태 확인하기
- 잠시 후 다시 시도

⚠️ 문제가 지속되면 관리자에게 문의해주세요.
빠른 시일 내에 해결하겠습니다.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 재시작", callback_data: "system:menu" }],
        ],
      };

      await bot.editMessageText(errorText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ 네비게이션 오류 표시 실패:", error);
    }
  }

  /**
   * 📊 NavigationHandler 상태 조회
   */
  getStatus() {
    return {
      className: "NavigationHandler",
      version: "3.0.1",
      isHealthy: true,
      stats: {
        navigationsHandled: this.stats.navigationsHandled,
        menusGenerated: this.stats.menusGenerated,
        errorsCount: this.stats.errorsCount,
        averageResponseTime: this.stats.averageResponseTime,
      },
      config: {
        hasModuleManager: !!this.moduleManager,
        hasCommandsRegistry: !!this.commandsRegistry,
      },
      lastActivity: TimeHelper.getLogTimeString(),
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 NavigationHandler 정리 시작...");

      // 통계 초기화
      this.stats = {
        navigationsHandled: 0,
        menusGenerated: 0,
        errorsCount: 0,
        averageResponseTime: 0,
      };

      logger.info("✅ NavigationHandler 정리 완료");
    } catch (error) {
      logger.error("❌ NavigationHandler 정리 실패:", error);
    }
  }
}

module.exports = NavigationHandler;
