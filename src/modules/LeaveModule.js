// src/modules/LeaveModule.js - 🏖️ SoC 완벽 준수 + 헬퍼 활용 버전
const BaseModule = require("../core/BaseModule");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

/**
 * 🏖️ LeaveModule - 휴가/연차 관리 모듈
 *
 * 🎯 핵심 역할: 연차 관련 비즈니스 로직 처리
 * ✅ SRP 준수: 로직만 담당, 데이터는 서비스에서, UI는 렌더러에서
 *
 * 비유: 여행사 상담원
 * - 고객 문의 접수 (콜백 처리)
 * - 상품 조회 (연차 현황)
 * - 예약 처리 (연차 신청)
 * - 상담 결과 안내 (UI 렌더링)
 */
class LeaveModule extends BaseModule {
  constructor() {
    super();
    this.moduleKey = "leave";

    // 🎯 SoC 준수: 의존성은 런타임에 주입받음
    this.service = null;
    this.renderer = null;
    this.errorHandler = null;
  }

  /**
   * 🎯 모듈 초기화 (SoC 준수)
   */
  async onInitialize() {
    try {
      // ServiceBuilder에서 서비스 가져오기
      this.service = await this.serviceBuilder.getOrCreate("leave");
      if (!this.service) {
        throw new Error("LeaveService 생성에 실패했습니다");
      }

      // 렌더러는 NavigationHandler에서 가져오기 (SoC 준수)
      this.renderer =
        this.moduleManager?.navigationHandler?.getRenderer("leave");
      if (!this.renderer) {
        logger.warn("LeaveRenderer를 찾을 수 없습니다 - 기본 렌더링 사용");
      }

      // ErrorHandler는 NavigationHandler에서 가져오기 (SoC 준수)
      this.errorHandler = this.moduleManager?.navigationHandler?.errorHandler;
      if (!this.errorHandler) {
        logger.warn("ErrorHandler를 찾을 수 없습니다 - 기본 에러 처리 사용");
      }

      // 액션 등록 (표준 패턴)
      this.setupActions();

      logger.success("🏖️ LeaveModule 초기화 완료 - SoC 준수");
    } catch (error) {
      logger.error("❌ LeaveModule 초기화 실패:", error);
      throw error;
    }

    this.actionMap = {
      // 📊 조회 관련
      status: this.showLeaveStatus.bind(this),
      history: this.showLeaveHistory.bind(this),
      today: this.checkTodayUsage.bind(this),
      monthly: this.showMonthlyStats.bind(this),

      // 🏖️ 신청 관련
      request: this.showRequestForm.bind(this),
      confirm: this.confirmLeaveRequest.bind(this),
      cancel: this.cancelLeaveRequest.bind(this),

      // ⚙️ 설정 관련
      settings: this.showSettings.bind(this),
      updateSettings: this.updateSettings.bind(this),
    };
  }
  /**
   * 🎯 액션 매핑 설정 (표준 패턴)
   */
  setupActions() {
    this.actionMap = {
      // 📊 조회 관련
      status: this.showLeaveStatus.bind(this),
      history: this.showLeaveHistory.bind(this),
      today: this.checkTodayUsage.bind(this),
      monthly: this.showMonthlyStats.bind(this),

      // 🏖️ 신청 관련
      request: this.showRequestForm.bind(this),
      confirm: this.confirmLeaveRequest.bind(this),
      cancel: this.cancelLeaveRequest.bind(this),

      // ⚙️ 설정 관련
      settings: this.showSettings.bind(this),
      updateSettings: this.updateSettings.bind(this),

      // 🔄 네비게이션
      main: this.showMainMenu.bind(this),
      back: this.handleBack.bind(this),
    };
  }

  /**
   * 📊 연차 현황 조회 및 표시
   *
   * 비유: 은행 ATM에서 잔고 조회
   */
  async showLeaveStatus(bot, callbackQuery, params) {
    try {
      const userId = callbackQuery.from.id;

      // 🎯 서비스에서 순수 데이터 조회
      const statusResponse = await this.service.getLeaveStatus(userId);

      if (!statusResponse.success) {
        return await this.handleServiceError(
          bot,
          callbackQuery,
          statusResponse
        );
      }

      // 🎨 렌더러에서 UI 생성 (SoC 준수)
      if (this.renderer) {
        return await this.renderer.renderLeaveStatus(statusResponse.data, {
          bot,
          callbackQuery,
          moduleManager: this.moduleManager,
        });
      }

      // 🔄 폴백: 렌더러가 없으면 기본 응답
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `잔여 연차: ${statusResponse.data.remainingLeave}일`,
      });

      logger.info(
        `📊 연차 현황 표시: ${userId} - ${statusResponse.data.remainingLeave}일 남음`
      );
    } catch (error) {
      await this.handleModuleError(bot, callbackQuery, "연차 현황 조회", error);
    }
  }

  /**
   * 📋 연차 사용 이력 표시
   *
   * 비유: 신용카드 사용 내역서 조회
   */
  async showLeaveHistory(bot, callbackQuery, params) {
    try {
      const userId = callbackQuery.from.id;

      // params에서 페이지 정보 추출 (예: "2024:1" -> year=2024, page=1)
      const [year, page] = params
        ? params.split(":")
        : [new Date().getFullYear(), 1];

      const historyResponse = await this.service.getLeaveHistory(userId, {
        year: parseInt(year),
        page: parseInt(page),
        limit: 10,
      });

      if (!historyResponse.success) {
        await this.handleServiceError(bot, callbackQuery, historyResponse);
        return;
      }

      const historyData = historyResponse.data;

      // 렌더러에서 UI 생성
      const message = this.renderer.renderLeaveHistory(historyData, year);
      const keyboard = this.renderer.createHistoryKeyboard(
        historyData,
        year,
        page
      );

      await bot.editMessageText(message, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: "HTML",
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `${historyData.items.length}건의 이력을 조회했습니다`,
      });

      logger.info(
        `📋 연차 이력 표시: ${userId} - ${historyData.items.length}건`
      );
    } catch (error) {
      logger.error("연차 이력 표시 실패:", error);
      await this.handleError(
        bot,
        callbackQuery,
        "연차 이력을 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🏖️ 연차 신청 폼 표시
   *
   * 비유: 호텔 예약 사이트의 예약 폼
   */
  async showRequestForm(bot, callbackQuery, params) {
    try {
      const userId = callbackQuery.from.id;

      // 현재 연차 현황 확인
      const statusResponse = await this.service.getLeaveStatus(userId);

      if (!statusResponse.success) {
        await this.handleServiceError(bot, callbackQuery, statusResponse);
        return;
      }

      const status = statusResponse.data;

      // 연차가 부족한 경우
      if (status.remainingLeave <= 0) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "잔여 연차가 없습니다!",
          show_alert: true,
        });
        return;
      }

      // 렌더러에서 신청 폼 UI 생성
      const message = this.renderer.renderRequestForm(status);
      const keyboard = this.renderer.createRequestFormKeyboard(status);

      await bot.editMessageText(message, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: "HTML",
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "연차 신청 폼을 불러왔습니다",
      });

      logger.info(`🏖️ 연차 신청 폼 표시: ${userId}`);
    } catch (error) {
      logger.error("연차 신청 폼 표시 실패:", error);
      await this.handleError(
        bot,
        callbackQuery,
        "연차 신청 폼을 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * ✅ 연차 신청 확인 및 처리
   *
   * 비유: 호텔 예약 최종 확인 및 결제
   */
  async confirmLeaveRequest(bot, callbackQuery, params) {
    try {
      const userId = callbackQuery.from.id;

      // params 파싱: "2024-12-25:full:개인사유"
      const [date, type, ...reasonParts] = params.split(":");
      const reason = reasonParts.join(":") || "";

      // 서비스에서 실제 연차 신청 처리
      const requestResponse = await this.service.requestLeave(
        userId,
        date,
        type,
        reason
      );

      if (!requestResponse.success) {
        await this.handleServiceError(bot, callbackQuery, requestResponse);
        return;
      }

      const leaveData = requestResponse.data;

      // 성공 메시지 렌더링
      const message = this.renderer.renderRequestSuccess(leaveData);
      const keyboard = this.renderer.createSuccessKeyboard();

      await bot.editMessageText(message, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: "HTML",
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "연차 신청이 완료되었습니다! ✅",
        show_alert: true,
      });

      logger.success(
        `🏖️ 연차 신청 완료: ${userId} - ${leaveData.date} (${leaveData.amount}일)`
      );
    } catch (error) {
      logger.error("연차 신청 처리 실패:", error);
      await this.handleError(
        bot,
        callbackQuery,
        "연차 신청 처리 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 📈 월별 연차 사용 통계 표시
   *
   * 비유: 가계부 앱의 월별 지출 차트
   */
  async showMonthlyStats(bot, callbackQuery, params) {
    try {
      const userId = callbackQuery.from.id;
      const year = params ? parseInt(params) : new Date().getFullYear();

      const statsResponse = await this.service.getMonthlyStats(userId, year);

      if (!statsResponse.success) {
        await this.handleServiceError(bot, callbackQuery, statsResponse);
        return;
      }

      const monthlyData = statsResponse.data;

      // 렌더러에서 통계 UI 생성
      const message = this.renderer.renderMonthlyStats(monthlyData, year);
      const keyboard = this.renderer.createStatsKeyboard(year);

      await bot.editMessageText(message, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: "HTML",
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `${year}년 월별 통계를 불러왔습니다`,
      });

      logger.info(`📈 월별 통계 표시: ${userId} - ${year}년`);
    } catch (error) {
      logger.error("월별 통계 표시 실패:", error);
      await this.handleError(
        bot,
        callbackQuery,
        "월별 통계를 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🔍 오늘 연차 사용 여부 확인
   */
  async checkTodayUsage(bot, callbackQuery, params) {
    try {
      const userId = callbackQuery.from.id;

      const todayResponse = await this.service.getTodayUsage(userId);

      if (!todayResponse.success) {
        await this.handleServiceError(bot, callbackQuery, todayResponse);
        return;
      }

      const todayData = todayResponse.data;

      // 렌더러에서 오늘 현황 UI 생성
      const message = this.renderer.renderTodayUsage(todayData);
      const keyboard = this.renderer.createTodayKeyboard();

      await bot.editMessageText(message, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: "HTML",
      });

      const responseText = todayData.hasUsage
        ? `오늘 ${todayData.totalDays}일 사용 중입니다`
        : "오늘은 연차를 사용하지 않았습니다";

      await bot.answerCallbackQuery(callbackQuery.id, { text: responseText });

      logger.info(`🔍 오늘 연차 확인: ${userId} - ${todayData.totalDays}일`);
    } catch (error) {
      logger.error("오늘 연차 확인 실패:", error);
      await this.handleError(
        bot,
        callbackQuery,
        "오늘 연차 확인 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMainMenu(bot, callbackQuery, params) {
    try {
      const userId = callbackQuery.from.id;

      // 현재 상태 정보 조회
      const statusResponse = await this.service.getLeaveStatus(userId);
      const status = statusResponse.success ? statusResponse.data : null;

      // 렌더러에서 메인 메뉴 UI 생성
      const message = this.renderer.renderMainMenu(status);
      const keyboard = this.renderer.createMainMenuKeyboard();

      await bot.editMessageText(message, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: "HTML",
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "연차 관리 메뉴입니다",
      });

      logger.info(`🏠 연차 메인 메뉴 표시: ${userId}`);
    } catch (error) {
      logger.error("메인 메뉴 표시 실패:", error);
      await this.handleError(
        bot,
        callbackQuery,
        "메인 메뉴를 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * ⚙️ 설정 메뉴 표시
   */
  async showSettings(bot, callbackQuery, params) {
    try {
      const userId = callbackQuery.from.id;

      // 현재 설정 조회
      const statusResponse = await this.service.getLeaveStatus(userId);

      if (!statusResponse.success) {
        await this.handleServiceError(bot, callbackQuery, statusResponse);
        return;
      }

      const status = statusResponse.data;

      // 렌더러에서 설정 UI 생성
      const message = this.renderer.renderSettings(status);
      const keyboard = this.renderer.createSettingsKeyboard();

      await bot.editMessageText(message, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        reply_markup: keyboard,
        parse_mode: "HTML",
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "연차 설정 메뉴입니다",
      });

      logger.info(`⚙️ 연차 설정 표시: ${userId}`);
    } catch (error) {
      logger.error("설정 표시 실패:", error);
      await this.handleError(
        bot,
        callbackQuery,
        "설정을 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  // ===== 🔧 에러 처리 메서드 (ErrorHandler 활용) =====

  /**
   * 🚨 서비스 오류 처리 (ErrorHandler 활용)
   */
  async handleServiceError(bot, callbackQuery, serviceResponse) {
    if (this.errorHandler) {
      // ErrorHandler에 위임 (SoC 준수)
      return await this.errorHandler.handleServiceError(
        bot,
        callbackQuery,
        serviceResponse,
        {
          module: "leave",
          action: "service_error",
          showAlert: true,
        }
      );
    }

    // 폴백: ErrorHandler가 없으면 기본 처리
    const errorMessage =
      serviceResponse.message || "알 수 없는 오류가 발생했습니다.";

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: errorMessage,
      show_alert: true,
    });

    logger.warn(`서비스 오류 처리 (폴백): ${errorMessage}`);
  }

  /**
   * 🚨 모듈 오류 처리 (ErrorHandler 활용)
   */
  async handleModuleError(bot, callbackQuery, operation, error) {
    if (this.errorHandler) {
      // ErrorHandler에 위임 (SoC 준수)
      return await this.errorHandler.handleModuleError(
        bot,
        callbackQuery,
        error,
        {
          module: "leave",
          operation,
          showAlert: true,
          fallbackToMain: true,
        }
      );
    }

    // 폴백: ErrorHandler가 없으면 기본 처리
    logger.error(`${operation} 실패:`, error);

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `${operation} 중 오류가 발생했습니다.`,
      show_alert: true,
    });

    // 에러 발생 시 메인 메뉴로 복귀
    setTimeout(() => {
      this.showMainMenu(bot, callbackQuery, null);
    }, 1000);
  }

  /**
   * 뒤로 가기 처리
   */
  async handleBack(bot, callbackQuery, params) {
    // params에 따라 적절한 메뉴로 이동
    const destination = params || "main";

    switch (destination) {
      case "status":
        await this.showLeaveStatus(bot, callbackQuery, null);
        break;
      case "history":
        await this.showLeaveHistory(bot, callbackQuery, null);
        break;
      default:
        await this.showMainMenu(bot, callbackQuery, null);
    }
  }

  /**
   * 일반 메시지 처리 (필요시 구현)
   */
  async onHandleMessage(bot, msg) {
    // 향후 텍스트 입력 처리를 위한 메서드
    // 예: 연차 사유 입력, 날짜 입력 등
    logger.info(`연차 모듈에서 메시지 수신: ${msg.text}`);
  }
}

module.exports = LeaveModule;
