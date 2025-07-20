// src/modules/LeaveModule.js - 표준화된 handleCallback 구조

const BaseModule = require("./BaseModule");
const { LeaveService } = require("../services/LeaveService");
const { TimeHelper } = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");
let logger;
try {
  logger = require("../utils/Logger");
} catch (error) {
  logger = {
    info: (...args) => console.log("[INFO]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    debug: (...args) => console.log("[DEBUG]", ...args),
    success: (...args) => console.log("[SUCCESS]", ...args),
  };
}

class LeaveModule extends BaseModule {
  constructor() {
    super("LeaveModule", {
      commands: ["leave"],
      callbacks: ["leave"],
    });
    this.leaveService = new LeaveService();
    this.userStates = new Map();
  }

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userState = this.userStates.get(userId);

    if (userState) {
      if (userState.action === "waiting_leave_input") {
        return await this.handleLeaveInput(
          bot,
          chatId,
          userId,
          text,
          userState
        );
      } else if (userState.action === "waiting_leave_setting") {
        return await this.handleLeaveSetting(
          bot,
          chatId,
          userId,
          text,
          userState
        );
      }
    }

    if (text === "/leave") {
      await this.showLeaveStatus(bot, chatId, null, userId);
      return true;
    }

    return false;
  }

  // ⭐ 표준화된 handleCallback 구조
  async handleCallback(bot, callbackQuery, subAction, params, menuManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    switch (subAction) {
      case "menu":
        await this.showLeaveMenu(bot, chatId, messageId, userId, userName);
        break;
      case "status":
        await this.showLeaveStatus(bot, chatId, messageId, userId);
        break;
      case "use":
        await this.showLeaveUseMenu(bot, chatId, messageId);
        break;
      case "use_1":
        await this.processLeaveUsage(bot, chatId, messageId, userId, 1);
        break;
      case "use_0.5":
        await this.processLeaveUsage(bot, chatId, messageId, userId, 0.5);
        break;
      case "use_custom":
        await this.startCustomLeaveInput(bot, chatId, messageId, userId);
        break;
      case "history":
        await this.showLeaveHistory(bot, chatId, messageId, userId);
        break;
      case "setting":
        await this.startLeaveSetting(bot, chatId, messageId, userId);
        break;
      case "help":
        await this.showLeaveHelp(bot, chatId, messageId);
        break;
      default:
        await this.sendMessage(
          bot,
          chatId,
          "❌ 알 수 없는 휴가 관리 명령입니다."
        );
    }
  }

  async showLeaveMenu(bot, chatId, messageId, userId, userName) {
    try {
      const leaveData = await this.leaveService.getUserLeaves(userId);
      const currentTime = TimeHelper.formatDateTime();

      const statusText =
        `📅 **${userName}님의 휴가 관리** (${currentTime})\n\n` +
        `📊 **${leaveData.year}년 연차 현황**\n` +
        `📅 총 연차: ${leaveData.totalLeaves}일\n` +
        `✅ 사용한 연차: ${leaveData.usedLeaves}일\n` +
        `⏳ 남은 연차: ${leaveData.remainingLeaves}일\n\n` +
        `${
          leaveData.remainingLeaves <= 3
            ? "⚠️ 연차가 얼마 남지 않았어요!"
            : "✨ 충분한 연차가 남아있어요!"
        }\n\n` +
        "원하는 기능을 선택하세요:";

      await this.editMessage(bot, chatId, messageId, statusText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📊 연차 현황", callback_data: "leave_status" },
              { text: "📝 연차 사용", callback_data: "leave_use" },
            ],
            [
              { text: "📋 사용 내역", callback_data: "leave_history" },
              { text: "⚙️ 연차 설정", callback_data: "leave_setting" },
            ],
            [
              { text: "❓ 도움말", callback_data: "leave_help" },
              { text: "🔙 메인 메뉴", callback_data: "main_menu" },
            ],
          ],
        },
      });
    } catch (error) {
      console.error("연차 메뉴 표시 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ **연차 정보 오류**\n\n연차 정보를 불러오는 중 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 다시 시도", callback_data: "leave_menu" }],
              [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
            ],
          },
        }
      );
    }
  }

  async showLeaveStatus(bot, chatId, messageId, userId) {
    try {
      const leaveData = await this.leaveService.getUserLeaves(userId);
      const currentTime = TimeHelper.formatDateTime();

      // 연차 사용률 계산
      const usageRate = Math.round(
        (leaveData.usedLeaves / leaveData.totalLeaves) * 100
      );
      const progressBar = this.createProgressBar(
        leaveData.usedLeaves,
        leaveData.totalLeaves
      );

      // 다음 휴가 추천
      const recommendation = this.getLeaveRecommendation(leaveData);

      const statusText =
        `📊 **연차 현황 상세** (${currentTime})\n\n` +
        `📅 **${leaveData.year}년 연차 정보**\n` +
        `📊 총 연차: ${leaveData.totalLeaves}일\n` +
        `✅ 사용: ${leaveData.usedLeaves}일\n` +
        `⏳ 남은 연차: ${leaveData.remainingLeaves}일\n\n` +
        `📈 **사용률**: ${usageRate}%\n` +
        `${progressBar}\n\n` +
        `${recommendation}\n\n` +
        `💡 **팁**: 연차는 적절히 사용해서 워라밸을 맞춰보세요! 🏖️`;

      const responseMethod = messageId ? "editMessage" : "sendMessage";

      await this[responseMethod](bot, chatId, messageId || chatId, statusText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📝 연차 사용", callback_data: "leave_use" },
              { text: "📋 사용 내역", callback_data: "leave_history" },
            ],
            [{ text: "🔙 휴가 메뉴", callback_data: "leave_menu" }],
          ],
        },
      });
    } catch (error) {
      console.error("연차 상태 조회 오류:", error);
      await this.sendMessage(
        bot,
        chatId,
        "❌ **연차 상태 조회 실패**\n\n연차 정보를 불러올 수 없습니다."
      );
    }
  }

  async showLeaveUseMenu(bot, chatId, messageId) {
    const currentTime = TimeHelper.formatDateTime();

    const useText =
      `🏖️ **연차 사용하기** (${currentTime})\n\n` +
      "사용할 연차를 선택하세요:\n\n" +
      "• **연차**: 하루 종일 휴가\n" +
      "• **반차**: 오전 또는 오후 반나절\n" +
      "• **직접 입력**: 원하는 일수 입력\n\n" +
      "💡 **참고**: 0.5일 단위로 사용 가능합니다.";

    await this.editMessage(bot, chatId, messageId, useText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🏖️ 연차 1일", callback_data: "leave_use_1" },
            { text: "🌅 반차 0.5일", callback_data: "leave_use_0.5" },
          ],
          [
            { text: "✏️ 직접 입력", callback_data: "leave_use_custom" },
            { text: "🔙 휴가 메뉴", callback_data: "leave_menu" },
          ],
        ],
      },
    });
  }

  async startCustomLeaveInput(bot, chatId, messageId, userId) {
    this.userStates.set(userId, {
      action: "waiting_leave_input",
      messageId: messageId,
      chatId: chatId,
    });

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "✏️ **연차 직접 입력**\n\n" +
        "사용할 연차 일수를 입력하세요.\n\n" +
        "**예시**:\n" +
        "• `1` - 연차 1일\n" +
        "• `0.5` - 반차\n" +
        "• `2.5` - 2일 반차\n\n" +
        "**참고**: 0.5일 단위로 입력 가능합니다.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ 취소", callback_data: "leave_use" }]],
        },
      }
    );
  }

  async handleLeaveInput(bot, chatId, userId, text, userState) {
    try {
      const days = this.validateLeaveAmount(text);
      await this.processLeaveUsage(
        bot,
        chatId,
        userState.messageId,
        userId,
        days
      );
      this.userStates.delete(userId);
      return true;
    } catch (error) {
      await this.sendMessage(bot, chatId, `❌ ${error.message}`);
      return true;
    }
  }

  async processLeaveUsage(bot, chatId, messageId, userId, days) {
    try {
      const result = await this.leaveService.useLeave(userId, days);
      const currentTime = TimeHelper.formatDateTime();

      const successText =
        `✅ **연차 사용 완료** (${currentTime})\n\n` +
        `🏖️ **사용한 연차**: ${days}일\n` +
        `📊 **업데이트된 현황**:\n` +
        `• 총 사용: ${result.usedLeaves}일\n` +
        `• 남은 연차: ${result.remainingLeaves}일\n\n` +
        `${
          result.remainingLeaves <= 3
            ? "⚠️ **주의**: 연차가 얼마 남지 않았습니다!\n계획적으로 사용하세요."
            : "✨ 연차 사용이 성공적으로 기록되었습니다!"
        }`;

      await this.editMessage(bot, chatId, messageId, successText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📊 연차 현황", callback_data: "leave_status" },
              { text: "📋 사용 내역", callback_data: "leave_history" },
            ],
            [{ text: "🔙 휴가 메뉴", callback_data: "leave_menu" }],
          ],
        },
      });
    } catch (error) {
      console.error("연차 사용 처리 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `❌ **연차 사용 실패**\n\n${error.message}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 연차 사용", callback_data: "leave_use" }],
            ],
          },
        }
      );
    }
  }

  async showLeaveHistory(bot, chatId, messageId, userId) {
    try {
      const history = await this.leaveService.getLeaveHistory(userId);
      const currentTime = TimeHelper.formatDateTime();

      let historyText = `📋 **연차 사용 내역** (${currentTime})\n\n`;

      if (history.length === 0) {
        historyText +=
          "아직 사용한 연차가 없습니다.\n\n첫 번째 연차를 사용해보세요! 🏖️";
      } else {
        historyText += `📊 **총 ${history.length}건의 사용 내역**\n\n`;

        // 최근 10개만 표시
        const recentHistory = history.slice(-10).reverse();

        recentHistory.forEach((record, index) => {
          const date = TimeHelper.formatDate(new Date(record.date));
          historyText += `${index + 1}. **${date}**: ${record.days}일 사용\n`;
        });

        if (history.length > 10) {
          historyText += `\n... 그 외 ${history.length - 10}건 더`;
        }
      }

      await this.editMessage(bot, chatId, messageId, historyText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📝 연차 사용", callback_data: "leave_use" },
              { text: "📊 연차 현황", callback_data: "leave_status" },
            ],
            [{ text: "🔙 휴가 메뉴", callback_data: "leave_menu" }],
          ],
        },
      });
    } catch (error) {
      console.error("휴가 내역 조회 오류:", error);
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ **내역 조회 실패**\n\n휴가 내역을 불러올 수 없습니다.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 휴가 메뉴", callback_data: "leave_menu" }],
            ],
          },
        }
      );
    }
  }

  async startLeaveSetting(bot, chatId, messageId, userId) {
    this.userStates.set(userId, {
      action: "waiting_leave_setting",
      messageId: messageId,
      chatId: chatId,
    });

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "⚙️ **연차 설정**\n\n" +
        "총 연차 일수를 입력하세요.\n\n" +
        "**일반적인 연차**:\n" +
        "• 신입사원: 15일\n" +
        "• 3년차 이상: 16일\n" +
        "• 5년차 이상: 18일\n" +
        "• 10년차 이상: 20일\n\n" +
        "**예시**: 15, 20, 25",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "15일", callback_data: "leave_setting_15" },
              { text: "20일", callback_data: "leave_setting_20" },
            ],
            [{ text: "❌ 취소", callback_data: "leave_menu" }],
          ],
        },
      }
    );
  }

  async handleLeaveSetting(bot, chatId, userId, text, userState) {
    try {
      const totalLeaves = parseInt(text);

      if (isNaN(totalLeaves) || totalLeaves <= 0 || totalLeaves > 30) {
        throw new Error("1일 이상 30일 이하의 숫자를 입력해주세요.");
      }

      const result = await this.leaveService.setTotalLeaves(
        userId,
        totalLeaves
      );
      const currentTime = TimeHelper.formatDateTime();

      const settingText =
        `✅ **연차 설정 완료** (${currentTime})\n\n` +
        `📅 **업데이트된 연차 정보**:\n` +
        `• 총 연차: ${result.totalLeaves}일\n` +
        `• 사용한 연차: ${result.usedLeaves}일\n` +
        `• 남은 연차: ${result.remainingLeaves}일\n\n` +
        "연차 설정이 성공적으로 업데이트되었습니다! ✨";

      await this.editMessage(bot, chatId, userState.messageId, settingText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📊 연차 현황", callback_data: "leave_status" },
              { text: "🔙 휴가 메뉴", callback_data: "leave_menu" },
            ],
          ],
        },
      });

      this.userStates.delete(userId);
      return true;
    } catch (error) {
      await this.sendMessage(bot, chatId, `❌ ${error.message}`);
      return true;
    }
  }

  async showLeaveHelp(bot, chatId, messageId) {
    const helpText =
      "📅 **휴가 관리 도움말**\n\n" +
      "**🎯 주요 기능**\n" +
      "• 📊 연차 현황 확인\n" +
      "• 📝 연차 사용 기록\n" +
      "• 📋 사용 내역 조회\n" +
      "• ⚙️ 연차 설정 변경\n\n" +
      "**💡 사용 방법**\n" +
      "1. **연차 설정**: 처음 사용 시 총 연차 일수 설정\n" +
      "2. **연차 사용**: 1일, 0.5일(반차) 또는 직접 입력\n" +
      "3. **현황 확인**: 남은 연차와 사용률 확인\n" +
      "4. **내역 조회**: 연차 사용 기록 확인\n\n" +
      "**📝 연차 사용 예시**\n" +
      "• `1` - 연차 1일\n" +
      "• `0.5` - 반차\n" +
      "• `2.5` - 2일 반차\n\n" +
      "**⚡ 빠른 명령어**\n" +
      "• `/leave` - 휴가 관리 메뉴\n\n" +
      "**🔔 알림 기능**\n" +
      "• 연차 3일 이하 시 알림\n" +
      "• 연차 사용률 표시\n" +
      "• 추천 휴가 계획 제안\n\n" +
      "효율적인 휴가 관리로 워라밸을 맞춰보세요! 🏖️";

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📊 연차 현황", callback_data: "leave_status" },
            { text: "📝 연차 사용", callback_data: "leave_use" },
          ],
          [{ text: "🔙 휴가 메뉴", callback_data: "leave_menu" }],
        ],
      },
    });
  }

  // 연차 사용량 검증
  validateLeaveAmount(text) {
    const amount = parseFloat(text);

    if (isNaN(amount)) {
      throw new Error("숫자를 입력해주세요. (예: 1, 0.5, 2.5)");
    }

    if (amount <= 0) {
      throw new Error("0보다 큰 숫자를 입력해주세요.");
    }

    if (amount > 30) {
      throw new Error("한 번에 30일 이상은 사용할 수 없습니다.");
    }

    // 0.5일 단위로만 허용
    if ((amount * 2) % 1 !== 0) {
      throw new Error("0.5일 단위로만 입력 가능합니다. (예: 1, 1.5, 2.5)");
    }

    return amount;
  }

  // 진행률 바 생성
  createProgressBar(current, total) {
    if (total === 0) return "░░░░░░░░░░ 0%";

    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 10);
    const empty = 10 - filled;

    return `${"▓".repeat(filled)}${"░".repeat(empty)} ${percentage}%`;
  }

  // 연차 사용 추천
  getLeaveRecommendation(leaveData) {
    const currentMonth = TimeHelper.getCurrentMonth();
    const remainingMonths = 12 - currentMonth;
    const monthlyRecommendation =
      Math.round(
        (leaveData.remainingLeaves / Math.max(remainingMonths, 1)) * 10
      ) / 10;

    if (leaveData.remainingLeaves <= 3) {
      return "🚨 **추천**: 연차가 얼마 남지 않았어요! 계획적으로 사용하세요.";
    } else if (monthlyRecommendation > 2) {
      return "🏖️ **추천**: 이번 달에 조금 더 쉬어도 좋을 것 같아요!";
    } else if (monthlyRecommendation < 0.5) {
      return "💪 **추천**: 적절한 연차 사용 중이에요! 워라밸 굿!";
    } else {
      return `📅 **추천**: 월 평균 ${monthlyRecommendation}일 정도 사용하시면 딱 좋아요!`;
    }
  }
}

module.exports = LeaveModule;
