// src/modules/LeaveModule.js - 표준화된 휴가 관리 모듈 (수정됨)

const BaseModule = require("./BaseModule");
const LeaveService = require("../services/LeaveService");
const timeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class LeaveModule extends BaseModule {
  constructor(bot, dependencies) {
    super("LeaveModule", {
      commands: ["leave"],
      callbacks: ["leave"],
      features: ["status", "use", "history", "setting"],
    });

    this.leaveService = null;
    // ✅ userStates는 BaseModule에서 초기화되므로 제거
  }

  // 🎯 모듈별 초기화
  async onInitialize() {
    try {
      this.leaveService = new LeaveService(this.db);
      await this.leaveService.initialize();
      logger.info("🏖️ LeaveService 초기화 성공");
    } catch (error) {
      logger.error("❌ LeaveService 초기화 실패:", error);
      throw error;
    }
  }

  // 🎯 액션 등록
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      status: this.showLeaveStatus,
      use: this.showLeaveUseMenu,
      "use:1": this.useOneDay,
      "use:0.5": this.useHalfDay,
      "use:custom": this.startCustomInput,
      history: this.showLeaveHistory,
      setting: this.showLeaveSetting,
      help: this.showLeaveHelp,
    });
  }

  // 🎯 메시지 처리 (수정됨)
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (!text) return false;

    // ✅ BaseModule의 getUserState 사용
    const userState = this.getUserState(userId);

    // 사용자 상태에 따른 처리
    if (userState) {
      switch (userState.action) {
        case "waiting_leave_input":
          return await this.handleLeaveInput(bot, chatId, userId, text);
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

  // 📋 휴가 메뉴 표시
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from, // from 객체 직접 가져오기
    } = callbackQuery;

    // getUserName에 from 객체 전달
    const userName = getUserName(from);

    const menuText =
      `🏖️ **휴가 관리**\n\n` + `${userName}님의 휴가 관리 메뉴입니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 잔여 휴가", callback_data: "leave:status" },
          { text: "✅ 휴가 사용", callback_data: "leave:use" },
        ],
        [
          { text: "📜 사용 내역", callback_data: "leave:history" },
          { text: "⚙️ 설정", callback_data: "leave:setting" },
        ],
        [{ text: "❓ 도움말", callback_data: "leave:help" }],
        [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }], // main:menu로 통일
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 📊 휴가 현황 조회
  async showLeaveStatus(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const leaveData = await this.leaveService.getLeaveStatus(userId);
      const userName = getUserName(callbackQuery.from);

      const statusText =
        `📊 **${userName}님의 휴가 현황**\n\n` +
        `🏖️ 잔여 연차: **${leaveData.remaining}일**\n` +
        `✅ 사용 연차: **${leaveData.used}일**\n` +
        `📅 총 연차: **${leaveData.total}일**\n\n` +
        `📈 사용률: **${((leaveData.used / leaveData.total) * 100).toFixed(
          1
        )}%**\n\n` +
        `⏰ ${timeHelper.getCurrentTime()}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ 휴가 사용", callback_data: "leave:use" },
            { text: "📜 사용 내역", callback_data: "leave:history" },
          ],
          [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statusText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("휴가 현황 조회 실패:", error);
      await this.sendError(bot, chatId, "휴가 현황을 가져올 수 없습니다.");
      return true;
    }
  }

  // ✅ 휴가 사용 메뉴
  async showLeaveUseMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const menuText =
      `✅ **휴가 사용**\n\n` +
      `사용하실 휴가 일수를 선택해주세요.\n` +
      `연차는 0.5일 단위로 사용 가능합니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "1일", callback_data: "leave:use:1" },
          { text: "0.5일", callback_data: "leave:use:0.5" },
        ],
        [{ text: "🔢 직접 입력", callback_data: "leave:use:custom" }],
        [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 1일 휴가 사용
  async useOneDay(bot, callbackQuery, params, moduleManager) {
    return await this.processLeaveUsage(bot, callbackQuery, 1);
  }

  // 0.5일 휴가 사용
  async useHalfDay(bot, callbackQuery, params, moduleManager) {
    return await this.processLeaveUsage(bot, callbackQuery, 0.5);
  }

  // 🔢 사용자 정의 휴가 일수 입력 시작
  async startCustomInput(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // ✅ BaseModule의 setUserState 사용
    this.setUserState(userId, {
      action: "waiting_leave_input",
      messageId: messageId,
    });

    const inputText =
      `🔢 **휴가 일수 입력**\n\n` +
      `사용하실 휴가 일수를 입력해주세요.\n` +
      `(예: 1, 1.5, 2, 2.5)\n\n` +
      `❌ 취소하시려면 /cancel 을 입력하세요.`;

    await this.editMessage(bot, chatId, messageId, inputText, {
      reply_markup: { inline_keyboard: [] },
    });

    return true;
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
      const history = await this.leaveService.getLeaveHistory(userId);
      const userName = getUserName(callbackQuery.from);

      let historyText = `📜 **${userName}님의 휴가 사용 내역**\n\n`;

      if (history.length === 0) {
        historyText += `아직 사용한 휴가가 없습니다.`;
      } else {
        history.slice(0, 10).forEach((record, index) => {
          historyText += `**${index + 1}.** ${record.days}일 (${
            record.date
          })\n`;
          if (record.reason) {
            historyText += `   사유: ${record.reason}\n`;
          }
          historyText += `\n`;
        });

        if (history.length > 10) {
          historyText += `... 외 ${history.length - 10}건 더`;
        }
      }

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, historyText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("휴가 내역 조회 실패:", error);
      await this.sendError(bot, chatId, "휴가 내역을 가져올 수 없습니다.");
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
      from: { id: userId },
    } = callbackQuery;

    try {
      const settings = await this.leaveService.getLeaveSettings(userId);

      const settingText =
        `⚙️ **휴가 설정**\n\n` +
        `📅 연간 총 휴가: **${settings.totalLeave}일**\n` +
        `🔔 알림 설정: **${settings.notifications ? "켜짐" : "꺼짐"}**\n` +
        `📊 월말 알림: **${settings.monthlyAlert ? "켜짐" : "꺼짐"}**`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📅 총 휴가 변경", callback_data: "leave:setting:total" },
            { text: "🔔 알림 토글", callback_data: "leave:setting:alert" },
          ],
          [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, settingText, {
        reply_markup: keyboard,
      });

      return true;
    } catch (error) {
      logger.error("휴가 설정 조회 실패:", error);
      await this.sendError(bot, chatId, "휴가 설정을 가져올 수 없습니다.");
      return true;
    }
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
      `🏖️ **제공 기능:**\n` +
      `• 잔여 휴가 조회\n` +
      `• 휴가 사용 신청\n` +
      `• 사용 내역 확인\n` +
      `• 휴가 설정 관리\n\n` +
      `💡 **사용 방법:**\n` +
      `/leave - 휴가 메뉴 열기\n\n` +
      `📝 **주의사항:**\n` +
      `• 휴가는 0.5일 단위로 사용 가능\n` +
      `• 사용된 휴가는 취소 불가\n` +
      `• 잔여 휴가가 부족하면 사용 불가`;

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

  // 🛠️ 휴가 사용 처리
  async processLeaveUsage(bot, callbackQuery, days) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const result = await this.leaveService.useLeave(userId, days);
      const userName = getUserName(callbackQuery.from);

      if (result.success) {
        const successText =
          `✅ **휴가 사용 완료**\n\n` +
          `${userName}님의 휴가 **${days}일**이 사용되었습니다.\n\n` +
          `🏖️ 잔여 휴가: **${result.remaining}일**\n` +
          `⏰ ${timeHelper.getCurrentTime()}`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "📊 현황 보기", callback_data: "leave:status" },
              { text: "📜 내역 보기", callback_data: "leave:history" },
            ],
            [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, successText, {
          reply_markup: keyboard,
        });
      } else {
        const errorText =
          `❌ **휴가 사용 실패**\n\n` +
          `${result.message || "휴가 사용 중 오류가 발생했습니다."}\n\n` +
          `🏖️ 현재 잔여 휴가: **${result.remaining || 0}일**`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, errorText, {
          reply_markup: keyboard,
        });
      }

      return true;
    } catch (error) {
      logger.error("휴가 사용 처리 실패:", error);
      await this.sendError(
        bot,
        chatId,
        "휴가 사용 처리 중 오류가 발생했습니다."
      );
      return true;
    }
  }

  // 🔢 사용자 입력 휴가 일수 처리
  async handleLeaveInput(bot, chatId, userId, text) {
    try {
      const days = parseFloat(text);

      if (isNaN(days) || days <= 0) {
        await this.sendMessage(
          bot,
          chatId,
          "❌ 올바른 숫자를 입력해주세요. (예: 1, 1.5, 2)"
        );
        return true;
      }

      if (days % 0.5 !== 0) {
        await this.sendMessage(
          bot,
          chatId,
          "❌ 휴가는 0.5일 단위로만 사용 가능합니다."
        );
        return true;
      }

      // ✅ BaseModule의 clearUserState 사용
      this.clearUserState(userId);

      // 가상의 콜백쿼리 객체 생성
      const fakeCallback = {
        message: { chat: { id: chatId } },
        from: { id: userId },
      };

      return await this.processLeaveUsage(bot, fakeCallback, days);
    } catch (error) {
      logger.error("휴가 입력 처리 오류:", error);
      await this.sendError(bot, chatId, "입력 처리 중 오류가 발생했습니다.");
      return true;
    }
  }

  // ⚙️ 휴가 설정 입력 처리
  async handleLeaveSetting(bot, chatId, userId, text) {
    try {
      // 설정 처리 로직
      const result = await this.leaveService.updateLeaveSetting(userId, text);

      // ✅ BaseModule의 clearUserState 사용
      this.clearUserState(userId);

      if (result.success) {
        await this.sendMessage(bot, chatId, "✅ 설정이 업데이트되었습니다.");
      } else {
        await this.sendMessage(bot, chatId, "❌ 설정 업데이트에 실패했습니다.");
      }

      return true;
    } catch (error) {
      logger.error("휴가 설정 처리 오류:", error);
      await this.sendError(bot, chatId, "설정 처리 중 오류가 발생했습니다.");
      return true;
    }
  }
}

module.exports = LeaveModule;
