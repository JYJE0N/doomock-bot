// src/modules/LeaveModule.js - 연차/월차/반차/반반차 통합 관리 모듈

const BaseModule = require("./BaseModule");
const LeaveService = require("../services/LeaveService");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class LeaveModule extends BaseModule {
  constructor(bot, dependencies) {
    super("LeaveModule", {
      commands: ["leave"],
      callbacks: ["leave"],
      features: ["status", "use", "history", "setting", "statistics"],
    });

    this.leaveService = null;
  }

  // 🎯 모듈 초기화
  async onInitialize() {
    try {
      this.leaveService = new LeaveService();
      await this.leaveService.initialize();
      logger.info("🏖️ LeaveModule 초기화 성공");
    } catch (error) {
      logger.error("❌ LeaveModule 초기화 실패:", error);
      throw error;
    }
  }

  // 🎯 액션 등록 (ActionMap 방식)
  setupActions() {
    this.registerActions({
      // 메인 메뉴
      menu: this.showMenu,

      // 휴가 현황 관련
      status: this.showLeaveStatus,
      statistics: this.showLeaveStatistics,

      // 휴가 사용 관련
      use: this.showLeaveUseMenu,
      "use:annual": this.showAnnualLeaveMenu,
      "use:monthly": this.showMonthlyLeaveMenu,
      "use:half": this.showHalfDayMenu,
      "use:quarter": this.showQuarterDayMenu,
      "use:sick": this.showSickLeaveMenu,

      // 구체적 사용 액션
      "apply:annual:1": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 1, "ANNUAL"),
      "apply:annual:0.5": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 0.5, "ANNUAL"),
      "apply:annual:0.25": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 0.25, "ANNUAL"),

      "apply:monthly:1": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 1, "MONTHLY"),
      "apply:monthly:0.5": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 0.5, "MONTHLY"),
      "apply:monthly:0.25": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 0.25, "MONTHLY"),

      "apply:half:0.5": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 0.5, "HALF_DAY"),

      "apply:quarter:0.25": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 0.25, "QUARTER_DAY"),

      "apply:sick:1": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 1, "SICK"),
      "apply:sick:0.5": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 0.5, "SICK"),
      "apply:sick:0.25": (bot, callbackQuery, params, moduleManager) =>
        this.processLeaveUsage(bot, callbackQuery, 0.25, "SICK"),

      // 기타 메뉴
      history: this.showLeaveHistory,
      setting: this.showLeaveSetting,
      help: this.showLeaveHelp,
    });
  }

  // 🎯 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (!text) return false;

    const userState = this.getUserState(userId);

    // 사용자 상태별 처리
    if (userState) {
      switch (userState.action) {
        case "waiting_leave_reason":
          return await this.handleLeaveReasonInput(
            bot,
            chatId,
            userId,
            text,
            userState
          );
        case "waiting_leave_setting":
          return await this.handleLeaveSetting(bot, chatId, userId, text);
      }
    }

    // /leave 명령어 처리
    if (text === "/leave") {
      await this.showLeaveStatus(bot, {
        message: { chat: { id: chatId } },
        from: { id: userId },
      });
      return true;
    }

    return false;
  }

  // 📋 휴가 메인 메뉴
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userName = getUserName(from);

    const menuText =
      `🏖️ **휴가 관리 시스템**\n\n` +
      `${userName}님의 종합 휴가 관리 메뉴입니다.\n` +
      `연차, 월차, 반차, 반반차를 통합 관리하세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 현재 현황", callback_data: "leave:status" },
          { text: "📈 상세 통계", callback_data: "leave:statistics" },
        ],
        [
          { text: "🏖️ 휴가 신청", callback_data: "leave:use" },
          { text: "📜 사용 내역", callback_data: "leave:history" },
        ],
        [
          { text: "⚙️ 설정", callback_data: "leave:setting" },
          { text: "❓ 도움말", callback_data: "leave:help" },
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 📊 휴가 현황 표시
  async showLeaveStatus(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const leaveData = await this.leaveService.getUserLeaves(userId);
      const statusText = this.leaveService.formatLeaveStatus(leaveData);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🏖️ 휴가 신청", callback_data: "leave:use" },
            { text: "📜 사용 내역", callback_data: "leave:history" },
          ],
          [
            { text: "📈 상세 통계", callback_data: "leave:statistics" },
            { text: "🔙 휴가 메뉴", callback_data: "leave:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statusText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("휴가 현황 조회 실패:", error);
      await this.sendError(bot, chatId, "휴가 현황을 불러올 수 없습니다.");
      return true;
    }
  }

  // 📈 휴가 상세 통계
  async showLeaveStatistics(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const stats = await this.leaveService.getLeaveStatistics(userId);
      const userName = getUserName(callbackQuery.from);

      let statsText = `📈 **${userName}님의 휴가 통계**\n\n`;

      // 기본 현황
      statsText += `**📊 전체 현황**\n`;
      statsText += `총 연차: ${stats.summary.total}일\n`;
      statsText += `사용: ${stats.summary.used}일\n`;
      statsText += `잔여: ${stats.summary.remaining}일\n`;
      statsText += `사용률: ${stats.summary.usageRate}\n\n`;

      // 타입별 현황
      if (stats.byType) {
        statsText += `**📂 타입별 사용 현황**\n`;
        Object.entries(stats.byType).forEach(([type, data]) => {
          const typeConfig = this.leaveService.leaveTypes[type];
          if (typeConfig && data.used > 0) {
            statsText += `${typeConfig.emoji} ${typeConfig.name}: ${data.used}일\n`;
          }
        });
        statsText += `\n`;
      }

      // 최근 사용 내역
      if (stats.recentHistory && stats.recentHistory.length > 0) {
        statsText += `**📋 최근 사용 내역**\n`;
        stats.recentHistory.slice(0, 3).forEach((record, index) => {
          const date = TimeHelper.formatDate(new Date(record.date));
          statsText += `${index + 1}. ${record.emoji} ${date} - ${
            record.typeName
          } ${record.requestedDays}일\n`;
        });
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 기본 현황", callback_data: "leave:status" },
            { text: "📜 전체 내역", callback_data: "leave:history" },
          ],
          [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statsText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("휴가 통계 조회 실패:", error);
      await this.sendError(bot, chatId, "휴가 통계를 불러올 수 없습니다.");
      return true;
    }
  }

  // 🏖️ 휴가 사용 메뉴
  async showLeaveUseMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const menuText =
      `🏖️ **휴가 신청**\n\n` +
      `신청하실 휴가 종류를 선택해주세요.\n` +
      `각 휴가별로 사용 가능한 단위가 다릅니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏖️ 연차", callback_data: "leave:use:annual" },
          { text: "📅 월차", callback_data: "leave:use:monthly" },
        ],
        [
          { text: "🌅 반차", callback_data: "leave:use:half" },
          { text: "⏰ 반반차", callback_data: "leave:use:quarter" },
        ],
        [{ text: "🤒 병가", callback_data: "leave:use:sick" }],
        [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 🏖️ 연차 사용 메뉴
  async showAnnualLeaveMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const menuText =
      `🏖️ **연차 신청**\n\n` +
      `연차 사용 단위를 선택해주세요.\n` +
      `• 1일: 하루종일 (09:00-18:00)\n` +
      `• 0.5일: 반나절 (오전 또는 오후)\n` +
      `• 0.25일: 반반나절 (2시간)`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "1일 사용", callback_data: "leave:apply:annual:1" },
          { text: "0.5일 사용", callback_data: "leave:apply:annual:0.5" },
        ],
        [{ text: "0.25일 사용", callback_data: "leave:apply:annual:0.25" }],
        [{ text: "🔙 휴가 신청", callback_data: "leave:use" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 📅 월차 사용 메뉴
  async showMonthlyLeaveMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const menuText =
      `📅 **월차 신청**\n\n` +
      `월차 사용 단위를 선택해주세요.\n` +
      `월차는 매월 1일씩 자동 지급됩니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "1일 사용", callback_data: "leave:apply:monthly:1" },
          { text: "0.5일 사용", callback_data: "leave:apply:monthly:0.5" },
        ],
        [{ text: "0.25일 사용", callback_data: "leave:apply:monthly:0.25" }],
        [{ text: "🔙 휴가 신청", callback_data: "leave:use" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 🌅 반차 사용 메뉴
  async showHalfDayMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const menuText =
      `🌅 **반차 신청**\n\n` +
      `반차는 0.5일 단위로만 사용 가능합니다.\n` +
      `• 오전 반차: 09:00-13:00\n` +
      `• 오후 반차: 14:00-18:00`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "0.5일 사용", callback_data: "leave:apply:half:0.5" }],
        [{ text: "🔙 휴가 신청", callback_data: "leave:use" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // ⏰ 반반차 사용 메뉴
  async showQuarterDayMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const menuText =
      `⏰ **반반차 신청**\n\n` +
      `반반차는 0.25일 단위로만 사용 가능합니다.\n` +
      `• 오전 반반차: 09:00-11:00\n` +
      `• 오후 반반차: 16:00-18:00`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "0.25일 사용", callback_data: "leave:apply:quarter:0.25" }],
        [{ text: "🔙 휴가 신청", callback_data: "leave:use" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 🤒 병가 사용 메뉴
  async showSickLeaveMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const menuText =
      `🤒 **병가 신청**\n\n` +
      `병가는 연차에서 차감되지 않습니다.\n` +
      `의료진 소견서가 필요할 수 있습니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "1일 사용", callback_data: "leave:apply:sick:1" },
          { text: "0.5일 사용", callback_data: "leave:apply:sick:0.5" },
        ],
        [{ text: "0.25일 사용", callback_data: "leave:apply:sick:0.25" }],
        [{ text: "🔙 휴가 신청", callback_data: "leave:use" }],
      ],
    };

    await this.editMessage(bot, chanId, messageId, menuText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // ✅ 휴가 사용 처리
  async processLeaveUsage(bot, callbackQuery, days, leaveType) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 사유 입력 상태 설정
      this.setUserState(userId, {
        action: "waiting_leave_reason",
        messageId: messageId,
        leaveData: { days, leaveType },
      });

      const typeConfig = this.leaveService.leaveTypes[leaveType];
      const unitInfo = this.leaveService.usageUnits[days];

      const inputText =
        `📝 **휴가 신청서 작성**\n\n` +
        `${typeConfig.emoji} **${typeConfig.name} ${days}일**\n` +
        `⏰ ${unitInfo.display} (${unitInfo.timeRange})\n\n` +
        `휴가 사유를 입력해주세요.\n` +
        `간단한 사유만 작성하셔도 됩니다.\n\n` +
        `❌ 취소하시려면 /cancel 을 입력하세요.`;

      await this.editMessage(bot, chatId, messageId, inputText, {
        reply_markup: { inline_keyboard: [] },
      });

      return true;
    } catch (error) {
      logger.error("휴가 신청 처리 실패:", error);
      await this.sendError(
        bot,
        chatId,
        "휴가 신청 처리 중 오류가 발생했습니다."
      );
      return true;
    }
  }

  // 📝 휴가 사유 입력 처리
  async handleLeaveReasonInput(bot, chatId, userId, text, userState) {
    try {
      // 취소 처리
      if (text === "/cancel") {
        this.clearUserState(userId);
        await this.sendMessage(bot, chatId, "휴가 신청이 취소되었습니다.");
        return true;
      }

      const { days, leaveType } = userState.leaveData;
      const reason = text.trim();

      // 휴가 사용 처리
      const result = await this.leaveService.useLeave(
        userId,
        days,
        leaveType,
        reason
      );

      this.clearUserState(userId);

      if (result.success) {
        const typeConfig = this.leaveService.leaveTypes[leaveType];
        const successText =
          `✅ **휴가 신청 완료**\n\n` +
          `${typeConfig.emoji} ${typeConfig.name} ${result.leaveRecord.requestedDays}일이 승인되었습니다.\n\n` +
          `📅 신청일: ${TimeHelper.formatDate(
            new Date(result.leaveRecord.date)
          )}\n` +
          `📝 사유: ${result.leaveRecord.reason || "사유 없음"}\n` +
          `⏰ 시간: ${result.leaveRecord.timeRange}\n\n` +
          `🏖️ 현재 잔여 연차: ${result.remainingLeaves}일`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "📊 현황 보기", callback_data: "leave:status" },
              { text: "📜 내역 보기", callback_data: "leave:history" },
            ],
            [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
          ],
        };

        await this.sendMessage(bot, chatId, successText, {
          reply_markup: keyboard,
        });
      } else {
        await this.sendError(bot, chatId, "휴가 신청에 실패했습니다.");
      }

      return true;
    } catch (error) {
      logger.error("휴가 사유 입력 처리 실패:", error);
      this.clearUserState(userId);

      let errorMessage = "휴가 신청 처리 중 오류가 발생했습니다.";
      if (error.message.includes("잔여 연차가 부족")) {
        errorMessage = `❌ ${error.message}`;
      } else if (error.message.includes("지원하지 않는")) {
        errorMessage = `❌ ${error.message}`;
      }

      await this.sendError(bot, chatId, errorMessage);
      return true;
    }
  }

  // 📜 휴가 사용 내역
  async showLeaveHistory(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const history = await this.leaveService.getLeaveHistory(userId, 10);
      const historyText = this.leaveService.formatLeaveHistory(history);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 현재 현황", callback_data: "leave:status" },
            { text: "📈 상세 통계", callback_data: "leave:statistics" },
          ],
          [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, historyText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("휴가 내역 조회 실패:", error);
      await this.sendError(bot, chatId, "휴가 내역을 불러올 수 없습니다.");
      return true;
    }
  }

  // ⚙️ 휴가 설정
  async showLeaveSetting(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const settingText =
      `⚙️ **휴가 설정**\n\n` +
      `휴가 관리 설정을 변경할 수 있습니다.\n` +
      `현재는 기본 설정으로 운영됩니다.\n\n` +
      `🔧 설정 가능 항목:\n` +
      `• 총 연차 일수 설정\n` +
      `• 월차 자동 지급 설정\n` +
      `• 알림 설정`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, settingText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // ❓ 휴가 도움말
  async showLeaveHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText =
      `❓ **휴가 관리 도움말**\n\n` +
      `**🏖️ 연차**: 1년간 사용할 수 있는 유급휴가\n` +
      `• 1일, 0.5일, 0.25일 단위 사용 가능\n\n` +
      `**📅 월차**: 매월 1일씩 자동 지급\n` +
      `• 1일, 0.5일, 0.25일 단위 사용 가능\n\n` +
      `**🌅 반차**: 반나절 휴가 (0.5일 고정)\n` +
      `• 오전반차 또는 오후반차\n\n` +
      `**⏰ 반반차**: 2시간 휴가 (0.25일 고정)\n` +
      `• 출근 후 2시간 또는 퇴근 전 2시간\n\n` +
      `**🤒 병가**: 질병으로 인한 휴가\n` +
      `• 연차에서 차감되지 않음`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // ⚙️ 휴가 설정 입력 처리
  async handleLeaveSetting(bot, chatId, userId, text) {
    try {
      // 설정 처리 로직 (추후 구현)
      this.clearUserState(userId);
      await this.sendMessage(bot, chatId, "⚙️ 설정 기능은 준비 중입니다.");
      return true;
    } catch (error) {
      logger.error("휴가 설정 처리 실패:", error);
      this.clearUserState(userId);
      await this.sendError(bot, chatId, "설정 처리 중 오류가 발생했습니다.");
      return true;
    }
  }
}

module.exports = LeaveModule;
