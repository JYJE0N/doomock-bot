// src/modules/TimerModule.js - 한국시간 + 시각적 진행률 표시

const BaseModule = require("./BaseModule");
const { TimerService } = require("../services/TimerService");
const { TimeHelper } = require("../utils/TimeHelper");
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

  // 새로운 콜백 구조에 맞춘 handleCallback 메서드
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
        await this.showTimerMenu(bot, chatId, messageId, userName);
        break;
      case "start_prompt":
        await this.startTimerPrompt(bot, chatId, messageId, userId);
        break;
      case "pomodoro_start":
        await this.startPomodoro(bot, chatId, messageId, userId);
        break;
      case "stop":
        await this.stopTimer(bot, chatId, messageId, userId);
        break;
      case "status":
        await this.showTimerStatus(bot, chatId, messageId, userId);
        break;
      default:
        await this.sendMessage(bot, chatId, "❌ 알 수 없는 타이머 명령입니다.");
    }
  }

  async showTimerMenu(bot, chatId, messageId, userName) {
    const currentTime = TimeHelper.formatDateTime();

    const menuText =
      `⏰ **${userName}님의 타이머** (${currentTime})\n\n` +
      "🍅 **포모도로**: 25분 집중 + 5분 휴식\n" +
      "⏱️ **일반 타이머**: 자유로운 시간 측정\n\n" +
      "원하는 기능을 선택하세요!";

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
      "⏰ **타이머 시작**\n\n작업명을 입력해주세요.\n\n" +
        "💡 **예시**: 독서하기, 운동하기, 회의 준비",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ 취소", callback_data: "timer_menu" }]],
        },
      }
    );
  }

  // 포모도로 시작
  async startPomodoro(bot, chatId, messageId, userId) {
    const result = this.timerService.startPomodoro(userId);

    if (result.success) {
      // ⭐ 완료 예정 시간 계산 (한국시간)
      const completionTime = TimeHelper.addMinutes(
        TimeHelper.getKoreaTime(),
        25
      );
      const completionTimeStr = TimeHelper.formatTime(completionTime);

      await this.editMessage(
        bot,
        chatId,
        messageId,
        "🍅 **포모도로 시작!**\n\n" +
          `📌 **작업**: ${result.data.taskName}\n` +
          `⏱️ **시간**: 25분\n` +
          `🎯 **세션**: ${result.data.sessionCount}번째\n` +
          `⏰ **완료 예정**: ${completionTimeStr}\n\n` +
          `${this.createProgressBar(0, 25)} 0%\n\n` +
          "집중해서 작업하세요! 💪",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📊 진행 상태", callback_data: "timer_status" },
                { text: "⏹️ 중지", callback_data: "timer_stop" },
              ],
              [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
            ],
          },
        }
      );

      // 25분 후 알림 설정
      setTimeout(() => {
        this.notifyPomodoroComplete(bot, chatId, userId);
      }, 25 * 60 * 1000);
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
        const currentTime = TimeHelper.formatDateTime();

        const keyboard =
          result.data.nextMode === "break"
            ? {
                inline_keyboard: [
                  [
                    {
                      text: "✅ 휴식 시작",
                      callback_data: "timer_pomodoro_start",
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
          `🔔 **포모도로 알림** (${currentTime})\n\n${result.data.message}`,
          {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          }
        );

        // 휴식 시간도 타이머 설정
        if (result.data.nextMode === "break") {
          setTimeout(() => {
            this.notifyPomodoroComplete(bot, chatId, userId);
          }, 5 * 60 * 1000);
        }
      }
    }
  }

  async stopTimer(bot, chatId, messageId, userId) {
    const result = this.timerService.stop(userId);

    if (result.success) {
      const currentTime = TimeHelper.formatDateTime();

      await this.editMessage(
        bot,
        chatId,
        messageId,
        "⏹️ **타이머 종료** 🎉\n\n" +
          `📌 **작업**: ${result.data.taskName}\n` +
          `⏱️ **소요시간**: ${result.data.elapsedTime}\n` +
          `🕐 **시작**: ${result.data.startTime}\n` +
          `🕕 **종료**: ${result.data.endTime}\n\n` +
          "수고하셨습니다! 💪",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🍅 포모도로 시작",
                  callback_data: "timer_pomodoro_start",
                },
                { text: "⏱️ 일반 타이머", callback_data: "timer_start_prompt" },
              ],
              [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
            ],
          },
        }
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

  async showTimerStatus(bot, chatId, messageId, userId) {
    const status = this.timerService.getStatus(userId);

    if (status.success) {
      let statusText;
      let buttons;

      if (status.data.type === "pomodoro") {
        const pomodoroStatus = this.timerService.pomodoroStatus(userId);
        if (pomodoroStatus.success) {
          // ⭐ 시각적 진행률 바 생성
          const progressBar = this.createProgressBar(
            pomodoroStatus.data.elapsed,
            pomodoroStatus.data.duration
          );

          // ⭐ 원형 진행률 표시
          const circularProgress = this.createCircularProgress(
            pomodoroStatus.data.elapsed,
            pomodoroStatus.data.duration
          );

          const modeEmoji = pomodoroStatus.data.mode === "work" ? "💼" : "☕";
          const modeText =
            pomodoroStatus.data.mode === "work" ? "작업 중" : "휴식 중";

          // ⭐ 완료 예정 시간 계산
          const remainingMinutes = pomodoroStatus.data.remaining;
          const completionTime = TimeHelper.addMinutes(
            TimeHelper.getKoreaTime(),
            remainingMinutes
          );
          const completionTimeStr = TimeHelper.formatTime(completionTime);

          const percentage = Math.round(
            (pomodoroStatus.data.elapsed / pomodoroStatus.data.duration) * 100
          );

          statusText =
            `🍅 **포모도로 ${modeText}** ${circularProgress}\n\n` +
            `${modeEmoji} **작업**: ${pomodoroStatus.data.taskName}\n` +
            `⏱️ **진행**: ${pomodoroStatus.data.elapsed}분 / ${pomodoroStatus.data.duration}분\n` +
            `${progressBar} ${percentage}%\n\n` +
            `🎯 **세션**: ${pomodoroStatus.data.sessionCount}회\n` +
            `⏳ **남은 시간**: ${pomodoroStatus.data.remaining}분\n` +
            `🕐 **완료 예정**: ${completionTimeStr}\n` +
            `📅 **현재 시간**: ${pomodoroStatus.data.currentTime}`;

          buttons = [
            [
              { text: "🔄 새로고침", callback_data: "timer_status" },
              { text: "⏹️ 중지", callback_data: "timer_stop" },
            ],
            [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
          ];
        }
      } else {
        // 일반 타이머
        statusText =
          "⏱️ **일반 타이머 진행 중**\n\n" +
          `📌 **작업**: ${status.data.taskName}\n` +
          `⏱️ **경과시간**: ${status.data.elapsedTime}\n` +
          `🕐 **시작 시간**: ${status.data.startTime}\n` +
          `📅 **현재 시간**: ${status.data.currentTime}`;

        buttons = [
          [
            { text: "⏹️ 타이머 정지", callback_data: "timer_stop" },
            { text: "🔄 새로고침", callback_data: "timer_status" },
          ],
          [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
        ];
      }

      await this.editMessage(bot, chatId, messageId, statusText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: buttons,
        },
      });
    } else {
      await this.editMessage(bot, chatId, messageId, `❌ ${status.error}`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🍅 포모도로 시작",
                callback_data: "timer_pomodoro_start",
              },
              { text: "⏱️ 일반 타이머", callback_data: "timer_start_prompt" },
            ],
            [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
          ],
        },
      });
    }
  }

  // ⭐ 시각적 진행 상황 바 생성 (향상된 버전)
  createProgressBar(current, total) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 10);
    const empty = 10 - filled;

    // 다양한 진행률 바 스타일
    const styles = {
      solid: { filled: "█", empty: "░" },
      block: { filled: "▓", empty: "░" },
      circle: { filled: "●", empty: "○" },
      square: { filled: "■", empty: "□" },
    };

    const style = styles.block; // 기본 스타일
    return `${style.filled.repeat(filled)}${style.empty.repeat(empty)}`;
  }

  // ⭐ 원형 진행률 표시
  createCircularProgress(current, total) {
    const percentage = Math.round((current / total) * 100);

    if (percentage <= 12.5) return "🕐";
    if (percentage <= 25) return "🕒";
    if (percentage <= 37.5) return "🕓";
    if (percentage <= 50) return "🕕";
    if (percentage <= 62.5) return "🕖";
    if (percentage <= 75) return "🕘";
    if (percentage <= 87.5) return "🕚";
    return "🕛";
  }

  // ⭐ 애니메이션 효과가 있는 진행률 (단계별)
  createAnimatedProgress(current, total) {
    const percentage = Math.round((current / total) * 100);

    const phases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

    const phaseIndex = Math.min(Math.floor(percentage / 12.5), 7);
    return phases[phaseIndex];
  }

  async handleTimerInput(bot, chatId, userId, text) {
    try {
      const taskName = ValidationHelper.validateTimerName(text);
      const result = this.timerService.start(userId, taskName);

      if (result.success) {
        this.userStates.delete(userId); // 상태 제거
        const currentTime = TimeHelper.formatDateTime();

        await this.sendMessage(
          bot,
          chatId,
          `⏰ **"${taskName}" 타이머 시작!**\n\n` +
            `🕐 **시작 시간**: ${result.data.startTime}\n` +
            `📅 **현재 시간**: ${currentTime}\n\n` +
            "집중하여 작업하세요! 💪",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⏹️ 타이머 정지", callback_data: "timer_stop" },
                  { text: "📊 현재 상태", callback_data: "timer_status" },
                ],
                [{ text: "🔙 타이머 메뉴", callback_data: "timer_menu" }],
              ],
            },
          }
        );
      } else {
        await this.sendMessage(bot, chatId, `❌ ${result.error}`);
      }
    } catch (error) {
      await this.sendMessage(bot, chatId, "❌ 유효하지 않은 작업명입니다.");
    }

    return true;
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
    const currentTime = TimeHelper.formatDateTime();

    const helpText =
      `⏰ **타이머 사용법** (${currentTime})\n\n` +
      "🍅 **포모도로 기법:**\n" +
      "• 25분 집중 + 5분 휴식\n" +
      "• 4세션마다 긴 휴식(15분)\n" +
      "• 생산성 향상에 효과적\n" +
      "• 시각적 진행률 표시\n\n" +
      "⏱️ **일반 타이머:**\n" +
      "• 자유로운 시간 측정\n" +
      "• 작업별 소요 시간 기록\n" +
      "• 정확한 한국시간 표시\n\n" +
      "📱 /start → ⏰ 타이머에서 시작하세요!";

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
