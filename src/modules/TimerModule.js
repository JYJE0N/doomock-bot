// src/modules/TimerModule.js - 사용자 친화적 포모도로 특화
const BaseModule = require("./BaseModule");
const TimerService = require("../services/TimerService");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class TimerModule extends BaseModule {
  constructor() {
    // ⭐ 중요: super()를 먼저 호출해야 this.actionMap이 초기화됨
    super("TimerModule");

    // 인스턴스 변수들 초기화
    this.timerService = new TimerService();
    this.userStates = new Map();
    this.config = {
      refreshInterval: 30000,
      enableNotifications: true,
      showProgressAnimation: true,
      autoCompletePrompt: true,
    };
    this.activeRefreshes = new Map();
    this.emojis = {
      work: "💼",
      break: "☕",
      longBreak: "🛋️",
      timer: "⏰",
      pomodoro: "🍅",
      success: "🎉",
      progress: ["🔴", "🟠", "🟡", "🟢"],
      numbers: ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"],
    };
    // ⭐ super() 호출 후에 액션 등록
  }

  // ⭐ Timer 모듈의 액션들을 등록
  setupActions() {
    this.registerActions({
      menu: this.showTimerMenu,
      "start:prompt": this.startTimerPrompt,
      "start:5": () => this.startTimer(5),
      "start:10": () => this.startTimer(10),
      // "start:custom": this.startCustomTimer, // 구현 시 주석 해제
      cancel: this.cancelTimer,
      help: this.showTimerHelp,
    });
  }

  async onInitialize() {
    try {
      // TimerService 초기화
      const TimerService = require("../services/TimerService");
      this.timerService = new TimerService(this.db);

      if (this.timerService.initialize) {
        await this.timerService.initialize();
      }

      logger.info("✅ TimerModule 초기화 완료");
    } catch (error) {
      logger.error("❌ TimerModule 초기화 실패:", error);
      throw error;
    }
  }

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;
    const userState = this.userStates.get(userId);

    // 타이머 입력 대기 중인 경우
    if (userState?.action === "waiting_timer:input") {
      return await this.handleTimerInput(bot, chatId, userId, text, userState);
    }

    // 포모도로 작업명 입력 대기 중인 경우
    if (userState?.action === "waiting_pomodoro_task") {
      return await this.handlePomodoroTaskInput(
        bot,
        chatId,
        userId,
        text,
        userState
      );
    }

    // 타이머 명령어 처리
    if (text === "/timer") {
      await this.showTimerHelp(bot, chatId);
      return true;
    }

    return false;
  }

  // ⭐ 표준화된 콜백 처리
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    await this.editMessage(bot, chatId, messageId, menuText, options);

    try {
      // BaseModule의 표준 handleCallback 호출
      // 이미 actionMap에 등록된 액션들은 자동으로 처리됨
      const handled = await super.handleCallback(
        bot,
        callbackQuery,
        subAction,
        params,
        moduleManager
      );

      if (!handled) {
        // 처리되지 않은 액션에 대한 기본 응답
        await this.sendMessage(bot, chatId, "❌ 알 수 없는 타이머 명령입니다.");
      }

      return handled;
    } catch (error) {
      logger.error(`TimerModule 콜백 오류 (${subAction}):`, error);
      await this.handleError(bot, chatId, error);
      return false;
    }
  }

  // ⭐ 포모도로 작업명 입력 프롬프트
  async showPomodoroTaskPrompt(bot, chatId, messageId, userId) {
    this.userStates.set(userId, {
      action: "waiting_pomodoro_task",
      messageId: messageId,
    });

    const examples = [
      "📖 책 읽기",
      "💻 코딩하기",
      "📝 보고서 작성",
      "🏃 운동하기",
      "🎨 디자인 작업",
      "📞 회의 준비",
    ];
    const randomExample = examples[Math.floor(Math.random() * examples.length)];

    await this.editMessage(
      bot,
      chatId,
      messageId,
      menuText,
      options,
      "🍅 **포모도로 시작**\n\n" +
        "25분 동안 집중할 작업을 입력해주세요!\n\n" +
        `💡 **예시**: ${randomExample}\n\n` +
        "✨ **팁**: 구체적이고 달성 가능한 목표를 설정하세요!",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚡ 빠른 시작", callback_data: "timer:pomodoro:quick" },
              { text: "❌ 취소", callback_data: "timer:menu" },
            ],
          ],
        },
      }
    );
  }

  // ⭐ 빠른 포모도로 시작 (작업명 입력 생략)
  async startQuickPomodoro(bot, chatId, messageId, userId) {
    const quickTasks = [
      "집중 작업",
      "포모도로 세션",
      "생산성 향상",
      "목표 달성",
      "효율적 작업",
      "몰입 시간",
    ];
    const taskName = quickTasks[Math.floor(Math.random() * quickTasks.length)];

    await this.startPomodoroWithTask(
      bot,
      chatId,
      messageId,
      userId,
      taskName,
      true
    );
  }

  // ⭐ 포모도로 작업명 입력 처리
  async handlePomodoroTaskInput(bot, chatId, userId, menuText, userState) {
    try {
      this.userStates.delete(userId);

      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, "❌ 작업명을 입력해주세요!");
        return true;
      }

      const taskName = text.trim();
      if (taskName.length > 50) {
        await bot.sendMessage(chatId, "❌ 작업명은 50자 이내로 입력해주세요!");
        return true;
      }

      await this.startPomodoroWithTask(
        bot,
        chatId,
        userState.messageId,
        userId,
        taskName
      );
      return true;
    } catch (error) {
      logger.error("포모도로 작업명 입력 처리 오류:", error);
      await bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.");
      return true;
    }
  }

  // ⭐ 포모도로 시작 (시각적 향상)
  async startPomodoroWithTask(
    bot,
    chatId,
    messageId,
    userId,
    taskName,
    isQuick = false
  ) {
    const result = this.timerService.startPomodoro(userId, taskName);

    if (result.success) {
      const data = result.data;

      // ⭐ 복원된 타이머인지 확인
      if (result.restored) {
        await this.showRestoredTimer(bot, chatId, messageId, userId, result);
        return;
      }

      // ⭐ 정확한 완료 예정 시간 계산
      const startTime = new Date(data.startTime); // ISO 문자열을 Date 객체로 변환
      const completionTime = TimeHelper.addMinutes(startTime, data.duration);
      const completionTimeStr = TimeHelper.formatTime(completionTime);

      // ⭐ 디버깅 로그 (문제 해결용)
      logger.info("🕐 시간 계산 디버깅:", {
        startTimeStr: data.startTime,
        startTimeObj: startTime,
        duration: data.duration,
        completionTime: completionTime,
        completionTimeStr: completionTimeStr,
        nowTime: TimeHelper.formatTime(TimeHelper.getKoreaTime()),
      });

      const progressBar = this.createProgressBar(0, data.duration);
      const sessionEmoji = this.getSessionEmoji(data.sessionCount);

      const startText =
        `🍅 **포모도로 시작!** ${sessionEmoji}\n\n` +
        `💼 **작업**: ${data.taskName}\n` +
        `⏱️ **시간**: ${data.duration}분 집중 시간\n` +
        `🎯 **세션**: ${data.sessionCount}번째\n` +
        `🕐 **시작 시간**: ${TimeHelper.formatTime(startTime)}\n` +
        `⏰ **완료 예정**: ${completionTimeStr}\n\n` +
        `${progressBar} 0%\n\n` +
        `🔥 **집중해서 작업하세요!**\n` +
        `${
          isQuick
            ? "⚡ 빠른 시작으로 바로 집중 모드에 돌입했습니다!"
            : "💪 성공적인 포모도로를 위해 화이팅!"
        }`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 현재 상태", callback_data: "timer:status" },
            { text: "✅ 완료", callback_data: "timer:complete" },
          ],
          [
            { text: "⏹️ 정지", callback_data: "timer:stop" },
            { text: "🔙 타이머 메뉴", callback_data: "timer:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, menuText, options, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      // ⭐ 자동 새로고침 시작
      this.startAutoRefresh(bot, chatId, messageId, userId);
    } else {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        menuText,
        options,
        `❌ ${result.error}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
    }
  }

  // ⭐ 복원된 타이머 표시
  async showRestoredTimer(bot, chatId, messageId, userId, result) {
    const data = result.data;
    const emoji = data.completed ? "🎉" : "🔄";

    let message;
    if (data.completed) {
      message =
        `${emoji} **타이머 복원 완료**\n\n` +
        `✅ **완료된 작업**: ${data.taskName}\n` +
        `⏱️ **진행 시간**: ${data.elapsedTime}\n` +
        `⏳ **다운타임**: ${data.downtime}분\n\n` +
        `${data.message}\n\n` +
        `새로운 포모도로를 시작하시겠어요?`;
    } else {
      const progressBar = this.createProgressBar(data.elapsed, data.duration);
      const percentage = Math.round((data.elapsed / data.duration) * 100);

      message =
        `${emoji} **타이머 복원됨**\n\n` +
        `💼 **작업**: ${data.taskName}\n` +
        `⏱️ **진행**: ${data.elapsed}분 / ${data.duration}분\n` +
        `${progressBar} ${percentage}%\n` +
        `⏳ **다운타임**: ${data.downtime}분\n\n` +
        `${data.message}`;
    }

    const keyboard = {
      inline_keyboard: data.completed
        ? [
            [
              { text: "🍅 새 포모도로", callback_data: "timer:pomodoro:start" },
              { text: "📊 통계 보기", callback_data: "timer:stats" },
            ],
            [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
          ]
        : [
            [
              { text: "▶️ 계속하기", callback_data: "timer:continue" },
              { text: "⏹️ 정지", callback_data: "timer:stop" },
            ],
            [
              { text: "📊 현재 상태", callback_data: "timer:status" },
              { text: "🔙 타이머 메뉴", callback_data: "timer:menu" },
            ],
          ],
    };

    await this.editMessage(bot, chatId, messageId, text, options, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    if (!data.completed) {
      this.startAutoRefresh(bot, chatId, messageId, userId);
    }
  }

  // ⭐ 스타트 브레이크 (휴식)
  async startBreak(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 포모도로 완료 후 휴식 시작 로직
    const breakText =
      "☕ **휴식 시간!**\n\n" +
      "5분간 휴식을 취하세요.\n" +
      "스트레칭, 물 마시기, 눈 운동 등을 추천합니다!\n\n" +
      "휴식도 생산성의 일부입니다. 🌱";

    await this.editMessage(bot, chatId, messageId, text, options, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏹️ 휴식 종료", callback_data: "timer:stop" }],
          [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
        ],
      },
    });
  }

  // ⭐ 타이머 상태 표시 (실시간 업데이트)
  async showTimerStatus(bot, chatId, messageId, userId) {
    const status = this.timerService.getStatus(userId);

    if (!status.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        text,
        options,
        `❌ ${status.error}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
      return;
    }

    if (status.data.type === "pomodoro") {
      await this.showPomodoroStatus(bot, chatId, messageId, userId);
    } else {
      await this.showGeneralTimerStatus(
        bot,
        chatId,
        messageId,
        userId,
        status.data
      );
    }
  }

  // ⭐ 포모도로 상태 표시 (풍부한 시각적 정보)
  async showPomodoroStatus(bot, chatId, messageId, userId) {
    const pomodoroStatus = this.timerService.pomodoroStatus(userId);

    if (!pomodoroStatus.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        text,
        options,
        `❌ ${pomodoroStatus.error}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
      return;
    }

    const data = pomodoroStatus.data;
    const modeText = data.mode === "work" ? "작업 중" : "휴식 중";
    const progressBar = data.progressBar;
    const circularProgress = data.circularProgress;

    // ⭐ 시간 상태에 따른 메시지
    let timeMessage = "";
    if (data.isOvertime) {
      timeMessage = `⚠️ **연장 중**: +${data.overtimeMinutes}분 초과`;
    } else if (data.remaining <= 5) {
      timeMessage = `🔥 **거의 완료**: ${data.remaining}분 남음!`;
    } else if (data.remaining <= 10) {
      timeMessage = `⚡ **막바지**: ${data.remaining}분 남음`;
    } else {
      timeMessage = `⏳ **남은 시간**: ${data.remainingTime}`;
    }

    const statusText =
      `🍅 **포모도로 ${modeText}** ${circularProgress}\n\n` +
      `${data.modeEmoji} **작업**: ${data.taskName}\n` +
      `⏱️ **진행**: ${data.elapsedTime} / ${data.duration}분\n` +
      `${progressBar} ${data.percentage}%\n\n` +
      `🎯 **세션**: ${this.getSessionEmoji(data.sessionCount)} ${
        data.sessionCount
      }회\n` +
      `${timeMessage}\n` +
      `🕐 **완료 예정**: ${data.completionTime}\n` +
      `📅 **현재 시간**: ${data.currentTime}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "timer:status" },
          { text: "✅ 완료", callback_data: "timer:complete" },
        ],
        [
          { text: "⏹️ 정지", callback_data: "timer:stop" },
          { text: "📊 통계", callback_data: "timer:stats" },
        ],
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, options, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ⭐ 포모도로 완료 처리
  async completePomodoro(bot, chatId, messageId, userId) {
    const result = this.timerService.completePomodoro(userId);

    if (result.success) {
      // 이모지와 메시지를 사용자 친화적으로
      const celebrationEmojis = ["🎉", "🎊", "🥳", "🙌", "👏", "✨"];
      const randomEmoji =
        celebrationEmojis[Math.floor(Math.random() * celebrationEmojis.length)];

      const completeText =
        `${randomEmoji} **포모도로 완료!**\n\n` +
        `🍅 **작업**: ${result.data.taskName}\n` +
        `⏱️ **집중 시간**: ${result.data.duration}분\n` +
        `📊 **오늘 완료**: ${result.data.todayCount}개\n` +
        `🏆 **레벨**: ${result.data.level} (${result.data.exp} EXP)\n\n` +
        `${result.data.message}`;

      // ⭐ 콜론 형식으로 통일
      const keyboard = {
        inline_keyboard: [
          [
            { text: "☕ 휴식 시작", callback_data: "timer:break:start" },
            { text: "🍅 새 포모도로", callback_data: "timer:pomodoro:start" },
          ],
          [
            { text: "📊 통계 보기", callback_data: "timer:stats" },
            { text: "🔙 타이머 메뉴", callback_data: "timer:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, options, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  // ⭐ 사용자 통계 표시
  async showUserStats(bot, chatId, messageId, userId) {
    const stats = this.timerService.getUserStats(userId);

    if (!stats.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "📊 **아직 통계가 없어요**\n\n" +
          "포모도로를 시작해서 나만의 생산성 기록을 만들어보세요!\n\n" +
          "🎯 첫 번째 포모도로를 시작해보시겠어요?",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🍅 첫 포모도로 시작",
                  callback_data: "timer:pomodoro:start",
                },
              ],
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
      return;
    }

    const data = stats.data;
    const todayPomodoros = data.today.completedPomodoros;

    // ⭐ 레벨 시스템 (게이미피케이션)
    const level = Math.floor(todayPomodoros / 4) + 1;
    const nextLevelProgress = todayPomodoros % 4;
    const levelBar =
      "🟩".repeat(nextLevelProgress) + "⬜".repeat(4 - nextLevelProgress);

    const statsText =
      `📊 **${getUserName({ id: userId })}님의 포모도로 통계**\n\n` +
      `🏆 **레벨 ${level}** (오늘 기준)\n` +
      `${levelBar} ${nextLevelProgress}/4\n\n` +
      `**📅 오늘의 성과**\n` +
      `🍅 완료한 포모도로: ${todayPomodoros}개\n` +
      `💼 집중 시간: ${data.today.workTime}\n` +
      `☕ 휴식 시간: ${data.today.breakTime}\n\n` +
      `**🎯 현재 세션**\n` +
      `📈 세션 카운트: ${data.current.sessionCount}회\n` +
      `⏱️ 총 작업 시간: ${data.current.totalWorkTime}\n` +
      `🛋️ 총 휴식 시간: ${data.current.totalBreakTime}\n\n` +
      `**📋 전체 기록**\n` +
      `📚 총 세션 수: ${data.overall.totalSessions}회\n` +
      `📅 마지막 세션: ${data.overall.lastSessionDate}`;

    // ⭐ 성취 뱃지 시스템
    const badges = [];
    if (todayPomodoros >= 1) badges.push("🥉 첫 포모도로");
    if (todayPomodoros >= 4) badges.push("🥈 집중 마스터");
    if (todayPomodoros >= 8) badges.push("🥇 생산성 킹");
    if (todayPomodoros >= 12) badges.push("💎 포모도로 레전드");

    let badgeText = "";
    if (badges.length > 0) {
      badgeText = `\n**🎖️ 오늘의 뱃지**\n${badges.join(" ")}\n`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "timer:stats" },
          { text: "🍅 새 포모도로", callback_data: "timer:pomodoro:start" },
        ],
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, options + badgeText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ⭐ 자동 새로고침 시작
  startAutoRefresh(bot, chatId, messageId, userId) {
    // 기존 새로고침 중지
    this.stopAutoRefresh(userId);

    const intervalId = setInterval(async () => {
      try {
        const status = this.timerService.pomodoroStatus(userId);
        if (status.success && !status.data.isComplete) {
          // 상태가 유효하면 자동 업데이트
          await this.showPomodoroStatus(bot, chatId, messageId, userId);
        } else {
          // 완료되었거나 오류시 새로고침 중지
          this.stopAutoRefresh(userId);
        }
      } catch (error) {
        logger.debug("자동 새로고침 오류 (무시):", error.message);
        this.stopAutoRefresh(userId);
      }
    }, this.config.refreshInterval);

    this.activeRefreshes.set(userId, intervalId);
    logger.debug(`자동 새로고침 시작: 사용자 ${userId}`);
  }

  // ⭐ 자동 새로고침 중지
  stopAutoRefresh(userId) {
    const intervalId = this.activeRefreshes.get(userId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeRefreshes.delete(userId);
      logger.debug(`자동 새로고침 중지: 사용자 ${userId}`);
    }
  }

  // ⭐ 헬퍼 메서드들
  getSessionEmoji(sessionCount) {
    if (sessionCount <= 10) {
      return this.emojis.numbers[sessionCount - 1] || "🔢";
    }
    return "🚀";
  }

  createProgressBar(current, total, length = 10) {
    const percentage = Math.min(100, (current / total) * 100);
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;

    return "🟩".repeat(filled) + "⬜".repeat(empty);
  }

  // 타이머 정지
  async stopTimer(bot, chatId, messageId, userId) {
    this.stopAutoRefresh(userId); // 자동 새로고침 중지

    const result = this.timerService.stop(userId);

    if (result.success) {
      const data = result.data;
      const typeEmoji = data.type === "pomodoro" ? "🍅" : "⏱️";

      let stopMessage = `⏹️ **타이머 정지됨** ${typeEmoji}\n\n`;
      stopMessage += `📌 **작업**: ${data.taskName}\n`;
      stopMessage += `⏱️ **소요 시간**: ${data.elapsedTime}\n`;
      stopMessage += `🕐 **시작**: ${TimeHelper.formatTime(
        new Date(data.startTime)
      )}\n`;
      stopMessage += `🕐 **종료**: ${TimeHelper.formatTime(
        new Date(data.endTime)
      )}\n`;

      if (data.sessionInfo) {
        stopMessage += `\n📊 **세션 정보**\n`;
        stopMessage += `🎯 총 세션: ${data.sessionInfo.totalSessions}회\n`;
        stopMessage += `💼 작업 시간: ${this.timerService.formatElapsedTime(
          data.sessionInfo.totalWorkTime
        )}\n`;
        stopMessage += `☕ 휴식 시간: ${this.timerService.formatElapsedTime(
          data.sessionInfo.totalBreakTime
        )}\n`;
      }

      stopMessage += `\n💪 **수고하셨습니다!**`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 통계 보기", callback_data: "timer:stats" },
            { text: "🍅 새 포모도로", callback_data: "timer:pomodoro:start" },
          ],
          [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, options, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        text,
        options,
        `❌ ${result.error}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
    }
  }

  // 계속하기 (복원된 타이머용)
  async continuePomodoro(bot, chatId, messageId, userId) {
    // 복원된 타이머의 restored 플래그를 제거하여 정상 동작하도록 함
    const timer = this.timerService.timers.get(userId);
    if (timer) {
      timer.restored = false;
    }

    await this.showTimerStatus(bot, chatId, messageId, userId);
    this.startAutoRefresh(bot, chatId, messageId, userId);
  }

  // 일반 타이머 입력 프롬프트
  async startTimerPrompt(bot, chatId, messageId, userId) {
    this.userStates.set(userId, {
      action: "waiting_timer:input",
      messageId: messageId,
    });

    const examples = [
      "📖 독서하기",
      "💻 프로그래밍",
      "🏃 운동하기",
      "📞 회의 참석",
      "🎨 창작 활동",
      "📝 글쓰기",
    ];
    const randomExample = examples[Math.floor(Math.random() * examples.length)];

    // ⭐ 콜론 형식으로 통일
    await this.editMessage(
      bot,
      chatId,
      messageId,
      text,
      options,
      "⏱️ **일반 타이머 시작**\n\n" +
        "측정할 작업명을 입력해주세요!\n\n" +
        `💡 **예시**: ${randomExample}\n\n` +
        "✨ **일반 타이머**는 자유로운 시간 측정이 가능합니다.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ 취소", callback_data: "timer:menu" }]],
        },
      }
    );
  }

  // 일반 타이머 입력 처리
  async handleTimerInput(bot, chatId, userId, text, userState) {
    try {
      this.userStates.delete(userId);

      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, "❌ 작업명을 입력해주세요!");
        return true;
      }

      const taskName = text.trim();
      if (taskName.length > 50) {
        await bot.sendMessage(chatId, "❌ 작업명은 50자 이내로 입력해주세요!");
        return true;
      }

      const result = this.timerService.start(userId, taskName);

      if (result.success) {
        const startText =
          `⏱️ **일반 타이머 시작!**\n\n` +
          `📌 **작업**: ${taskName}\n` +
          `🕐 **시작 시간**: ${result.data.startTime}\n` +
          `📅 **현재 시간**: ${TimeHelper.formatDateTime()}\n\n` +
          `⏰ **자유롭게 시간을 측정하세요!**\n` +
          `언제든지 정지할 수 있습니다. 💪`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "📊 현재 상태", callback_data: "timer:status" },
              { text: "⏹️ 정지", callback_data: "timer:stop" },
            ],
            [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, text, options, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          text,
          options,
          `❌ ${result.error}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
              ],
            },
          }
        );
      }
      return true;
    } catch (error) {
      logger.error("일반 타이머 입력 처리 오류:", error);
      await bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.");
      return true;
    }
  }

  // 일반 타이머 상태 표시
  async showGeneralTimerStatus(bot, chatId, messageId, userId, statusData) {
    const statusText =
      `⏱️ **일반 타이머 진행 중**\n\n` +
      `📌 **작업**: ${statusData.taskName}\n` +
      `⏱️ **경과 시간**: ${statusData.elapsedTime}\n` +
      `🕐 **시작 시간**: ${TimeHelper.formatTime(
        new Date(statusData.startTime)
      )}\n` +
      `📅 **현재 시간**: ${TimeHelper.formatTime(
        new Date(statusData.currentTime)
      )}\n\n` +
      `🚀 **계속 진행 중입니다!**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "timer:status" },
          { text: "⏹️ 정지", callback_data: "timer:stop" },
        ],
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, options, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // 타이머 도움말
  // showTimerHelp 메서드도 수정
  async showTimerHelp(bot, chatId, messageId = null) {
    const currentTime = TimeHelper.formatDateTime();

    const helpText =
      `⏰ **타이머 사용법** \n` +
      `📅 ${currentTime}\n\n` +
      `🍅 **포모도로 기법 (추천)**\n` +
      `• 25분 집중 + 5분 휴식의 과학적 방법\n` +
      `• 4세션마다 긴 휴식 (15분)\n` +
      `• 시각적 진행률과 자동 전환\n` +
      `• 실시간 상태 업데이트\n` +
      `• 성취 통계 및 레벨 시스템\n\n` +
      `⏱️ **일반 타이머**\n` +
      `• 자유로운 시간 측정\n` +
      `• 작업별 소요 시간 기록\n` +
      `• 정확한 한국시간 표시\n\n` +
      `🎯 **특별 기능**\n` +
      `• 서버 재시작 시 자동 복원\n` +
      `• 게이미피케이션 요소\n` +
      `• 사용자별 개인 통계\n` +
      `• 실시간 진행률 표시\n\n` +
      `📱 /start → ⏰ 타이머에서 시작하세요!`;

    // ⭐ 콜론 형식으로 통일
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🍅 포모도로 시작", callback_data: "timer:pomodoro:start" },
          { text: "⏱️ 일반 타이머", callback_data: "timer:start:prompt" },
        ],
        [
          { text: "⏰ 타이머 메뉴", callback_data: "timer:menu" },
          { text: "🔙 메인 메뉴", callback_data: "main:menu" },
        ],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, text, options, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, helpText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  // 에러 처리
  async handleError(bot, chatId, error) {
    const errorText =
      "❌ **타이머 오류 발생**\n\n" +
      "처리 중 문제가 발생했습니다.\n" +
      "잠시 후 다시 시도해주세요.\n\n" +
      "문제가 지속되면 관리자에게 문의해주세요.";

    await this.sendMessage(bot, chatId, errorText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "timer:menu" },
            { text: "🏠 메인 메뉴", callback_data: "main:menu" },
          ],
        ],
      },
    });
  }

  // 모듈 종료 시 정리
  async shutdown() {
    // 모든 자동 새로고침 중지
    for (const userId of this.activeRefreshes.keys()) {
      this.stopAutoRefresh(userId);
    }

    logger.info("🛑 TimerModule 정리 완료");
  }

  // ⭐ 포모도로 작업명 입력 프롬프트
  async showPomodoroTaskPrompt(bot, chatId, messageId, userId) {
    this.userStates.set(userId, {
      action: "waiting_pomodoro_task",
      messageId: messageId,
    });

    const examples = [
      "📖 책 읽기",
      "💻 코딩하기",
      "📝 보고서 작성",
      "🏃 운동하기",
      "🎨 디자인 작업",
      "📞 회의 준비",
    ];
    const randomExample = examples[Math.floor(Math.random() * examples.length)];

    await this.editMessage(
      bot,
      chatId,
      messageId,
      text,
      options,
      "🍅 **포모도로 시작**\n\n" +
        "25분 동안 집중할 작업을 입력해주세요!\n\n" +
        `💡 **예시**: ${randomExample}\n\n` +
        "✨ **팁**: 구체적이고 달성 가능한 목표를 설정하세요!",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚡ 빠른 시작", callback_data: "timer:pomodoro:quick" },
              { text: "❌ 취소", callback_data: "timer:menu" },
            ],
          ],
        },
      }
    );
  }

  // ⭐ 빠른 포모도로 시작 (작업명 입력 생략)
  async startQuickPomodoro(bot, chatId, messageId, userId) {
    const quickTasks = [
      "집중 작업",
      "포모도로 세션",
      "생산성 향상",
      "목표 달성",
      "효율적 작업",
      "몰입 시간",
    ];
    const taskName = quickTasks[Math.floor(Math.random() * quickTasks.length)];

    await this.startPomodoroWithTask(
      bot,
      chatId,
      messageId,
      userId,
      taskName,
      true
    );
  }

  // ⭐ 포모도로 작업명 입력 처리
  async handlePomodoroTaskInput(bot, chatId, userId, text, userState) {
    try {
      this.userStates.delete(userId);

      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, "❌ 작업명을 입력해주세요!");
        return true;
      }

      const taskName = text.trim();
      if (taskName.length > 50) {
        await bot.sendMessage(chatId, "❌ 작업명은 50자 이내로 입력해주세요!");
        return true;
      }

      await this.startPomodoroWithTask(
        bot,
        chatId,
        userState.messageId,
        userId,
        taskName
      );
      return true;
    } catch (error) {
      logger.error("포모도로 작업명 입력 처리 오류:", error);
      await bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.");
      return true;
    }
  }

  // ⭐ 포모도로 시작 (시각적 향상)
  async startPomodoroWithTask(
    bot,
    chatId,
    messageId,
    userId,
    taskName,
    isQuick = false
  ) {
    const result = this.timerService.startPomodoro(userId, taskName);

    if (result.success) {
      const data = result.data;

      // ⭐ 복원된 타이머인지 확인
      if (result.restored) {
        await this.showRestoredTimer(bot, chatId, messageId, userId, result);
        return;
      }

      // ⭐ 정확한 완료 예정 시간 계산
      const startTime = new Date(data.startTime); // ISO 문자열을 Date 객체로 변환
      const completionTime = TimeHelper.addMinutes(startTime, data.duration);
      const completionTimeStr = TimeHelper.formatTime(completionTime);

      // ⭐ 디버깅 로그 (문제 해결용)
      logger.info("🕐 시간 계산 디버깅:", {
        startTimeStr: data.startTime,
        startTimeObj: startTime,
        duration: data.duration,
        completionTime: completionTime,
        completionTimeStr: completionTimeStr,
        nowTime: TimeHelper.formatTime(TimeHelper.getKoreaTime()),
      });

      const progressBar = this.createProgressBar(0, data.duration);
      const sessionEmoji = this.getSessionEmoji(data.sessionCount);

      const startText =
        `🍅 **포모도로 시작!** ${sessionEmoji}\n\n` +
        `💼 **작업**: ${data.taskName}\n` +
        `⏱️ **시간**: ${data.duration}분 집중 시간\n` +
        `🎯 **세션**: ${data.sessionCount}번째\n` +
        `🕐 **시작 시간**: ${TimeHelper.formatTime(startTime)}\n` +
        `⏰ **완료 예정**: ${completionTimeStr}\n\n` +
        `${progressBar} 0%\n\n` +
        `🔥 **집중해서 작업하세요!**\n` +
        `${
          isQuick
            ? "⚡ 빠른 시작으로 바로 집중 모드에 돌입했습니다!"
            : "💪 성공적인 포모도로를 위해 화이팅!"
        }`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 현재 상태", callback_data: "timer:status" },
            { text: "✅ 완료", callback_data: "timer:complete" },
          ],
          [
            { text: "⏹️ 정지", callback_data: "timer:stop" },
            { text: "🔙 타이머 메뉴", callback_data: "timer:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, options, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      // ⭐ 자동 새로고침 시작
      this.startAutoRefresh(bot, chatId, messageId, userId);
    } else {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        text,
        options,
        `❌ ${result.error}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
    }
  }

  // ⭐ 복원된 타이머 표시
  async showRestoredTimer(bot, chatId, messageId, userId, result) {
    const data = result.data;
    const emoji = data.completed ? "🎉" : "🔄";

    let message;
    if (data.completed) {
      message =
        `${emoji} **타이머 복원 완료**\n\n` +
        `✅ **완료된 작업**: ${data.taskName}\n` +
        `⏱️ **진행 시간**: ${data.elapsedTime}\n` +
        `⏳ **다운타임**: ${data.downtime}분\n\n` +
        `${data.message}\n\n` +
        `새로운 포모도로를 시작하시겠어요?`;
    } else {
      const progressBar = this.createProgressBar(data.elapsed, data.duration);
      const percentage = Math.round((data.elapsed / data.duration) * 100);

      message =
        `${emoji} **타이머 복원됨**\n\n` +
        `💼 **작업**: ${data.taskName}\n` +
        `⏱️ **진행**: ${data.elapsed}분 / ${data.duration}분\n` +
        `${progressBar} ${percentage}%\n` +
        `⏳ **다운타임**: ${data.downtime}분\n\n` +
        `${data.message}`;
    }

    const keyboard = {
      inline_keyboard: data.completed
        ? [
            [
              { text: "🍅 새 포모도로", callback_data: "timer:pomodoro:start" },
              { text: "📊 통계 보기", callback_data: "timer:stats" },
            ],
            [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
          ]
        : [
            [
              { text: "▶️ 계속하기", callback_data: "timer:continue" },
              { text: "⏹️ 정지", callback_data: "timer:stop" },
            ],
            [
              { text: "📊 현재 상태", callback_data: "timer:status" },
              { text: "🔙 타이머 메뉴", callback_data: "timer:menu" },
            ],
          ],
    };

    await this.editMessage(bot, chatId, messageId, text, options, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    if (!data.completed) {
      this.startAutoRefresh(bot, chatId, messageId, userId);
    }
  }

  // ⭐ 타이머 상태 표시 (실시간 업데이트)
  async showTimerStatus(bot, chatId, messageId, userId) {
    const status = this.timerService.getStatus(userId);

    if (!status.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        text,
        options,
        `❌ ${status.error}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
      return;
    }

    if (status.data.type === "pomodoro") {
      await this.showPomodoroStatus(bot, chatId, messageId, userId);
    } else {
      await this.showGeneralTimerStatus(
        bot,
        chatId,
        messageId,
        userId,
        status.data
      );
    }
  }

  // ⭐ 포모도로 상태 표시 (풍부한 시각적 정보)
  async showPomodoroStatus(bot, chatId, messageId, userId) {
    const pomodoroStatus = this.timerService.pomodoroStatus(userId);

    if (!pomodoroStatus.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        text,
        options,
        `❌ ${pomodoroStatus.error}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
      return;
    }

    const data = pomodoroStatus.data;
    const modeText = data.mode === "work" ? "작업 중" : "휴식 중";
    const progressBar = data.progressBar;
    const circularProgress = data.circularProgress;

    // ⭐ 시간 상태에 따른 메시지
    let timeMessage = "";
    if (data.isOvertime) {
      timeMessage = `⚠️ **연장 중**: +${data.overtimeMinutes}분 초과`;
    } else if (data.remaining <= 5) {
      timeMessage = `🔥 **거의 완료**: ${data.remaining}분 남음!`;
    } else if (data.remaining <= 10) {
      timeMessage = `⚡ **막바지**: ${data.remaining}분 남음`;
    } else {
      timeMessage = `⏳ **남은 시간**: ${data.remainingTime}`;
    }

    const statusText =
      `🍅 **포모도로 ${modeText}** ${circularProgress}\n\n` +
      `${data.modeEmoji} **작업**: ${data.taskName}\n` +
      `⏱️ **진행**: ${data.elapsedTime} / ${data.duration}분\n` +
      `${progressBar} ${data.percentage}%\n\n` +
      `🎯 **세션**: ${this.getSessionEmoji(data.sessionCount)} ${
        data.sessionCount
      }회\n` +
      `${timeMessage}\n` +
      `🕐 **완료 예정**: ${data.completionTime}\n` +
      `📅 **현재 시간**: ${data.currentTime}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "timer:status" },
          { text: "✅ 완료", callback_data: "timer:complete" },
        ],
        [
          { text: "⏹️ 정지", callback_data: "timer:stop" },
          { text: "📊 통계", callback_data: "timer:stats" },
        ],
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, options, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ⭐ 포모도로 완료 처리
  async completePomodoro(bot, chatId, messageId, userId) {
    const result = this.timerService.completePomodoro(userId);

    if (result.success) {
      // 이모지와 메시지를 사용자 친화적으로
      const celebrationEmojis = ["🎉", "🎊", "🥳", "🙌", "👏", "✨"];
      const randomEmoji =
        celebrationEmojis[Math.floor(Math.random() * celebrationEmojis.length)];

      const completeText =
        `${randomEmoji} **포모도로 완료!**\n\n` +
        `🍅 **작업**: ${result.data.taskName}\n` +
        `⏱️ **집중 시간**: ${result.data.duration}분\n` +
        `📊 **오늘 완료**: ${result.data.todayCount}개\n` +
        `🏆 **레벨**: ${result.data.level} (${result.data.exp} EXP)\n\n` +
        `${result.data.message}`;

      // ⭐ 콜론 형식으로 통일
      const keyboard = {
        inline_keyboard: [
          [
            { text: "☕ 휴식 시작", callback_data: "timer:break:start" },
            { text: "🍅 새 포모도로", callback_data: "timer:pomodoro:start" },
          ],
          [
            { text: "📊 통계 보기", callback_data: "timer:stats" },
            { text: "🔙 타이머 메뉴", callback_data: "timer:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, options, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  // ⭐ 사용자 통계 표시
  async showUserStats(bot, chatId, messageId, userId) {
    const stats = this.timerService.getUserStats(userId);

    if (!stats.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        text,
        options,
        "📊 **아직 통계가 없어요**\n\n" +
          "포모도로를 시작해서 나만의 생산성 기록을 만들어보세요!\n\n" +
          "🎯 첫 번째 포모도로를 시작해보시겠어요?",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🍅 첫 포모도로 시작",
                  callback_data: "timer:pomodoro:start",
                },
              ],
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
      return;
    }

    const data = stats.data;
    const todayPomodoros = data.today.completedPomodoros;

    // ⭐ 레벨 시스템 (게이미피케이션)
    const level = Math.floor(todayPomodoros / 4) + 1;
    const nextLevelProgress = todayPomodoros % 4;
    const levelBar =
      "🟩".repeat(nextLevelProgress) + "⬜".repeat(4 - nextLevelProgress);

    const statsText =
      `📊 **${getUserName({ id: userId })}님의 포모도로 통계**\n\n` +
      `🏆 **레벨 ${level}** (오늘 기준)\n` +
      `${levelBar} ${nextLevelProgress}/4\n\n` +
      `**📅 오늘의 성과**\n` +
      `🍅 완료한 포모도로: ${todayPomodoros}개\n` +
      `💼 집중 시간: ${data.today.workTime}\n` +
      `☕ 휴식 시간: ${data.today.breakTime}\n\n` +
      `**🎯 현재 세션**\n` +
      `📈 세션 카운트: ${data.current.sessionCount}회\n` +
      `⏱️ 총 작업 시간: ${data.current.totalWorkTime}\n` +
      `🛋️ 총 휴식 시간: ${data.current.totalBreakTime}\n\n` +
      `**📋 전체 기록**\n` +
      `📚 총 세션 수: ${data.overall.totalSessions}회\n` +
      `📅 마지막 세션: ${data.overall.lastSessionDate}`;

    // ⭐ 성취 뱃지 시스템
    const badges = [];
    if (todayPomodoros >= 1) badges.push("🥉 첫 포모도로");
    if (todayPomodoros >= 4) badges.push("🥈 집중 마스터");
    if (todayPomodoros >= 8) badges.push("🥇 생산성 킹");
    if (todayPomodoros >= 12) badges.push("💎 포모도로 레전드");

    let badgeText = "";
    if (badges.length > 0) {
      badgeText = `\n**🎖️ 오늘의 뱃지**\n${badges.join(" ")}\n`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "timer:stats" },
          { text: "🍅 새 포모도로", callback_data: "timer:pomodoro:start" },
        ],
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, options + badgeText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ⭐ 자동 새로고침 시작
  startAutoRefresh(bot, chatId, messageId, userId) {
    // 기존 새로고침 중지
    this.stopAutoRefresh(userId);

    const intervalId = setInterval(async () => {
      try {
        const status = this.timerService.pomodoroStatus(userId);
        if (status.success && !status.data.isComplete) {
          // 상태가 유효하면 자동 업데이트
          await this.showPomodoroStatus(bot, chatId, messageId, userId);
        } else {
          // 완료되었거나 오류시 새로고침 중지
          this.stopAutoRefresh(userId);
        }
      } catch (error) {
        logger.debug("자동 새로고침 오류 (무시):", error.message);
        this.stopAutoRefresh(userId);
      }
    }, this.config.refreshInterval);

    this.activeRefreshes.set(userId, intervalId);
    logger.debug(`자동 새로고침 시작: 사용자 ${userId}`);
  }

  // ⭐ 자동 새로고침 중지
  stopAutoRefresh(userId) {
    const intervalId = this.activeRefreshes.get(userId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeRefreshes.delete(userId);
      logger.debug(`자동 새로고침 중지: 사용자 ${userId}`);
    }
  }

  // ⭐ 헬퍼 메서드들
  getSessionEmoji(sessionCount) {
    if (sessionCount <= 10) {
      return this.emojis.numbers[sessionCount - 1] || "🔢";
    }
    return "🚀";
  }

  createProgressBar(current, total, length = 10) {
    const percentage = Math.min(100, (current / total) * 100);
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;

    return "🟩".repeat(filled) + "⬜".repeat(empty);
  }

  // 타이머 정지
  async stopTimer(bot, chatId, messageId, userId) {
    this.stopAutoRefresh(userId); // 자동 새로고침 중지

    const result = this.timerService.stop(userId);

    if (result.success) {
      const data = result.data;
      const typeEmoji = data.type === "pomodoro" ? "🍅" : "⏱️";

      let stopMessage = `⏹️ **타이머 정지됨** ${typeEmoji}\n\n`;
      stopMessage += `📌 **작업**: ${data.taskName}\n`;
      stopMessage += `⏱️ **소요 시간**: ${data.elapsedTime}\n`;
      stopMessage += `🕐 **시작**: ${TimeHelper.formatTime(
        new Date(data.startTime)
      )}\n`;
      stopMessage += `🕐 **종료**: ${TimeHelper.formatTime(
        new Date(data.endTime)
      )}\n`;

      if (data.sessionInfo) {
        stopMessage += `\n📊 **세션 정보**\n`;
        stopMessage += `🎯 총 세션: ${data.sessionInfo.totalSessions}회\n`;
        stopMessage += `💼 작업 시간: ${this.timerService.formatElapsedTime(
          data.sessionInfo.totalWorkTime
        )}\n`;
        stopMessage += `☕ 휴식 시간: ${this.timerService.formatElapsedTime(
          data.sessionInfo.totalBreakTime
        )}\n`;
      }

      stopMessage += `\n💪 **수고하셨습니다!**`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 통계 보기", callback_data: "timer:stats" },
            { text: "🍅 새 포모도로", callback_data: "timer:pomodoro:start" },
          ],
          [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
        ],
      };

      await this.editMessage(
        bot,
        chatId,
        messageId,
        text,
        options,
        stopMessage,
        {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }
      );
    } else {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        text,
        options,
        `❌ ${result.error}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
    }
  }

  // 계속하기 (복원된 타이머용)
  async continuePomodoro(bot, chatId, messageId, userId) {
    // 복원된 타이머의 restored 플래그를 제거하여 정상 동작하도록 함
    const timer = this.timerService.timers.get(userId);
    if (timer) {
      timer.restored = false;
    }

    await this.showTimerStatus(bot, chatId, messageId, userId);
    this.startAutoRefresh(bot, chatId, messageId, userId);
  }

  // 일반 타이머 입력 프롬프트
  async startTimerPrompt(bot, chatId, messageId, userId) {
    this.userStates.set(userId, {
      action: "waiting_timer:input",
      messageId: messageId,
    });

    const examples = [
      "📖 독서하기",
      "💻 프로그래밍",
      "🏃 운동하기",
      "📞 회의 참석",
      "🎨 창작 활동",
      "📝 글쓰기",
    ];
    const randomExample = examples[Math.floor(Math.random() * examples.length)];

    // ⭐ 콜론 형식으로 통일
    await this.editMessage(
      bot,
      chatId,
      messageId,
      text,
      options,
      "⏱️ **일반 타이머 시작**\n\n" +
        "측정할 작업명을 입력해주세요!\n\n" +
        `💡 **예시**: ${randomExample}\n\n` +
        "✨ **일반 타이머**는 자유로운 시간 측정이 가능합니다.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ 취소", callback_data: "timer:menu" }]],
        },
      }
    );
  }

  // 일반 타이머 입력 처리
  async handleTimerInput(bot, chatId, userId, text, userState) {
    try {
      this.userStates.delete(userId);

      if (!text || text.trim().length === 0) {
        await bot.sendMessage(chatId, "❌ 작업명을 입력해주세요!");
        return true;
      }

      const taskName = text.trim();
      if (taskName.length > 50) {
        await bot.sendMessage(chatId, "❌ 작업명은 50자 이내로 입력해주세요!");
        return true;
      }

      const result = this.timerService.start(userId, taskName);

      if (result.success) {
        const startText =
          `⏱️ **일반 타이머 시작!**\n\n` +
          `📌 **작업**: ${taskName}\n` +
          `🕐 **시작 시간**: ${result.data.startTime}\n` +
          `📅 **현재 시간**: ${TimeHelper.formatDateTime()}\n\n` +
          `⏰ **자유롭게 시간을 측정하세요!**\n` +
          `언제든지 정지할 수 있습니다. 💪`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "📊 현재 상태", callback_data: "timer:status" },
              { text: "⏹️ 정지", callback_data: "timer:stop" },
            ],
            [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, text, options, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          text,
          options,
          `❌ ${result.error}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
              ],
            },
          }
        );
      }
      return true;
    } catch (error) {
      logger.error("일반 타이머 입력 처리 오류:", error);
      await bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.");
      return true;
    }
  }

  // 일반 타이머 상태 표시
  async showGeneralTimerStatus(bot, chatId, messageId, userId, statusData) {
    const statusText =
      `⏱️ **일반 타이머 진행 중**\n\n` +
      `📌 **작업**: ${statusData.taskName}\n` +
      `⏱️ **경과 시간**: ${statusData.elapsedTime}\n` +
      `🕐 **시작 시간**: ${TimeHelper.formatTime(
        new Date(statusData.startTime)
      )}\n` +
      `📅 **현재 시간**: ${TimeHelper.formatTime(
        new Date(statusData.currentTime)
      )}\n\n` +
      `🚀 **계속 진행 중입니다!**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "timer:status" },
          { text: "⏹️ 정지", callback_data: "timer:stop" },
        ],
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, text, options, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // 타이머 도움말
  // showTimerHelp 메서드도 수정
  async showTimerHelp(bot, chatId, messageId = null) {
    const currentTime = TimeHelper.formatDateTime();

    const helpText =
      `⏰ **타이머 사용법** \n` +
      `📅 ${currentTime}\n\n` +
      `🍅 **포모도로 기법 (추천)**\n` +
      `• 25분 집중 + 5분 휴식의 과학적 방법\n` +
      `• 4세션마다 긴 휴식 (15분)\n` +
      `• 시각적 진행률과 자동 전환\n` +
      `• 실시간 상태 업데이트\n` +
      `• 성취 통계 및 레벨 시스템\n\n` +
      `⏱️ **일반 타이머**\n` +
      `• 자유로운 시간 측정\n` +
      `• 작업별 소요 시간 기록\n` +
      `• 정확한 한국시간 표시\n\n` +
      `🎯 **특별 기능**\n` +
      `• 서버 재시작 시 자동 복원\n` +
      `• 게이미피케이션 요소\n` +
      `• 사용자별 개인 통계\n` +
      `• 실시간 진행률 표시\n\n` +
      `📱 /start → ⏰ 타이머에서 시작하세요!`;

    // ⭐ 콜론 형식으로 통일
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🍅 포모도로 시작", callback_data: "timer:pomodoro:start" },
          { text: "⏱️ 일반 타이머", callback_data: "timer:start:prompt" },
        ],
        [
          { text: "⏰ 타이머 메뉴", callback_data: "timer:menu" },
          { text: "🔙 메인 메뉴", callback_data: "main:menu" },
        ],
      ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, text, options, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, helpText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }
  // 🛑 타이머 취소
  async cancelTimer(bot, chatId, messageId, from) {
    const userId = from?.id;
    const userName = from?.first_name || "사용자";

    const timer = this.activeTimers.get(userId);

    if (timer) {
      clearTimeout(timer.timeout); // 타이머 정지
      this.activeTimers.delete(userId);

      const text = `⏹️ *${userName}님의 타이머가 취소되었습니다.*`;
      await this.editOrSend(bot, chatId, messageId, text);
    } else {
      const text = `⚠️ *현재 실행 중인 타이머가 없습니다.*`;
      await this.editOrSend(bot, chatId, messageId, text);
    }
  }

  // 도우미: messageId가 있으면 edit, 없으면 send
  async editOrSend(bot, chatId, messageId, text) {
    if (messageId) {
      await this.editMessage(bot, chatId, messageId, text, options, {
        parse_mode: "Markdown",
      });
    } else {
      await this.sendMessage(bot, chatId, text, {
        parse_mode: "Markdown",
      });
    }
  }
  // 에러 처리
  async handleError(bot, chatId, error) {
    const errorText =
      "❌ **타이머 오류 발생**\n\n" +
      "처리 중 문제가 발생했습니다.\n" +
      "잠시 후 다시 시도해주세요.\n\n" +
      "문제가 지속되면 관리자에게 문의해주세요.";

    await this.sendMessage(bot, chatId, errorText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "timer:menu" },
            { text: "🏠 메인 메뉴", callback_data: "main:menu" },
          ],
        ],
      },
    });
  }

  // 모듈 종료 시 정리
  async shutdown() {
    // 모든 자동 새로고침 중지
    for (const userId of this.activeRefreshes.keys()) {
      this.stopAutoRefresh(userId);
    }

    logger.info("🛑 TimerModule 정리 완료");
  }
  // ⭐ 메인 타이머 메뉴 (누락된 메서드 추가!)
  async showTimerMenu(bot, chatId, messageId, userName, userId) {
    const currentTime = TimeHelper.formatDateTime();
    const activeTimer = this.timerService.getStatus(userId);
    const pomodoroStatus = this.timerService.pomodoroStatus(userId);

    let statusInfo = "";
    if (activeTimer.success) {
      const emoji = activeTimer.data.type === "pomodoro" ? "🍅" : "⏰";
      statusInfo = `\n🔴 **진행 중**: ${emoji} ${activeTimer.data.taskName} (${activeTimer.data.elapsedTime})`;
    }

    // 사용자 통계 미리보기
    const userStats = this.timerService.getUserStats(userId);
    let statsPreview = "";
    if (userStats.success) {
      const todayPomodoros = userStats.data.today.completedPomodoros;
      if (todayPomodoros > 0) {
        statsPreview = `\n📊 **오늘**: 🍅${todayPomodoros}개 완료, ${userStats.data.today.workTime} 집중`;
      }
    }

    const menuText =
      `${this.emojis.timer} **${userName}님의 타이머** \n` +
      `📅 ${currentTime}${statusInfo}${statsPreview}\n\n` +
      "🍅 **포모도로**: 과학적으로 검증된 25분 집중법\n" +
      "⏱️ **일반 타이머**: 자유로운 시간 측정\n\n" +
      "🎯 **오늘도 집중해서 목표를 달성해보세요!";

    // ⭐ 모든 callback_data를 콜론(:) 형식으로 통일
    const keyboard = {
      inline_keyboard: activeTimer.success
        ? [
            [
              { text: "📊 현재 상태", callback_data: "timer:status" },
              { text: "⏹️ 정지", callback_data: "timer:stop" },
            ],
            [
              { text: "📈 통계", callback_data: "timer:stats" },
              { text: "❓ 도움말", callback_data: "timer:help" },
            ],
          ]
        : [
            [
              {
                text: "🍅 포모도로 시작",
                callback_data: "timer:pomodoro:start",
              },
              { text: "⏱️ 일반 타이머", callback_data: "timer:start:prompt" },
            ],
            [
              { text: "📈 내 통계", callback_data: "timer:stats" },
              { text: "❓ 도움말", callback_data: "timer:help" },
            ],
            [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
          ],
    };

    await this.editMessage(bot, chatId, messageId, text, options, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }
} // ⭐ 이 중괄호가 중요! 클래스를 닫아야 함

module.exports = TimerModule;
