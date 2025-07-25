// src/modules/WorktimeModule.js - ServiceBuilder 연동 리팩토링 v3.0.1
const BaseModule = require("../core/BaseModule");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 🕐 WorktimeModule v3.0.1 - ServiceBuilder 연동 리팩토링
 *
 * 🎯 주요 변경사항:
 * - ServiceBuilder를 통한 서비스 요청 시스템
 * - 서비스 직접 생성 제거 (new WorktimeService() 삭제)
 * - 느슨한 결합 구현
 * - 표준 매개변수 체계 준수
 * - actionMap 방식 사용
 * - Railway 환경 최적화
 */
class WorktimeModule extends BaseModule {
  constructor(bot, options = {}) {
    super("WorktimeModule", {
      bot,
      serviceBuilder: options.serviceBuilder, // ServiceBuilder 주입
      moduleManager: options.moduleManager,
      moduleKey: options.moduleKey,
      moduleConfig: options.moduleConfig,
      config: options.config,
    });

    // 🔧 서비스 인스턴스들 (ServiceBuilder로 요청)
    this.worktimeService = null;

    // 기본 근무 시간 설정
    this.workSchedule = {
      startTime: "08:30",
      lunchStart: "11:30",
      lunchEnd: "13:00",
      endTime: "17:30",
      workDays: [1, 2, 3, 4, 5], // 월~금
      totalWorkHours: 7.5,
    };

    this.progressEmojis = {
      morning: "🌅",
      working: "💼",
      lunch: "🍽️",
      afternoon: "☕",
      leaving: "🏃",
      done: "🏠",
      weekend: "🎉",
    };

    logger.info("🕐 WorktimeModule v3.0.1 생성됨 (ServiceBuilder 연동)");
  }

  /**
   * 🎯 모듈 초기화 (ServiceBuilder 활용)
   */
  async onInitialize() {
    try {
      logger.info("🕐 WorktimeModule 초기화 시작 (ServiceBuilder 활용)...");

      // 🔧 필수 서비스 요청 (실패 시 예외 발생)
      this.worktimeService = await this.requireService("worktime");

      if (!this.worktimeService) {
        throw new Error("WorktimeService 초기화 실패");
      }

      // 📋 액션 설정
      this.setupActions();

      logger.success("✅ WorktimeModule 초기화 완료");
      return true;
    } catch (error) {
      logger.error("❌ WorktimeModule 초기화 실패:", error);

      // 🛡️ 안전 모드: 기본 기능이라도 제공
      logger.warn("⚠️ 안전 모드로 WorktimeModule 부분 초기화 시도...");

      try {
        // 최소한의 액션이라도 설정
        this.setupBasicActions();
        logger.warn("⚠️ WorktimeModule 부분 초기화됨 (제한된 기능)");
        return false; // 부분 초기화 성공
      } catch (safetyError) {
        logger.error("❌ WorktimeModule 안전 모드 초기화도 실패:", safetyError);
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

      // 🕐 근무시간 관리
      status: this.handleStatusAction.bind(this),
      checkin: this.handleCheckinAction.bind(this),
      checkout: this.handleCheckoutAction.bind(this),
      progress: this.handleProgressAction.bind(this),

      // 📊 기록 관리
      history: this.handleHistoryAction.bind(this),
      "today:record": this.handleTodayRecordAction.bind(this),

      // ⚙️ 설정
      settings: this.handleSettingsAction.bind(this),

      // 📝 노트 추가
      "add:checkin_note": this.handleAddCheckinNoteAction.bind(this),
      "add:checkout_note": this.handleAddCheckoutNoteAction.bind(this),
    });

    logger.debug("🕐 WorktimeModule 액션 등록 완료");
  }

  /**
   * 🛡️ 안전 모드용 기본 액션 설정
   */
  setupBasicActions() {
    this.registerActions({
      menu: this.handleErrorMenuAction.bind(this),
      error: this.handleErrorAction.bind(this),
    });

    logger.debug("🛡️ WorktimeModule 기본 액션 등록 완료 (안전 모드)");
  }

  /**
   * 📬 메시지 핸들러 (onHandleMessage 구현)
   */
  async onHandleMessage(bot, msg) {
    try {
      const { text, from } = msg;

      // 근무시간 관련 키워드 감지
      if (this.isWorktimeKeyword(text)) {
        return await this.handleWorktimeKeyword(bot, msg);
      }

      return false; // 처리하지 않음
    } catch (error) {
      logger.error("❌ WorktimeModule 메시지 처리 실패:", error);
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

      // WorktimeService 상태 확인
      if (!this.worktimeService) {
        return await this.handleErrorMenuAction(
          bot,
          callbackQuery,
          subAction,
          params,
          moduleManager
        );
      }

      const currentTime = TimeHelper.format(new Date(), "time");
      const todayStatus = await this.getTodayWorkStatus(callbackQuery.from.id);

      const menuText = `🕐 **근무시간 관리** v3.0.1

📅 **오늘 (${TimeHelper.format(new Date(), "date")})**
🕐 현재 시간: ${currentTime}

📊 **현재 상태:**
• 근무시간 서비스: ${this.worktimeService ? "✅ 연결됨" : "❌ 비연결"}
• 출근 상태: ${todayStatus.checkedIn ? "✅ 출근함" : "⭕ 미출근"}
• 퇴근 상태: ${todayStatus.checkedOut ? "✅ 퇴근함" : "⭕ 미퇴근"}

🕐 **근무시간:**
• 정규 시간: ${this.workSchedule.startTime} ~ ${this.workSchedule.endTime}
• 점심 시간: ${this.workSchedule.lunchStart} ~ ${this.workSchedule.lunchEnd}

📱 **주요 기능:**
• 출근/퇴근 기록
• 근무시간 진행률
• 일별/주별 기록 조회`;

      await this.sendMessage(bot, chatId, menuText);
      return true;
    } catch (error) {
      logger.error("❌ 근무시간 메뉴 액션 실패:", error);
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

      const errorMenuText = `🕐 **근무시간 관리** (제한 모드)

❌ **서비스 상태:**
• 근무시간 서비스: 연결 실패
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
   * 📊 상태 액션
   */
  async handleStatusAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      if (!this.worktimeService) {
        return await this.handleServiceUnavailableError(bot, callbackQuery);
      }

      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id;

      // 오늘 근무 상태 조회
      const todayStatus = await this.getTodayWorkStatus(userId);
      const workProgress = this.calculateWorkProgress(todayStatus);

      let statusText = `📊 **근무시간 상태** (${TimeHelper.format(
        new Date(),
        "date"
      )})\n\n`;

      if (todayStatus.checkedIn) {
        statusText += `✅ **출근**: ${TimeHelper.format(
          todayStatus.checkinTime,
          "time"
        )}\n`;

        if (todayStatus.checkedOut) {
          statusText += `✅ **퇴근**: ${TimeHelper.format(
            todayStatus.checkoutTime,
            "time"
          )}\n`;
          statusText += `🕐 **총 근무시간**: ${this.formatDuration(
            todayStatus.totalWorkTime
          )}\n`;
        } else {
          statusText += `⏳ **현재 근무 중**: ${this.formatDuration(
            workProgress.currentWorkTime
          )}\n`;
          statusText += `📈 **진행률**: ${workProgress.progressPercent}%\n`;
        }
      } else {
        statusText += `⭕ **아직 출근하지 않았습니다**\n`;
        statusText += `🕐 **정규 출근시간**: ${this.workSchedule.startTime}\n`;
      }

      await this.sendMessage(bot, chatId, statusText);
      return true;
    } catch (error) {
      logger.error("❌ 근무시간 상태 액션 실패:", error);
      return false;
    }
  }

  /**
   * 🏠 출근 액션
   */
  async handleCheckinAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      if (!this.worktimeService) {
        return await this.handleServiceUnavailableError(bot, callbackQuery);
      }

      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id;
      const userName = getUserName(callbackQuery.from);

      // 이미 출근했는지 확인
      const todayStatus = await this.getTodayWorkStatus(userId);

      if (todayStatus.checkedIn) {
        const checkinTime = TimeHelper.format(todayStatus.checkinTime, "time");
        await this.sendMessage(
          bot,
          chatId,
          `⚠️ **이미 출근하셨습니다**\n\n` +
            `출근 시간: ${checkinTime}\n` +
            `다시 출근 처리가 필요하시면 관리자에게 문의하세요.`
        );
        return true;
      }

      // 출근 처리
      const checkinResult = await this.worktimeService.recordCheckin?.(userId, {
        userName,
        timestamp: new Date(),
        source: "telegram_bot",
      });

      if (checkinResult?.success) {
        const checkinTime = TimeHelper.format(new Date(), "time");
        await this.sendMessage(
          bot,
          chatId,
          `✅ **출근 완료!**\n\n` +
            `👋 안녕하세요, ${userName}님!\n` +
            `🕐 출근 시간: ${checkinTime}\n` +
            `💼 오늘도 좋은 하루 되세요!`
        );
      } else {
        await this.sendMessage(
          bot,
          chatId,
          `❌ 출근 처리 실패: ${checkinResult?.error || "알 수 없는 오류"}`
        );
      }

      return true;
    } catch (error) {
      logger.error("❌ 출근 액션 실패:", error);
      return false;
    }
  }

  /**
   * 🏃 퇴근 액션
   */
  async handleCheckoutAction(
    bot,
    callbackQuery,
    subAction,
    params,
    moduleManager
  ) {
    try {
      if (!this.worktimeService) {
        return await this.handleServiceUnavailableError(bot, callbackQuery);
      }

      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id;
      const userName = getUserName(callbackQuery.from);

      // 출근했는지 확인
      const todayStatus = await this.getTodayWorkStatus(userId);

      if (!todayStatus.checkedIn) {
        await this.sendMessage(
          bot,
          chatId,
          `⚠️ **출근 기록이 없습니다**\n\n` +
            `먼저 출근 처리를 해주세요.\n` +
            `출근 시간이 누락된 경우 관리자에게 문의하세요.`
        );
        return true;
      }

      if (todayStatus.checkedOut) {
        const checkoutTime = TimeHelper.format(
          todayStatus.checkoutTime,
          "time"
        );
        await this.sendMessage(
          bot,
          chatId,
          `⚠️ **이미 퇴근하셨습니다**\n\n` +
            `퇴근 시간: ${checkoutTime}\n` +
            `추가 작업이 필요하시면 관리자에게 문의하세요.`
        );
        return true;
      }

      // 퇴근 처리
      const checkoutResult = await this.worktimeService.recordCheckout?.(
        userId,
        {
          userName,
          timestamp: new Date(),
          source: "telegram_bot",
        }
      );

      if (checkoutResult?.success) {
        const checkoutTime = TimeHelper.format(new Date(), "time");
        const totalWorkTime = this.calculateTotalWorkTime(
          todayStatus.checkinTime,
          new Date()
        );

        await this.sendMessage(
          bot,
          chatId,
          `✅ **퇴근 완료!**\n\n` +
            `👋 수고하셨습니다, ${userName}님!\n` +
            `🕐 퇴근 시간: ${checkoutTime}\n` +
            `⏱️ 총 근무시간: ${this.formatDuration(totalWorkTime)}\n` +
            `🏠 안전하게 집에 가세요!`
        );
      } else {
        await this.sendMessage(
          bot,
          chatId,
          `❌ 퇴근 처리 실패: ${checkoutResult?.error || "알 수 없는 오류"}`
        );
      }

      return true;
    } catch (error) {
      logger.error("❌ 퇴근 액션 실패:", error);
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 오늘 근무 상태 조회
   */
  async getTodayWorkStatus(userId) {
    try {
      if (!this.worktimeService || !this.worktimeService.getTodayRecord) {
        return {
          checkedIn: false,
          checkedOut: false,
          checkinTime: null,
          checkoutTime: null,
          totalWorkTime: 0,
        };
      }

      const todayRecord = await this.worktimeService.getTodayRecord(userId);

      return {
        checkedIn: !!todayRecord?.checkinTime,
        checkedOut: !!todayRecord?.checkoutTime,
        checkinTime: todayRecord?.checkinTime,
        checkoutTime: todayRecord?.checkoutTime,
        totalWorkTime: todayRecord?.totalWorkTime || 0,
      };
    } catch (error) {
      logger.error("❌ 오늘 근무 상태 조회 실패:", error);
      return {
        checkedIn: false,
        checkedOut: false,
        checkinTime: null,
        checkoutTime: null,
        totalWorkTime: 0,
      };
    }
  }

  /**
   * 근무 진행률 계산
   */
  calculateWorkProgress(todayStatus) {
    if (!todayStatus.checkedIn) {
      return { currentWorkTime: 0, progressPercent: 0 };
    }

    const now = new Date();
    const checkinTime = new Date(todayStatus.checkinTime);
    const currentWorkTime = now.getTime() - checkinTime.getTime();

    const targetWorkTime = this.workSchedule.totalWorkHours * 60 * 60 * 1000; // 밀리초
    const progressPercent = Math.min(
      Math.round((currentWorkTime / targetWorkTime) * 100),
      100
    );

    return {
      currentWorkTime,
      progressPercent,
    };
  }

  /**
   * 총 근무시간 계산
   */
  calculateTotalWorkTime(checkinTime, checkoutTime) {
    if (!checkinTime || !checkoutTime) return 0;

    const checkin = new Date(checkinTime);
    const checkout = new Date(checkoutTime);

    return checkout.getTime() - checkin.getTime();
  }

  /**
   * 시간 포맷팅 (밀리초 -> 시간:분)
   */
  formatDuration(milliseconds) {
    if (milliseconds <= 0) return "0분";

    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  /**
   * 근무시간 키워드 감지
   */
  isWorktimeKeyword(text) {
    if (!text || typeof text !== "string") return false;

    const keywords = [
      "출근",
      "퇴근",
      "근무시간",
      "worktime",
      "체크인",
      "체크아웃",
      "checkin",
      "checkout",
    ];

    return keywords.some((keyword) => text.includes(keyword));
  }

  /**
   * 근무시간 키워드 처리
   */
  async handleWorktimeKeyword(bot, msg) {
    try {
      const {
        text,
        chat: { id: chatId },
      } = msg;

      await this.sendMessage(
        bot,
        chatId,
        "🕐 근무시간 키워드를 감지했습니다!\n\n" +
          "정확한 출근/퇴근 처리를 위해 근무시간 메뉴를 이용해주세요.\n" +
          "/worktime 명령어를 사용하세요."
      );

      return true;
    } catch (error) {
      logger.error("❌ 근무시간 키워드 처리 실패:", error);
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
          "근무시간 관리 서비스에 일시적인 문제가 발생했습니다.\n" +
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
  async handleProgressAction() {
    return await this.handleNotImplementedAction();
  }
  async handleHistoryAction() {
    return await this.handleNotImplementedAction();
  }
  async handleTodayRecordAction() {
    return await this.handleNotImplementedAction();
  }
  async handleSettingsAction() {
    return await this.handleNotImplementedAction();
  }
  async handleAddCheckinNoteAction() {
    return await this.handleNotImplementedAction();
  }
  async handleAddCheckoutNoteAction() {
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
      worktimeService: {
        connected: !!this.worktimeService,
        status: this.worktimeService?.getStatus?.() || "unknown",
      },
      workSchedule: this.workSchedule,
      config: this.config,
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      // 상위 클래스 정리
      await super.cleanup();

      // 서비스 참조 정리 (ServiceBuilder가 관리하므로 직접 정리하지 않음)
      this.worktimeService = null;

      logger.info("✅ WorktimeModule 정리 완료");
    } catch (error) {
      logger.error("❌ WorktimeModule 정리 실패:", error);
    }
  }
}

module.exports = WorktimeModule;
