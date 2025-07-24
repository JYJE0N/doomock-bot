// src/modules/TimerModule.js - 표준화된 타이머 모듈

const BaseModule = require("./BaseModule");
const TimerService = require("../services/TimerService");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class TimerModule extends BaseModule {
  constructor() {
    super("TimerModule", {
      commands: ["timer", "타이머", "pomodoro", "뽀모도로"],
      callbacks: ["timer"],
      features: [
        "start",
        "stop",
        "pause",
        "resume",
        "status",
        "stats",
        "pomodoro",
      ],
    });

    this.timerService = new TimerService();
    this.activeRefreshes = new Map();

    // 타이머 설정
    this.config = {
      refreshInterval: 30000,
      enableNotifications: true,
      showProgressAnimation: true,
      autoCompletePrompt: true,
    };

    // 이모지
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

    logger.info("⏰ TimerModule 생성됨");
  }

  // ✅ 표준 액션 등록
  setupActions() {
    this.registerActions({
      menu: this.showTimerMenu.bind(this),
      status: this.showTimerStatus.bind(this),
      start: this.startTimer.bind(this),
      stop: this.stopTimer.bind(this),
      pause: this.pauseTimer.bind(this), // ✅ 함수로 올바르게 등록
      resume: this.resumeTimer.bind(this),
      "pomodoro:start": this.startPomodoro.bind(this),
      "pomodoro:break": this.startBreak.bind(this),
      "start:prompt": this.showStartPrompt.bind(this),
      "start:5": () => this.startCustomTimer(5),
      "start:10": () => this.startCustomTimer(10),
      "start:15": () => this.startCustomTimer(15),
      "start:25": () => this.startCustomTimer(25),
      stats: this.showStats.bind(this),
      help: this.showTimerHelp.bind(this),
    });
  }

  // ✅ 모듈 초기화
  async onInitialize() {
    try {
      // TimerService 초기화
      if (this.timerService && this.timerService.initialize) {
        await this.timerService.initialize();
        logger.info("⏰ TimerService 초기화 성공");
      }
    } catch (error) {
      logger.error("❌ TimerService 초기화 실패:", error);
      // 서비스 초기화 실패해도 모듈은 동작하도록
    }
  }

  // ✅ 메시지 처리
  async onHandleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (!text) return false;

    // 사용자 상태 확인
    const userState = this.getUserState(userId);

    if (userState) {
      switch (userState.action) {
        case "waiting_timer_input":
          return await this.handleTimerInput(
            bot,
            chatId,
            userId,
            text,
            userState
          );
        case "waiting_pomodoro_task":
          return await this.handlePomodoroTaskInput(
            bot,
            chatId,
            userId,
            text,
            userState
          );
      }
    }

    // 명령어 처리
    const command = this.extractCommand(text);

    if (command === "timer" || text === "타이머") {
      await this.showTimerMenu(bot, {
        message: { chat: { id: chatId } },
        from: { id: userId },
      });
      return true;
    }

    if (command === "pomodoro" || text === "뽀모도로") {
      await this.startPomodoro(bot, {
        message: { chat: { id: chatId } },
        from: { id: userId },
      });
      return true;
    }

    return false;
  }

  // ==================== 액션 핸들러 ====================

  /**
   * 타이머 메뉴 표시
   */
  async showTimerMenu(bot, callbackQuery, params, moduleManager) {
    const chatId = callbackQuery.message?.chat?.id || callbackQuery.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    const userId = callbackQuery.from?.id;

    const userName = getUserName(callbackQuery.from);

    // 활성 타이머 확인
    const activeTimer = await this.timerService.getActiveTimer(userId);

    let menuText = `⏰ **타이머 & 뽀모도로**\n\n${userName}님의 시간 관리 도구입니다.`;

    if (activeTimer.success && activeTimer.timer) {
      const timer = activeTimer.timer;
      const remainingTime = this.formatTime(timer.remainingTime);

      menuText += `\n\n🎯 **진행 중인 타이머**\n`;
      menuText += `⏱️ 남은 시간: ${remainingTime}\n`;
      menuText += `📝 작업: ${timer.task || "일반 타이머"}`;
    }

    const keyboard = {
      inline_keyboard: activeTimer.success
        ? [
            [
              { text: "📊 상태", callback_data: "timer:status" },
              { text: "⏸️ 일시정지", callback_data: "timer:pause" },
            ],
            [
              { text: "⏹️ 정지", callback_data: "timer:stop" },
              { text: "📈 통계", callback_data: "timer:stats" },
            ],
            [
              { text: "❓ 도움말", callback_data: "timer:help" },
              { text: "🏠 메인 메뉴", callback_data: "main:menu" },
            ],
          ]
        : [
            [
              {
                text: "🍅 뽀모도로 시작",
                callback_data: "timer:pomodoro:start",
              },
              { text: "⏱️ 일반 타이머", callback_data: "timer:start:prompt" },
            ],
            [
              { text: "📈 내 통계", callback_data: "timer:stats" },
              { text: "❓ 도움말", callback_data: "timer:help" },
            ],
            [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
          ],
    };

    if (messageId) {
      await this.editMessage(bot, chatId, messageId, menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.sendMessage(bot, chatId, menuText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
  }

  /**
   * 타이머 상태 표시
   */
  async showTimerStatus(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userId = callbackQuery.from.id;

    const activeTimer = await this.timerService.getActiveTimer(userId);

    if (!activeTimer.success || !activeTimer.timer) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ 진행 중인 타이머가 없습니다.",
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

    const timer = activeTimer.timer;
    const remainingTime = this.formatTime(timer.remainingTime);
    const progress = this.calculateProgress(timer);

    const statusText = `📊 **타이머 상태**

⏱️ **남은 시간**: ${remainingTime}
📝 **작업**: ${timer.task || "일반 타이머"}
🎯 **타입**: ${timer.type === "pomodoro" ? "🍅 뽀모도로" : "⏰ 일반"}
📊 **진행률**: ${progress}%

${this.getProgressBar(progress)}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "⏸️ 일시정지", callback_data: "timer:pause" },
          { text: "⏹️ 정지", callback_data: "timer:stop" },
        ],
        [
          { text: "🔄 새로고침", callback_data: "timer:status" },
          { text: "🔙 타이머 메뉴", callback_data: "timer:menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, statusText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 타이머 시작 프롬프트
   */
  async showStartPrompt(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const promptText = `⏰ **타이머 시작**

몇 분 동안 타이머를 실행하시겠어요?`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "5분", callback_data: "timer:start:5" },
          { text: "10분", callback_data: "timer:start:10" },
          { text: "15분", callback_data: "timer:start:15" },
        ],
        [
          { text: "25분", callback_data: "timer:start:25" },
          { text: "⌨️ 직접 입력", callback_data: "timer:start:custom" },
        ],
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, promptText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 타이머 시작
   */
  async startTimer(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userId = callbackQuery.from.id;

    // 기본 15분 타이머
    const duration = params?.[0] || 15;

    const result = await this.timerService.startTimer(
      userId,
      duration,
      "일반 타이머"
    );

    if (result.success) {
      const successText = `✅ **타이머 시작됨**

⏱️ **시간**: ${duration}분
📝 **작업**: 일반 타이머
🎯 **목표**: 집중해서 작업하세요!

⏰ ${duration}분 후에 알림을 드릴게요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 상태", callback_data: "timer:status" },
            { text: "⏸️ 일시정지", callback_data: "timer:pause" },
          ],
          [{ text: "⏹️ 정지", callback_data: "timer:stop" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, successText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `❌ 타이머 시작 실패: ${result.message}`
      );
    }
  }

  /**
   * 사용자 정의 시간 타이머 시작
   */
  async startCustomTimer(duration) {
    return async (bot, callbackQuery, params, moduleManager) => {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId,
        },
      } = callbackQuery;
      const userId = callbackQuery.from.id;

      const result = await this.timerService.startTimer(
        userId,
        duration,
        "일반 타이머"
      );

      if (result.success) {
        const successText = `✅ **${duration}분 타이머 시작됨**

⏱️ **시간**: ${duration}분
📝 **작업**: 일반 타이머

⏰ ${duration}분 후에 알림을 드릴게요!`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "📊 상태", callback_data: "timer:status" },
              { text: "⏸️ 일시정지", callback_data: "timer:pause" },
            ],
            [{ text: "⏹️ 정지", callback_data: "timer:stop" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, successText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `❌ 타이머 시작 실패: ${result.message}`
        );
      }
    };
  }

  /**
   * 뽀모도로 시작
   */
  async startPomodoro(bot, callbackQuery, params, moduleManager) {
    const chatId = callbackQuery.message?.chat?.id || callbackQuery.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    const userId = callbackQuery.from.id;

    const result = await this.timerService.startPomodoro(
      userId,
      "뽀모도로 작업"
    );

    if (result.success) {
      const successText = `🍅 **뽀모도로 시작됨**

⏱️ **시간**: 25분
📝 **작업**: 뽀모도로 세션
🎯 **목표**: 집중해서 작업하세요!

25분 후 5분 휴식을 안내해드릴게요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 상태", callback_data: "timer:status" },
            { text: "⏸️ 일시정지", callback_data: "timer:pause" },
          ],
          [{ text: "⏹️ 정지", callback_data: "timer:stop" }],
        ],
      };

      if (messageId) {
        await this.editMessage(bot, chatId, messageId, successText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await this.sendMessage(bot, chatId, successText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
    } else {
      const errorText = `❌ 뽀모도로 시작 실패: ${result.message}`;

      if (messageId) {
        await this.editMessage(bot, chatId, messageId, errorText);
      } else {
        await this.sendMessage(bot, chatId, errorText);
      }
    }
  }

  /**
   * 타이머 일시정지
   */
  async pauseTimer(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userId = callbackQuery.from.id;

    const result = await this.timerService.pauseTimer(userId);

    if (result.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "⏸️ **타이머가 일시정지되었습니다.**",
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "▶️ 재시작", callback_data: "timer:resume" },
                { text: "⏹️ 정지", callback_data: "timer:stop" },
              ],
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
    } else {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `❌ 일시정지 실패: ${result.message}`
      );
    }
  }

  /**
   * 타이머 재시작
   */
  async resumeTimer(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userId = callbackQuery.from.id;

    const result = await this.timerService.resumeTimer(userId);

    if (result.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "▶️ **타이머가 재시작되었습니다.**",
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📊 상태", callback_data: "timer:status" },
                { text: "⏸️ 일시정지", callback_data: "timer:pause" },
              ],
              [{ text: "⏹️ 정지", callback_data: "timer:stop" }],
            ],
          },
        }
      );
    } else {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `❌ 재시작 실패: ${result.message}`
      );
    }
  }

  /**
   * 타이머 정지
   */
  async stopTimer(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userId = callbackQuery.from.id;

    const result = await this.timerService.stopTimer(userId);

    if (result.success) {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "⏹️ **타이머가 정지되었습니다.**",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        }
      );
    } else {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `❌ 정지 실패: ${result.message}`
      );
    }
  }

  /**
   * 통계 표시
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userId = callbackQuery.from.id;

    const stats = await this.timerService.getUserStats(userId);

    const statsText = `📈 **타이머 통계**

🗓️ **오늘**
• 완료된 세션: ${stats.today?.completed || 0}개
• 총 집중 시간: ${this.formatTime((stats.today?.totalTime || 0) * 60)}

📊 **전체 기록**
• 총 세션: ${stats.total?.sessions || 0}개
• 총 시간: ${this.formatTime((stats.total?.totalTime || 0) * 60)}
• 평균 세션: ${stats.total?.averageSession || 0}분

🍅 **뽀모도로**
• 완료된 뽀모도로: ${stats.pomodoro?.completed || 0}개
• 현재 연속: ${stats.pomodoro?.currentStreak || 0}개
• 최고 연속: ${stats.pomodoro?.bestStreak || 0}개`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, statsText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 도움말 표시
   */
  async showTimerHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `❓ **타이머 & 뽀모도로 도움말**

**명령어:**
• \`/timer\` 또는 "타이머" - 타이머 메뉴 열기
• \`/pomodoro\` 또는 "뽀모도로" - 뽀모도로 바로 시작

**기능:**
⏰ **일반 타이머** - 5~60분 자유 설정
🍅 **뽀모도로** - 25분 작업 + 5분 휴식
⏸️ **일시정지/재시작** - 타이머 제어
📊 **통계** - 나의 집중 시간 기록

**뽀모도로 기법:**
1. 25분 집중 작업
2. 5분 짧은 휴식
3. 4세트 후 15-30분 긴 휴식
4. 반복하여 생산성 향상

**사용 팁:**
• 타이머 진행 중에도 메뉴에서 상태 확인 가능
• 통계를 통해 집중 시간 트래킹
• 알림으로 시간 관리 도움`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  // ==================== 유틸리티 메서드 ====================

  /**
   * 시간 포맷팅 (분 → MM:SS)
   */
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * 진행률 계산
   */
  calculateProgress(timer) {
    if (!timer.totalTime || timer.totalTime === 0) return 0;
    const elapsedTime = timer.totalTime - timer.remainingTime;
    return Math.round((elapsedTime / timer.totalTime) * 100);
  }

  /**
   * 진행률 바 생성
   */
  getProgressBar(progress) {
    const filledBlocks = Math.floor(progress / 10);
    const emptyBlocks = 10 - filledBlocks;
    return "█".repeat(filledBlocks) + "░".repeat(emptyBlocks) + ` ${progress}%`;
  }

  /**
   * 타이머 입력 처리
   */
  async handleTimerInput(bot, chatId, userId, text, userState) {
    this.clearUserState(userId);

    const duration = parseInt(text);

    if (isNaN(duration) || duration < 1 || duration > 60) {
      await this.sendMessage(
        bot,
        chatId,
        "❌ 1~60분 사이의 숫자를 입력해주세요."
      );
      return true;
    }

    const result = await this.timerService.startTimer(
      userId,
      duration,
      "사용자 정의 타이머"
    );

    if (result.success) {
      await this.sendMessage(
        bot,
        chatId,
        `✅ ${duration}분 타이머가 시작되었습니다!`
      );
    } else {
      await this.sendMessage(
        bot,
        chatId,
        `❌ 타이머 시작 실패: ${result.message}`
      );
    }

    return true;
  }

  /**
   * 뽀모도로 작업명 입력 처리
   */
  async handlePomodoroTaskInput(bot, chatId, userId, text, userState) {
    this.clearUserState(userId);

    const result = await this.timerService.startPomodoro(userId, text);

    if (result.success) {
      await this.sendMessage(
        bot,
        chatId,
        `🍅 "${text}" 뽀모도로가 시작되었습니다! (25분)`
      );
    } else {
      await this.sendMessage(
        bot,
        chatId,
        `❌ 뽀모도로 시작 실패: ${result.message}`
      );
    }

    return true;
  }

  // ✅ 휴식 시작 (뽀모도로용)
  async startBreak(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userId = callbackQuery.from.id;

    const breakDuration = params?.[0] === "long" ? 15 : 5;
    const result = await this.timerService.startBreak(userId, breakDuration);

    if (result.success) {
      const breakText = `☕ **휴식 시간**

⏱️ **시간**: ${breakDuration}분
🎯 **타입**: ${breakDuration === 15 ? "긴 휴식" : "짧은 휴식"}

잠시 휴식을 취하세요!`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 상태", callback_data: "timer:status" },
            { text: "⏹️ 정지", callback_data: "timer:stop" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, breakText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `❌ 휴식 시작 실패: ${result.message}`
      );
    }
  }
}

module.exports = TimerModule;
