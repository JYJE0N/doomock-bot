// src/modules/TimerModule.js - 완전 리팩토링된 타이머/포모도로 모듈
const BaseModule = require("./BaseModule");
const TimerService = require("../services/TimerService");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 타이머/포모도로 관리 모듈
 * - UI/UX 담당
 * - 사용자 상호작용 처리
 * - TimerService를 통한 데이터 관리
 * - Railway 환경변수 기반 포모도로 설정
 * - 표준 매개변수 체계 완벽 준수
 */
class TimerModule extends BaseModule {
  constructor(bot, options = {}) {
    super("TimerModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
    });

    // TimerService 초기화
    this.timerService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      workDuration: parseInt(process.env.POMODORO_WORK_DURATION) || 25,
      shortBreakDuration: parseInt(process.env.POMODORO_SHORT_BREAK) || 5,
      longBreakDuration: parseInt(process.env.POMODORO_LONG_BREAK) || 15,
      longBreakInterval:
        parseInt(process.env.POMODORO_LONG_BREAK_INTERVAL) || 4,
      refreshInterval: parseInt(process.env.TIMER_REFRESH_INTERVAL) || 30000,
      enableNotifications: process.env.ENABLE_TIMER_NOTIFICATIONS === "true",
      maxRestoreHours: parseInt(process.env.TIMER_MAX_RESTORE_HOURS) || 24,
    };

    // UI 상태 관리
    this.activeRefreshes = new Map(); // 실시간 업데이트 관리

    // 이모지 설정
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

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      this.timerService = new TimerService();
      this.timerService.db = this.db; // DB 연결 전달
      await this.timerService.initialize();

      logger.info("⏰ TimerService 연결 성공");
    } catch (error) {
      logger.error("❌ TimerService 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      help: this.showHelp,
      status: this.showStatus,
      stats: this.showStats,

      // 포모도로 액션들 (표준 콜론 형식)
      "pomodoro:start": this.startPomodoro,
      "pomodoro:complete": this.completePomodoro,
      "pomodoro:break": this.startBreak,

      // 일반 타이머 액션들
      "start:prompt": this.startTimerPrompt,
      "start:5": this.startTimer5,
      "start:10": this.startTimer10,
      "start:15": this.startTimer15,
      "start:30": this.startTimer30,
      "start:custom": this.startCustomTimer,

      // 제어 액션들
      stop: this.stopTimer,
      pause: this.pauseTimer,
      continue: this.continueTimer,

      // UI 업데이트
      refresh: this.refreshStatus,
    });
  }

  /**
   * 🎯 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 사용자 상태 확인
    const userState = this.getUserState(userId);

    // 포모도로 작업명 입력 대기 상태
    if (userState?.action === "waiting_pomodoro_task") {
      await this.handlePomodoroTaskInput(bot, chatId, userId, text);
      return true;
    }

    // 커스텀 타이머 시간 입력 대기 상태
    if (userState?.action === "waiting_timer_duration") {
      await this.handleTimerDurationInput(bot, chatId, userId, text);
      return true;
    }

    // 명령어 처리
    const command = this.extractCommand(text);
    if (command === "timer" || text.trim() === "타이머") {
      await this.sendTimerMenu(bot, chatId);
      return true;
    }

    return false;
  }

  // ===== 🍅 포모도로 액션들 (표준 매개변수 준수) =====

  /**
   * 포모도로 시작
   */
  async startPomodoro(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 기존 타이머 확인
      const existingStatus = this.timerService.getStatus(userId);
      if (existingStatus.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "❌ **이미 실행 중인 타이머가 있습니다**\n\n먼저 현재 타이머를 정지해주세요.",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📊 현재 상태", callback_data: "timer:status" },
                  { text: "⏹️ 정지", callback_data: "timer:stop" },
                ],
                [{ text: "🔙 뒤로", callback_data: "timer:menu" }],
              ],
            },
          }
        );
        return;
      }

      // 포모도로 작업명 입력 요청
      this.setUserState(userId, { action: "waiting_pomodoro_task" });

      const inputText = `🍅 **포모도로 시작**

어떤 작업을 하실 건가요?
작업명을 입력해주세요.

💡 **포모도로 기법**
• ${this.config.workDuration}분 집중 + ${this.config.shortBreakDuration}분 휴식
• ${this.config.longBreakInterval}번째마다 ${this.config.longBreakDuration}분 긴 휴식
• 과학적으로 검증된 생산성 향상 방법

취소하려면 "/cancel" 또는 "취소"를 입력하세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "📝 기본 작업으로 시작",
              callback_data: "timer:pomodoro:start:default",
            },
          ],
          [{ text: "❌ 취소", callback_data: "timer:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, inputText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("포모도로 시작 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 포모도로 완료 처리
   */
  async completePomodoro(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      const result = this.timerService.completePomodoro(userId);

      if (!result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `❌ ${result.error}`,
          show_alert: true,
        });
        return;
      }

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `🎉 ${result.data.message}`,
        show_alert: true,
      });

      // 자동으로 다음 단계 시작 (휴식 또는 새 포모도로)
      if (result.data.nextMode === "break") {
        await this.startBreak(bot, callbackQuery, [], moduleManager);
      } else {
        await this.showMenu(bot, callbackQuery, [], moduleManager);
      }
    } catch (error) {
      logger.error("포모도로 완료 처리 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 처리 중 오류가 발생했습니다.",
        show_alert: true,
      });
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
      from: { id: userId },
    } = callbackQuery;

    try {
      const pomodoroStatus = this.timerService.pomodoroStatus(userId);

      if (!pomodoroStatus.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
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
      const isLongBreak = data.mode === "longBreak";

      const breakText = `${isLongBreak ? "🛋️" : "☕"} **${
        isLongBreak ? "긴 " : ""
      }휴식 시간!**

${
  isLongBreak ? data.duration : this.config.shortBreakDuration
}분간 휴식을 취하세요.

💡 **추천 휴식 활동:**
• 🚶‍♂️ 가벼운 산책
• 🧘‍♀️ 스트레칭  
• 💧 물 마시기
• 👀 눈 운동
• 🌱 심호흡

휴식도 생산성의 일부입니다!

**진행률**: ${data.progressBar}
**남은 시간**: ${data.remainingTime}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "timer:refresh" },
            { text: "⏹️ 정지", callback_data: "timer:stop" },
          ],
          [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, breakText, {
        reply_markup: keyboard,
      });

      // 실시간 업데이트 시작
      this.startAutoRefresh(bot, chatId, messageId, userId);
    } catch (error) {
      logger.error("휴식 시작 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  // ===== ⏰ 일반 타이머 액션들 =====

  /**
   * 타이머 시작 선택 메뉴
   */
  async startTimerPrompt(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const promptText = `⏱️ **일반 타이머**

시간을 선택하거나 직접 입력하세요.

💡 **일반 타이머 특징:**
• 자유로운 시간 설정
• 작업별 소요 시간 측정
• 정확한 한국시간 표시`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "⏱️ 5분", callback_data: "timer:start:5" },
          { text: "⏱️ 10분", callback_data: "timer:start:10" },
        ],
        [
          { text: "⏱️ 15분", callback_data: "timer:start:15" },
          { text: "⏱️ 30분", callback_data: "timer:start:30" },
        ],
        [{ text: "🔧 직접 입력", callback_data: "timer:start:custom" }],
        [{ text: "🔙 뒤로", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, promptText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 5분 타이머 시작
   */
  async startTimer5(bot, callbackQuery, params, moduleManager) {
    await this.startGeneralTimer(bot, callbackQuery, 5, "5분 타이머");
  }

  /**
   * 10분 타이머 시작
   */
  async startTimer10(bot, callbackQuery, params, moduleManager) {
    await this.startGeneralTimer(bot, callbackQuery, 10, "10분 타이머");
  }

  /**
   * 15분 타이머 시작
   */
  async startTimer15(bot, callbackQuery, params, moduleManager) {
    await this.startGeneralTimer(bot, callbackQuery, 15, "15분 타이머");
  }

  /**
   * 30분 타이머 시작
   */
  async startTimer30(bot, callbackQuery, params, moduleManager) {
    await this.startGeneralTimer(bot, callbackQuery, 30, "30분 타이머");
  }

  /**
   * 커스텀 타이머 시작 요청
   */
  async startCustomTimer(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.setUserState(userId, { action: "waiting_timer_duration" });

    const customText = `🔧 **커스텀 타이머**

원하는 시간을 입력해주세요.

📝 **입력 형식:**
• 분 단위: "20", "45분"
• 시간:분: "1:30", "2시간 15분"

예시: 25, 45분, 1:30, 2시간

취소하려면 "/cancel" 또는 "취소"를 입력하세요.`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "timer:menu" }]],
    };

    await this.editMessage(bot, chatId, messageId, customText, {
      reply_markup: keyboard,
    });
  }

  // ===== 📊 상태 표시 액션들 =====

  /**
   * 타이머 메뉴 표시
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from,
    } = callbackQuery;

    const userName = getUserName(from);
    const userId = from.id;

    try {
      // 현재 타이머 상태 확인
      const activeTimer = this.timerService.getStatus(userId);
      const pomodoroSession = this.timerService.pomodoroStatus(userId);
      const userStats = this.timerService.getUserStats(userId);

      let statusInfo = "";
      if (activeTimer.success) {
        const emoji = activeTimer.data.type === "pomodoro" ? "🍅" : "⏱️";
        statusInfo = `\n🔴 **진행 중**: ${emoji} ${activeTimer.data.taskName} (${activeTimer.data.elapsedTime})`;
      }

      // 오늘의 통계 미리보기
      let statsPreview = "";
      if (userStats.success && userStats.data.today.completedPomodoros > 0) {
        const todayPomodoros = userStats.data.today.completedPomodoros;
        const todayWorkTime = userStats.data.today.workTime;
        statsPreview = `\n📊 **오늘**: ${this.emojis.pomodoro}${todayPomodoros}개 완료, ${todayWorkTime} 집중`;
      }

      const menuText = `${this.emojis.timer} **${userName}님의 타이머**

📅 ${TimeHelper.formatDateTime()}${statusInfo}${statsPreview}

🍅 **포모도로**: 과학적으로 검증된 ${this.config.workDuration}분 집중법
⏱️ **일반 타이머**: 자유로운 시간 측정

🎯 **오늘도 집중해서 목표를 달성해보세요!**`;

      // 현재 상태에 따른 키보드
      const keyboard = {
        inline_keyboard: activeTimer.success
          ? [
              [
                { text: "📊 현재 상태", callback_data: "timer:status" },
                { text: "⏹️ 정지", callback_data: "timer:stop" },
              ],
              [
                { text: "📈 내 통계", callback_data: "timer:stats" },
                { text: "❓ 도움말", callback_data: "timer:help" },
              ],
              [{ text: "🔙 메인 메뉴", callback_data: "main:menu" }],
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

      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("타이머 메뉴 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 현재 타이머 상태 표시
   */
  async showStatus(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const status = this.timerService.getStatus(userId);

      if (!status.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `❌ **타이머 없음**\n\n${status.error}`,
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
    } catch (error) {
      logger.error("타이머 상태 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 포모도로 상태 표시 (상세)
   */
  async showPomodoroStatus(bot, chatId, messageId, userId) {
    try {
      const pomodoroStatus = this.timerService.pomodoroStatus(userId);

      if (!pomodoroStatus.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
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
      const modeText =
        data.mode === "work"
          ? "집중 시간"
          : data.mode === "break"
          ? "짧은 휴식"
          : "긴 휴식";
      const modeEmoji = data.modeEmoji;

      let statusText = `${modeEmoji} **${modeText}**\n\n`;
      statusText += `📌 **작업**: ${data.taskName}\n`;
      statusText += `📊 **진행률**: ${data.percentage}% ${data.circularProgress}\n`;
      statusText += `${data.progressBar}\n\n`;
      statusText += `⏱️ **경과**: ${data.elapsedTime} / ${data.duration}분\n`;
      statusText += `⏳ **남은 시간**: ${data.remainingTime}\n`;
      statusText += `🎯 **세션**: ${data.sessionCount}번째\n\n`;
      statusText += `🕐 **시작**: ${data.startTime}\n`;
      statusText += `🏁 **완료 예정**: ${data.completionTime}\n`;

      if (data.isOvertime) {
        statusText += `\n⚠️ **초과**: ${data.overtimeMinutes}분 오버`;
      }

      statusText += `\n📅 **현재 시간**: ${data.currentTime}`;

      const keyboard = {
        inline_keyboard: data.isComplete
          ? [
              [
                {
                  text: "🎉 완료 처리",
                  callback_data: "timer:pomodoro:complete",
                },
                { text: "⏹️ 정지", callback_data: "timer:stop" },
              ],
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ]
          : [
              [
                { text: "🔄 새로고침", callback_data: "timer:refresh" },
                { text: "⏹️ 정지", callback_data: "timer:stop" },
              ],
              [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
            ],
      };

      await this.editMessage(bot, chatId, messageId, statusText, {
        reply_markup: keyboard,
      });

      // 완료되지 않은 경우 실시간 업데이트 시작
      if (!data.isComplete) {
        this.startAutoRefresh(bot, chatId, messageId, userId);
      }
    } catch (error) {
      logger.error("포모도로 상태 표시 오류:", error);
      throw error;
    }
  }

  /**
   * 일반 타이머 상태 표시
   */
  async showGeneralTimerStatus(bot, chatId, messageId, userId, statusData) {
    const statusText = `⏱️ **일반 타이머 진행 중**

📌 **작업**: ${statusData.taskName}
⏱️ **경과 시간**: ${statusData.elapsedTime}
🕐 **시작 시간**: ${statusData.startTime}
📅 **현재 시간**: ${statusData.currentTime}

🚀 **계속 진행 중입니다!**`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 새로고침", callback_data: "timer:refresh" },
          { text: "⏹️ 정지", callback_data: "timer:stop" },
        ],
        [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, statusText, {
      reply_markup: keyboard,
    });

    // 실시간 업데이트 시작
    this.startAutoRefresh(bot, chatId, messageId, userId);
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
      from: { id: userId },
    } = callbackQuery;

    try {
      const stats = this.timerService.getUserStats(userId);

      if (!stats.success) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          `❌ **통계 없음**\n\n${stats.error}`,
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

      const data = stats.data;

      const statsText = `📊 **타이머 통계**

**🎯 오늘의 성과**
• 완료한 포모도로: ${this.emojis.pomodoro} ${data.today.completedPomodoros}개
• 집중 시간: ${data.today.workTime}
• 휴식 시간: ${data.today.breakTime}
• 총 활동 시간: ${data.today.totalTime}

**📈 주간 통계**
• 이번주 포모도로: ${data.week.completedPomodoros}개
• 주간 집중 시간: ${data.week.workTime}
• 평균 일일 포모도로: ${data.week.averageDaily}개

**🏆 전체 기록**
• 총 포모도로: ${data.total.completedPomodoros}개
• 총 집중 시간: ${data.total.workTime}
• 평균 완료 시간: ${data.total.averageCompletionTime}
• 최장 집중 세션: ${data.total.longestSession}

**🎖️ 레벨 정보**
• 현재 레벨: ${data.level.current}
• 다음 레벨까지: ${data.level.nextLevelProgress}
• 일일 목표: ${data.daily.target}개 (달성률: ${data.daily.achievementRate}%)

최근 업데이트: ${TimeHelper.formatDateTime()}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 새로고침", callback_data: "timer:stats" }],
          [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, statsText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("통계 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const helpText = `⏰ **타이머 사용법**

📅 ${TimeHelper.formatDateTime()}

🍅 **포모도로 기법 (추천)**
• ${this.config.workDuration}분 집중 + ${
      this.config.shortBreakDuration
    }분 휴식의 과학적 방법
• ${this.config.longBreakInterval}세션마다 긴 휴식 (${
      this.config.longBreakDuration
    }분)
• 시각적 진행률과 자동 전환
• 실시간 상태 업데이트
• 성취 통계 및 레벨 시스템

⏱️ **일반 타이머**
• 자유로운 시간 측정
• 작업별 소요 시간 기록  
• 정확한 한국시간 표시

🎯 **특별 기능**
• Railway 서버 재시작 시 자동 복원
• 게이미피케이션 요소
• 사용자별 개인 통계
• 실시간 진행률 표시
• 환경변수 기반 설정

📱 /start → ⏰ 타이머에서 시작하세요!`;

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

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎮 제어 액션들 =====

  /**
   * 타이머 정지
   */
  async stopTimer(bot, callbackQuery, params, moduleManager) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      const result = this.timerService.stopTimer(userId);

      if (!result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `❌ ${result.error}`,
          show_alert: true,
        });
        return;
      }

      // 자동 새로고침 중지
      this.stopAutoRefresh(userId);

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `⏹️ 타이머가 정지되었습니다.`,
        show_alert: false,
      });

      // 메뉴로 돌아가기
      await this.showMenu(bot, callbackQuery, [], moduleManager);
    } catch (error) {
      logger.error("타이머 정지 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 정지 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * 상태 새로고침
   */
  async refreshStatus(bot, callbackQuery, params, moduleManager) {
    // 단순히 현재 상태를 다시 표시
    await this.showStatus(bot, callbackQuery, params, moduleManager);
  }

  // ===== 🎯 입력 처리 메서드들 =====

  /**
   * 포모도로 작업명 입력 처리
   */
  async handlePomodoroTaskInput(bot, chatId, userId, text) {
    // 상태 초기화
    this.clearUserState(userId);

    // 취소 확인
    if (text.toLowerCase() === "/cancel" || text === "취소") {
      await this.sendMessage(
        bot,
        chatId,
        "✅ 포모도로 시작이 취소되었습니다.",
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

    try {
      // 포모도로 시작
      const result = await this.timerService.startPomodoro(userId, text);

      if (!result.success) {
        await this.sendError(bot, chatId, result.error);
        return;
      }

      const data = result.data;
      const successText = `🍅 **포모도로 시작!**

📝 **작업**: ${data.taskName}
⏱️ **집중 시간**: ${data.duration}분
🎯 **세션**: ${data.sessionCount}번째
🕐 **시작 시간**: ${data.startTime}

🔥 **집중해서 목표를 달성해보세요!**`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 현재 상태", callback_data: "timer:status" },
            { text: "⏹️ 정지", callback_data: "timer:stop" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, successText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("포모도로 작업명 입력 처리 오류:", error);
      await this.sendError(
        bot,
        chatId,
        "포모도로 시작 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 타이머 시간 입력 처리
   */
  async handleTimerDurationInput(bot, chatId, userId, text) {
    // 상태 초기화
    this.clearUserState(userId);

    // 취소 확인
    if (text.toLowerCase() === "/cancel" || text === "취소") {
      await this.sendMessage(bot, chatId, "✅ 타이머 시작이 취소되었습니다.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 타이머 메뉴", callback_data: "timer:menu" }],
          ],
        },
      });
      return;
    }

    try {
      // 시간 파싱
      const minutes = this.parseTimeInput(text);

      if (!minutes || minutes < 1 || minutes > 480) {
        // 최대 8시간
        await this.sendError(
          bot,
          chatId,
          "올바른 시간을 입력해주세요. (1분 ~ 8시간)"
        );
        return;
      }

      // 일반 타이머 시작
      const taskName = `${minutes}분 타이머`;
      const result = await this.timerService.startTimer(
        userId,
        taskName,
        minutes
      );

      if (!result.success) {
        await this.sendError(bot, chatId, result.error);
        return;
      }

      const successText = `⏱️ **타이머 시작!**

📝 **작업**: ${taskName}
⏱️ **설정 시간**: ${minutes}분
🕐 **시작 시간**: ${result.data.startTime}

⏰ **시간이 다 되면 알려드릴게요!**`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 현재 상태", callback_data: "timer:status" },
            { text: "⏹️ 정지", callback_data: "timer:stop" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, successText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("타이머 시간 입력 처리 오류:", error);
      await this.sendError(bot, chatId, "타이머 시작 중 오류가 발생했습니다.");
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 일반 타이머 시작 공통 로직
   */
  async startGeneralTimer(bot, callbackQuery, minutes, taskName) {
    const {
      from: { id: userId },
    } = callbackQuery;

    try {
      const result = await this.timerService.startTimer(
        userId,
        taskName,
        minutes
      );

      if (!result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `❌ ${result.error}`,
          show_alert: true,
        });
        return;
      }

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `⏱️ ${taskName} 시작!`,
        show_alert: false,
      });

      // 상태 표시로 전환
      await this.showStatus(bot, callbackQuery, [], null);
    } catch (error) {
      logger.error("일반 타이머 시작 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 타이머 시작 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * 시간 입력 파싱
   */
  parseTimeInput(input) {
    if (!input || typeof input !== "string") return null;

    const text = input.trim().toLowerCase();

    // 분 단위 입력 (예: "25", "25분")
    const minuteMatch = text.match(/^(\d+)(?:분?)?$/);
    if (minuteMatch) {
      return parseInt(minuteMatch[1]);
    }

    // 시간:분 형식 (예: "1:30", "2:15")
    const timeMatch = text.match(/^(\d+):(\d+)$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      if (minutes < 60) {
        return hours * 60 + minutes;
      }
    }

    // 시간 단위 (예: "1시간", "2시간 30분")
    const hourMatch = text.match(/^(\d+)시간(?:\s*(\d+)분?)?$/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
      const minutes = hourMatch[2] ? parseInt(hourMatch[2]) : 0;
      return hours * 60 + minutes;
    }

    return null;
  }

  /**
   * 실시간 업데이트 시작
   */
  startAutoRefresh(bot, chatId, messageId, userId) {
    // 기존 새로고침 중지
    this.stopAutoRefresh(userId);

    const refreshInterval = setInterval(async () => {
      try {
        // 타이머 상태 확인
        const status = this.timerService.getStatus(userId);
        if (!status.success) {
          this.stopAutoRefresh(userId);
          return;
        }

        // 상태에 따라 업데이트
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
      } catch (error) {
        logger.error("자동 새로고침 오류:", error);
        this.stopAutoRefresh(userId);
      }
    }, this.config.refreshInterval);

    this.activeRefreshes.set(userId, refreshInterval);
  }

  /**
   * 실시간 업데이트 중지
   */
  stopAutoRefresh(userId) {
    const refreshInterval = this.activeRefreshes.get(userId);
    if (refreshInterval) {
      clearInterval(refreshInterval);
      this.activeRefreshes.delete(userId);
    }
  }

  /**
   * 타이머 메뉴 전송 (명령어용)
   */
  async sendTimerMenu(bot, chatId) {
    try {
      const text = `⏰ **타이머 관리**

생산성을 높이는 타이머를 사용해보세요!

🍅 **포모도로**: 과학적 집중법
⏱️ **일반 타이머**: 자유로운 시간 측정

무엇을 하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🍅 포모도로 시작", callback_data: "timer:pomodoro:start" },
            { text: "⏱️ 일반 타이머", callback_data: "timer:start:prompt" },
          ],
          [
            { text: "📈 내 통계", callback_data: "timer:stats" },
            { text: "❓ 도움말", callback_data: "timer:help" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      };

      await this.sendMessage(bot, chatId, text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("타이머 메뉴 전송 오류:", error);
      await this.sendError(bot, chatId, "메뉴 표시 중 오류가 발생했습니다.");
    }
  }

  /**
   * 에러 처리
   */
  async handleError(bot, callbackQuery, error) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      await this.editMessage(
        bot,
        chatId,
        messageId,
        "❌ **오류 발생**\n\n처리 중 문제가 발생했습니다.\n잠시 후 다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 다시 시도", callback_data: "timer:menu" }],
              [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
            ],
          },
        }
      );
    } catch (editError) {
      logger.error("에러 메시지 표시 실패:", editError);
    }
  }

  /**
   * 모듈 종료 시 정리
   */
  async shutdown() {
    // 모든 자동 새로고침 중지
    for (const userId of this.activeRefreshes.keys()) {
      this.stopAutoRefresh(userId);
    }

    logger.info("🛑 TimerModule 정리 완료");
  }
}

module.exports = TimerModule;
