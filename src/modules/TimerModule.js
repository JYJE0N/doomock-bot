// src/modules/TimerModule.js - 이벤트 기반 TimerService 연동

const BaseModule = require("./BaseModule");
const TimerService = require("../services/TimerService");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");
const logger = require("../utils/Logger");

class TimerModule extends BaseModule {
  constructor(bot, options = {}) {
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

    // ✅ 이벤트 기반 TimerService 생성
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

    logger.info("⏰ TimerModule 생성됨 (이벤트 기반)");
  }

  // ✅ 표준 액션 등록
  setupActions() {
    this.registerActions({
      menu: this.showTimerMenu.bind(this),
      status: this.showTimerStatus.bind(this),
      start: this.startTimer.bind(this),
      stop: this.stopTimer.bind(this),
      pause: this.pauseTimer.bind(this),
      resume: this.resumeTimer.bind(this),
      "pomodoro:start": this.startPomodoro.bind(this),
      "pomodoro:break": this.startBreak.bind(this),
      "start:prompt": this.showStartPrompt.bind(this),
      "start:5": () => this.startCustomTimer(5),
      "start:10": () => this.startCustomTimer(10),
      "start:15": () => this.startCustomTimer(15),
      "start:25": () => this.startCustomTimer(25),
      "start:custom": this.promptCustomTimer.bind(this),
      stats: this.showStats.bind(this),
      help: this.showTimerHelp.bind(this),
    });
  }

  // ✅ 모듈 초기화
  async onInitialize() {
    try {
      // TimerService는 이미 생성자에서 초기화됨
      logger.info("⏰ TimerModule 초기화 완료");
    } catch (error) {
      logger.error("❌ TimerModule 초기화 실패:", error);
      throw error;
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
          return await this.handleTimerInput(bot, chatId, userId, text, userState);
        case "waiting_pomodoro_task":
          return await this.handlePomodoroTaskInput(bot, chatId, userId, text, userState);
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
      const remainingTime = this.formatTime(timer.remainingTime || 0);

      menuText += `\n\n🎯 **진행 중인 타이머**\n`;
      menuText += `⏱️ 남은 시간: ${remainingTime}\n`;
      menuText += `📝 작업: ${timer.taskName || "일반 타이머"}`;
    }

    const keyboard = {
      inline_keyboard: activeTimer.success && activeTimer.timer
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
   * ✅ 커스텀 시간 타이머 시작
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
        `${duration}분 타이머`
      );

      if (result.success) {
        const successText = `✅ **타이머 시작됨**

⏱️ **시간**: ${duration}분
📝 **작업**: ${duration}분 타이머
🕐 **시작**: ${TimeHelper.formatTime(new Date())}
🕕 **완료 예정**: ${result.data.expectedEndTime}

집중해서 작업하세요! 💪`;

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
        const errorText = `❌ 타이머 시작 실패: ${result.error}`;
        await this.editMessage(bot, chatId, messageId, errorText, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
          },
        });
      }
    };
  }

  /**
   * ✅ 직접 입력 타이머 프롬프트
   */
  async promptCustomTimer(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userId = callbackQuery.from.id;

    // 사용자 상태 설정
    this.setUserState(userId, {
      action: "waiting_timer_input",
      chatId,
      messageId,
    });

    const promptText = `⌨️ **직접 입력**

타이머를 몇 분 동안 실행하시겠어요?
숫자만 입력해주세요. (예: 30)

최소 1분, 최대 240분(4시간)까지 설정 가능합니다.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "❌ 취소", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, promptText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * ✅ 사용자 입력 타이머 시간 처리
   */
  async handleTimerInput(bot, chatId, userId, text, userState) {
    try {
      const duration = parseInt(text.trim());

      if (isNaN(duration) || duration < 1 || duration > 240) {
        await this.sendMessage(bot, chatId, 
          "❌ 올바른 시간을 입력해주세요. (1-240분)\n다시 입력하거나 /cancel로 취소하세요."
        );
        return true;
      }

      // 사용자 상태 초기화
      this.clearUserState(userId);

      // 타이머 시작
      const result = await this.timerService.startTimer(
        userId,
        duration,
        `${duration}분 타이머`
      );

      if (result.success) {
        const successText = `✅ **타이머 시작됨**

⏱️ **시간**: ${duration}분
📝 **작업**: ${duration}분 타이머
🕐 **시작**: ${TimeHelper.formatTime(new Date())}
🕕 **완료 예정**: ${result.data.expectedEndTime}

집중해서 작업하세요! 💪`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "📊 상태", callback_data: "timer:status" },
              { text: "⏸️ 일시정지", callback_data: "timer:pause" },
            ],
            [{ text: "⏹️ 정지", callback_data: "timer:stop" }],
          ],
        };

        // 기존 메시지 수정
        if (userState.messageId) {
          await this.editMessage(bot, chatId, userState.messageId, successText, {
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
        await this.sendMessage(bot, chatId, `❌ 타이머
