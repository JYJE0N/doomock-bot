// src/modules/ReminderModule.js - 수정된 버전
const BaseModule = require("./BaseModule");
const logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

class ReminderModule extends BaseModule {
  constructor(bot, options = {}) {
    // ✅ 표준 매개변수
    super("ReminderModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
    });

    this.reminderService = null;

    logger.info("📅 ReminderModule 생성됨");
  }

  /**
   * 모듈 초기화
   */
  async onInitialize() {
    try {
      const ReminderService = require("../services/ReminderService");
      this.reminderService = new ReminderService(this.db);

      if (this.reminderService.initialize) {
        await this.reminderService.initialize();
      }

      logger.info("✅ ReminderModule 초기화 성공");
    } catch (error) {
      logger.error("❌ ReminderModule 초기화 실패:", error);
      this.reminderService = null;
    }
  }

  /**
   * 액션 등록
   */
  setupActions() {
    this.registerActions({
      menu: this.showMenu,
      add: this.startAddReminder,
      list: this.showReminderList,
      remove: this.removeReminder,
      settings: this.showSettings,
      help: this.showHelp,
    });
  }

  /**
   * 메뉴 데이터 가져오기
   */
  getMenuText(userName) {
    return {
      text: `📅 **${userName}님의 리마인더**

알림을 설정하고 관리하세요!

**사용 가능한 기능:**
• 새 리마인더 추가
• 리마인더 목록 보기
• 리마인더 수정/삭제
• 반복 알림 설정`,

      keyboard: {
        inline_keyboard: [
          [
            { text: "➕ 새 리마인더", callback_data: "reminder:add" },
            { text: "📋 목록 보기", callback_data: "reminder:list" },
          ],
          [
            { text: "⚙️ 설정", callback_data: "reminder:settings" },
            { text: "❓ 도움말", callback_data: "reminder:help" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "main:menu" }],
        ],
      },
    };
  }

  /**
   * 메뉴 표시
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
    const menuData = this.getMenuText(userName);

    await this.editMessage(bot, chatId, messageId, menuData.text, {
      parse_mode: "Markdown",
      reply_markup: menuData.keyboard,
    });
  }

  /**
   * 리마인더 추가 시작
   */
  async startAddReminder(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    // 사용자 상태 설정
    this.setUserState(userId, {
      action: "adding_reminder",
      step: "title",
      messageId: messageId,
    });

    const text = `📝 **새 리마인더 추가**

리마인더 제목을 입력해주세요.
(예: 회의 참석, 약 복용, 보고서 제출)

취소하려면 /cancel을 입력하세요.`;

    const keyboard = {
      inline_keyboard: [[{ text: "❌ 취소", callback_data: "reminder:menu" }]],
    };

    await this.editMessage(bot, chatId, messageId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 리마인더 목록 표시
   */
  async showReminderList(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;

    try {
      const reminders = await this.reminderService.getUserReminders(userId);

      if (!reminders || reminders.length === 0) {
        const emptyText = `📋 **리마인더 목록**

등록된 리마인더가 없습니다.
새로운 리마인더를 추가해보세요!`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "➕ 새 리마인더", callback_data: "reminder:add" }],
            [{ text: "🔙 뒤로", callback_data: "reminder:menu" }],
          ],
        };

        await this.editMessage(bot, chatId, messageId, emptyText, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
        return;
      }

      // 리마인더 목록 생성
      const listText = reminders
        .map((reminder, index) => {
          const time = new Date(reminder.time).toLocaleString("ko-KR");
          const status = reminder.active ? "✅" : "❌";
          return `${index + 1}. ${status} ${reminder.title}\n   ⏰ ${time}`;
        })
        .join("\n\n");

      const text = `📋 **리마인더 목록**

${listText}

전체: ${reminders.length}개`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "➕ 추가", callback_data: "reminder:add" },
            { text: "🗑️ 삭제", callback_data: "reminder:remove" },
          ],
          [{ text: "🔙 뒤로", callback_data: "reminder:menu" }],
        ],
      };

      await this.editMessage(bot, chatId, messageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("리마인더 목록 조회 오류:", error);
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

    const helpText = `❓ **리마인더 도움말**

**리마인더란?**
특정 시간에 알림을 받을 수 있는 기능입니다.

**사용 방법:**
1. "새 리마인더" 버튼 클릭
2. 리마인더 제목 입력
3. 알림 받을 시간 설정
4. 반복 여부 선택

**지원 기능:**
• 일회성 알림
• 반복 알림 (매일, 매주, 매월)
• 알림 활성화/비활성화
• 다중 리마인더 관리

**명령어:**
• /reminder - 리마인더 메뉴 열기`;

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 뒤로", callback_data: "reminder:menu" }]],
    };

    await this.editMessage(bot, chatId, messageId, helpText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 설정 표시
   */
  async showSettings(bot, callbackQuery, params, moduleManager) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
    } = callbackQuery;

    const settingsText = `⚙️ **리마인더 설정**

현재 설정 기능은 준비 중입니다.`;

    const keyboard = {
      inline_keyboard: [[{ text: "🔙 뒤로", callback_data: "reminder:menu" }]],
    };

    await this.editMessage(bot, chatId, messageId, settingsText, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }

  /**
   * 메시지 처리
   */
  async handleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId },
    } = msg;

    if (!text) return false;

    // 사용자 상태 확인
    const userState = this.getUserState(userId);

    if (userState?.action === "adding_reminder") {
      // 리마인더 추가 프로세스 처리
      return await this.handleReminderInput(bot, msg, userState);
    }

    // 명령어 처리
    if (text === "/reminder" || text === "리마인더") {
      await this.sendReminderMenu(bot, chatId);
      return true;
    }

    return false;
  }

  /**
   * 리마인더 메뉴 전송 (메시지용)
   */
  async sendReminderMenu(bot, chatId) {
    const menuData = this.getMenuText("사용자");

    await this.sendMessage(bot, chatId, menuData.text, {
      parse_mode: "Markdown",
      reply_markup: menuData.keyboard,
    });
  }
}

module.exports = ReminderModule;
