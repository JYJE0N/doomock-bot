// src/modules/TimerModule.js - 이벤트 기반 TimerService 연동

const BaseModule = require("../core/BaseModule");
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
  // setupActions() {
  //   this.registerActions({
  //     menu: this.showTimerMenu.bind(this),
  //     status: this.showTimerStatus.bind(this),
  //     start: this.startTimer.bind(this),
  //     stop: this.stopTimer.bind(this),
  //     pause: this.pauseTimer.bind(this),
  //     resume: this.resumeTimer.bind(this),
  //     "pomodoro:start": this.startPomodoro.bind(this),
  //     "pomodoro:break": this.startBreak.bind(this),
  //     "start:prompt": this.showStartPrompt.bind(this),
  //     "start:5": () => this.startCustomTimer(5),
  //     "start:10": () => this.startCustomTimer(10),
  //     "start:15": () => this.startCustomTimer(15),
  //     "start:25": () => this.startCustomTimer(25),
  //     "start:custom": this.promptCustomTimer.bind(this),
  //     stats: this.showStats.bind(this),
  //     help: this.showTimerHelp.bind(this),
  //   });
  // }

  setupActions() {
    // 안전한 바인딩을 위해 메서드 존재 여부 확인
    const actions = {};

    // 메서드가 존재하는 경우에만 바인딩
    if (this.showTimerMenu) actions.menu = this.showTimerMenu.bind(this);
    if (this.showTimerStatus) actions.status = this.showTimerStatus.bind(this);
    if (this.startCustomTimer) actions.start = this.startCustomTimer.bind(this);
    if (this.stopTimer) actions.stop = this.stopTimer.bind(this);
    if (this.pauseTimer) actions.pause = this.pauseTimer.bind(this);
    if (this.resumeTimer) actions.resume = this.resumeTimer.bind(this);
    if (this.startPomodoro)
      actions["pomodoro:start"] = this.startPomodoro.bind(this);
    if (this.startBreak) actions["pomodoro:break"] = this.startBreak.bind(this);
    if (this.showStartPrompt)
      actions["start:prompt"] = this.showStartPrompt.bind(this);
    if (this.showStats) actions.stats = this.showStats.bind(this);
    if (this.showTimerHelp) actions.help = this.showTimerHelp.bind(this);

    // 커스텀 타이머 액션
    actions["start:5"] = () => this.startCustomTimer(5);
    actions["start:10"] = () => this.startCustomTimer(10);
    actions["start:15"] = () => this.startCustomTimer(15);
    actions["start:25"] = () => this.startCustomTimer(25);

    if (this.promptCustomTimer)
      actions["start:custom"] = this.promptCustomTimer.bind(this);

    this.registerActions(actions);
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
      const remainingTime = this.formatTime(timer.remainingTime || 0);

      menuText += `\n\n🎯 **진행 중인 타이머**\n`;
      menuText += `⏱️ 남은 시간: ${remainingTime}\n`;
      menuText += `📝 작업: ${timer.taskName || "일반 타이머"}`;
    }

    const keyboard = {
      inline_keyboard:
        activeTimer.success && activeTimer.timer
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
                { text: "🏠 메인 메뉴", callback_data: "system:menu" },
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
              [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
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
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "timer:menu" }]],
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
        await this.sendMessage(
          bot,
          chatId,
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
          await this.editMessage(
            bot,
            chatId,
            userState.messageId,
            successText,
            {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            }
          );
        } else {
          await this.sendMessage(bot, chatId, successText, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
        }
      } else {
        await this.sendMessage(
          bot,
          chatId,
          `❌ 타이머 시작 실패: ${result.error}`
        );
      }

      return true;
    } catch (error) {
      logger.error("타이머 입력 처리 오류:", error);
      this.clearUserState(userId);
      await this.sendMessage(
        bot,
        chatId,
        "❌ 처리 중 오류가 발생했습니다. 다시 시도해주세요."
      );
      return true;
    }
  }

  /**
   * 포모도로 시작
   */
  async startPomodoro(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userId = callbackQuery.from.id;

    const result = await this.timerService.startPomodoro(
      userId,
      "포모도로 작업"
    );

    if (result.success) {
      const successText = `🍅 **포모도로 시작됨**

⏱️ **작업 시간**: ${result.data.duration}분
📝 **작업**: ${result.data.taskName}
🕐 **시작**: ${TimeHelper.formatTime(new Date())}
🕕 **완료 예정**: ${result.data.expectedEndTime}

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
      const errorText = `❌ 뽀모도로 시작 실패: ${result.error}`;

      if (messageId) {
        await this.editMessage(bot, chatId, messageId, errorText);
      } else {
        await this.sendMessage(bot, chatId, errorText);
      }
    }
  }

  /**
   * 휴식 시작
   */
  async startBreak(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;
    const userId = callbackQuery.from.id;

    // params[0]에서 휴식 타입 확인 (short/long)
    const breakDuration = params?.[0] === "long" ? 15 : 5;

    // 휴식용 타이머 시작
    const result = await this.timerService.startTimer(
      userId,
      breakDuration,
      breakDuration === 15 ? "긴 휴식" : "짧은 휴식"
    );

    if (result.success) {
      const breakText = `☕ **휴식 시간**

⏱️ **시간**: ${breakDuration}분
🎯 **타입**: ${breakDuration === 15 ? "긴 휴식" : "짧은 휴식"}
🕐 **시작**: ${TimeHelper.formatTime(new Date())}
🕕 **완료 예정**: ${result.data.expectedEndTime}

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
        `❌ 휴식 시작 실패: ${result.error}`
      );
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
    const remainingTime = this.formatTime(timer.remainingTime || 0);
    const progress = this.calculateProgress(timer);

    const statusText = `📊 **타이머 상태**

⏱️ **남은 시간**: ${remainingTime}
📝 **작업**: ${timer.taskName || "일반 타이머"}
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
      const stopText = `⏹️ **타이머 정지됨**

📝 **작업**: ${result.data.taskName}
⏱️ **경과 시간**: ${result.data.elapsedTime}
🕐 **시작**: ${TimeHelper.formatTime(new Date(result.data.startTime))}
🕕 **종료**: ${TimeHelper.formatTime(new Date(result.data.endTime))}

수고하셨습니다! 🎉`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🍅 뽀모도로", callback_data: "timer:pomodoro:start" },
            { text: "⏰ 새 타이머", callback_data: "timer:start:prompt" },
          ],
          [
            { text: "📈 통계", callback_data: "timer:stats" },
            { text: "🔙 타이머 메뉴", callback_data: "timer:menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, stopText, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        `❌ 정지 실패: ${result.error}`,
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

  /**
   * 타이머 일시정지 (현재 구현되지 않음)
   */
  async pauseTimer(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "⚠️ **일시정지 기능**\n\n현재 일시정지 기능은 구현 중입니다.\n타이머를 정지하거나 계속 진행해주세요.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⏹️ 정지", callback_data: "timer:stop" },
              { text: "📊 상태", callback_data: "timer:status" },
            ],
            [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
          ],
        },
      }
    );
  }

  /**
   * 타이머 재시작 (현재 구현되지 않음)
   */
  async resumeTimer(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    await this.editMessage(
      bot,
      chatId,
      messageId,
      "⚠️ **재시작 기능**\n\n현재 재시작 기능은 구현 중입니다.\n새로운 타이머를 시작해주세요.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🍅 뽀모도로", callback_data: "timer:pomodoro:start" },
              { text: "⏰ 새 타이머", callback_data: "timer:start:prompt" },
            ],
            [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
          ],
        },
      }
    );
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

    const serviceStatus = this.timerService.getServiceStatus();

    const statsText = `📈 **타이머 통계**

**🎯 현재 상태:**
• 활성 타이머: ${serviceStatus.activeTimers}개
• 활성 포모도로: ${serviceStatus.activePomodoroSessions}개
• 총 사용자: ${serviceStatus.totalUsers}명

**⚙️ 시스템 정보:**
• 서버 시간: ${serviceStatus.serverTime}
• 시간대: ${serviceStatus.timezone}
• 가동 시간: ${serviceStatus.uptime}분

**🍅 포모도로 설정:**
• 작업 시간: ${serviceStatus.config.workDuration}분
• 짧은 휴식: ${serviceStatus.config.shortBreakDuration}분
• 긴 휴식: ${serviceStatus.config.longBreakDuration}분
• 긴 휴식 주기: ${serviceStatus.config.longBreakInterval}회마다

**💾 백업 상태:**
• 마지막 백업: ${serviceStatus.lastBackup}
• 체크 인터벌: ${serviceStatus.checkInterval}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "timer:stats" },
          { text: "🔙 타이머 메뉴", callback_data: "timer:menu" },
        ],
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

    const helpText = `❓ **타이머 사용법**

**🍅 포모도로 기법:**
• 25분 집중 작업 → 5분 휴식
• 4회 완료 후 15분 긴 휴식
• 자동으로 완료 알림 제공

**⏰ 일반 타이머:**
• 5분, 10분, 15분, 25분 또는 직접 입력
• 최대 240분(4시간)까지 설정 가능
• 완료 시 자동 알림

**📊 기능:**
• 실시간 상태 확인
• 진행률 표시
• 통계 및 히스토리

**🔔 자동 알림:**
• 타이머 완료 시 자동 메시지
• 포모도로 단계별 안내
• 휴식 시간 알림

**💡 팁:**
• 집중이 필요한 작업에 포모도로 사용
• 단순 작업에는 일반 타이머 사용
• 통계를 통해 생산성 확인`;

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
   * 시간 포맷팅 (분을 시:분 형태로)
   */
  formatTime(minutes) {
    if (minutes <= 0) return "완료";

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}시간 ${mins}분`;
    } else {
      return `${mins}분`;
    }
  }

  /**
   * 진행률 계산
   */
  calculateProgress(timer) {
    if (!timer.duration || timer.duration <= 0) return 0;

    const elapsed = timer.elapsedTime || 0;
    const progress = Math.min(
      100,
      Math.round((elapsed / timer.duration) * 100)
    );
    return Math.max(0, progress);
  }

  /**
   * 진행률 바 생성
   */
  getProgressBar(progress) {
    const barLength = 10;
    const filled = Math.round((progress / 100) * barLength);
    const empty = barLength - filled;

    return "█".repeat(filled) + "░".repeat(empty) + ` ${progress}%`;
  }

  /**
   * 모듈 상태 조회
   */
  getStatus() {
    const serviceStatus = this.timerService?.getServiceStatus() || {};

    return {
      active: true,
      initialized: true,
      activeTimers: serviceStatus.activeTimers || 0,
      activeSessions: serviceStatus.activePomodoroSessions || 0,
      userStates: this.userStates.size,
      checkInterval: serviceStatus.checkInterval || "비활성",
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    logger.info("🧹 TimerModule 정리 시작...");

    // 활성 새로고침 정리
    for (const refreshId of this.activeRefreshes.values()) {
      clearInterval(refreshId);
    }
    this.activeRefreshes.clear();

    // TimerService 정리
    if (this.timerService && this.timerService.cleanup) {
      await this.timerService.cleanup();
    }

    // 사용자 상태 정리
    this.userStates.clear();

    logger.info("✅ TimerModule 정리 완료");
  }
}

module.exports = TimerModule;
