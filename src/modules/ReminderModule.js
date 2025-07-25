// src/modules/ReminderModule.js - ServiceBuilder 연동 리팩토링 v3.0.1
const BaseModule = require("../core/BaseModule");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * ⏰ ReminderModule v3.0.1 - ServiceBuilder 연동 리팩토링
 *
 * 🎯 주요 변경사항:
 * - ServiceBuilder를 통한 서비스 요청 시스템
 * - 서비스 직접 생성 제거 (new ReminderService() 삭제)
 * - 느슨한 결합 구현
 * - 표준 매개변수 체계 준수
 * - actionMap 방식 사용
 * - Railway 환경 최적화
 */
class ReminderModule extends BaseModule {
  constructor(bot, options = {}) {
    super("ReminderModule", {
      bot,
      serviceBuilder: options.serviceBuilder, // ServiceBuilder 주입
      moduleManager: options.moduleManager,
      moduleKey: options.moduleKey,
      moduleConfig: options.moduleConfig,
      config: options.config,
    });

    // 🔧 서비스 인스턴스들 (ServiceBuilder로 요청)
    this.reminderService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      maxReminders: parseInt(process.env.MAX_REMINDERS_PER_USER) || 20,
      minMinutes: parseInt(process.env.MIN_REMINDER_MINUTES) || 1,
      maxMinutes: parseInt(process.env.MAX_REMINDER_MINUTES) || 1440, // 24시간
      enableVoiceReminders: process.env.ENABLE_VOICE_REMINDERS === "true",
      ...this.config,
    };

    // 리마인더 유형별 설정
    this.reminderTypes = {
      minutes: {
        name: "분 단위",
        icon: "⏰",
        description: "N분 후 알림",
        examples: ["30", "60", "120"],
      },
      time: {
        name: "시간 지정",
        icon: "🕐",
        description: "특정 시간에 알림",
        examples: ["14:30", "09:00", "18:00"],
      },
      recurring: {
        name: "반복 알림",
        icon: "🔄",
        description: "매일/매주 반복",
        examples: ["매일 09:00", "매주 월요일 10:00"],
      },
    };

    // 빠른 설정 옵션
    this.quickOptions = [
      { text: "⏰ 5분 후", minutes: 5 },
      { text: "⏰ 10분 후", minutes: 10 },
      { text: "⏰ 30분 후", minutes: 30 },
      { text: "⏰ 1시간 후", minutes: 60 },
      { text: "🕐 점심시간", time: "12:00" },
      { text: "🕕 퇴근시간", time: "18:00" },
    ];

    logger.info("⏰ ReminderModule v3.0.1 생성됨 (ServiceBuilder 연동)");
  }

  /**
   * 🎯 모듈 초기화 (ServiceBuilder 활용)
   */
  async onInitialize() {
    try {
      logger.info("⏰ ReminderModule 초기화 시작 (ServiceBuilder 활용)...");

      // 🔧 필수 서비스 요청 (실패 시 예외 발생)
      this.reminderService = await this.requireService("reminder");

      if (!this.reminderService) {
        throw new Error("ReminderService 초기화 실패");
      }

      // 📋 액션 설정
      this.setupActions();

      logger.success("✅ ReminderModule 초기화 완료");
      return true;
    } catch (error) {
      logger.error("❌ ReminderModule 초기화 실패:", error);

      // 🛡️ 안전 모드: 기본 기능이라도 제공
      logger.warn("⚠️ 안전 모드로 ReminderModule 부분 초기화 시도...");

      try {
        // 최소한의 액션이라도 설정
        this.setupBasicActions();
        logger.warn("⚠️ ReminderModule 부분 초기화됨 (제한된 기능)");
        return false; // 부분 초기화 성공
      } catch (safetyError) {
        logger.error("❌ ReminderModule 안전 모드 초기화도 실패:", safetyError);
        throw error; // 완전 실패
      }
    }
  }

  /**
   * 🎯 액션 설정 (기본 기능)
   */
  setupActions() {
    this.registerActions({
      // 📋 메인 메뉴
      menu: this.handleMenuAction.bind(this),
      help: this.handleHelpAction.bind(this),

      // ⏰ 리마인더 생성
      create: this.handleCreateAction.bind(this),
      "create:minutes": this.handleCreateMinutesAction.bind(this),
      "create:time": this.handleCreateTimeAction.bind(this),
      "create:custom": this.handleCreateCustomAction.bind(this),

      // 🚀 빠른 설정
      "quick:5": this.handleQuick5MinutesAction.bind(this),
      "quick:10": this.handleQuick10MinutesAction.bind(this),
      "quick:30": this.handleQuick30MinutesAction.bind(this),
      "quick:60": this.handleQuick60MinutesAction.bind(this),
      "quick:lunch": this.handleQuickLunchAction.bind(this),
      "quick:home": this.handleQuickHomeAction.bind(this),

      // 📋 리마인더 관리
      list: this.handleListAction.bind(this),
      "cancel:all": this.handleCancelAllAction.bind(this),
      cancel: this.handleCancelAction.bind(this),

      // 📊 설정 및 기타
      stats: this.handleStatsAction.bind(this),
      settings: this.handleSettingsAction.bind(this),
    });

    logger.debug("⏰ ReminderModule 액션 등록 완료");
  }

  /**
   * 🛡️ 안전 모드용 기본 액션 설정
   */
  setupBasicActions() {
    this.registerActions({
      menu: this.handleErrorMenuAction.bind(this),
      error: this.handleErrorAction.bind(this),
    });

    logger.debug("🛡️ ReminderModule 기본 액션 등록 완료 (안전 모드)");
  }

  /**
   * 📬 메시지 핸들러 (onHandleMessage 구현)
   */
  async onHandleMessage(bot, msg) {
    try {
      const { text, from, chat } = msg;

      // 리마인더 관련 키워드 감지
      if (this.isReminderKeyword(text)) {
        return await this.handleReminderKeyword(bot, msg);
      }

      // 사용자 상태 처리 (미래 확장)
      // if (this.userStates.has(from.id)) {
      //   return await this.handleUserStateMessage(bot, msg);
      // }

      return false; // 처리하지 않음
    } catch (error) {
      logger.error("❌ ReminderModule 메시지 처리 실패:", error);
      return false;
    }
  }

  // ===== 🎯 액션 핸들러들 =====

  /**
   * 📋 메뉴 액션
   */
  async handleMenuAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const chatId = callbackQuery.message.chat.id;

      // ReminderService 상태 확인
      if (!this.reminderService) {
        return await this.handleErrorMenuAction(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );
      }

      const menuText = `⏰ **리마인더** v3.0.1

🔔 **현재 상태:**
• 리마인더 서비스: ${this.reminderService ? "✅ 연결됨" : "❌ 비연결"}
• 활성 리마인더: ${this.reminderService?.getActiveReminders?.()?.length || 0}개

⏰ **주요 기능:**
• 분 단위 알림 (5분, 30분, 1시간 등)
• 시간 지정 알림 (14:30, 18:00 등)
• 빠른 설정 옵션
• 리마인더 관리 및 통계

언제 알림을 받으시겠습니까?`;

      await this.sendMessage(bot, chatId, menuText);
      return true;
    } catch (error) {
      logger.error("❌ 리마인더 메뉴 액션 실패:", error);
      return await this.handleErrorAction(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );
    }
  }

  /**
   * 🛡️ 에러 상황용 메뉴 액션
   */
  async handleErrorMenuAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const chatId = callbackQuery.message.chat.id;

      const errorMenuText = `⏰ **리마인더** (제한 모드)

❌ **서비스 상태:**
• 리마인더 서비스: 연결 실패
• 일부 기능을 사용할 수 없습니다

🔧 **가능한 작업:**
• 시스템 상태 확인
• 에러 신고
• 다른 모듈 이용

⚠️ 관리자에게 문의하거나 잠시 후 다시 시도해주세요.`;

      await this.sendMessage(bot, chatId, errorMenuText);
      return true;
    } catch (error) {
      logger.error("❌ 에러 메뉴 액션도 실패:", error);
      return false;
    }
  }

  /**
   * ❓ 도움말 액션
   */
  async handleHelpAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const chatId = callbackQuery.message.chat.id;

      const helpText = `⏰ **리마인더 도움말**

📋 **사용법:**
• 버튼으로 빠른 설정
• "N분 후 알림" 형태로 메시지 입력
• "오후 3시에 알림" 형태로 시간 지정

🚀 **빠른 명령어:**
• \`5분 후 알림\` - 5분 후 알림
• \`30분 후 회의\` - 30분 후 회의 알림
• \`오후 2시에 점심\` - 오후 2시에 점심 알림

📱 **기능:**
• 최대 ${this.config.maxReminders}개 리마인더
• ${this.config.minMinutes}분 ~ ${Math.floor(
        this.config.maxMinutes / 60
      )}시간 범위
• 활성 리마인더 목록 보기
• 개별/전체 취소`;

      await this.sendMessage(bot, chatId, helpText);
      return true;
    } catch (error) {
      logger.error("❌ 리마인더 도움말 액션 실패:", error);
      return false;
    }
  }

  /**
   * ⏰ 리마인더 생성 액션
   */
  async handleCreateAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      if (!this.reminderService) {
        return await this.handleServiceUnavailableError(bot, callbackQuery);
      }

      const chatId = callbackQuery.message.chat.id;

      const createText = `⏰ **새 리마인더 만들기**

어떤 방식으로 알림을 설정하시겠습니까?

🚀 **빠른 설정:**
• 자주 사용하는 시간으로 바로 설정

⏰ **분 단위:**
• N분 후에 알림 받기

🕐 **시간 지정:**
• 특정 시간에 알림 받기`;

      await this.sendMessage(bot, chatId, createText);
      return true;
    } catch (error) {
      logger.error("❌ 리마인더 생성 액션 실패:", error);
      return false;
    }
  }

  /**
   * 🚀 빠른 5분 후 액션
   */
  async handleQuick5MinutesAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    return await this.createQuickReminder(bot, callbackQuery, 5, "5분 후 알림");
  }

  /**
   * 🚀 빠른 10분 후 액션
   */
  async handleQuick10MinutesAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    return await this.createQuickReminder(
      bot,
      callbackQuery,
      10,
      "10분 후 알림"
    );
  }

  /**
   * 🚀 빠른 30분 후 액션
   */
  async handleQuick30MinutesAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    return await this.createQuickReminder(
      bot,
      callbackQuery,
      30,
      "30분 후 알림"
    );
  }

  /**
   * 🚀 빠른 60분 후 액션
   */
  async handleQuick60MinutesAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    return await this.createQuickReminder(
      bot,
      callbackQuery,
      60,
      "1시간 후 알림"
    );
  }

  /**
   * 📋 리마인더 목록 액션
   */
  async handleListAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      if (!this.reminderService) {
        return await this.handleServiceUnavailableError(bot, callbackQuery);
      }

      const chatId = callbackQuery.message.chat.id;
      const activeReminders =
        this.reminderService.getActiveReminders?.(chatId) || [];

      if (activeReminders.length === 0) {
        await this.sendMessage(
          bot,
          chatId,
          "📋 **활성 리마인더 없음**\n\n" +
            "현재 설정된 리마인더가 없습니다.\n" +
            "새로운 리마인더를 만들어보세요!"
        );
        return true;
      }

      let listText = `📋 **활성 리마인더 목록** (${activeReminders.length}개)\n\n`;

      activeReminders.forEach((reminder, index) => {
        const targetTime = TimeHelper.format(reminder.targetTime, "short");
        listText += `${index + 1}. ⏰ ${reminder.text}\n`;
        listText += `   🕐 ${targetTime}\n\n`;
      });

      await this.sendMessage(bot, chatId, listText);
      return true;
    } catch (error) {
      logger.error("❌ 리마인더 목록 액션 실패:", error);
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 빠른 리마인더 생성
   */
  async createQuickReminder(bot, callbackQuery, minutes, description) {
    try {
      if (!this.reminderService) {
        return await this.handleServiceUnavailableError(bot, callbackQuery);
      }

      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id;

      // 리마인더 생성
      const result = this.reminderService.createReminder?.(
        bot,
        chatId,
        userId,
        minutes,
        description
      );

      if (result?.success) {
        const targetTime = TimeHelper.format(result.targetTime, "short");

        await this.sendMessage(
          bot,
          chatId,
          `✅ **리마인더 설정 완료!**\n\n` +
            `⏰ ${description}\n` +
            `🕐 알림 시간: ${targetTime}\n\n` +
            `ID: ${result.id}`
        );
      } else {
        await this.sendMessage(
          bot,
          chatId,
          `❌ 리마인더 설정 실패: ${result?.message || "알 수 없는 오류"}`
        );
      }

      return true;
    } catch (error) {
      logger.error("❌ 빠른 리마인더 생성 실패:", error);
      return false;
    }
  }

  /**
   * 리마인더 키워드 감지
   */
  isReminderKeyword(text) {
    if (!text || typeof text !== "string") return false;

    const keywords = [
      "알림",
      "리마인더",
      "reminder",
      "분 후",
      "시간 후",
      "후에",
      "에 알려",
      "때 알림",
    ];

    return keywords.some((keyword) => text.includes(keyword));
  }

  /**
   * 리마인더 키워드 처리
   */
  async handleReminderKeyword(bot, msg) {
    try {
      const {
        text,
        chat: { id: chatId },
      } = msg;

      // 간단한 패턴 매칭 (미래 확장)
      await this.sendMessage(
        bot,
        chatId,
        "⏰ 리마인더 키워드를 감지했습니다!\n\n" +
          "더 정확한 설정을 위해 리마인더 메뉴를 이용해주세요.\n" +
          "/reminder 명령어를 사용하세요."
      );

      return true;
    } catch (error) {
      logger.error("❌ 리마인더 키워드 처리 실패:", error);
      return false;
    }
  }

  /**
   * 서비스 사용 불가 에러 처리
   */
  async handleServiceUnavailableError(bot, callbackQuery) {
    try {
      const chatId = callbackQuery.message.chat.id;

      await this.sendMessage(
        bot,
        chatId,
        "❌ **서비스 일시 사용 불가**\n\n" +
          "리마인더 서비스에 일시적인 문제가 발생했습니다.\n" +
          "잠시 후 다시 시도해주세요.\n\n" +
          "문제가 지속되면 관리자에게 문의하세요."
      );

      return true;
    } catch (error) {
      logger.error("❌ 서비스 사용 불가 에러 처리 실패:", error);
      return false;
    }
  }

  /**
   * 일반 에러 처리
   */
  async handleErrorAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      const chatId = callbackQuery.message.chat.id;

      await this.sendMessage(
        bot,
        chatId,
        "❌ **작업 처리 실패**\n\n" +
          "요청하신 작업을 처리할 수 없습니다.\n" +
          "잠시 후 다시 시도해주세요."
      );

      return true;
    } catch (error) {
      logger.error("❌ 에러 액션 처리도 실패:", error);
      return false;
    }
  }

  // 기타 액션 핸들러들은 간단한 스텁으로 구현
  async handleCreateMinutesAction() {
    return await this.handleNotImplementedAction();
  }
  async handleCreateTimeAction() {
    return await this.handleNotImplementedAction();
  }
  async handleCreateCustomAction() {
    return await this.handleNotImplementedAction();
  }
  async handleQuickLunchAction() {
    return await this.handleNotImplementedAction();
  }
  async handleQuickHomeAction() {
    return await this.handleNotImplementedAction();
  }
  async handleCancelAllAction() {
    return await this.handleNotImplementedAction();
  }
  async handleCancelAction() {
    return await this.handleNotImplementedAction();
  }
  async handleStatsAction() {
    return await this.handleNotImplementedAction();
  }
  async handleSettingsAction() {
    return await this.handleNotImplementedAction();
  }

  async handleNotImplementedAction() {
    // 미구현 기능 처리 로직
    return true;
  }

  /**
   * 📊 상태 조회 (ServiceBuilder 활용)
   */
  getStatus() {
    const baseStatus = super.getStatus();

    return {
      ...baseStatus,
      reminderService: {
        connected: !!this.reminderService,
        status: this.reminderService?.getServiceStatus?.() || "unknown",
        activeReminders:
          this.reminderService?.getActiveReminders?.()?.length || 0,
      },
      config: this.config,
      reminderTypes: this.reminderTypes,
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      // 상위 클래스 정리
      await super.cleanup();

      // ReminderService 정리
      if (this.reminderService && this.reminderService.cleanup) {
        await this.reminderService.cleanup();
      }

      // 서비스 참조 정리 (ServiceBuilder가 관리하므로 직접 정리하지 않음)
      this.reminderService = null;

      logger.info("✅ ReminderModule 정리 완료");
    } catch (error) {
      logger.error("❌ ReminderModule 정리 실패:", error);
    }
  }
}

module.exports = ReminderModule;
