// src/modules/LeaveModule.js - 표준화된 휴가 관리 모듈

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

  // 🎯 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userState = this.userStates.get(userId);

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
  async showMenu(bot, callbackQuery, params, menuManager) {
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
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // 📊 휴가 현황 표시
  async showLeaveStatus(bot, callbackQuery, params) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const leaveData = await this.leaveService.getUserLeaveData(userId);
      const userName = getUserName(callbackQuery.from);

      const statusText =
        `📊 **휴가 현황**\n\n` +
        `👤 ${userName}님\n` +
        `📅 총 휴가: ${leaveData.totalDays}일\n` +
        `✅ 사용: ${leaveData.usedDays}일\n` +
        `📌 잔여: ${leaveData.remainingDays}일\n\n` +
        `_마지막 업데이트: ${leaveData.lastUpdate}_`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ 휴가 사용", callback_data: "leave:use" },
            { text: "📜 사용 내역", callback_data: "leave:history" },
          ],
          [{ text: "🔙 돌아가기", callback_data: "leave:menu" }],
        ],
      };

      if (messageId) {
        await this.editMessage(bot, chatId, messageId, statusText, {
          reply_markup: keyboard,
        });
      } else {
        await this.sendMessage(bot, chatId, statusText, {
          reply_markup: keyboard,
        });
      }

      return true;
    } catch (error) {
      logger.error("휴가 현황 조회 실패:", error);
      await this.sendError(bot, chatId, "휴가 현황을 조회할 수 없습니다.");
      return true;
    }
  }

  // ✅ 휴가 사용 메뉴
  async showLeaveUseMenu(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const menuText = `✅ **휴가 사용**\n\n` + `사용할 휴가 일수를 선택하세요:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "1일", callback_data: "leave:use:1" },
          { text: "0.5일", callback_data: "leave:use:0.5" },
        ],
        [{ text: "🔢 직접 입력", callback_data: "leave:use:custom" }],
        [{ text: "🔙 돌아가기", callback_data: "leave:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      reply_markup: keyboard,
    });

    return true;
  }

  // 1일 휴가 사용
  async useOneDay(bot, callbackQuery) {
    return await this.processLeaveUsage(bot, callbackQuery, 1);
  }

  // 0.5일 휴가 사용
  async useHalfDay(bot, callbackQuery) {
    return await this.processLeaveUsage(bot, callbackQuery, 0.5);
  }

  // 휴가 사용 처리
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

      if (result.success) {
        const successText =
          `✅ **휴가 사용 완료**\n\n` +
          `사용: ${days}일\n` +
          `잔여: ${result.remaining}일`;

        await this.editMessage(bot, chatId, messageId, successText, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 휴가 메뉴", callback_data: "leave:menu" }],
            ],
          },
        });
      } else {
        await this.sendError(bot, chatId, result.message);
      }

      return true;
    } catch (error) {
      logger.error("휴가 사용 처리 실패:", error);
      await this.sendError(bot, chatId, "휴가 사용 처리에 실패했습니다.");
      return true;
    }
  }

  // 사용자 입력 시작
  async startCustomInput(bot, callbackQuery) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.userStates.set(userId, {
      action: "waiting_leave_input",
      messageId: messageId,
    });

    const inputText =
      `🔢 **휴가 일수 입력**\n\n` +
      `사용할 휴가 일수를 입력해주세요.\n` +
      `(예: 2, 1.5, 0.5)`;

    await this.sendMessage(bot, chatId, inputText);
    return true;
  }

  // 사용자 입력 처리
  async handleLeaveInput(bot, chatId, userId, text) {
    const days = parseFloat(text);

    if (isNaN(days) || days <= 0) {
      await this.sendError(bot, chatId, "올바른 숫자를 입력해주세요.");
      return true;
    }

    // 상태 초기화
    this.userStates.delete(userId);

    // 가상의 콜백쿼리 객체 생성
    const fakeCallback = {
      message: { chat: { id: chatId } },
      from: { id: userId },
    };

    return await this.processLeaveUsage(bot, fakeCallback, days);
  }
}

module.exports = LeaveModule;
