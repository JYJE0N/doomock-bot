// src/modules/SystemModule.js - 리팩토링된 시스템 모듈
const BaseModule = require("./BaseModule");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

/**
 * 시스템 모듈
 * - 메인 메뉴
 * - 도움말
 * - 시스템 상태
 * - 설정 관리
 */
class SystemModule extends BaseModule {
  constructor(bot, options = {}) {
    super("SystemModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
    });

    // 시스템 설정
    this.config = {
      version: process.env.npm_package_version || "3.0.1",
      environment: process.env.NODE_ENV || "development",
      isRailway: !!process.env.RAILWAY_ENVIRONMENT,
    };

    logger.info("🏠 SystemModule 생성됨");
  }

  /**
   * 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showMainMenu,
      help: this.showHelp,
      status: this.showStatus,
      settings: this.showSettings,
      cancel: this.handleCancel,
    });
  }

  /**
   * 메시지 처리 - BaseModule의 handleMessage를 오버라이드
   */
  async handleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
    } = msg;

    if (!text) return false;

    const command = text.toLowerCase().trim();

    switch (command) {
      case "/start":
      case "시작":
        await this.handleStart(bot, msg);
        return true;

      case "/help":
      case "도움말":
        await this.sendHelpMessage(bot, chatId);
        return true;

      case "/status":
      case "상태":
        await this.sendStatusMessage(bot, chatId);
        return true;

      case "/cancel":
      case "취소":
        await this.sendCancelMessage(bot, chatId);
        return true;

      default:
        return false;
    }
  }

  // ===== 액션 핸들러 =====

  /**
   * 메인 메뉴 표시
   */
  async showMainMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const userName = getUserName(callbackQuery.from);

      const text = `🏠 **메인 메뉴**

안녕하세요! ${userName}님!
무엇을 도와드릴까요?

환경: ${this.config.isRailway ? "Railway" : "Local"}
버전: v${this.config.version}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📝 할일 관리", callback_data: "todo:menu" },
            { text: "⏰ 타이머", callback_data: "timer:menu" },
          ],
          [
            { text: "🕐 근무시간", callback_data: "worktime:menu" },
            { text: "🏖️ 휴가관리", callback_data: "leave:menu" },
          ],
          [
            { text: "📅 리마인더", callback_data: "reminder:menu" },
            { text: "🔮 운세", callback_data: "fortune:menu" },
          ],
          [
            { text: "☁️ 날씨", callback_data: "weather:menu" },
            { text: "🔧 유틸리티", callback_data: "utils:menu" },
          ],
          [
            { text: "⚙️ 설정", callback_data: "system:settings" },
            { text: "❓ 도움말", callback_data: "system:help" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        reply_markup: keyboard,
      });

      return true; // 처리 성공
    } catch (error) {
      logger.error("메인 메뉴 표시 오류:", error);

      // 에러 발생시 안전한 처리
      if (callbackQuery && callbackQuery.message) {
        try {
          await this.sendMessage(
            bot,
            callbackQuery.message.chat.id,
            "❌ 메인 메뉴를 표시하는 중 오류가 발생했습니다."
          );
        } catch (sendError) {
          logger.error("에러 메시지 전송 실패:", sendError);
        }
      }

      return false;
    }
  }

  // 메인 메뉴 키보드 생성 메서드 추가
  createMainMenuKeyboard(moduleManager) {
    return {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo:menu" },
          { text: "⏰ 타이머", callback_data: "timer:menu" },
        ],
        [
          { text: "🕐 근무시간", callback_data: "worktime:menu" },
          { text: "🏖️ 휴가관리", callback_data: "leave:menu" },
        ],
        [
          { text: "📅 리마인더", callback_data: "reminder:menu" },
          { text: "🔮 운세", callback_data: "fortune:menu" },
        ],
        [
          { text: "☁️ 날씨", callback_data: "weather:menu" },
          { text: "🔧 유틸리티", callback_data: "utils:menu" },
        ],
        [
          { text: "⚙️ 설정", callback_data: "system:settings" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
      ],
    };
  }
  /**
   * /start 명령어 처리
   */
  async handleStart(bot, msg) {
    const {
      chat: { id: chatId },
      from,
    } = msg;
    const userName = getUserName(from);

    const welcomeText = `🏠 **두목봇 v${this.config.version}**

안녕하세요 ${userName}님!
저는 당신의 업무를 도와드리는 두목봇입니다.

아래 메뉴에서 원하는 기능을 선택해주세요.

환경: ${this.config.isRailway ? "Railway" : "Local"}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📝 할일 관리", callback_data: "todo:menu" },
          { text: "⏰ 타이머", callback_data: "timer:menu" },
        ],
        [
          { text: "🕐 근무시간", callback_data: "worktime:menu" },
          { text: "🏖️ 휴가관리", callback_data: "leave:menu" },
        ],
        [
          { text: "📅 리마인더", callback_data: "reminder:menu" },
          { text: "🔮 운세", callback_data: "fortune:menu" },
        ],
        [
          { text: "☁️ 날씨", callback_data: "weather:menu" },
          { text: "🔧 유틸리티", callback_data: "utils:menu" },
        ],
        [
          { text: "⚙️ 설정", callback_data: "system:settings" },
          { text: "❓ 도움말", callback_data: "system:help" },
        ],
      ],
    };

    await this.sendMessage(bot, chatId, welcomeText, {
      reply_markup: keyboard,
    });
  }
  /**
   * 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `❓ **도움말**

**사용 가능한 명령어:**
• /start - 봇 시작
• /help - 도움말 보기
• /status - 시스템 상태
• /cancel - 현재 작업 취소

**주요 기능:**
• 📝 할일 관리 - 할일 추가/완료/삭제
• ⏰ 타이머 - 포모도로 타이머
• 🕐 근무시간 - 출퇴근 기록
• 🏖️ 휴가관리 - 휴가 신청/조회
• 📅 리마인더 - 알림 설정
• 🔮 운세 - 오늘의 운세
• ☁️ 날씨 - 현재 날씨 정보
• 🔧 유틸리티 - TTS 등 도구

버전: v${this.config.version}`;

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 도움말 메시지 (명령어)
   */
  async sendHelpMessage(bot, chatId) {
    const helpText = `❓ **도움말**

**사용 가능한 명령어:**
• /start - 봇 시작
• /help - 도움말 보기
• /status - 시스템 상태
• /cancel - 현재 작업 취소

**주요 기능:**
• 📝 할일 관리 - 할일 추가/완료/삭제
• ⏰ 타이머 - 포모도로 타이머
• 🕐 근무시간 - 출퇴근 기록
• 🏖️ 휴가관리 - 휴가 신청/조회
• 📅 리마인더 - 알림 설정
• 🔮 운세 - 오늘의 운세
• ☁️ 날씨 - 현재 날씨 정보
• 🔧 유틸리티 - TTS 등 도구

버전: v${this.config.version}`;

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]],
    };

    await this.sendMessage(bot, chatId, helpText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 상태 표시
   */
  async showStatus(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      const moduleStatus = await this.getModuleStatus(moduleManager);

      const statusText = `📊 **시스템 상태**

**봇 정보:**
• 버전: v${this.config.version}
• 환경: ${this.config.isRailway ? "Railway" : "Local"}
• 가동 시간: ${this.formatUptime(uptime)}

**메모리 사용량:**
• Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(
        memUsage.heapTotal / 1024 / 1024
      )}MB
• RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB

**모듈 상태:**
• 전체 모듈: ${moduleStatus.totalModules}개
• 활성 모듈: ${moduleStatus.activeModules}개

**데이터베이스:**
• 상태: ${this.db ? "연결됨 ✅" : "연결 안됨 ❌"}

마지막 업데이트: ${this.formatDate(new Date())}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 새로고침", callback_data: "system:status" }],
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statusText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("시스템 상태 확인 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 상태 메시지 (명령어)
   */
  async sendStatusMessage(bot, chatId) {
    try {
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();

      const statusText = `📊 **시스템 상태**

**봇 정보:**
• 버전: v${this.config.version}
• 환경: ${this.config.isRailway ? "Railway" : "Local"}
• 가동 시간: ${this.formatUptime(uptime)}

**메모리 사용량:**
• Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(
        memUsage.heapTotal / 1024 / 1024
      )}MB
• RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB

**데이터베이스:**
• 상태: ${this.db ? "연결됨 ✅" : "연결 안됨 ❌"}

마지막 업데이트: ${this.formatDate(new Date())}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, statusText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("시스템 상태 확인 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 시스템 상태를 확인하는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 설정 메뉴
   */
  async showSettings(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const settingsText = `⚙️ **설정**

현재 설정 기능은 준비 중입니다.`;

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]],
    };

    await this.editMessage(bot, chatId, messageId, settingsText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 취소 핸들러
   */
  async handleCancel(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "✅ 작업이 취소되었습니다.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
          ],
        },
      }
    );
  }

  /**
   * 취소 메시지 (명령어)
   */
  async sendCancelMessage(bot, chatId) {
    await this.sendMessage(bot, chatId, "✅ 작업이 취소되었습니다.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      },
    });
  }

  /**
   * 모듈 상태 가져오기
   */
  async getModuleStatus(moduleManager) {
    if (!moduleManager) {
      return {
        totalModules: 0,
        activeModules: 0,
      };
    }

    try {
      const modules = moduleManager.getLoadedModules();
      return {
        totalModules: modules.length,
        activeModules: modules.filter((m) => m.isActive).length,
      };
    } catch (error) {
      logger.error("모듈 상태 확인 오류:", error);
      return {
        totalModules: 0,
        activeModules: 0,
      };
    }
  }

  /**
   * 업타임 포맷
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}일`);
    if (hours > 0) parts.push(`${hours}시간`);
    if (minutes > 0) parts.push(`${minutes}분`);
    if (secs > 0) parts.push(`${secs}초`);

    return parts.join(" ") || "0초";
  }

  /**
   * 날짜 포맷
   */
  formatDate(date) {
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Seoul",
    };
    return new Intl.DateTimeFormat("ko-KR", options).format(date);
  }
}

module.exports = SystemModule;
