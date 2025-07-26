// src/handlers/NavigationHandler.js - 완전 구현 v3.0.1 🎹
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");

/**
 * 🎹 NavigationHandler v3.0.1 - 완전 구현
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
    } catch (error) {
      logger.error("❌ NavigationHandler 오류:", error);
      this.stats.errorsCount++;
      await this.showSystemError(
        bot,
        callbackQuery,
        "네비게이션 처리 중 오류가 발생했습니다."
      );
      return false;
    } finally {
      // 응답 시간 통계
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    }
  }

  /**
   * 🏛️ 시스템 네비게이션 처리
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
      switch (action) {
        case "menu":
        case "start":
          return await this.showMainMenu(bot, callbackQuery, moduleManager);

        case "help":
          return await this.showHelpMenu(bot, callbackQuery, moduleManager);

        case "status":
          return await this.showStatusMenu(bot, callbackQuery, moduleManager);

        case "settings":
          return await this.showSettingsMenu(bot, callbackQuery, moduleManager);

        case "about":
          return await this.showAboutMenu(bot, callbackQuery, moduleManager);

        default:
          await this.showUnknownAction(bot, callbackQuery, action);
          return false;
      }
    } catch (error) {
      logger.error("❌ 시스템 네비게이션 오류:", error);
      await this.showSystemError(
        bot,
        callbackQuery,
        "시스템 메뉴 처리 중 오류가 발생했습니다."
      );
      return false;
    }
  }

  // ===== 🎹 메인 키보드 생성 메서드들 =====

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMainMenu(bot, callbackQuery, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);
      const activeModules = this.getActiveModules(moduleManager);

      // 메인 메뉴 텍스트 생성
      const menuText = this.buildMainMenuText(userName, activeModules);

      // 메인 메뉴 키보드 생성
      const keyboard = this.buildMainMenuKeyboard(activeModules);

      // 메시지 업데이트
      await this.updateMessage(bot, callbackQuery, menuText, keyboard);
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
  buildMainMenuText(userName, activeModules) {
    const uptime = this.formatUptime(process.uptime());

    let text = `🤖 **두목봇 v3.0.1**\n\n`;
    text += `👋 안녕하세요, **${userName}**님!\n`;
    text += `원하는 기능을 선택해주세요.\n\n`;

    if (activeModules.length > 0) {
      text += `**🎯 사용 가능한 기능 (${activeModules.length}개)**\n`;
      activeModules.slice(0, 5).forEach((module) => {
        text += `${module.emoji} ${module.name}\n`;
      });

      if (activeModules.length > 5) {
        text += `... 외 ${activeModules.length - 5}개\n`;
      }
    } else {
      text += `⚠️ 시스템 초기화 중입니다.\n잠시 후 다시 시도해주세요.\n`;
    }

    text += `\n**📊 시스템 정보**\n`;
    text += `• ⏱️ 가동시간: ${uptime}\n`;
    text += `• 🔄 처리된 요청: ${this.stats.navigationsHandled}회\n`;
    text += `• 🌍 환경: ${process.env.RAILWAY_ENVIRONMENT || "개발"}`;

    return text;
  }

  /**
   * ⌨️ 메인 메뉴 키보드 생성
   */
  buildMainMenuKeyboard(activeModules) {
    const keyboard = { inline_keyboard: [] };

    // 활성 모듈 버튼들 (2열씩 배치)
    if (activeModules.length > 0) {
      for (let i = 0; i < activeModules.length; i += 2) {
        const row = [];

        // 첫 번째 모듈
        const module1 = activeModules[i];
        row.push({
          text: `${module1.emoji} ${module1.name}`,
          callback_data: `${module1.key}:menu`,
        });

        // 두 번째 모듈 (있으면)
        if (i + 1 < activeModules.length) {
          const module2 = activeModules[i + 1];
          row.push({
            text: `${module2.emoji} ${module2.name}`,
            callback_data: `${module2.key}:menu`,
          });
        }

        keyboard.inline_keyboard.push(row);
      }
    }

    // 시스템 메뉴 (2줄)
    keyboard.inline_keyboard.push([
      { text: "📊 시스템 상태", callback_data: "system:status" },
      { text: "❓ 도움말", callback_data: "system:help" },
    ]);

    keyboard.inline_keyboard.push([
      { text: "⚙️ 설정", callback_data: "system:settings" },
      { text: "ℹ️ 정보", callback_data: "system:about" },
    ]);

    return keyboard;
  }

  /**
   * ❓ 도움말 메뉴 표시
   */
  async showHelpMenu(bot, callbackQuery, moduleManager) {
    try {
      const helpText = this.buildHelpText(moduleManager);
      const keyboard = this.buildHelpKeyboard(moduleManager);

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

    let text = `❓ **도움말**\n\n`;

    text += `**🔹 기본 명령어**\n`;
    text += `• \`/start\` - 봇 시작 및 메인 메뉴\n`;
    text += `• \`/help\` - 도움말 표시\n`;
    text += `• \`/status\` - 시스템 상태 확인\n`;
    text += `• \`/cancel\` - 현재 작업 취소\n\n`;

    if (activeModules.length > 0) {
      text += `**🔹 사용 가능한 기능**\n`;
      activeModules.forEach((module) => {
        text += `• ${module.emoji} **${module.name}** - ${
          module.description || "기능 설명"
        }\n`;
      });
      text += `\n`;
    }

    text += `**🔹 사용 팁**\n`;
    text += `• 메뉴 버튼을 통해 편리하게 이용하세요\n`;
    text += `• 작업 중 언제든 \`/cancel\`로 취소 가능\n`;
    text += `• 문제 발생 시 \`/start\`로 초기화하세요\n`;
    text += `• 각 기능별 상세 도움말은 해당 메뉴에서 확인`;

    return text;
  }

  /**
   * ⌨️ 도움말 키보드 생성
   */
  buildHelpKeyboard(moduleManager) {
    const keyboard = { inline_keyboard: [] };
    const activeModules = this.getActiveModules(moduleManager);

    // 모듈별 도움말 (최대 6개, 3열씩)
    if (activeModules.length > 0) {
      const helpModules = activeModules.slice(0, 6);

      for (let i = 0; i < helpModules.length; i += 3) {
        const row = [];

        for (let j = 0; j < 3 && i + j < helpModules.length; j++) {
          const module = helpModules[i + j];
          row.push({
            text: `${module.emoji} ${module.shortName || module.name}`,
            callback_data: `${module.key}:help`,
          });
        }

        keyboard.inline_keyboard.push(row);
      }
    }

    // 시스템 메뉴
    keyboard.inline_keyboard.push([
      { text: "📊 상태", callback_data: "system:status" },
      { text: "⚙️ 설정", callback_data: "system:settings" },
      { text: "🏠 메인", callback_data: "system:menu" },
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
    text += `${healthIcon} 시스템이 정상적으로 작동 중입니다!`;

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
          { text: "📈 상세 정보", callback_data: "system:details" },
        ],
        [
          { text: "🧹 캐시 정리", callback_data: "system:cleanup" },
          { text: "📊 성능 분석", callback_data: "system:performance" },
        ],
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

    text += `**🎨 인터페이스 설정**\n`;
    text += `• 테마: 기본 테마\n`;
    text += `• 언어: 한국어\n`;
    text += `• 시간대: Asia/Seoul\n\n`;

    text += `**🔔 알림 설정**\n`;
    text += `• 시스템 알림: 활성화\n`;
    text += `• 오류 알림: 활성화\n`;
    text += `• 업데이트 알림: 활성화\n\n`;

    text += `**🛠️ 고급 설정**\n`;
    text += `• 캐시 사용: 활성화\n`;
    text += `• 디버그 모드: 비활성화\n`;
    text += `• 자동 재시작: 활성화\n\n`;

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
          { text: "🎨 테마 변경", callback_data: "system:theme" },
          { text: "🌐 언어 설정", callback_data: "system:language" },
        ],
        [
          { text: "🔔 알림 설정", callback_data: "system:notifications" },
          { text: "⏰ 시간대 설정", callback_data: "system:timezone" },
        ],
        [
          { text: "🛠️ 고급 설정", callback_data: "system:advanced" },
          { text: "🔄 초기화", callback_data: "system:reset" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };
  }

  /**
   * ℹ️ 정보 메뉴 표시
   */
  async showAboutMenu(bot, callbackQuery, moduleManager) {
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
    let text = `ℹ️ **두목봇 v3.0.1**\n\n`;

    text += `**🤖 봇 정보**\n`;
    text += `• 이름: 두목봇\n`;
    text += `• 버전: v3.0.1\n`;
    text += `• 개발: Navigation 중앙처리 시스템\n`;
    text += `• 아키텍처: 모듈형 마이크로서비스\n\n`;

    text += `**🔧 주요 기능**\n`;
    text += `• 📝 할일 관리\n`;
    text += `• ⏰ 타이머 기능\n`;
    text += `• 🕐 근무시간 관리\n`;
    text += `• 🏖️ 휴가 관리\n\n`;

    text += `**🏗️ 기술 스택**\n`;
    text += `• Runtime: Node.js ${process.version}\n`;
    text += `• Database: MongoDB\n`;
    text += `• Platform: Railway\n`;
    text += `• Architecture: 중앙집중식 모듈 시스템\n\n`;

    text += `**📊 성능**\n`;
    text += `• 가동시간: ${this.formatUptime(process.uptime())}\n`;
    text += `• 처리 요청: ${this.stats.navigationsHandled}회\n`;
    text += `• 평균 응답: ${this.stats.averageResponseTime}ms\n\n`;

    text += `🚀 지속적으로 업데이트되고 있습니다!`;

    return text;
  }

  /**
   * ⌨️ 정보 키보드 생성
   */
  buildAboutKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📋 변경 기록", callback_data: "system:changelog" },
          { text: "📄 라이센스", callback_data: "system:license" },
        ],
        [
          { text: "🐛 버그 신고", callback_data: "system:bug_report" },
          { text: "💡 기능 제안", callback_data: "system:feature_request" },
        ],
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

      // 콜백 쿼리 응답
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      logger.error("메시지 업데이트 오류:", error);

      // 콜백 쿼리 오류 응답
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "처리 중 오류가 발생했습니다.",
          show_alert: true,
        });
      } catch (callbackError) {
        logger.error("콜백 쿼리 응답 오류:", callbackError);
      }

      throw error;
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
