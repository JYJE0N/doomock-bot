// src/handlers/NavigationHandler.js - 수정된 버전 v3.0.1 🎹
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🎹 NavigationHandler v3.0.1 - 문법 오류 수정
 *
 * 🎯 역할:
 * ✅ 모든 인라인키보드 생성 중앙관리
 * ✅ 시스템 네비게이션 직접 처리
 * ✅ 모듈 네비게이션 ModuleManager 위임
 * ✅ 일관된 UI/UX 디자인 시스템
 * ✅ 콜백 데이터 파싱 및 라우팅
 */
class NavigationHandler {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.moduleManager = options.moduleManager;
    this.commandsRegistry = options.commandsRegistry;

    // 🎨 UI 디자인 시스템
    this.uiTheme = {
      // 색상 팔레트
      colors: {
        primary: "🔵",
        success: "🟢",
        warning: "🟡",
        danger: "🔴",
        info: "🔵",
        system: "⚙️",
      },

      // 아이콘 세트
      icons: {
        menu: "📱",
        back: "🔙",
        home: "🏠",
        help: "❓",
        status: "📊",
        settings: "⚙️",
        refresh: "🔄",
        add: "➕",
        list: "📋",
        search: "🔍",
        edit: "✏️",
        delete: "🗑️",
        toggle: "🔄",
        save: "💾",
        cancel: "❌",
      },

      // 버튼 스타일
      buttonStyles: {
        primary: { maxWidth: 2, priority: 1 },
        secondary: { maxWidth: 3, priority: 2 },
        action: { maxWidth: 4, priority: 3 },
      },
    };

    // 📊 통계
    this.stats = {
      navigationsHandled: 0,
      keyboardsGenerated: 0,
      errorsCount: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
    };

    // 🔄 콜백 캐시 (중복 처리 방지)
    this.callbackCache = new Map();
    this.cacheTimeout = 5000; // 5초

    logger.info("🎹 NavigationHandler v3.0.1 완전 구현 시작!");
  }

  /**
   * 🎯 네비게이션 처리 (메인 엔트리포인트) - 문법 오류 수정
   */
  async handleNavigation(bot, callbackQuery, subAction, params, moduleManager) {
    const startTime = Date.now();

    try {
      // 중복 처리 방지
      const callbackId = callbackQuery.id;
      if (this.callbackCache.has(callbackId)) {
        logger.debug(`🔄 중복 네비게이션 콜백 무시: ${callbackId}`);
        return true;
      }
      this.callbackCache.set(callbackId, true);
      setTimeout(
        () => this.callbackCache.delete(callbackId),
        this.cacheTimeout
      );

      // ✅ 수정된 콜백 데이터 파싱
      const { moduleKey, action, additionalParams } = this.parseCallbackData(
        callbackQuery.data
      );

      // ✅ 올바른 로깅 형식 (콜론 사용)
      logger.debug(
        `🎹 NavigationHandler: ${moduleKey}:${action} (${additionalParams.join(
          ", "
        )})`
      );

      // 시스템 네비게이션 (직접 처리)
      if (moduleKey === "system" || moduleKey === "main") {
        const handled = await this.handleSystemNavigation(
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

      // 모듈 네비게이션 (ModuleManager로 위임)
      if (moduleManager && moduleManager.hasModule(moduleKey)) {
        const moduleInstance = moduleManager.getModule(moduleKey);

        if (
          moduleInstance &&
          typeof moduleInstance.handleCallback === "function"
        ) {
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

      // ✅ 중요: try 블록이 여기서 끝남 - 누락된 중괄호 추가
    } catch (error) {
      logger.error("❌ NavigationHandler 오류:", error);
      this.stats.errorsCount++;
      await this.showSystemError(
        bot,
        callbackQuery,
        "네비게이션 처리 중 오류가 발생했습니다."
      );

      // 응답 시간 기록
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);

      return false;
    } finally {
      // 콜백 쿼리 응답 (항상 실행)
      try {
        await bot.answerCallbackQuery(callbackQuery.id);
      } catch (finalError) {
        logger.debug("콜백 쿼리 응답 중 오류:", finalError);
      }
    }
  }

  /**
   * 🎯 시스템 네비게이션 처리 (직접 처리)
   */
  async handleSystemNavigation(
    bot,
    callbackQuery,
    action,
    params,
    moduleManager
  ) {
    try {
      switch (action) {
        case "menu":
          return await this.showMainMenu(bot, callbackQuery, moduleManager);

        case "status":
          return await this.showStatusMenu(bot, callbackQuery, moduleManager);

        case "help":
          return await this.showHelpMenu(bot, callbackQuery, moduleManager);

        case "settings":
          return await this.showSettingsMenu(bot, callbackQuery, moduleManager);

        case "about":
          return await this.showAboutMenu(bot, callbackQuery);

        default:
          logger.warn(`❓ 알 수 없는 시스템 액션: ${action}`);
          await this.showUnknownAction(bot, callbackQuery, action);
          return false;
      }
    } catch (error) {
      logger.error("❌ 시스템 네비게이션 처리 오류:", error);
      await this.showSystemError(
        bot,
        callbackQuery,
        "시스템 기능 처리 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMainMenu(bot, callbackQuery, moduleManager) {
    try {
      const mainMenuText = this.buildMainMenuText(moduleManager);
      const keyboard = this.buildMainMenuKeyboard(moduleManager);

      await this.updateMessage(bot, callbackQuery, mainMenuText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 메인 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 메인 메뉴 텍스트 생성
   */
  buildMainMenuText(moduleManager) {
    const activeModules = this.getActiveModules(moduleManager);
    const uptime = this.formatUptime(process.uptime());

    let text = `🏠 **두목봇 v3.0.1 메인 메뉴**\n\n`;
    text += `👋 안녕하세요! 사용하실 기능을 선택해주세요.\n\n`;

    // 시스템 정보
    text += `⚡ **시스템 상태**\n`;
    text += `• 가동시간: ${uptime}\n`;
    text += `• 활성 모듈: ${activeModules.length}개\n`;
    text += `• 처리된 요청: ${this.stats.navigationsHandled}회\n\n`;

    // 사용 가능한 모듈들
    if (activeModules.length > 0) {
      text += `📦 **사용 가능한 모듈**\n`;
      activeModules.slice(0, 3).forEach((module) => {
        text += `• ${module.emoji} ${module.name}: ${module.description}\n`;
      });

      if (activeModules.length > 3) {
        text += `• ... 외 ${activeModules.length - 3}개 모듈\n`;
      }
    } else {
      text += `⚠️ **모듈 없음**\n현재 사용 가능한 모듈이 없습니다.\n`;
    }

    text += `\n🎹 NavigationHandler를 통해 처리됩니다.`;

    return text;
  }

  /**
   * 🎮 메인 메뉴 키보드 생성
   */
  buildMainMenuKeyboard(moduleManager) {
    const keyboard = { inline_keyboard: [] };
    const activeModules = this.getActiveModules(moduleManager);

    // 활성 모듈 버튼들 (2개씩 배치)
    for (let i = 0; i < activeModules.length; i += 2) {
      const row = [];

      // 첫 번째 모듈
      const module1 = activeModules[i];
      row.push({
        text: `${module1.emoji} ${module1.shortName}`,
        callback_data: `${module1.key}:menu`,
      });

      // 두 번째 모듈 (있으면)
      if (i + 1 < activeModules.length) {
        const module2 = activeModules[i + 1];
        row.push({
          text: `${module2.emoji} ${module2.shortName}`,
          callback_data: `${module2.key}:menu`,
        });
      }

      keyboard.inline_keyboard.push(row);
    }

    // 시스템 메뉴
    keyboard.inline_keyboard.push([
      { text: "📊 상태", callback_data: "system:status" },
      { text: "❓ 도움말", callback_data: "system:help" },
      { text: "⚙️ 설정", callback_data: "system:settings" },
    ]);

    return keyboard;
  }

  /**
   * 📊 상태 메뉴 표시
   */
  async showStatusMenu(bot, callbackQuery, moduleManager) {
    try {
      const statusText = this.buildStatusText(moduleManager);
      const keyboard = this.buildStatusKeyboard();

      await this.updateMessage(bot, callbackQuery, statusText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 상태 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 상태 텍스트 생성
   */
  buildStatusText(moduleManager) {
    const memoryUsage = process.memoryUsage();
    const uptime = this.formatUptime(process.uptime());
    const activeModules = this.getActiveModules(moduleManager);

    let text = `📊 **시스템 상태**\n\n`;

    // 시스템 정보
    text += `**🖥️ 시스템 정보**\n`;
    text += `• 버전: v3.0.1\n`;
    text += `• 환경: ${process.env.RAILWAY_ENVIRONMENT || "개발"}\n`;
    text += `• 가동시간: ${uptime}\n`;
    text += `• Node.js: ${process.version}\n\n`;

    // 메모리 사용량
    text += `**💾 메모리 사용량**\n`;
    text += `• RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(1)}MB\n`;
    text += `• Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(
      1
    )}MB\n`;
    text += `• Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(
      1
    )}MB\n\n`;

    // 모듈 상태
    text += `**📦 모듈 상태**\n`;
    text += `• 전체 모듈: ${
      moduleManager ? moduleManager.getModuleList().length : 0
    }개\n`;
    text += `• 활성 모듈: ${activeModules.length}개\n`;
    text += `• 비활성 모듈: ${
      moduleManager
        ? moduleManager.getModuleList().length - activeModules.length
        : 0
    }개\n\n`;

    // NavigationHandler 통계
    text += `**🎹 NavigationHandler 통계**\n`;
    text += `• 처리된 네비게이션: ${this.stats.navigationsHandled}회\n`;
    text += `• 생성된 키보드: ${this.stats.keyboardsGenerated}개\n`;
    text += `• 오류 발생: ${this.stats.errorsCount}회\n`;
    text += `• 평균 응답시간: ${this.stats.averageResponseTime}ms\n\n`;

    // 상태 아이콘
    const healthIcon =
      this.stats.errorsCount < 5
        ? "🟢"
        : this.stats.errorsCount < 20
        ? "🟡"
        : "🔴";
    text += `${healthIcon} **시스템 건강도**: ${
      this.stats.errorsCount < 5
        ? "양호"
        : this.stats.errorsCount < 20
        ? "주의"
        : "위험"
    }`;

    return text;
  }

  /**
   * 🎮 상태 키보드 생성
   */
  buildStatusKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "💾 메모리 정리", callback_data: "system:cleanup" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  /**
   * ❓ 도움말 메뉴 표시
   */
  async showHelpMenu(bot, callbackQuery, moduleManager) {
    try {
      const helpText = this.buildHelpText(moduleManager);
      const keyboard = this.buildHelpKeyboard();

      await this.updateMessage(bot, callbackQuery, helpText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 도움말 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 도움말 텍스트 생성
   */
  buildHelpText(moduleManager) {
    const activeModules = this.getActiveModules(moduleManager);

    let text = `❓ **두목봇 도움말**\n\n`;
    text += `🤖 **두목봇이란?**\n`;
    text += `업무 효율성을 위한 다기능 텔레그램 봇입니다.\n\n`;

    text += `🎮 **기본 사용법**\n`;
    text += `• 메뉴에서 원하는 기능을 선택하세요\n`;
    text += `• 각 모듈별로 다양한 기능을 제공합니다\n`;
    text += `• /start 명령어로 언제든 메인 메뉴로 돌아올 수 있습니다\n\n`;

    // 사용 가능한 모듈 설명
    if (activeModules.length > 0) {
      text += `📦 **사용 가능한 모듈**\n`;
      activeModules.forEach((module) => {
        text += `• ${module.emoji} **${module.name}**: ${module.description}\n`;
      });
      text += `\n`;
    }

    text += `💡 **팁**\n`;
    text += `• 상태 메뉴에서 시스템 상태를 확인할 수 있습니다\n`;
    text += `• 각 기능은 직관적인 버튼으로 조작할 수 있습니다\n`;
    text += `• 문제가 있을 때는 메인 메뉴로 돌아가 보세요\n\n`;

    text += `📞 **지원**\n`;
    text += `문제가 지속되면 시스템 관리자에게 문의하세요.`;

    return text;
  }

  /**
   * 🎮 도움말 키보드 생성
   */
  buildHelpKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🎯 사용 가이드", callback_data: "system:guide" },
          { text: "🆘 문제해결", callback_data: "system:troubleshoot" },
        ],
        [{ text: "💡 기능 제안", callback_data: "system:feature_request" }],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  /**
   * ⚙️ 설정 메뉴 표시
   */
  async showSettingsMenu(bot, callbackQuery, moduleManager) {
    try {
      const settingsText = this.buildSettingsText();
      const keyboard = this.buildSettingsKeyboard();

      await this.updateMessage(bot, callbackQuery, settingsText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 설정 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 설정 텍스트 생성
   */
  buildSettingsText() {
    let text = `⚙️ **시스템 설정**\n\n`;

    text += `🎹 **NavigationHandler 설정**\n`;
    text += `• 캐시 타임아웃: ${this.cacheTimeout}ms\n`;
    text += `• UI 테마: 기본 테마\n`;
    text += `• 버튼 스타일: 현대적\n\n`;

    text += `📊 **현재 통계**\n`;
    text += `• 처리된 네비게이션: ${this.stats.navigationsHandled}회\n`;
    text += `• 생성된 키보드: ${this.stats.keyboardsGenerated}개\n`;
    text += `• 평균 응답시간: ${this.stats.averageResponseTime}ms\n\n`;

    text += `🔧 **시스템 정보**\n`;
    text += `• 버전: v3.0.1\n`;
    text += `• 환경: ${process.env.RAILWAY_ENVIRONMENT || "개발"}\n`;
    text += `• 업타임: ${this.formatUptime(process.uptime())}\n\n`;

    text += `⚠️ **주의사항**\n`;
    text += `설정 변경은 시스템 관리자만 가능합니다.`;

    return text;
  }

  /**
   * 🎮 설정 키보드 생성
   */
  buildSettingsKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🎨 테마 설정", callback_data: "system:theme_settings" },
          {
            text: "🔔 알림 설정",
            callback_data: "system:notification_settings",
          },
        ],
        [
          { text: "🧹 캐시 정리", callback_data: "system:clear_cache" },
          { text: "📊 상세 통계", callback_data: "system:detailed_stats" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  /**
   * ℹ️ 정보 메뉴 표시
   */
  async showAboutMenu(bot, callbackQuery) {
    try {
      const aboutText = this.buildAboutText();
      const keyboard = this.buildAboutKeyboard();

      await this.updateMessage(bot, callbackQuery, aboutText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 정보 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 정보 텍스트 생성
   */
  buildAboutText() {
    const startTime = new Date(Date.now() - process.uptime() * 1000);

    let text = `ℹ️ **두목봇 정보**\n\n`;

    text += `🤖 **봇 정보**\n`;
    text += `• 이름: 두목봇\n`;
    text += `• 버전: v3.0.1\n`;
    text += `• 아키텍처: NavigationHandler 중심\n`;
    text += `• 런타임: Node.js ${process.version}\n\n`;

    text += `⚡ **주요 특징**\n`;
    text += `• 🎹 중앙집중식 네비게이션 시스템\n`;
    text += `• 📦 모듈화된 기능 구조\n`;
    text += `• 🔄 실시간 상태 모니터링\n`;
    text += `• 🎨 일관된 UI/UX 디자인\n`;
    text += `• 📊 자세한 통계 및 로깅\n\n`;

    text += `📅 **시작 시간**\n`;
    text += `${TimeHelper.format(startTime, "YYYY-MM-DD HH:mm:ss")} KST\n\n`;

    text += `🏭 **개발 정보**\n`;
    text += `• 플랫폼: Railway\n`;
    text += `• 아키텍처: 마이크로서비스\n`;
    text += `• 데이터베이스: MongoDB\n`;
    text += `• 캐싱: 메모리 기반\n\n`;

    text += `© 2025 두목봇 v3.0.1 - NavigationHandler 구동`;

    return text;
  }

  /**
   * 🎮 정보 키보드 생성
   */
  buildAboutKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📊 시스템 상태", callback_data: "system:status" },
          { text: "⚙️ 설정", callback_data: "system:settings" },
        ],
        [{ text: "💡 기능 제안", callback_data: "system:feature_request" }],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  // ===== 🔧 유틸리티 메서드들 =====

  /**
   * 📋 활성 모듈 목록 조회
   */
  getActiveModules(moduleManager) {
    if (!moduleManager) return [];

    try {
      const modules = moduleManager.getActiveModulesStatus();
      return modules
        .map((module) => ({
          key: module.key,
          name: module.name,
          shortName: module.name.substring(0, 4),
          emoji: this.getModuleEmoji(module.key),
          description: module.description || `${module.name} 기능`,
          priority: module.priority || 99,
        }))
        .sort((a, b) => a.priority - b.priority);
    } catch (error) {
      logger.error("활성 모듈 조회 오류:", error);
      return [];
    }
  }

  /**
   * 🎨 모듈 이모지 매핑
   */
  getModuleEmoji(moduleKey) {
    const emojiMap = {
      todo: "📝",
      timer: "⏰",
      worktime: "🕐",
      vacation: "🏖️",
      system: "⚙️",
      example: "📱",
      demo: "🎪",
      test: "🧪",
    };

    return emojiMap[moduleKey] || "📦";
  }

  /**
   * 🔧 콜백 데이터 파싱
   */
  parseCallbackData(callbackData) {
    try {
      if (!callbackData || typeof callbackData !== "string") {
        logger.warn("❓ NavigationHandler: 빈 콜백 데이터");
        return {
          moduleKey: "system",
          action: "menu",
          additionalParams: [],
        };
      }

      // ✅ 콜론(:) 기준으로 파싱
      const parts = callbackData.split(":");

      const result = {
        moduleKey: parts[0] || "system",
        action: parts[1] || "menu",
        additionalParams: parts.slice(2) || [],
      };

      // ✅ 상세 디버그 로그
      if (logger.level === "debug") {
        logger.debug(
          `🎹 Navigation 파싱: "${callbackData}" → ${result.moduleKey}:${
            result.action
          }${
            result.additionalParams.length > 0
              ? `:${result.additionalParams.join(":")}`
              : ""
          }`
        );
      }

      return result;
    } catch (error) {
      logger.error("❌ NavigationHandler 콜백 파싱 오류:", error);
      return {
        moduleKey: "system",
        action: "menu",
        additionalParams: [],
      };
    }
  }

  /**
   * 📝 메시지 업데이트
   */
  async updateMessage(bot, callbackQuery, text, keyboard) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      // 콜백 쿼리 응답은 handleNavigation에서 처리됨
    } catch (error) {
      logger.error("메시지 업데이트 오류:", error);
      throw error; // 상위에서 처리하도록 다시 던짐
    }
  }

  /**
   * 🚨 시스템 오류 표시
   */
  async showSystemError(bot, callbackQuery, errorMessage) {
    try {
      const errorText = `🚨 **시스템 오류**\n\n${errorMessage}\n\n🔧 **해결 방법:**\n• 🔄 메인 메뉴로 돌아가기\n• 📊 시스템 상태 확인\n• 잠시 후 다시 시도\n\n⚠️ 문제가 지속되면 관리자에게 문의해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 메인 메뉴", callback_data: "system:menu" },
            { text: "📊 시스템 상태", callback_data: "system:status" },
          ],
        ],
      };

      await this.updateMessage(bot, callbackQuery, errorText, keyboard);
    } catch (error) {
      logger.error("❌ 시스템 오류 표시 실패:", error);
    }
  }

  /**
   * ❓ 알 수 없는 액션 처리
   */
  async showUnknownAction(bot, callbackQuery, action) {
    const errorText = `❓ **알 수 없는 액션**\n\n\`${action}\` 액션을 찾을 수 없습니다.\n\n메인 메뉴로 돌아가서 다시 시도해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.updateMessage(bot, callbackQuery, errorText, keyboard);
  }

  /**
   * ❓ 알 수 없는 네비게이션 처리
   */
  async handleUnknownNavigation(bot, callbackQuery, moduleKey, action) {
    // ✅ 올바른 형식으로 로깅
    logger.warn(`❓ 처리되지 않은 네비게이션: ${moduleKey}:${action}`);

    const errorText = `❓ **처리할 수 없는 요청**\n\n모듈: \`${moduleKey}\`\n액션: \`${action}\`\n\n해당 기능이 아직 구현되지 않았거나\n모듈이 비활성화되었습니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          { text: "📊 시스템 상태", callback_data: "system:status" },
        ],
      ],
    };

    await this.updateMessage(bot, callbackQuery, errorText, keyboard);
  }

  /**
   * ⏱️ 업타임 포맷팅
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}일 ${hours}시간`;
    } else if (hours > 0) {
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
      this.stats.totalResponseTime += responseTime;

      if (this.stats.navigationsHandled === 0) {
        this.stats.averageResponseTime = responseTime;
      } else {
        this.stats.averageResponseTime = Math.round(
          this.stats.totalResponseTime / (this.stats.navigationsHandled + 1)
        );
      }
    } catch (error) {
      logger.debug("📊 응답 시간 통계 업데이트 오류:", error);
    }
  }

  /**
   * 📊 NavigationHandler 상태 조회
   */
  getStatus() {
    return {
      className: "NavigationHandler",
      version: "3.0.1",
      isHealthy: this.stats.errorsCount < 10,
      stats: {
        navigationsHandled: this.stats.navigationsHandled,
        keyboardsGenerated: this.stats.keyboardsGenerated,
        errorsCount: this.stats.errorsCount,
        averageResponseTime: this.stats.averageResponseTime,
      },
      config: {
        hasModuleManager: !!this.moduleManager,
        hasCommandsRegistry: !!this.commandsRegistry,
        cacheTimeout: this.cacheTimeout,
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

      // 캐시 정리
      this.callbackCache.clear();

      // 통계 초기화
      this.stats = {
        navigationsHandled: 0,
        keyboardsGenerated: 0,
        errorsCount: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
      };

      logger.info("✅ NavigationHandler 정리 완료");
    } catch (error) {
      logger.error("❌ NavigationHandler 정리 실패:", error);
    }
  }
}

module.exports = NavigationHandler;
