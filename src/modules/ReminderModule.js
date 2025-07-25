// src/modules/ReminderModule.js - 완전 리팩토링된 리마인더 모듈
const BaseModule = require("./BaseModule");
const ReminderService = require("../services/ReminderService");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 리마인더 관리 모듈
 * - UI/UX 담당
 * - 사용자 상호작용 처리
 * - ReminderService를 통한 알림 관리
 * - 분/시간 단위 리마인더 지원
 * - 표준 매개변수 체계 완벽 준수
 */
class ReminderModule extends BaseModule {
  constructor(bot, options = {}) {
    super("ReminderModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
    });

    // ReminderService 초기화
    this.reminderService = null;

    // Railway 환경변수 기반 설정
    this.config = {
      maxReminders: parseInt(process.env.MAX_REMINDERS_PER_USER) || 20,
      minMinutes: parseInt(process.env.MIN_REMINDER_MINUTES) || 1,
      maxMinutes: parseInt(process.env.MAX_REMINDER_MINUTES) || 1440, // 24시간
      enableVoiceReminders: process.env.ENABLE_VOICE_REMINDERS === "true",
    };

    // 리마인더 유형별 설정
    this.reminderTypes = {
      minutes: {
        name: "분 단위",
        icon: "⏰",
        description: "N분 후 알림",
        examples: ["30", "60", "120"],
      },
      time: {
        name: "시간 지정",
        icon: "🕐",
        description: "특정 시간에 알림",
        examples: ["14:30", "09:00", "18:00"],
      },
      recurring: {
        name: "반복 알림",
        icon: "🔄",
        description: "매일/매주 반복",
        examples: ["매일 09:00", "매주 월요일 10:00"],
      },
    };

    // 빠른 설정 옵션
    this.quickOptions = [
      { text: "⏰ 5분 후", minutes: 5 },
      { text: "⏰ 10분 후", minutes: 10 },
      { text: "⏰ 30분 후", minutes: 30 },
      { text: "⏰ 1시간 후", minutes: 60 },
      { text: "🕐 점심시간", time: "12:00" },
      { text: "🕕 퇴근시간", time: "18:00" },
    ];

    logger.info("⏰ ReminderModule 생성됨");
  }

  /**
   * 🎯 모듈 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      this.reminderService = new ReminderService();
      this.reminderService.db = this.db; // DB 연결 전달
      await this.reminderService.initialize();

      logger.info("⏰ ReminderService 연결 성공");
    } catch (error) {
      logger.error("❌ ReminderService 초기화 실패:", error);
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

      // 리마인더 생성
      create: this.startReminderCreation,
      "create:minutes": this.createMinutesReminder,
      "create:time": this.createTimeReminder,
      "create:custom": this.startCustomReminder,

      // 빠른 설정
      "quick:5": this.setQuick5Minutes,
      "quick:10": this.setQuick10Minutes,
      "quick:30": this.setQuick30Minutes,
      "quick:60": this.setQuick60Minutes,
      "quick:lunch": this.setQuickLunch,
      "quick:home": this.setQuickHome,

      // 리마인더 관리
      list: this.showReminderList,
      "cancel:all": this.cancelAllReminders,

      // 개별 리마인더 관리 (동적)
      cancel: this.cancelReminder,

      // 설정 및 기타
      stats: this.showStats,
      settings: this.showSettings,
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

    // 커스텀 리마인더 입력 대기 상태
    if (userState?.action === "waiting_reminder_input") {
      await this.handleReminderInput(bot, chatId, userId, text);
      return true;
    }

    // 리마인더 명령어 처리
    if (text.startsWith("/remind")) {
      await this.handleReminderCommand(bot, chatId, userId, text);
      return true;
    }

    // 리마인더 단축 명령어
    const command = this.extractCommand(text);
    if (
      command === "reminder" ||
      command === "알림" ||
      text.trim() === "리마인더"
    ) {
      await this.sendReminderMenu(bot, chatId);
      return true;
    }

    return false;
  }

  // ===== ⏰ 리마인더 메뉴 액션들 (표준 매개변수 준수) =====

  /**
   * 리마인더 메뉴 표시
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
      // 현재 활성 리마인더 개수 조회
      const activeReminders = await this.reminderService.getActiveReminders(
        chatId
      );
      const reminderCount = activeReminders.length;

      // 다음 리마인더 정보
      let nextReminderInfo = "";
      if (reminderCount > 0) {
        const nextReminder = activeReminders.sort(
          (a, b) => new Date(a.targetTime) - new Date(b.targetTime)
        )[0];
        const timeLeft = TimeHelper.getTimeUntil(nextReminder.targetTime);
        nextReminderInfo = `\n🔔 **다음 알림**: ${nextReminder.text} (${timeLeft})`;
      }

      const menuText = `⏰ **${userName}님의 리마인더**

📅 ${TimeHelper.formatDateTime()}

**현재 상태:**
• 활성 리마인더: ${reminderCount}개 / ${
        this.config.maxReminders
      }개${nextReminderInfo}

**리마인더 설정:**
• ⏰ 분 단위: N분 후 알림
• 🕐 시간 지정: 특정 시간에 알림
• 🚀 빠른 설정: 자주 사용하는 시간

언제 알림을 받으시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "⏰ 분 단위", callback_data: "reminder:create:minutes" },
            { text: "🕐 시간 지정", callback_data: "reminder:create:time" },
          ],
          [
            { text: "🚀 빠른 설정", callback_data: "reminder:create" },
            { text: "✏️ 직접 입력", callback_data: "reminder:create:custom" },
          ],
          [
            { text: "📋 목록 보기", callback_data: "reminder:list" },
            { text: "📊 통계", callback_data: "reminder:stats" },
          ],
          [
            { text: "❓ 도움말", callback_data: "reminder:help" },
            { text: "⚙️ 설정", callback_data: "reminder:settings" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, menuText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("리마인더 메뉴 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 빠른 설정 메뉴 표시
   */
  async startReminderCreation(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      const quickText = `🚀 **빠른 리마인더 설정**

자주 사용하는 시간으로 바로 설정하세요!

아래 버튼을 누르면 알림 내용을 입력하는 단계로 넘어갑니다.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "⏰ 5분 후", callback_data: "reminder:quick:5" },
            { text: "⏰ 10분 후", callback_data: "reminder:quick:10" },
          ],
          [
            { text: "⏰ 30분 후", callback_data: "reminder:quick:30" },
            { text: "⏰ 1시간 후", callback_data: "reminder:quick:60" },
          ],
          [
            {
              text: "🕐 점심시간 (12:00)",
              callback_data: "reminder:quick:lunch",
            },
            {
              text: "🕕 퇴근시간 (18:00)",
              callback_data: "reminder:quick:home",
            },
          ],
          [{ text: "🔙 리마인더 메뉴", callback_data: "reminder:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, quickText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("빠른 설정 메뉴 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 분 단위 리마인더 생성
   */
  async createMinutesReminder(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.setUserState(userId, {
      action: "waiting_reminder_input",
      type: "minutes",
      step: "time",
    });

    const minutesText = `⏰ **분 단위 리마인더**

몇 분 후에 알림을 받으시겠습니까?

📝 **입력 방법:**
• 숫자만 입력: "30" (30분 후)
• 범위: ${this.config.minMinutes}분 ~ ${this.config.maxMinutes}분

**예시:**
• 5 - 5분 후 알림
• 30 - 30분 후 알림  
• 120 - 2시간 후 알림

취소하려면 "/cancel" 또는 "취소"를 입력하세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "5분", callback_data: "reminder:quick:5" },
          { text: "10분", callback_data: "reminder:quick:10" },
          { text: "30분", callback_data: "reminder:quick:30" },
        ],
        [{ text: "❌ 취소", callback_data: "reminder:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, minutesText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 시간 지정 리마인더 생성
   */
  async createTimeReminder(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.setUserState(userId, {
      action: "waiting_reminder_input",
      type: "time",
      step: "time",
    });

    const timeText = `🕐 **시간 지정 리마인더**

언제 알림을 받으시겠습니까?

📝 **입력 형식:**
• HH:MM 형식: "14:30" (오후 2시 30분)
• 24시간 형식 사용

**예시:**
• 09:00 - 오전 9시
• 14:30 - 오후 2시 30분
• 18:00 - 오후 6시

⏰ **참고:** 현재 시간이 지난 경우 다음 날로 설정됩니다.

취소하려면 "/cancel" 또는 "취소"를 입력하세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "09:00", callback_data: "reminder:quick:9" },
          { text: "12:00", callback_data: "reminder:quick:lunch" },
          { text: "18:00", callback_data: "reminder:quick:home" },
        ],
        [{ text: "❌ 취소", callback_data: "reminder:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, timeText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 커스텀 리마인더 시작
   */
  async startCustomReminder(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.setUserState(userId, {
      action: "waiting_reminder_input",
      type: "custom",
      step: "full",
    });

    const customText = `✏️ **직접 리마인더 입력**

리마인더 명령어를 직접 입력하세요.

📝 **입력 형식:**
• \`/remind [시간] [내용]\`

**예시:**
• \`/remind 30 독서하기\` - 30분 후 "독서하기" 알림
• \`/remind 14:30 회의 시작\` - 오후 2시 30분에 "회의 시작" 알림
• \`/remind 60 운동시간\` - 1시간 후 "운동시간" 알림

⚡ **팁:** /remind 없이 "30 독서하기" 형태로도 입력 가능합니다.

취소하려면 "/cancel" 또는 "취소"를 입력하세요.`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "reminder:menu" }]],
    };

    await this.editMessage(bot, chatId, messageId, customText, {
      reply_markup: keyboard,
    });
  }

  // ===== 🚀 빠른 설정 액션들 =====

  /**
   * 5분 후 리마인더
   */
  async setQuick5Minutes(bot, callbackQuery, params, moduleManager) {
    await this.setQuickReminder(
      bot,
      callbackQuery,
      { minutes: 5 },
      moduleManager
    );
  }

  /**
   * 10분 후 리마인더
   */
  async setQuick10Minutes(bot, callbackQuery, params, moduleManager) {
    await this.setQuickReminder(
      bot,
      callbackQuery,
      { minutes: 10 },
      moduleManager
    );
  }

  /**
   * 30분 후 리마인더
   */
  async setQuick30Minutes(bot, callbackQuery, params, moduleManager) {
    await this.setQuickReminder(
      bot,
      callbackQuery,
      { minutes: 30 },
      moduleManager
    );
  }

  /**
   * 1시간 후 리마인더
   */
  async setQuick60Minutes(bot, callbackQuery, params, moduleManager) {
    await this.setQuickReminder(
      bot,
      callbackQuery,
      { minutes: 60 },
      moduleManager
    );
  }

  /**
   * 점심시간 리마인더
   */
  async setQuickLunch(bot, callbackQuery, params, moduleManager) {
    await this.setQuickReminder(
      bot,
      callbackQuery,
      { time: "12:00" },
      moduleManager
    );
  }

  /**
   * 퇴근시간 리마인더
   */
  async setQuickHome(bot, callbackQuery, params, moduleManager) {
    await this.setQuickReminder(
      bot,
      callbackQuery,
      { time: "18:00" },
      moduleManager
    );
  }

  /**
   * 빠른 리마인더 설정 공통 로직
   */
  async setQuickReminder(bot, callbackQuery, timeConfig, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      // 사용자 상태 설정 (리마인더 내용 입력 대기)
      this.setUserState(userId, {
        action: "waiting_reminder_input",
        type: "quick",
        step: "content",
        timeConfig: timeConfig,
      });

      let timeDisplay = "";
      if (timeConfig.minutes) {
        timeDisplay = `${timeConfig.minutes}분 후`;
      } else if (timeConfig.time) {
        timeDisplay = `${timeConfig.time}`;
      }

      const contentText = `⏰ **${timeDisplay} 리마인더**

무엇을 알려드릴까요?

📝 **리마인더 내용을 입력하세요:**

**예시:**
• 독서하기
• 회의 준비
• 물 마시기
• 스트레칭 시간

취소하려면 "/cancel" 또는 "취소"를 입력하세요.`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "❌ 취소", callback_data: "reminder:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, contentText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("빠른 리마인더 설정 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  // ===== 📋 리마인더 관리 액션들 =====

  /**
   * 리마인더 목록 표시
   */
  async showReminderList(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      const activeReminders = await this.reminderService.getActiveReminders(
        chatId
      );

      if (activeReminders.length === 0) {
        await this.editMessage(
          bot,
          chatId,
          messageId,
          "📭 **설정된 리마인더가 없습니다**\n\n새로운 리마인더를 설정해보세요!",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "➕ 리마인더 추가",
                    callback_data: "reminder:create",
                  },
                ],
                [{ text: "🔙 리마인더 메뉴", callback_data: "reminder:menu" }],
              ],
            },
          }
        );
        return;
      }

      // 리마인더 목록 정렬 (시간순)
      const sortedReminders = activeReminders.sort(
        (a, b) => new Date(a.targetTime) - new Date(b.targetTime)
      );

      let listText = `📋 **활성 리마인더 목록** (${activeReminders.length}개)\n\n`;

      sortedReminders.forEach((reminder, index) => {
        const timeLeft = TimeHelper.getTimeUntil(reminder.targetTime);
        const targetTime = TimeHelper.formatDateTime(reminder.targetTime);

        listText += `${index + 1}. **${reminder.text}**\n`;
        listText += `   ⏰ ${targetTime}\n`;
        listText += `   ⏳ ${timeLeft}\n\n`;
      });

      // 개별 취소 버튼 생성 (최대 5개까지)
      const cancelButtons = [];
      const maxButtons = Math.min(sortedReminders.length, 5);

      for (let i = 0; i < maxButtons; i += 2) {
        const row = [];

        // 첫 번째 버튼
        row.push({
          text: `❌ ${i + 1}`,
          callback_data: `reminder:cancel:${sortedReminders[i].id}`,
        });

        // 두 번째 버튼 (있으면)
        if (i + 1 < maxButtons) {
          row.push({
            text: `❌ ${i + 2}`,
            callback_data: `reminder:cancel:${sortedReminders[i + 1].id}`,
          });
        }

        cancelButtons.push(row);
      }

      const keyboard = {
        inline_keyboard: [
          ...cancelButtons,
          [{ text: "🗑️ 모두 삭제", callback_data: "reminder:cancel:all" }],
          [{ text: "🔙 리마인더 메뉴", callback_data: "reminder:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, listText, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("리마인더 목록 표시 오류:", error);
      await this.handleError(bot, callbackQuery, error);
    }
  }

  /**
   * 개별 리마인더 취소
   */
  async cancelReminder(bot, callbackQuery, params, moduleManager) {
    const reminderId = params[0];

    if (!reminderId) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 리마인더 ID를 찾을 수 없습니다.",
        show_alert: true,
      });
      return;
    }

    try {
      const result = await this.reminderService.cancelReminder(
        parseInt(reminderId)
      );

      if (result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "🗑️ 리마인더가 취소되었습니다.",
          show_alert: false,
        });

        // 목록 새로고침
        await this.showReminderList(bot, callbackQuery, [], moduleManager);
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: result.message,
          show_alert: true,
        });
      }
    } catch (error) {
      logger.error("리마인더 취소 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 취소 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * 모든 리마인더 취소
   */
  async cancelAllReminders(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
      },
    } = callbackQuery;

    try {
      const result = await this.reminderService.cancelAllReminders(chatId);

      if (result.success) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `🗑️ ${result.count}개의 리마인더가 모두 취소되었습니다.`,
          show_alert: true,
        });

        // 메뉴로 돌아가기
        await this.showMenu(bot, callbackQuery, [], moduleManager);
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: result.message,
          show_alert: true,
        });
      }
    } catch (error) {
      logger.error("모든 리마인더 취소 오류:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ 취소 중 오류가 발생했습니다.",
        show_alert: true,
      });
    }
  }

  /**
   * 리마인더 통계 표시
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    try {
      const stats = await this.reminderService.getUserStats(chatId);

      const statsText = `📊 **리마인더 통계**

**현재 상태:**
• 활성 리마인더: ${stats.active}개
• 최대 설정 가능: ${this.config.maxReminders}개
• 사용률: ${Math.round((stats.active / this.config.maxReminders) * 100)}%

**전체 기록:**
• 총 생성: ${stats.totalCreated}개
• 완료된 알림: ${stats.completed}개
• 취소된 알림: ${stats.cancelled}개
• 성공률: ${stats.successRate}%

**이번 달 활동:**
• 이번 달 생성: ${stats.thisMonth.created}개
• 이번 달 완료: ${stats.thisMonth.completed}개
• 평균 일일 알림: ${stats.dailyAverage}개

**자주 사용하는 시간:**
• 가장 많이 설정한 시간: ${stats.mostUsedTime}
• 평균 알림 간격: ${stats.averageInterval}

최근 업데이트: ${TimeHelper.formatDateTime()}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 새로고침", callback_data: "reminder:stats" }],
          [{ text: "🔙 리마인더 메뉴", callback_data: "reminder:menu" }],
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

    const helpText = `❓ **리마인더 사용법**

📅 ${TimeHelper.formatDateTime()}

⏰ **기본 사용법:**
원하는 시간에 알림을 받을 수 있습니다.

**📝 명령어 형식:**
• \`/remind [시간] [내용]\`

**⏰ 시간 설정 방법:**
• **분 단위**: \`30\` (30분 후)
• **시간 지정**: \`14:30\` (오후 2시 30분)

**💡 사용 예시:**
• \`/remind 30 독서하기\` - 30분 후 "독서하기" 알림
• \`/remind 14:30 회의 시작\` - 오후 2시 30분에 "회의 시작" 알림
• \`/remind 60 운동시간\` - 1시간 후 "운동시간" 알림

**🚀 빠른 설정:**
메뉴에서 자주 사용하는 시간으로 바로 설정 가능합니다.

**📋 관리 기능:**
• 활성 리마인더 목록 확인
• 개별 또는 전체 취소
• 사용 통계 확인

**⚙️ 제한사항:**
• 최대 ${this.config.maxReminders}개까지 동시 설정 가능
• ${this.config.minMinutes}분 ~ ${this.config.maxMinutes}분 범위
• 과거 시간 설정 시 다음 날로 자동 조정

**🎯 팁:**
• 구체적인 내용으로 설정하면 더 효과적입니다
• 정기적인 활동에 활용해보세요 (물 마시기, 스트레칭 등)`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "➕ 리마인더 추가", callback_data: "reminder:create" },
          { text: "📋 목록 보기", callback_data: "reminder:list" },
        ],
        [
          { text: "🔙 리마인더 메뉴", callback_data: "reminder:menu" },
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      reply_markup: keyboard,
    });
  }

  /**
   * 설정 메뉴 표시
   */
  async showSettings(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const settingsText = `⚙️ **리마인더 설정**

**현재 설정:**
• 최대 리마인더: ${this.config.maxReminders}개
• 최소 시간: ${this.config.minMinutes}분
• 최대 시간: ${this.config.maxMinutes}분 (${Math.floor(
      this.config.maxMinutes / 60
    )}시간)
• 음성 알림: ${this.config.enableVoiceReminders ? "활성화" : "비활성화"}

**알림 방식:**
• 텍스트 메시지: ✅ 항상 활성화
• 음성 알림: ${this.config.enableVoiceReminders ? "✅ 활성화" : "❌ 비활성화"}

**시간 설정:**
• 한국 표준시(KST) 기준
• 24시간 형식 사용
• 과거 시간 설정 시 다음 날 자동 조정

이 설정들은 Railway 환경변수로 관리됩니다.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 리마인더 메뉴", callback_data: "reminder:menu" }],
      ],
    };

    await this.editMessage(bot, chatId, messageId, settingsText, {
      reply_markup: keyboard,
    });
  }

  // ===== 🎯 입력 처리 메서드들 =====

  /**
   * 리마인더 입력 처리
   */
  async handleReminderInput(bot, chatId, userId, text) {
    const userState = this.getUserState(userId);

    // 상태 초기화
    this.clearUserState(userId);

    // 취소 확인
    if (text.toLowerCase() === "/cancel" || text === "취소") {
      await this.sendMessage(
        bot,
        chatId,
        "✅ 리마인더 설정이 취소되었습니다.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 리마인더 메뉴", callback_data: "reminder:menu" }],
            ],
          },
        }
      );
      return;
    }

    try {
      let reminderData;

      if (userState.step === "full" || userState.type === "custom") {
        // 전체 명령어 파싱
        const fullCommand = text.startsWith("/remind")
          ? text
          : `/remind ${text}`;
        reminderData = await this.reminderService.parseReminderCommand(
          fullCommand
        );
      } else if (userState.step === "content" && userState.timeConfig) {
        // 빠른 설정 - 내용만 입력받음
        const timeConfig = userState.timeConfig;
        let timeParam;

        if (timeConfig.minutes) {
          timeParam = timeConfig.minutes.toString();
        } else if (timeConfig.time) {
          timeParam = timeConfig.time;
        }

        const fullCommand = `/remind ${timeParam} ${text}`;
        reminderData = await this.reminderService.parseReminderCommand(
          fullCommand
        );
      } else if (userState.step === "time") {
        // 시간만 입력받는 경우 - 다음 단계로
        const timeResult = await this.reminderService.parseTime(text);

        if (!timeResult.success) {
          await this.sendError(bot, chatId, timeResult.message);
          return;
        }

        // 내용 입력 단계로 이동
        this.setUserState(userId, {
          action: "waiting_reminder_input",
          type: userState.type,
          step: "content",
          timeData: timeResult,
        });

        await this.sendMessage(
          bot,
          chatId,
          `⏰ **${text} 리마인더**\n\n리마인더 내용을 입력해주세요:\n\n**예시:** 독서하기, 회의 준비, 물 마시기`
        );
        return;
      } else if (userState.step === "content" && userState.timeData) {
        // 시간은 이미 설정됨, 내용만 합치기
        const timeParam = userState.timeData.time;
        const fullCommand = `/remind ${timeParam} ${text}`;
        reminderData = await this.reminderService.parseReminderCommand(
          fullCommand
        );
      }

      if (!reminderData.success) {
        await this.sendError(bot, chatId, reminderData.message);
        return;
      }

      // 리마인더 설정
      const result = await this.reminderService.setReminder(
        this.bot,
        chatId,
        reminderData.data
      );

      if (result.success) {
        const successText = `✅ **리마인더가 설정되었습니다!**

📝 **내용**: ${reminderData.data.text}
⏰ **알림 시간**: ${TimeHelper.formatDateTime(result.targetTime)}
🆔 **리마인더 ID**: #${result.reminderId}

${reminderData.message}`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "📋 목록 보기", callback_data: "reminder:list" },
              { text: "➕ 추가 설정", callback_data: "reminder:create" },
            ],
            [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
          ],
        };

        await this.sendMessage(bot, chatId, successText, {
          reply_markup: keyboard,
        });
      } else {
        await this.sendError(bot, chatId, "리마인더 설정에 실패했습니다.");
      }
    } catch (error) {
      logger.error("리마인더 입력 처리 오류:", error);
      await this.sendError(
        bot,
        chatId,
        "리마인더 처리 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 리마인더 명령어 처리
   */
  async handleReminderCommand(bot, chatId, userId, text) {
    try {
      // 명령어 파싱
      const reminderData = await this.reminderService.parseReminderCommand(
        text
      );

      if (!reminderData.success) {
        await this.sendError(bot, chatId, reminderData.message);
        return;
      }

      // 리마인더 설정
      const result = await this.reminderService.setReminder(
        this.bot,
        chatId,
        reminderData.data
      );

      if (result.success) {
        const successText = `✅ **리마인더가 설정되었습니다!**

📝 **내용**: ${reminderData.data.text}
⏰ **알림 시간**: ${TimeHelper.formatDateTime(result.targetTime)}
🆔 **리마인더 ID**: #${result.reminderId}

${reminderData.message}`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: "📋 목록 보기", callback_data: "reminder:list" },
              { text: "➕ 추가 설정", callback_data: "reminder:create" },
            ],
            [{ text: "⏰ 리마인더 메뉴", callback_data: "reminder:menu" }],
          ],
        };

        await this.sendMessage(bot, chatId, successText, {
          reply_markup: keyboard,
        });
      } else {
        await this.sendError(bot, chatId, "리마인더 설정에 실패했습니다.");
      }
    } catch (error) {
      logger.error("리마인더 명령어 처리 오류:", error);
      await this.sendError(
        bot,
        chatId,
        "리마인더 처리 중 오류가 발생했습니다."
      );
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 리마인더 메뉴 전송 (명령어용)
   */
  async sendReminderMenu(bot, chatId) {
    try {
      const text = `⏰ **리마인더**

원하는 시간에 알림을 받아보세요!

🔔 **주요 기능:**
• 분 단위 알림 (5분, 30분, 1시간 등)
• 시간 지정 알림 (14:30, 18:00 등)
• 빠른 설정 옵션
• 리마인더 관리 및 통계

언제 알림을 받으시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "⏰ 분 단위", callback_data: "reminder:create:minutes" },
            { text: "🕐 시간 지정", callback_data: "reminder:create:time" },
          ],
          [
            { text: "🚀 빠른 설정", callback_data: "reminder:create" },
            { text: "📋 목록 보기", callback_data: "reminder:list" },
          ],
          [
            { text: "❓ 도움말", callback_data: "reminder:help" },
            { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          ],
        ],
      };

      await this.sendMessage(bot, chatId, text, {
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("리마인더 메뉴 전송 오류:", error);
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
        "❌ **오류 발생**\n\n리마인더 처리 중 문제가 발생했습니다.\n잠시 후 다시 시도해주세요.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 다시 시도", callback_data: "reminder:menu" }],
              [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
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
    try {
      // ReminderService 정리
      if (this.reminderService) {
        await this.reminderService.cleanup();
      }

      logger.info("🛑 ReminderModule 정리 완료");
    } catch (error) {
      logger.error("ReminderModule 정리 오류:", error);
    }
  }
}

module.exports = ReminderModule;
