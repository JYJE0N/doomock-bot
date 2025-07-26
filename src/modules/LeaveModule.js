// src/modules/LeaveModule.js - 표준 구조 수정 v3.0.1
const BaseModule = require("../core/BaseModule");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName, getUserId } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

/**
 * 🏖️ LeaveModule v3.0.1 - 연차/월차/반차/반반차 통합 관리
 *
 * 🎯 주요 수정사항:
 * - 표준 생성자 매개변수 사용 (bot, options)
 * - ServiceBuilder를 통한 서비스 요청
 * - 표준 매개변수 체계 준수
 * - actionMap 방식 사용
 */
class LeaveModule extends BaseModule {
  constructor(bot, options = {}) {
    super("LeaveModule", {
      bot,
      serviceBuilder: options.serviceBuilder, // ServiceBuilder 주입
      moduleManager: options.moduleManager,
      moduleKey: options.moduleKey,
      moduleConfig: options.moduleConfig,
      config: options.config,
    });

    // 🔧 서비스 인스턴스 (onInitialize에서 요청)
    this.leaveService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      annualLeaveDays: parseInt(process.env.ANNUAL_LEAVE_DAYS) || 15,
      monthlyLeaveDays: parseInt(process.env.MONTHLY_LEAVE_DAYS) || 1,
      sickLeaveDays: parseInt(process.env.SICK_LEAVE_DAYS) || 3,
      enableHalfDay: process.env.ENABLE_HALF_DAY_LEAVE !== "false",
      enableQuarterDay: process.env.ENABLE_QUARTER_DAY_LEAVE === "true",
      ...this.config,
    };

    // 휴가 유형 정의
    this.leaveTypes = {
      ANNUAL: { name: "연차", icon: "🏖️", unit: "일" },
      MONTHLY: { name: "월차", icon: "📅", unit: "일" },
      HALF: { name: "반차", icon: "🌗", unit: "회" },
      QUARTER: { name: "반반차", icon: "⏱️", unit: "회" },
      SICK: { name: "병가", icon: "🏥", unit: "일" },
    };

    logger.info("🏖️ LeaveModule v3.0.1 생성됨");
  }

  /**
   * 🎯 모듈 초기화 - ServiceBuilder 활용
   */
  async onInitialize() {
    try {
      logger.info("🏖️ LeaveModule 서비스 초기화 시작...");

      // ServiceBuilder를 통한 서비스 요청
      this.leaveService = await this.requireService("leave");

      logger.success("✅ LeaveModule 서비스 초기화 완료");
    } catch (error) {
      logger.error("❌ LeaveModule 서비스 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 설정 (표준 actionMap 방식)
   */
  setupActions() {
    this.registerActions({
      // 메인 메뉴
      menu: this.showMenu,

      // 휴가 현황
      status: this.showLeaveStatus,
      statistics: this.showLeaveStatistics,

      // 휴가 사용
      use: this.showLeaveUseMenu,
      annual: this.handleAnnualLeave,
      monthly: this.handleMonthlyLeave,
      half: this.handleHalfDayLeave,
      quarter: this.handleQuarterDayLeave,
      sick: this.handleSickLeave,

      // 휴가 신청 처리
      apply: this.processLeaveApplication,
      confirm: this.confirmLeaveApplication,
      cancel: this.cancelLeaveApplication,

      // 휴가 내역
      history: this.showLeaveHistory,
      detail: this.showLeaveDetail,

      // 설정
      settings: this.showSettings,
      help: this.showHelp,
    });
  }

  /**
   * 📋 메인 메뉴
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const userName = getUserName(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      // 서비스 상태 확인
      if (!this.leaveService) {
        await this.sendError(
          bot,
          callbackQuery,
          "서비스가 초기화되지 않았습니다."
        );
        return false;
      }

      // 휴가 현황 조회
      const status = await this.leaveService.getUserLeaveStatus(userId);
      const currentYear = new Date().getFullYear();

      const menuText = `🏖️ **휴가 관리**

${userName}님의 ${currentYear}년 휴가 현황:

${this.leaveTypes.ANNUAL.icon} **연차**: ${status.annual.remaining}/${status.annual.total}일
${this.leaveTypes.MONTHLY.icon} **월차**: ${status.monthly.remaining}/${status.monthly.total}일
${this.leaveTypes.SICK.icon} **병가**: ${status.sick.used}/${status.sick.total}일 사용

무엇을 하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 휴가 현황", callback_data: "leave:status" },
            { text: "✏️ 휴가 사용", callback_data: "leave:use" },
          ],
          [
            { text: "📅 사용 내역", callback_data: "leave:history" },
            { text: "📈 통계", callback_data: "leave:statistics" },
          ],
          [
            { text: "⚙️ 설정", callback_data: "leave:settings" },
            { text: "❓ 도움말", callback_data: "leave:help" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("LeaveModule 메뉴 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "메뉴를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 📊 휴가 현황 상세
   */
  async showLeaveStatus(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const status = await this.leaveService.getUserLeaveStatus(userId);
      const currentMonth = TimeHelper.format(new Date(), "month");

      const statusText = `📊 **휴가 현황 상세**

📅 기준: ${currentMonth}

**연차 (Annual Leave)**
• 총 부여: ${status.annual.total}일
• 사용: ${status.annual.used}일
• 잔여: ${status.annual.remaining}일

**월차 (Monthly Leave)**
• 이번달 부여: ${status.monthly.total}일
• 사용: ${status.monthly.used}일
• 잔여: ${status.monthly.remaining}일

**반차/반반차**
• 반차 사용: ${status.half.used}회 (${status.half.used * 0.5}일)
• 반반차 사용: ${status.quarter.used}회 (${status.quarter.used * 0.25}일)

**병가 (Sick Leave)**
• 총 한도: ${status.sick.total}일
• 사용: ${status.sick.used}일
• 잔여: ${status.sick.remaining}일

💡 다음 월차 발생일: ${status.nextMonthlyLeaveDate}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✏️ 휴가 사용", callback_data: "leave:use" },
            { text: "📅 사용 내역", callback_data: "leave:history" },
          ],
          [{ text: "🔙 뒤로", callback_data: "leave:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statusText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("LeaveModule 현황 표시 오류:", error);
      await this.sendError(bot, callbackQuery, "현황을 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * ✏️ 휴가 사용 메뉴
   */
  async showLeaveUseMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;

      const status = await this.leaveService.getUserLeaveStatus(userId);

      const useMenuText = `✏️ **휴가 사용**

어떤 휴가를 사용하시겠습니까?

사용 가능한 휴가:`;

      const keyboard = [[]];

      // 연차
      if (status.annual.remaining > 0) {
        keyboard[0].push({
          text: `${this.leaveTypes.ANNUAL.icon} 연차 (${status.annual.remaining}일)`,
          callback_data: "leave:annual",
        });
      }

      // 월차
      if (status.monthly.remaining > 0) {
        keyboard[0].push({
          text: `${this.leaveTypes.MONTHLY.icon} 월차 (${status.monthly.remaining}일)`,
          callback_data: "leave:monthly",
        });
      }

      // 반차/반반차
      if (this.config.enableHalfDay && status.annual.remaining >= 0.5) {
        keyboard.push([
          { text: "🌗 반차 (0.5일)", callback_data: "leave:half" },
        ]);
      }

      if (this.config.enableQuarterDay && status.annual.remaining >= 0.25) {
        keyboard[keyboard.length - 1].push({
          text: "⏱️ 반반차 (0.25일)",
          callback_data: "leave:quarter",
        });
      }

      // 병가
      keyboard.push([
        {
          text: `${this.leaveTypes.SICK.icon} 병가`,
          callback_data: "leave:sick",
        },
      ]);

      // 뒤로가기
      keyboard.push([{ text: "🔙 뒤로", callback_data: "leave:menu" }]);

      await this.editMessage(bot, chatId, messageId, useMenuText, {
        reply_markup: { inline_keyboard: keyboard },
      });

      return true;
    } catch (error) {
      logger.error("LeaveModule 휴가 사용 메뉴 오류:", error);
      await this.sendError(bot, callbackQuery, "메뉴를 표시할 수 없습니다.");
      return false;
    }
  }

  /**
   * 🏖️ 연차 사용
   */
  async handleAnnualLeave(bot, callbackQuery, params, moduleManager) {
    try {
      const userId = getUserId(callbackQuery);
      const {
        message: {
          chat: { id: chatId },
        },
      } = callbackQuery;

      // 사용자 상태 설정
      this.setUserState(userId, {
        action: "using_leave",
        leaveType: "ANNUAL",
        step: "waiting_date",
      });

      const instructionText = `🏖️ **연차 사용**

언제 연차를 사용하시겠습니까?

날짜를 입력해주세요:
• 오늘: "오늘"
• 내일: "내일"  
• 특정 날짜: "12월 25일" 또는 "12/25"

여러 날 사용시: "12/25-12/27" (3일간)

/cancel - 취소`;

      await bot.sendMessage(chatId, instructionText, {
        parse_mode: "Markdown",
      });

      return true;
    } catch (error) {
      logger.error("LeaveModule 연차 처리 오류:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "연차 신청을 시작할 수 없습니다."
      );
      return false;
    }
  }

  /**
   * 📨 메시지 처리 (날짜 입력 등)
   */
  async onHandleMessage(bot, msg) {
    try {
      const userId = getUserId(msg);
      const userState = this.getUserState(userId);

      if (!userState) {
        return false;
      }

      // 취소 명령
      if (msg.text === "/cancel") {
        this.clearUserState(userId);
        await bot.sendMessage(msg.chat.id, "❌ 휴가 신청이 취소되었습니다.");
        return true;
      }

      // 휴가 날짜 입력 처리
      if (
        userState.action === "using_leave" &&
        userState.step === "waiting_date"
      ) {
        return await this.processLeaveDate(bot, msg, userState);
      }

      return false;
    } catch (error) {
      logger.error("LeaveModule 메시지 처리 오류:", error);
      await bot.sendMessage(
        msg.chat.id,
        "❌ 처리 중 오류가 발생했습니다.\n다시 시도해주세요."
      );
      return true;
    }
  }

  /**
   * 날짜 입력 처리
   */
  async processLeaveDate(bot, msg, userState) {
    try {
      const userId = getUserId(msg);
      const dateText = msg.text.trim();

      // 날짜 파싱 (TimeHelper 활용)
      const parsedDate = this.parseLeaveDate(dateText);

      if (!parsedDate.isValid) {
        await bot.sendMessage(
          msg.chat.id,
          "⚠️ 올바른 날짜 형식이 아닙니다.\n\n예시: '12월 25일', '12/25', '내일'"
        );
        return true;
      }

      // 휴가 신청 데이터 준비
      const leaveData = {
        userId,
        type: userState.leaveType,
        startDate: parsedDate.startDate,
        endDate: parsedDate.endDate || parsedDate.startDate,
        days: parsedDate.days,
        reason: userState.reason || "",
      };

      // 휴가 신청
      const result = await this.leaveService.applyLeave(leaveData);

      if (result.success) {
        this.clearUserState(userId);

        const successText = `✅ **휴가 신청 완료**

${this.leaveTypes[userState.leaveType].icon} ${
          this.leaveTypes[userState.leaveType].name
        }
📅 ${TimeHelper.format(parsedDate.startDate, "dateOnly")}
${
  parsedDate.endDate
    ? `~ ${TimeHelper.format(parsedDate.endDate, "dateOnly")}`
    : ""
}
📊 ${parsedDate.days}일

잔여 휴가: ${result.remaining}일`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "📊 휴가 현황", callback_data: "leave:status" },
              { text: "📅 사용 내역", callback_data: "leave:history" },
            ],
            [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
          ],
        };

        await bot.sendMessage(msg.chat.id, successText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await bot.sendMessage(
          msg.chat.id,
          `❌ 휴가 신청 실패\n\n${result.message}`
        );
      }

      return true;
    } catch (error) {
      logger.error("LeaveModule 날짜 처리 오류:", error);
      throw error;
    }
  }

  /**
   * 날짜 파싱 헬퍼
   */
  parseLeaveDate(dateText) {
    try {
      const today = new Date();

      // "오늘"
      if (dateText === "오늘") {
        return {
          isValid: true,
          startDate: today,
          days: 1,
        };
      }

      // "내일"
      if (dateText === "내일") {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return {
          isValid: true,
          startDate: tomorrow,
          days: 1,
        };
      }

      // 날짜 범위 (12/25-12/27)
      if (dateText.includes("-")) {
        const [start, end] = dateText.split("-").map((d) => d.trim());
        // 실제 날짜 파싱 로직 구현 필요
        // TimeHelper 활용
      }

      // 단일 날짜
      // TimeHelper를 활용한 날짜 파싱

      return { isValid: false };
    } catch (error) {
      return { isValid: false };
    }
  }
}

module.exports = LeaveModule;
