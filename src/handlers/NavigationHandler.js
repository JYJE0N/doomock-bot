// src/handlers/NavigationHandler.js - system:menu 처리 완전 구현본 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🎹 NavigationHandler v3.0.1 - system:menu 처리 완전 구현본
 *
 * 🎯 핵심 수정사항:
 * - handleSystemNavigation 완전 구현 ⭐
 * - system:menu 콜백 처리 완성
 * - SystemModule과 완전 연동
 * - 폴백(fallback) 시스템 구현
 * - 에러 처리 완성
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

    logger.info("🎹 NavigationHandler 생성 완료");
  }

  /**
   * 🎯 네비게이션 처리 (메인 엔트리포인트)
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

      // ✅ 콜백 데이터 파싱
      const { moduleKey, action, additionalParams } = this.parseCallbackData(
        callbackQuery.data
      );

      logger.debug(`🎹 NavigationHandler: ${moduleKey}:${action}`);

      // ✅ 시스템 네비게이션 (직접 처리)
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
          this.updateResponseTimeStats(Date.now() - startTime);
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
            this.updateResponseTimeStats(Date.now() - startTime);
            return true;
          }
        }
      }

      // 처리되지 않은 네비게이션
      logger.warn(`⚠️ ❓ 처리되지 않은 네비게이션: ${moduleKey}:${action}`);
      await this.handleUnknownNavigation(bot, callbackQuery, moduleKey, action);
      return false;
    } catch (error) {
      logger.error("❌ ❌ NavigationHandler 오류:", error);
      this.stats.errorsCount++;
      await this.showSystemError(
        bot,
        callbackQuery,
        "네비게이션 처리 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  /**
   * 🎯 시스템 네비게이션 처리 (완전 구현!)
   */
  async handleSystemNavigation(
    bot,
    callbackQuery,
    action,
    params,
    moduleManager
  ) {
    logger.debug(`🎹 시스템 네비게이션: ${action}`);

    try {
      // ✅ 액션에 따라 처리
      switch (action) {
        case "menu":
        case "start":
          return await this.handleMainMenuRequest(
            bot,
            callbackQuery,
            moduleManager
          );

        case "help":
          return await this.handleHelpRequest(
            bot,
            callbackQuery,
            moduleManager
          );

        case "status":
          return await this.handleStatusRequest(
            bot,
            callbackQuery,
            moduleManager
          );

        case "settings":
          return await this.handleSettingsRequest(
            bot,
            callbackQuery,
            moduleManager
          );

        case "about":
          return await this.handleAboutRequest(
            bot,
            callbackQuery,
            moduleManager
          );

        default:
          logger.warn(`❓ 알 수 없는 시스템 액션: ${action}`);
          return await this.showUnknownSystemAction(bot, callbackQuery, action);
      }
    } catch (error) {
      logger.error("❌ ❌ 시스템 네비게이션 오류:", error);
      return await this.showSystemError(bot, callbackQuery, error.message);
    }
  }

  /**
   * 🏠 메인 메뉴 요청 처리 (핵심!)
   */
  async handleMainMenuRequest(bot, callbackQuery, moduleManager) {
    try {
      logger.debug("🏠 메인 메뉴 요청 처리 시작");

      // 1. SystemModule 찾기
      let systemModule = null;

      if (moduleManager && moduleManager.hasModule) {
        // ModuleManager의 정확한 키 확인
        const possibleKeys = ["SystemModule", "system", "System"];
        for (const key of possibleKeys) {
          if (moduleManager.hasModule(key)) {
            systemModule = moduleManager.getModule(key);
            logger.debug(`✅ SystemModule 발견: ${key}`);
            break;
          }
        }
      }

      // 2. SystemModule이 있는 경우 - 데이터 요청
      if (systemModule && typeof systemModule.handleMenuAction === "function") {
        logger.debug("🔧 SystemModule에서 데이터 요청");

        const result = await systemModule.handleMenuAction(
          bot,
          callbackQuery,
          "menu",
          [],
          moduleManager
        );

        if (result && result.success && result.data) {
          // NavigationHandler에서 UI 생성
          const menuText = this.buildMainMenuText(result.data);
          const keyboard = this.buildMainMenuKeyboard(
            result.data,
            moduleManager
          );

          await this.updateMessage(bot, callbackQuery, menuText, keyboard);
          this.stats.keyboardsGenerated++;

          logger.debug("✅ 메인 메뉴 표시 성공 (SystemModule 연동)");
          return true;
        } else {
          logger.warn("⚠️ SystemModule에서 유효하지 않은 응답");
        }
      }

      // 3. 폴백: SystemModule이 없거나 실패한 경우
      logger.warn("⚠️ SystemModule 사용 불가, 폴백 메뉴 표시");
      return await this.showFallbackMainMenu(bot, callbackQuery, moduleManager);
    } catch (error) {
      logger.error("❌ ❌ 메인 메뉴 표시 오류:", error);
      return await this.showFallbackMainMenu(bot, callbackQuery, moduleManager);
    }
  }

  /**
   * 📝 메인 메뉴 텍스트 생성
   */
  buildMainMenuText(data) {
    const userName = data.userName || "사용자";
    const currentTime = TimeHelper.format(new Date(), "time");

    let text = `🤖 **두목봇 v3.0.1**\n\n`;
    text += `안녕하세요, ${userName}님! 👋\n`;
    text += `현재 시간: ${currentTime}\n\n`;

    // 활성 모듈 정보
    if (data.activeModules && data.activeModules.length > 0) {
      text += `📱 **사용 가능한 기능** (${data.activeModules.length}개)\n`;
      data.activeModules.forEach((module) => {
        const emoji = this.getModuleEmoji(module.key);
        text += `${emoji} ${module.name}\n`;
      });
    } else {
      text += `📱 **기본 기능만 사용 가능**\n`;
      text += `⚙️ 시스템 관리\n`;
      text += `❓ 도움말\n`;
    }

    text += `\n원하는 기능을 선택해주세요! 🎯`;

    return text;
  }

  /**
   * ⌨️ 메인 메뉴 키보드 생성
   */
  buildMainMenuKeyboard(data, moduleManager) {
    const keyboard = { inline_keyboard: [] };

    // 활성 모듈들 버튼 생성
    if (data.activeModules && data.activeModules.length > 0) {
      const moduleButtons = data.activeModules.map((module) => ({
        text: `${this.getModuleEmoji(module.key)} ${module.name}`,
        callback_data: `${module.key}:menu`,
      }));

      // 2개씩 행 생성
      for (let i = 0; i < moduleButtons.length; i += 2) {
        const row = moduleButtons.slice(i, i + 2);
        keyboard.inline_keyboard.push(row);
      }
    } else {
      // 폴백 버튼들
      keyboard.inline_keyboard.push([
        { text: "📝 할일관리", callback_data: "todo:menu" },
        { text: "⏰ 타이머", callback_data: "timer:menu" },
      ]);
      keyboard.inline_keyboard.push([
        { text: "🕐 근무시간", callback_data: "worktime:menu" },
        { text: "🏖️ 휴가관리", callback_data: "leave:menu" },
      ]);
    }

    // 시스템 버튼들
    keyboard.inline_keyboard.push([
      { text: "❓ 도움말", callback_data: "system:help" },
      { text: "📊 상태확인", callback_data: "system:status" },
    ]);

    keyboard.inline_keyboard.push([
      { text: "⚙️ 설정", callback_data: "system:settings" },
    ]);

    return keyboard;
  }

  /**
   * 🛡️ 폴백 메인 메뉴 (SystemModule 없을 때)
   */
  async showFallbackMainMenu(bot, callbackQuery, moduleManager) {
    try {
      logger.debug("🛡️ 폴백 메인 메뉴 표시");

      const userName = getUserName(callbackQuery) || "사용자";
      const currentTime = TimeHelper.format(new Date(), "time");

      const fallbackText =
        `🤖 **두목봇 v3.0.1** (안전모드)\n\n` +
        `안녕하세요, ${userName}님! 👋\n` +
        `현재 시간: ${currentTime}\n\n` +
        `⚠️ 일부 서비스가 일시적으로 사용할 수 없어 기본 기능만 제공됩니다.\n\n` +
        `**📱 사용 가능한 기능**\n` +
        `📝 할일 관리\n` +
        `⏰ 타이머\n` +
        `🕐 근무시간 관리\n` +
        `❓ 도움말\n\n` +
        `원하는 기능을 선택해주세요! 🎯`;

      const fallbackKeyboard = {
        inline_keyboard: [
          [
            { text: "📝 할일관리", callback_data: "todo:menu" },
            { text: "⏰ 타이머", callback_data: "timer:menu" },
          ],
          [
            { text: "🕐 근무시간", callback_data: "worktime:menu" },
            { text: "❓ 도움말", callback_data: "system:help" },
          ],
          [{ text: "🔄 새로고침", callback_data: "system:menu" }],
        ],
      };

      await this.updateMessage(
        bot,
        callbackQuery,
        fallbackText,
        fallbackKeyboard
      );
      this.stats.keyboardsGenerated++;

      logger.debug("✅ 폴백 메인 메뉴 표시 완료");
      return true;
    } catch (error) {
      logger.error("❌ 폴백 메뉴 표시도 실패:", error);
      return false;
    }
  }

  /**
   * ❓ 도움말 요청 처리
   */
  async handleHelpRequest(bot, callbackQuery, moduleManager) {
    try {
      const helpText = this.buildHelpText();
      const keyboard = this.buildHelpKeyboard();

      await this.updateMessage(bot, callbackQuery, helpText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 도움말 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 도움말 텍스트 생성
   */
  buildHelpText() {
    let text = `❓ **두목봇 v3.0.1 도움말**\n\n`;

    text += `**🎯 주요 기능**\n`;
    text += `📝 할일 관리 - 체계적인 작업 관리\n`;
    text += `⏰ 타이머 - 포모도로 및 일반 타이머\n`;
    text += `🕐 근무시간 - 출퇴근 시간 관리\n`;
    text += `🏖️ 휴가관리 - 연차 및 휴가 신청\n\n`;

    text += `**⌨️ 기본 명령어**\n`;
    text += `• /start - 메인 메뉴 열기\n`;
    text += `• /help - 이 도움말 보기\n`;
    text += `• /status - 시스템 상태 확인\n\n`;

    text += `**💡 사용 팁**\n`;
    text += `• 버튼을 클릭하여 쉽게 조작하세요\n`;
    text += `• 언제든 🏠 버튼으로 메인 메뉴로 돌아갈 수 있습니다\n`;
    text += `• 문제가 있으면 /status로 상태를 확인해보세요\n\n`;

    text += `**🔧 문의사항**\n`;
    text += `기술 지원이 필요하시면 관리자에게 문의하세요.`;

    return text;
  }

  /**
   * ⌨️ 도움말 키보드 생성
   */
  buildHelpKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📊 상태확인", callback_data: "system:status" },
          { text: "⚙️ 설정", callback_data: "system:settings" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  /**
   * 📊 상태 요청 처리
   */
  async handleStatusRequest(bot, callbackQuery, moduleManager) {
    try {
      const statusText = this.buildStatusText(moduleManager);
      const keyboard = this.buildStatusKeyboard();

      await this.updateMessage(bot, callbackQuery, statusText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 상태 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 상태 텍스트 생성
   */
  buildStatusText(moduleManager) {
    const uptime = this.getUptime();
    const currentTime = TimeHelper.format(new Date(), "full");

    let text = `📊 **시스템 상태**\n\n`;
    text += `🕐 현재 시간: ${currentTime}\n`;
    text += `⏱️ 가동 시간: ${uptime}\n\n`;

    // 모듈 상태
    if (moduleManager && moduleManager.getModuleList) {
      const modules = moduleManager.getModuleList();
      const activeCount = modules.filter((m) => m.active).length;
      const totalCount = modules.length;

      text += `**📱 모듈 상태**\n`;
      text += `• 전체 모듈: ${totalCount}개\n`;
      text += `• 활성 모듈: ${activeCount}개\n`;
      text += `• 비활성 모듈: ${totalCount - activeCount}개\n\n`;
    }

    // NavigationHandler 통계
    text += `**🎹 네비게이션 통계**\n`;
    text += `• 처리된 요청: ${this.stats.navigationsHandled}회\n`;
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
    text += `${healthIcon} 시스템이 정상 작동 중입니다!`;

    return text;
  }

  /**
   * ⌨️ 상태 키보드 생성
   */
  buildStatusKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "system:status" },
          { text: "📈 상세정보", callback_data: "system:details" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  /**
   * ⚙️ 설정 요청 처리
   */
  async handleSettingsRequest(bot, callbackQuery, moduleManager) {
    try {
      const settingsText = this.buildSettingsText();
      const keyboard = this.buildSettingsKeyboard();

      await this.updateMessage(bot, callbackQuery, settingsText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 설정 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 설정 텍스트 생성
   */
  buildSettingsText() {
    let text = `⚙️ **시스템 설정**\n\n`;

    text += `**🎨 인터페이스**\n`;
    text += `• 테마: 기본 테마\n`;
    text += `• 언어: 한국어\n`;
    text += `• 시간대: Asia/Seoul\n\n`;

    text += `**🔔 알림 설정**\n`;
    text += `• 시스템 알림: 활성화\n`;
    text += `• 오류 알림: 활성화\n\n`;

    text += `**🛠️ 고급 설정**\n`;
    text += `• 캐시 사용: 활성화\n`;
    text += `• 디버그 모드: 비활성화\n\n`;

    text += `⚠️ 설정 변경은 관리자만 가능합니다.`;

    return text;
  }

  /**
   * ⌨️ 설정 키보드 생성
   */
  buildSettingsKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🎨 테마", callback_data: "system:theme" },
          { text: "🌐 언어", callback_data: "system:language" },
        ],
        [
          { text: "🔔 알림", callback_data: "system:notifications" },
          { text: "⏰ 시간대", callback_data: "system:timezone" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  /**
   * ℹ️ 정보 요청 처리
   */
  async handleAboutRequest(bot, callbackQuery, moduleManager) {
    try {
      const aboutText = this.buildAboutText();
      const keyboard = this.buildAboutKeyboard();

      await this.updateMessage(bot, callbackQuery, aboutText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 정보 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 정보 텍스트 생성
   */
  buildAboutText() {
    let text = `ℹ️ **두목봇 v3.0.1 정보**\n\n`;

    text += `**🤖 봇 정보**\n`;
    text += `• 이름: 두목봇 (doomock-bot)\n`;
    text += `• 버전: v3.0.1\n`;
    text += `• 개발자: doomock\n`;
    text += `• 플랫폼: Telegram\n\n`;

    text += `**🎯 주요 기능**\n`;
    text += `📝 Todo 관리\n`;
    text += `⏰ 타이머 기능\n`;
    text += `🕐 근무시간 관리\n`;
    text += `🏖️ 휴가 관리\n`;
    text += `⏰ 리마인더\n`;
    text += `🔮 운세 보기\n`;
    text += `🌤️ 날씨 정보\n`;
    text += `🎤 TTS 기능\n\n`;

    text += `**🛠️ 기술 스택**\n`;
    text += `• Node.js + Telegraf\n`;
    text += `• MongoDB\n`;
    text += `• Railway 배포\n\n`;

    text += `© 2025 doomock. 모든 권리 보유.`;

    return text;
  }

  /**
   * ⌨️ 정보 키보드 생성
   */
  buildAboutKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📊 상태확인", callback_data: "system:status" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * ❓ 알 수 없는 네비게이션 처리
   */
  async handleUnknownNavigation(bot, callbackQuery, moduleKey, action) {
    try {
      const unknownText =
        `❓ **알 수 없는 요청**\n\n` +
        `요청하신 기능을 찾을 수 없습니다.\n` +
        `• 모듈: ${moduleKey}\n` +
        `• 액션: ${action}\n\n` +
        `메인 메뉴로 돌아가서 다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
            { text: "🔄 새로고침", callback_data: "system:menu" },
          ],
        ],
      };

      await this.updateMessage(bot, callbackQuery, unknownText, keyboard);
      logger.warn(`⚠️ ❓ 처리되지 않은 콜백: ${moduleKey}:${action}`);

      return true;
    } catch (error) {
      logger.error("❌ 알 수 없는 네비게이션 처리 실패:", error);
      return false;
    }
  }

  /**
   * ❓ 알 수 없는 시스템 액션 처리
   */
  async showUnknownSystemAction(bot, callbackQuery, action) {
    try {
      const unknownText =
        `❓ **알 수 없는 시스템 기능**\n\n` +
        `요청하신 시스템 기능을 찾을 수 없습니다.\n` +
        `• 액션: ${action}\n\n` +
        `메인 메뉴로 돌아가세요.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.updateMessage(bot, callbackQuery, unknownText, keyboard);
      return true;
    } catch (error) {
      logger.error("❌ 알 수 없는 시스템 액션 처리 실패:", error);
      return false;
    }
  }

  /**
   * 🚨 시스템 오류 표시
   */
  async showSystemError(bot, callbackQuery, errorMessage) {
    try {
      const errorText =
        `🚨 **시스템 오류**\n\n` +
        `처리 중 오류가 발생했습니다.\n` +
        `${errorMessage}\n\n` +
        `잠시 후 다시 시도해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "system:menu" },
            { text: "❓ 도움말", callback_data: "system:help" },
          ],
        ],
      };

      await this.updateMessage(bot, callbackQuery, errorText, keyboard);
      logger.error("❌ ❌ 시스템 오류 표시 실패:", errorMessage);

      return true;
    } catch (error) {
      logger.error("❌ ❌ 시스템 오류 표시 실패:", error);
      return false;
    }
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

      // 콜론(:) 기준으로 파싱
      const parts = callbackData.split(":");

      const result = {
        moduleKey: parts[0] || "system",
        action: parts[1] || "menu",
        additionalParams: parts.slice(2) || [],
      };

      logger.debug(
        `🎹 Navigation 파싱: "${callbackData}" → ${result.moduleKey}:${result.action}`
      );

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

      // 콜백 쿼리 응답
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error("❌ 메시지 업데이트 오류:", error);

      // 콜백 쿼리 오류 응답
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "처리 중 오류가 발생했습니다.",
          show_alert: true,
        });
      } catch (answerError) {
        logger.error("❌ 콜백 쿼리 응답 오류:", answerError);
      }

      throw error;
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
      leave: "🏖️",
      reminder: "⏰",
      fortune: "🔮",
      weather: "🌤️",
      tts: "🎤",
      system: "⚙️",
    };

    return emojiMap[moduleKey] || "📦";
  }

  /**
   * ⏱️ 업타임 계산
   */
  getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${seconds}초`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds}초`;
    } else {
      return `${seconds}초`;
    }
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    this.stats.totalResponseTime += responseTime;
    this.stats.averageResponseTime = Math.round(
      this.stats.totalResponseTime / Math.max(this.stats.navigationsHandled, 1)
    );
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    return {
      navigationsHandled: this.stats.navigationsHandled,
      keyboardsGenerated: this.stats.keyboardsGenerated,
      errorsCount: this.stats.errorsCount,
      averageResponseTime: this.stats.averageResponseTime,
      cacheSize: this.callbackCache.size,
      healthy: this.stats.errorsCount < 10,
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
