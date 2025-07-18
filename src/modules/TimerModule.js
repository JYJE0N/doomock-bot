const BaseModule = require("./BaseModule");
const { TimerService } = require("../services/TimerService");
const { getUserName } = require("../utils/UserHelper");
const { ValidationHelper } = require("../utils/ValidationHelper");

class TimerModule extends BaseModule {
  constructor() {
    super("TimerModule", {
      commands: ["timer"],
      callbacks: ["timer"],
    });
    this.timerService = new TimerService();
    this.userStates = new Map();
  }

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userState = this.userStates.get(userId);

    // 상태가 있을 때 처리
    if (userState && userState.action === "waiting_timer_input") {
      return await this.handleTimerInput(bot, chatId, userId, text);
    }

    // 명령어 처리
    if (text && text.startsWith("/timer")) {
      await this.handleTimerCommand(bot, msg);
      return true;
    }

    return false;
  }

  async handleCallback(bot, callbackQuery) {
    const data = callbackQuery.data;
    const parts = data.split("_");
    const action = parts[1];
    const subAction = parts[2];

    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    switch (action) {
      case "menu":
        await this.showTimerMenu(bot, chatId, messageId, userName);
        break;
      case "start":
        if (parts[2] === "prompt") {
          await this.startTimerPrompt(bot, chatId, messageId, userId);
        }
        break;
      case "stop":
        await this.stopTimer(bot, chatId, messageId, userId);
        break;
      case "status":
        await this.showTimerStatus(bot, chatId, messageId, userId);
        break;
      case "pomodoro":
        if (subAction === "start") {
          await this.startPomodoro(bot, chatId, messageId, userId);
        } else if (subAction === "complete") {
          await this.completePomodoro(bot, chatId, messageId, userId);
        }
        break;
      default:
        await this.sendMessage(bot, chatId, "❌ 알 수 없는 타이머 명령입니다.");
    }
  }

  async showTimerMenu(bot, chatId, messageId, userName) {
    const menuText =
      `⏰ **${userName}님의 타이머**\n\n` +
      `🍅 포모도로: 25분 집중 + 5분 휴식\n` +
      `⏱️ 일반 타이머: 자유로운 시간 측정\n\n` +
      `원하는 기능을 선택하세요!`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🍅 포모도로 시작", callback_data: "timer_pomodoro_start" },
          { text: "⏱️ 일반 타이머", callback_data: "timer_start_prompt" },
        ],
        [
          { text: "⏹️ 타이머 정지", callback_data: "timer_stop" },
          { text: "📊 현재 상태", callback_data: "timer_status" },
        ],
        [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, menuText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  async startTimerPrompt(bot, chatId, messageId, userId) {
    this.userStates.set(userId, { action: "waiting_timer_input" });

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "⏰ **타이머 시작**\n\n작업명을 입력해주세요.\n예: 독서하기, 운동하기",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ 취소", callback_data: "cancel_action" }],
          ],
        },
      }
    );
  }
  // 포모도로 시작
  async startPomodoro(bot, chatId, messageId, userId) {
    const result = this.timerService.startPomodoro(userId);

    if (result.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `🍅 **포모도로 시작!**\n\n` +
          `📌 작업: ${result.data.taskName}\n` +
          `⏱️ 시간: 25분\n` +
          `🎯 ${result.data.sessionCount}번째 세션\n\n` +
          `집중해서 작업하세요! 💪`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "📊 진행 상태",
                  callback_data: "timer_pomodoro_status",
                },
                { text: "⏹️ 중지", callback_data: "timer_stop" },
              ],
              [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
            ],
          },
        }
      );

      // 25분 후 알림 설정
      setTimeout(
        () => {
          this.notifyPomodoroComplete(bot, chatId, userId);
        },
        25 * 60 * 1000
      );
    } else {
      await this.editMessage(bot, chatId, messageId, `❌ ${result.error}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
          ],
        },
      });
    }
  }

  // 포모도로 완료 알림
  async notifyPomodoroComplete(bot, chatId, userId) {
    const status = this.timerService.pomodoroStatus(userId);

    if (status.success && status.data.isComplete) {
      const result = this.timerService.completePomodoro(userId);

      if (result.success) {
        const keyboard =
          result.data.nextMode === "break"
            ? {
                inline_keyboard: [
                  [
                    {
                      text: "✅ 휴식 시작",
                      callback_data: "timer_pomodoro_complete",
                    },
                    { text: "⏹️ 종료", callback_data: "timer_stop" },
                  ],
                ],
              }
            : {
                inline_keyboard: [
                  [
                    {
                      text: "🍅 다음 포모도로",
                      callback_data: "timer_pomodoro_start",
                    },
                    { text: "⏹️ 종료", callback_data: "timer_stop" },
                  ],
                ],
              };

        await bot.sendMessage(
          chatId,
          `🔔 **포모도로 알림**\n\n${result.data.message}`,
          {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          }
        );

        // 휴식 시간도 타이머 설정
        if (result.data.nextMode === "break") {
          setTimeout(
            () => {
              this.notifyPomodoroComplete(bot, chatId, userId);
            },
            5 * 60 * 1000
          );
        }
      }
    }
  }

  // 포모도로 상태 표시
  async showPomodoroStatus(bot, chatId, messageId, userId) {
    const status = this.timerService.pomodoroStatus(userId);

    if (status.success) {
      const progressBar = this.createProgressBar(
        status.data.elapsed,
        status.data.duration
      );
      const modeEmoji = status.data.mode === "work" ? "💼" : "☕";
      const modeText = status.data.mode === "work" ? "작업 중" : "휴식 중";

      await this.editMessage(
        bot,
        chatId,
        messageId,
        `🍅 **포모도로 ${modeText}**\n\n` +
          `${modeEmoji} ${status.data.taskName}\n` +
          `⏱️ ${status.data.elapsed}/${status.data.duration}분\n` +
          `${progressBar}\n` +
          `🎯 세션: ${status.data.sessionCount}회\n` +
          `⏳ 남은 시간: ${status.data.remaining}분`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔄 새로고침", callback_data: "timer_pomodoro_status" },
                { text: "⏹️ 중지", callback_data: "timer_stop" },
              ],
              [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
            ],
          },
        }
      );
    }
  }

  // 진행 상황 바 생성
  createProgressBar(current, total) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 10);
    const empty = 10 - filled;

    return `${"▓".repeat(filled)}${"░".repeat(empty)} ${percentage}%`;
  }

  async handleTimerInput(bot, chatId, userId, text) {
    try {
      const taskName = ValidationHelper.validateTimerName(text);
      const result = this.timerService.start(userId, taskName);

      if (result.success) {
        await this.sendMessage(
          bot,
          chatId,
          `⏰ "${taskName}" 타이머를 시작했습니다!`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⏹️ 타이머 정지", callback_data: "timer_stop" },
                  { text: "⏱️ 현재 상태", callback_data: "timer_status" },
                ],
                [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
              ],
            },
          }
        );
      } else {
        await this.sendMessage(bot, chatId, `❌ ${result.error}`);
      }

      this.userStates.delete(userId);
      return true;
    } catch (error) {
      await this.sendMessage(bot, chatId, `❌ ${error.message}`);
      return true;
    }
  }

  async stopTimer(bot, chatId, messageId, userId) {
    const result = this.timerService.stop(userId);

    if (result.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `⏹️ "${result.data.taskName}" 완료!\n소요시간: ${result.data.duration}분`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "▶️ 새 타이머 시작",
                  callback_data: "timer_start_prompt",
                },
                { text: "🔙 타이머 메뉴", callback_data: "timer_menu" },
              ],
            ],
          },
        }
      );
    } else {
      await this.editMessage(bot, chatId, messageId, `❌ ${result.error}`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "▶️ 타이머 시작", callback_data: "timer_start_prompt" },
              { text: "🔙 타이머 메뉴", callback_data: "timer_menu" },
            ],
          ],
        },
      });
    }
  }

  async showTimerStatus(bot, chatId, messageId, userId) {
    const status = this.timerService.status(userId);

    if (status.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `⏱️ "${status.data.taskName}" 진행 중...\n경과시간: ${status.data.duration}분`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "⏹️ 타이머 정지", callback_data: "timer_stop" },
                { text: "🔄 새로고침", callback_data: "timer_status" },
              ],
              [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
            ],
          },
        }
      );
    } else {
      await this.editMessage(bot, chatId, messageId, `❌ ${status.error}`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "▶️ 타이머 시작", callback_data: "timer_start_prompt" },
              { text: "🔙 타이머 메뉴", callback_data: "timer_menu" },
            ],
          ],
        },
      });
    }
  }

  async handleTimerCommand(bot, msg) {
    const {
      chat: { id: chatId },
      text,
    } = msg;

    if (text === "/timer") {
      await this.showTimerHelp(bot, chatId);
    }
  }

  async showTimerHelp(bot, chatId) {
    const helpText =
      `⏰ **타이머 사용법**\n\n` +
      `메뉴에서 타이머를 시작하고 관리하세요.\n\n` +
      `**기능:**\n` +
      `• 작업 시간 측정\n` +
      `• 실시간 진행 상태 확인\n` +
      `• 작업별 소요 시간 기록\n\n` +
      `⏱️ 효율적인 시간 관리를 시작하세요!`;

    await this.sendMessage(bot, chatId, helpText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏰ 타이머 메뉴", callback_data: "timer_menu" }],
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    });
  }
}

module.exports = TimerModule;
