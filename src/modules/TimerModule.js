// src/modules/TimerModule.js - 표준 패턴으로 완전 새로 구현

const BaseModule = require("./BaseModule");
const { getUserName } = require("../utils/UserHelper");
const Logger = require("../utils/Logger");

class TimerModule extends BaseModule {
  constructor() {
    super("TimerModule", {
      commands: ["timer", "pomodoro"],
      callbacks: ["timer"],
      features: [
        "start",
        "stop",
        "pause",
        "resume",
        "pomodoro_start",
        "custom_start",
        "status",
      ],
    });

    // 타이머 상태 관리 (메모리 저장)
    this.userTimers = new Map();

    Logger.info("⏰ TimerModule 초기화 완료");
  }

  // ✅ 표준 액션 등록 패턴 적용
  registerActions() {
    // 타이머 기능별 액션 등록
    this.actionMap.set("start", this.showStartOptions.bind(this));
    this.actionMap.set("stop", this.stopTimer.bind(this));
    this.actionMap.set("pause", this.pauseTimer.bind(this));
    this.actionMap.set("resume", this.resumeTimer.bind(this));
    this.actionMap.set("pomodoro_start", this.startPomodoroTimer.bind(this));
    this.actionMap.set("custom_start", this.showCustomTimerOptions.bind(this));
    this.actionMap.set("status", this.showTimerStatus.bind(this));
  }

  // ✅ 메뉴 데이터 제공 (BaseModule 오버라이드)
  getMenuData(userName) {
    return {
      text: `⏰ **${userName}님의 타이머**\n\n집중력을 높이고 시간을 효과적으로 관리하세요!`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "🍅 포모도로 시작", callback_data: "timer_pomodoro_start" },
            { text: "⏱️ 커스텀 타이머", callback_data: "timer_custom_start" },
          ],
          [
            { text: "▶️ 타이머 시작", callback_data: "timer_start" },
            { text: "⏹️ 타이머 정지", callback_data: "timer_stop" },
          ],
          [
            { text: "⏸️ 일시정지", callback_data: "timer_pause" },
            { text: "▶️ 재개", callback_data: "timer_resume" },
          ],
          [
            { text: "📊 타이머 상태", callback_data: "timer_status" },
            { text: "❓ 도움말", callback_data: "timer_help" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
        ],
      },
    };
  }

  // ========== 타이머 기능 메서드들 ==========

  async showStartOptions(bot, chatId, messageId, userId, userName) {
    try {
      const text = `⏰ **타이머 시작 옵션**\n\n어떤 타이머를 시작하시겠어요?`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🍅 포모도로 (25분)",
              callback_data: "timer_pomodoro_start",
            },
          ],
          [
            { text: "⏱️ 15분", callback_data: "timer_start_15" },
            { text: "⏱️ 30분", callback_data: "timer_start_30" },
          ],
          [
            { text: "⏱️ 45분", callback_data: "timer_start_45" },
            { text: "⏱️ 60분", callback_data: "timer_start_60" },
          ],
          [{ text: "🔧 커스텀 설정", callback_data: "timer_custom_start" }],
          [
            { text: "🔙 타이머 메뉴", callback_data: "timer_menu" },
            { text: "🏠 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`TimerModule showStartOptions 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async startPomodoroTimer(bot, chatId, messageId, userId, userName) {
    try {
      // 25분 포모도로 타이머 시작
      const minutes = 25;
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + minutes * 60 * 1000);

      const timerData = {
        type: "pomodoro",
        duration: minutes,
        startTime: startTime,
        endTime: endTime,
        status: "running",
        paused: false,
        pausedTime: 0,
      };

      this.userTimers.set(userId, timerData);

      const text =
        `🍅 **포모도로 타이머 시작!**\n\n` +
        `⏰ 시간: ${minutes}분\n` +
        `🎯 집중 모드 활성화\n` +
        `⏰ 종료 예정: ${endTime.toLocaleTimeString("ko-KR")}\n\n` +
        `💪 집중해서 작업해보세요!`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getRunningTimerKeyboard(),
      });

      // 타이머 완료 알림 설정 (실제로는 백그라운드 서비스나 스케줄러 필요)
      this.scheduleTimerAlert(bot, chatId, userId, minutes);

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`TimerModule startPomodoroTimer 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showCustomTimerOptions(bot, chatId, messageId, userId, userName) {
    try {
      const text = `🔧 **커스텀 타이머**\n\n원하는 시간을 선택하세요:`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "⏱️ 5분", callback_data: "timer_start_5" },
            { text: "⏱️ 10분", callback_data: "timer_start_10" },
            { text: "⏱️ 15분", callback_data: "timer_start_15" },
          ],
          [
            { text: "⏱️ 20분", callback_data: "timer_start_20" },
            { text: "⏱️ 25분", callback_data: "timer_start_25" },
            { text: "⏱️ 30분", callback_data: "timer_start_30" },
          ],
          [
            { text: "⏱️ 45분", callback_data: "timer_start_45" },
            { text: "⏱️ 60분", callback_data: "timer_start_60" },
            { text: "⏱️ 90분", callback_data: "timer_start_90" },
          ],
          [
            { text: "🔙 타이머 메뉴", callback_data: "timer_menu" },
            { text: "🏠 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`TimerModule showCustomTimerOptions 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async stopTimer(bot, chatId, messageId, userId, userName) {
    try {
      const timerData = this.userTimers.get(userId);

      if (!timerData) {
        const text = `⏹️ **타이머 정지**\n\n현재 실행 중인 타이머가 없습니다.`;

        await this.editMessage(bot, chatId, messageId, text, {
          parse_mode: "Markdown",
          reply_markup: this.getTimerMenuKeyboard(),
        });
        return;
      }

      // 타이머 정지
      this.userTimers.delete(userId);

      const elapsedMinutes = Math.floor(
        (new Date() - timerData.startTime) / (1000 * 60)
      );

      const text =
        `⏹️ **타이머 정지됨**\n\n` +
        `📊 경과 시간: ${elapsedMinutes}분\n` +
        `🎯 수고하셨습니다!`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getTimerMenuKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`TimerModule stopTimer 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async pauseTimer(bot, chatId, messageId, userId, userName) {
    try {
      const timerData = this.userTimers.get(userId);

      if (!timerData || timerData.paused) {
        const text = `⏸️ **일시정지**\n\n일시정지할 수 있는 타이머가 없습니다.`;

        await this.editMessage(bot, chatId, messageId, text, {
          parse_mode: "Markdown",
          reply_markup: this.getTimerMenuKeyboard(),
        });
        return;
      }

      // 타이머 일시정지
      timerData.paused = true;
      timerData.pauseTime = new Date();
      timerData.status = "paused";

      this.userTimers.set(userId, timerData);

      const text = `⏸️ **타이머 일시정지**\n\n타이머가 일시정지되었습니다.\n▶️ 재개 버튼을 눌러 계속하세요.`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getPausedTimerKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`TimerModule pauseTimer 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async resumeTimer(bot, chatId, messageId, userId, userName) {
    try {
      const timerData = this.userTimers.get(userId);

      if (!timerData || !timerData.paused) {
        const text = `▶️ **재개**\n\n재개할 수 있는 타이머가 없습니다.`;

        await this.editMessage(bot, chatId, messageId, text, {
          parse_mode: "Markdown",
          reply_markup: this.getTimerMenuKeyboard(),
        });
        return;
      }

      // 타이머 재개
      const pausedDuration = new Date() - timerData.pauseTime;
      timerData.endTime = new Date(
        timerData.endTime.getTime() + pausedDuration
      );
      timerData.paused = false;
      timerData.status = "running";
      delete timerData.pauseTime;

      this.userTimers.set(userId, timerData);

      const remainingMinutes = Math.ceil(
        (timerData.endTime - new Date()) / (1000 * 60)
      );

      const text =
        `▶️ **타이머 재개**\n\n` +
        `⏰ 남은 시간: 약 ${remainingMinutes}분\n` +
        `💪 다시 집중해보세요!`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getRunningTimerKeyboard(),
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`TimerModule resumeTimer 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  async showTimerStatus(bot, chatId, messageId, userId, userName) {
    try {
      const timerData = this.userTimers.get(userId);

      if (!timerData) {
        const text = `📊 **타이머 상태**\n\n현재 실행 중인 타이머가 없습니다.\n\n새로운 타이머를 시작해보세요!`;

        await this.editMessage(bot, chatId, messageId, text, {
          parse_mode: "Markdown",
          reply_markup: this.getTimerMenuKeyboard(),
        });
        return;
      }

      const now = new Date();
      const elapsedMinutes = Math.floor(
        (now - timerData.startTime) / (1000 * 60)
      );
      const remainingMinutes = Math.ceil(
        (timerData.endTime - now) / (1000 * 60)
      );

      const statusIcon = {
        running: "▶️",
        paused: "⏸️",
        completed: "✅",
      };

      const text =
        `📊 **타이머 상태**\n\n` +
        `${statusIcon[timerData.status]} 상태: ${
          timerData.status === "running"
            ? "실행 중"
            : timerData.status === "paused"
            ? "일시정지"
            : "완료"
        }\n` +
        `🎯 타입: ${timerData.type === "pomodoro" ? "포모도로" : "커스텀"}\n` +
        `⏰ 설정 시간: ${timerData.duration}분\n` +
        `📈 경과 시간: ${elapsedMinutes}분\n` +
        `⏳ 남은 시간: ${
          remainingMinutes > 0 ? remainingMinutes + "분" : "완료!"
        }\n` +
        `🕐 시작 시간: ${timerData.startTime.toLocaleTimeString("ko-KR")}`;

      const keyboard =
        timerData.status === "running"
          ? this.getRunningTimerKeyboard()
          : timerData.status === "paused"
          ? this.getPausedTimerKeyboard()
          : this.getTimerMenuKeyboard();

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      this.updateStats("callback");
    } catch (error) {
      Logger.error(`TimerModule showTimerStatus 오류:`, error);
      await this.handleError(bot, chatId, error);
    }
  }

  // ========== 동적 콜백 처리 (시간별 타이머 시작) ==========

  async handleCallback(bot, callbackQuery, subAction, params) {
    // 동적 타이머 시작 처리 (timer_start_5, timer_start_10 등)
    const startMatch = subAction.match(/^start_(\d+)$/);

    if (startMatch) {
      const minutes = parseInt(startMatch[1]);
      return await this.startCustomTimer(bot, callbackQuery, minutes);
    }

    // 표준 액션은 부모 클래스에서 처리
    return await super.handleCallback(bot, callbackQuery, subAction, params);
  }

  async startCustomTimer(bot, callbackQuery, minutes) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + minutes * 60 * 1000);

      const timerData = {
        type: "custom",
        duration: minutes,
        startTime: startTime,
        endTime: endTime,
        status: "running",
        paused: false,
      };

      this.userTimers.set(userId, timerData);

      const text =
        `⏰ **${minutes}분 타이머 시작!**\n\n` +
        `🎯 집중 모드 활성화\n` +
        `⏰ 종료 예정: ${endTime.toLocaleTimeString("ko-KR")}\n\n` +
        `💪 열심히 해보세요!`;

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: this.getRunningTimerKeyboard(),
      });

      // 타이머 완료 알림 설정
      this.scheduleTimerAlert(bot, chatId, userId, minutes);

      this.updateStats("callback");
      return true;
    } catch (error) {
      Logger.error(`TimerModule startCustomTimer(${minutes}) 오류:`, error);
      await this.handleError(bot, chatId, error);
      return true;
    }
  }

  // ========== 타이머 알림 시스템 ==========

  scheduleTimerAlert(bot, chatId, userId, minutes) {
    // 실제로는 cron job이나 스케줄러를 사용해야 하지만, 여기서는 setTimeout 사용
    const alertTime = minutes * 60 * 1000; // 밀리초로 변환

    setTimeout(async () => {
      try {
        const timerData = this.userTimers.get(userId);

        // 타이머가 여전히 실행 중인지 확인
        if (timerData && timerData.status === "running") {
          await bot.sendMessage(
            chatId,
            `🔔 **타이머 완료!**\n\n` +
              `⏰ ${minutes}분 타이머가 완료되었습니다!\n` +
              `🎉 수고하셨습니다!`,
            { parse_mode: "Markdown" }
          );

          // 타이머 데이터 정리
          this.userTimers.delete(userId);
        }
      } catch (error) {
        Logger.error(`타이머 알림 전송 오류:`, error);
      }
    }, alertTime);
  }

  // ========== 키보드 생성 ==========

  getTimerMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🍅 포모도로", callback_data: "timer_pomodoro_start" },
          { text: "⏱️ 커스텀", callback_data: "timer_custom_start" },
        ],
        [
          { text: "⏰ 타이머 메뉴", callback_data: "timer_menu" },
          { text: "🔙 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };
  }

  getRunningTimerKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "⏸️ 일시정지", callback_data: "timer_pause" },
          { text: "⏹️ 정지", callback_data: "timer_stop" },
        ],
        [
          { text: "📊 상태확인", callback_data: "timer_status" },
          { text: "🔙 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };
  }

  getPausedTimerKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "▶️ 재개", callback_data: "timer_resume" },
          { text: "⏹️ 정지", callback_data: "timer_stop" },
        ],
        [
          { text: "📊 상태확인", callback_data: "timer_status" },
          { text: "🔙 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };
  }

  // ========== 명령어 처리 ==========

  async handleMessage(bot, msg) {
    const {
      chat: { id: chatId },
      from: { id: userId },
      text,
    } = msg;

    if (text && (text.startsWith("/timer") || text.startsWith("/pomodoro"))) {
      await this.handleTimerCommand(bot, msg);
      this.updateStats("command");
      return true;
    }

    return false;
  }

  async handleTimerCommand(bot, msg) {
    const {
      chat: { id: chatId },
      from,
    } = msg;
    const userName = getUserName(from);
    const text = msg.text;

    try {
      if (text.startsWith("/pomodoro")) {
        // 포모도로 타이머 즉시 시작
        await this.startPomodoroTimer(bot, chatId, null, from.id, userName);
      } else {
        // 타이머 메뉴 표시
        const menuData = this.getMenuData(userName);
        await this.sendMessage(bot, chatId, menuData.text, {
          parse_mode: "Markdown",
          reply_markup: menuData.keyboard,
        });
      }
    } catch (error) {
      Logger.error("TimerModule handleTimerCommand 오류:", error);
      await this.sendMessage(bot, chatId, "❌ 타이머를 시작할 수 없습니다.");
    }
  }

  // ✅ 도움말 메시지 오버라이드
  getHelpMessage() {
    return `⏰ **타이머 사용법**

**📱 메뉴 방식:**
/start → ⏰ 타이머 → 원하는 타이머 선택

**⌨️ 명령어 방식:**
/timer - 타이머 메뉴 열기
/pomodoro - 포모도로 타이머 즉시 시작

**🍅 포모도로 기법:**
• 25분 집중 + 5분 휴식
• 집중력 향상에 효과적
• 생산성 증대

**⏱️ 커스텀 타이머:**
• 5분 ~ 90분 자유 설정
• 개인 맞춤 시간 관리
• 다양한 작업에 활용

**🎯 기능:**
• ⏸️ 일시정지/재개
• 📊 실시간 상태 확인
• 🔔 완료 알림

시간 관리의 달인이 되어보세요! 📈`;
  }

  // ========== 초기화 ==========

  async initialize() {
    try {
      // 타이머 데이터 초기화
      this.userTimers.clear();

      await super.initialize();
      Logger.success("✅ TimerModule 초기화 완료");
    } catch (error) {
      Logger.error("❌ TimerModule 초기화 실패:", error);
      throw error;
    }
  }

  // ========== 정리 ==========

  async cleanup() {
    try {
      // 모든 타이머 정리
      this.userTimers.clear();
      Logger.info("⏰ TimerModule 정리 완료");
    } catch (error) {
      Logger.error("TimerModule 정리 오류:", error);
    }
  }
}

module.exports = TimerModule;
