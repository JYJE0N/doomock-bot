// src/handlers/NavigationHandler.js - 🚨 즉시 수정: 모듈 키 불일치 해결
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎹 네비게이션 핸들러 v3.0.1 - 🚨 즉시 수정판
 *
 * 🔧 핵심 수정사항:
 * ✅ "system" → "SystemModule" 키로 수정 (ModuleManager와 일치)
 * ✅ 폴백 시스템 강화 (모듈 없어도 기본 동작)
 * ✅ 디버깅 로그 추가
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

    logger.info("🎹 NavigationHandler v3.0.1 생성됨 (키 수정판)");
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

      // 🚨 시스템 네비게이션 (키 수정!)
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
      logger.warn(`⚠️ 처리되지 않은 콜백: ${callbackQuery.data}`);
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
   * 🏛️ 시스템 네비게이션 처리 - ✅ SystemModule 키로 수정!
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
      // 🚨 핵심 수정: "system" → "SystemModule"로 변경!
      const possibleKeys = ["SystemModule", "system"]; // 호환성을 위해 둘 다 확인
      let systemModule = null;
      let foundKey = null;

      if (moduleManager) {
        // ModuleManager에서 사용 가능한 모든 키 확인
        logger.debug(
          "🔍 등록된 모듈 키들:",
          Array.from(moduleManager.moduleInstances?.keys() || [])
        );

        for (const key of possibleKeys) {
          if (moduleManager.hasModule(key)) {
            systemModule = moduleManager.getModule(key);
            foundKey = key;
            logger.debug(`✅ SystemModule 발견: ${key}`);
            break;
          }
        }
      }

      // SystemModule이 있으면 위임
      if (systemModule && systemModule.handleCallback) {
        logger.debug(`🔄 SystemModule로 위임: ${action} (키: ${foundKey})`);
        return await systemModule.handleCallback(
          bot,
          callbackQuery,
          action,
          params,
          moduleManager
        );
      }

      // ✅ 강화된 폴백: SystemModule이 없으면 NavigationHandler에서 직접 처리
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

      // 사용 가능한 모듈 확인
      const availableModules = [];
      if (moduleManager && moduleManager.getModuleList) {
        const moduleList = moduleManager.getModuleList();
        for (const module of moduleList) {
          if (module.active && module.key !== "SystemModule") {
            availableModules.push({
              name: module.name,
              key: module.key,
              emoji: this.getModuleEmoji(module.key),
            });
          }
        }
      }

      const menuText = `🤖 **두목봇 v3.0.1**

👋 안녕하세요, **${userName}**님!

⚠️ 시스템이 초기화 중입니다.
${
  availableModules.length > 0
    ? "일부 기능은 사용 가능합니다."
    : "잠시 후 다시 시도해주세요."
}

**📊 시스템 현황**
- 🔄 SystemModule 로딩 중...
- ⏱️ 가동시간: ${this.formatUptime(process.uptime())}
- 🌍 환경: ${process.env.RAILWAY_ENVIRONMENT ? "Railway" : "로컬"}
- 📦 활성 모듈: ${availableModules.length}개

${
  availableModules.length > 0
    ? `\n**🔧 사용 가능한 기능:**\n${availableModules
        .map((m) => `${m.emoji} ${m.name}`)
        .join("\n")}`
    : ""
}`;

      // 키보드 생성
      const keyboard = {
        inline_keyboard: [],
      };

      // 사용 가능한 모듈 버튼들
      for (const module of availableModules.slice(0, 6)) {
        // 최대 6개까지
        keyboard.inline_keyboard.push([
          {
            text: `${module.emoji} ${module.name}`,
            callback_data: `${module.key}:menu`,
          },
        ]);
      }

      // 시스템 버튼들
      keyboard.inline_keyboard.push([
        { text: "🔄 새로고침", callback_data: "system:menu" },
        { text: "📊 상태 확인", callback_data: "system:status" },
      ]);

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
   * ❓ 폴백 도움말 (SystemModule이 없을 때)
   */
  async showFallbackHelp(bot, callbackQuery) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const helpText = `❓ **두목봇 도움말**

🤖 **기본 명령어:**
- /start - 봇 시작 및 메인 메뉴
- /help - 이 도움말 표시
- /status - 시스템 상태 확인

⚠️ **현재 상태:**
시스템이 초기화 중입니다.
모든 기능이 곧 사용 가능해집니다.

🔧 **문제 해결:**
- 🔄 새로고침 버튼 클릭
- 잠시 후 다시 시도
- /start 명령어로 재시작

📞 **문의:**
문제가 지속되면 관리자에게 문의하세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
            { text: "📊 시스템 상태", callback_data: "system:status" },
          ],
        ],
      };

      await bot.editMessageText(helpText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 폴백 도움말 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📊 폴백 상태 (SystemModule이 없을 때)
   */
  async showFallbackStatus(bot, callbackQuery, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // 시스템 정보 수집
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const memoryMB = Math.round(memoryUsage.rss / 1024 / 1024);

      // 모듈 상태 확인
      let moduleStatus = "알 수 없음";
      let activeModules = 0;
      let totalModules = 0;

      if (moduleManager) {
        if (moduleManager.moduleInstances) {
          activeModules = moduleManager.moduleInstances.size;
        }
        if (moduleManager.moduleRegistry) {
          totalModules = moduleManager.moduleRegistry.size;
        }
        moduleStatus = `${activeModules}/${totalModules}개 활성`;
      }

      const statusText = `📊 **시스템 상태**

⏱️ **가동시간:** ${this.formatUptime(uptime)}
💾 **메모리 사용량:** ${memoryMB}MB
🌍 **환경:** ${process.env.RAILWAY_ENVIRONMENT ? "Railway" : "로컬"}

📦 **모듈 상태:** ${moduleStatus}
🔧 **SystemModule:** 초기화 중...
🗄️ **데이터베이스:** ${process.env.MONGODB_URI ? "연결됨" : "미설정"}

⚠️ **주의사항:**
시스템이 완전히 초기화되지 않았습니다.
잠시 후 다시 확인해주세요.

**🔄 마지막 확인:** ${TimeHelper.format(new Date(), "HH:mm:ss")}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:status" },
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      await bot.editMessageText(statusText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 폴백 상태 표시 오류:", error);
      return false;
    }
  }

  /**
   * ❓ 알 수 없는 액션 처리
   */
  async showUnknownAction(bot, callbackQuery, action) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const errorText = `❓ **알 수 없는 요청**

요청하신 기능을 찾을 수 없습니다: \`${action}\`

🔧 **해결 방법:**
- 🏠 메인 메뉴로 돌아가기
- 🔄 페이지 새로고침
- /start 명령어로 재시작

⚠️ 문제가 지속되면 관리자에게 문의하세요.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
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
      logger.error("❌ 알 수 없는 액션 표시 오류:", error);
      return false;
    }
  }

  /**
   * 🔍 콜백 데이터 파싱
   */
  parseNavigationData(callbackData) {
    try {
      const parts = callbackData.split(":");
      return {
        moduleKey: parts[0] || "system",
        action: parts[1] || "menu",
        additionalParams: parts.slice(2),
      };
    } catch (error) {
      logger.error("❌ 콜백 데이터 파싱 오류:", error);
      return {
        moduleKey: "system",
        action: "menu",
        additionalParams: [],
      };
    }
  }

  /**
   * 🔍 알 수 없는 네비게이션 처리
   */
  async handleUnknownNavigation(bot, callbackQuery, moduleKey, action) {
    logger.warn(`❓ 알 수 없는 네비게이션: ${moduleKey}:${action}`);

    // 기본 메뉴로 리다이렉트
    return await this.showFallbackMainMenu(
      bot,
      callbackQuery,
      [],
      this.moduleManager
    );
  }

  /**
   * 📱 모듈 이모지 반환
   */
  getModuleEmoji(moduleKey) {
    const emojiMap = {
      TodoModule: "📝",
      TimerModule: "⏰",
      WorktimeModule: "🕐",
      LeaveModule: "🏖️",
      ReminderModule: "🔔",
      FortuneModule: "🔮",
      WeatherModule: "🌤️",
      TTSModule: "🎤",
    };
    return emojiMap[moduleKey] || "🔧";
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
   * 🚀 명령어에서 메인 메뉴 표시 (CommandHandler용)
   */
  async showMainMenuFromCommand(bot, chatId, userName) {
    try {
      const menuText = `🤖 **두목봇 v3.0.1**

👋 안녕하세요, **${userName}**님!
원하는 기능을 선택해주세요.

⚠️ 시스템 초기화 중...
잠시 후 모든 기능이 사용 가능해집니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:menu" },
            { text: "📊 시스템 상태", callback_data: "system:status" },
          ],
          [{ text: "❓ 도움말", callback_data: "system:help" }],
        ],
      };

      await bot.sendMessage(chatId, menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("❌ 명령어 메인 메뉴 표시 실패:", error);
      return false;
    }
  }

  /**
   * ❓ 명령어에서 도움말 표시 (CommandHandler용)
   */
  async showHelpFromCommand(bot, chatId) {
    try {
      return await this.showFallbackHelp(bot, {
        message: { chat: { id: chatId }, message_id: null },
      });
    } catch (error) {
      logger.error("❌ 명령어 도움말 표시 실패:", error);
      return false;
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
