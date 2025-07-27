const logger = require("./Logger");
const { MessageStyler } = require("./MessageStyler");

/**
 * 🎨 화려한 봇 메시지 시스템
 *
 * 🌟 특징:
 * - MarkdownV2 완벽 지원
 * - Enhanced Logger와 콘솔 동기화
 * - 동적 UI 컴포넌트
 * - 사용자 친화적 인터페이션
 */
class EnhancedBotResponses {
  constructor() {
    // this.formatter = new TelegramFormatter();
    this.styler = null;

    // 🎨 메시지 전송 옵션
    this.defaultOptions = {
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    };

    logger.info("EnhancedBotResponses v3.0.1 시작");
  }

  /**
   * 🏠 화려한 메인 메뉴 전송
   */
  async sendMainMenu(bot, chatId, userName, stats) {
    try {
      // 🖥️ Enhanced Logger - 콘솔 출력
      console.log(this.styler.moduleTitle("main", "🏠"));
      console.log(this.styler.styles.userJoin(userName));
      logger.info("🏠 메인 메뉴 전송", {
        userName,
        chatId,
        stats,
      });

      // 📱 화려한 텔레그램 메시지
      const menuCard = this.formatter.createMenuCard(userName, stats);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📝 할일 관리", callback_data: "todo:menu" },
            { text: "⏰ 타이머", callback_data: "timer:menu" },
          ],
          [
            { text: "🏢 근무시간", callback_data: "worktime:menu" },
            { text: "🔔 리마인더", callback_data: "reminder:menu" },
          ],
          [
            { text: "🔮 운세", callback_data: "fortune:menu" },
            { text: "🌤️ 날씨", callback_data: "weather:menu" },
          ],
          [
            { text: "⚙️ 설정", callback_data: "system:settings" },
            { text: "❓ 도움말", callback_data: "system:help" },
          ],
        ],
      };

      const sentMessage = await bot.sendMessage(chatId, menuCard, {
        ...this.defaultOptions,
        reply_markup: keyboard,
      });

      logger.success("✅ 메인 메뉴 전송 완료", {
        messageId: sentMessage.message_id,
      });

      return sentMessage;
    } catch (error) {
      logger.error("❌ 메인 메뉴 전송 실패:", error);
      return await this.sendFallbackMessage(
        bot,
        chatId,
        "메뉴를 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 📝 화려한 Todo 목록 전송
   */
  async sendTodoList(bot, chatId, todos, pagination) {
    try {
      // 🖥️ Enhanced Logger - 콘솔 출력
      console.log(this.styler.moduleTitle("todo", "📝"));
      console.log(this.styler.styles.todoAdd(`${todos.length}개 할일 표시`));

      // 📱 화려한 Todo 카드
      const todoCard = this.formatter.createTodoListCard(todos, pagination);

      const keyboard = this.createTodoKeyboard(pagination);

      return await bot.sendMessage(chatId, todoCard, {
        ...this.defaultOptions,
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ Todo 목록 전송 실패:", error);
      return await this.sendFallbackMessage(
        bot,
        chatId,
        "할일 목록을 불러올 수 없습니다."
      );
    }
  }

  /**
   * ⏰ 실시간 타이머 상태 전송
   */
  async sendTimerStatus(bot, chatId, timer) {
    try {
      // 🖥️ Enhanced Logger - 콘솔 애니메이션
      console.log(this.styler.moduleTitle("timer", "⏰"));
      console.log(this.styler.styles.timerStart(timer.name));

      // 📱 동적 타이머 카드
      const timerCard = this.formatter.createTimerCard(timer);

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: timer.isRunning ? "⏸️ 일시정지" : "▶️ 시작",
              callback_data: `timer:toggle:${timer.id}`,
            },
            { text: "⏹️ 정지", callback_data: `timer:stop:${timer.id}` },
          ],
          [
            { text: "🔄 리셋", callback_data: `timer:reset:${timer.id}` },
            { text: "⚙️ 설정", callback_data: `timer:settings:${timer.id}` },
          ],
          [{ text: "🔙 뒤로", callback_data: "timer:menu" }],
        ],
      };

      return await bot.sendMessage(chatId, timerCard, {
        ...this.defaultOptions,
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ 타이머 상태 전송 실패:", error);
      return await this.sendFallbackMessage(
        bot,
        chatId,
        "타이머 정보를 불러올 수 없습니다."
      );
    }
  }

  /**
   * 🏢 근무시간 대시보드 전송
   */
  async sendWorkDashboard(bot, chatId, workData) {
    try {
      // 🖥️ Enhanced Logger - 콘솔 출력
      console.log(this.styler.moduleTitle("worktime", "🏢"));
      console.log(this.styler.styles.workStart(workData.checkInTime));

      // 📱 근무시간 대시보드
      const dashboard = this.formatter.createWorkDashboard(workData);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🕐 출근", callback_data: "worktime:checkin" },
            { text: "🏠 퇴근", callback_data: "worktime:checkout" },
          ],
          [
            { text: "☕ 휴식 시작", callback_data: "worktime:break:start" },
            { text: "🔄 휴식 종료", callback_data: "worktime:break:end" },
          ],
          [
            { text: "📊 주간 통계", callback_data: "worktime:weekly" },
            { text: "📈 월간 통계", callback_data: "worktime:monthly" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      return await bot.sendMessage(chatId, dashboard, {
        ...this.defaultOptions,
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ 근무시간 대시보드 전송 실패:", error);
      return await this.sendFallbackMessage(
        bot,
        chatId,
        "근무시간 정보를 불러올 수 없습니다."
      );
    }
  }

  /**
   * 🎉 성공 애니메이션 메시지
   */
  async sendSuccessAnimation(bot, chatId, title, message) {
    try {
      // 🖥️ Enhanced Logger - 축하 콘솔
      console.log(this.styler.rainbow("🎉 SUCCESS! 🎉"));
      console.log(this.styler.styles.success(title));
      logger.success(`🎊 ${title}`, { message });

      // 📱 화려한 성공 메시지
      const successCard = this.formatter.createSuccessAnimation(title, message);

      return await bot.sendMessage(chatId, successCard, this.defaultOptions);
    } catch (error) {
      logger.error("❌ 성공 애니메이션 전송 실패:", error);
      return await this.sendFallbackMessage(
        bot,
        chatId,
        "작업이 완료되었습니다!"
      );
    }
  }

  /**
   * 🔔 스마트 알림 전송
   */
  async sendSmartNotification(bot, chatId, notification) {
    try {
      // 🖥️ Enhanced Logger - 알림 출력
      console.log(
        this.styler.styles.reminder(notification.title, notification.time)
      );
      logger.info("🔔 스마트 알림 전송", notification);

      // 📱 알림 카드
      const notificationCard =
        this.formatter.createNotificationCard(notification);

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "✅ 확인",
              callback_data: `notification:confirm:${notification.id}`,
            },
            {
              text: "⏰ 다시 알림",
              callback_data: `notification:snooze:${notification.id}`,
            },
          ],
          [
            {
              text: "🔇 음소거",
              callback_data: `notification:mute:${notification.id}`,
            },
          ],
        ],
      };

      return await bot.sendMessage(chatId, notificationCard, {
        ...this.defaultOptions,
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error("❌ 스마트 알림 전송 실패:", error);
      return await this.sendFallbackMessage(bot, chatId, notification.message);
    }
  }

  /**
   * ❌ 사용자 친화적 에러 메시지
   */
  async sendFriendlyError(bot, chatId, error, suggestion) {
    try {
      // 🖥️ Enhanced Logger - 에러 출력
      console.log(this.styler.styles.error(error));
      logger.error("❌ 사용자 친화적 에러:", { error, suggestion });

      // 📱 친화적 에러 메시지
      const errorCard = this.formatter.createErrorMessage(error, suggestion);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 다시 시도", callback_data: "retry" },
            { text: "❓ 도움말", callback_data: "system:help" },
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      return await bot.sendMessage(chatId, errorCard, {
        ...this.defaultOptions,
        reply_markup: keyboard,
      });
    } catch (fallbackError) {
      logger.error("❌ 에러 메시지 전송도 실패:", fallbackError);
      return await this.sendFallbackMessage(
        bot,
        chatId,
        "오류가 발생했습니다. 다시 시도해주세요."
      );
    }
  }

  /**
   * 🛡️ Fallback 메시지 (MarkdownV2 실패 시)
   */
  async sendFallbackMessage(bot, chatId, text) {
    try {
      return await bot.sendMessage(chatId, `❌ ${text}`, {
        parse_mode: "HTML",
      });
    } catch (error) {
      logger.error("❌ Fallback 메시지도 실패:", error);
      // 마지막 수단: 일반 텍스트
      return await bot.sendMessage(chatId, text);
    }
  }

  // ===== 🛠️ 키보드 생성 헬퍼들 =====

  createTodoKeyboard(pagination) {
    const { currentPage, totalPages } = pagination;
    const buttons = [];

    // 페이지네이션 버튼
    if (totalPages > 1) {
      const pageButtons = [];
      if (currentPage > 1) {
        pageButtons.push({
          text: "⬅️ 이전",
          callback_data: `todo:page:${currentPage - 1}`,
        });
      }
      pageButtons.push({
        text: `${currentPage}/${totalPages}`,
        callback_data: "todo:page:info",
      });
      if (currentPage < totalPages) {
        pageButtons.push({
          text: "다음 ➡️",
          callback_data: `todo:page:${currentPage + 1}`,
        });
      }
      buttons.push(pageButtons);
    }

    // 액션 버튼들
    buttons.push([
      { text: "➕ 추가", callback_data: "todo:add" },
      { text: "✅ 완료", callback_data: "todo:complete" },
    ]);

    buttons.push([
      { text: "✏️ 편집", callback_data: "todo:edit" },
      { text: "🗑️ 삭제", callback_data: "todo:delete" },
    ]);

    buttons.push([{ text: "🔙 메인 메뉴", callback_data: "system:menu" }]);

    return { inline_keyboard: buttons };
  }
}

module.exports = {
  EnhancedBotResponses: new EnhancedBotResponses(),
};
