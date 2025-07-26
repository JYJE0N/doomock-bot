// src/utils/BotResponses.js - 텔레그램 + 콘솔 통합 관리
const templates = require("./MessageTemplates");
const styler = require("./MessageStyler");
const chalk = require("chalk");
const logger = require("./Logger");

/**
 * 🎨 BotResponses - 모든 봇 응답을 한곳에서 관리
 *
 * 장점:
 * - 텔레그램 메시지와 콘솔 로그를 동시에 처리
 * - 일관된 스타일 유지
 * - 코드 중복 제거
 * - 유지보수 쉬움
 */
class BotResponses {
  constructor() {
    this.templates = templates;
    this.styler = styler;
  }

  // ===== 🏠 시스템 메시지 =====

  /**
   * 환영 메시지
   */
  async sendWelcome(bot, chatId, userName) {
    // 🖥️ 콘솔 로그 (화려하게)
    console.log(styler.styles.userJoin(userName));
    console.log(
      styler.createBox(
        "🎉 새 사용자",
        `${userName}님이 봇을 시작했습니다\n시간: ${styler.formatTime()}`,
        "success"
      )
    );

    // 📱 텔레그램 메시지 (예쁘게)
    await bot.sendMessage(chatId, templates.templates.welcome(userName), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📚 도움말", callback_data: "system:help" }],
          [{ text: "🚀 시작하기", callback_data: "system:menu" }],
        ],
      },
    });
  }

  /**
   * 도움말 메시지
   */
  async sendHelp(bot, chatId) {
    // 🖥️ 콘솔
    console.log(styler.styles.system("도움말 요청"));

    // 📱 텔레그램
    await bot.sendMessage(chatId, templates.templates.help(), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: templates.buttons.backToMenu,
      },
    });
  }

  // ===== 📝 할일 관리 =====

  /**
   * 할일 추가 성공
   */
  async sendTodoAdded(bot, chatId, task, userName) {
    // 🖥️ 콘솔
    console.log(styler.styles.todoAdd(task));
    logger.info(`할일 추가: ${task} (사용자: ${userName})`);

    // 📱 텔레그램
    await bot.sendMessage(chatId, templates.templates.todoAdded(task), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📋 목록 보기", callback_data: "todo:list" },
            { text: "➕ 더 추가", callback_data: "todo:add" },
          ],
          [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
        ],
      },
    });
  }

  /**
   * 할일 완료
   */
  async sendTodoCompleted(bot, chatId, task) {
    // 🖥️ 콘솔 (축하 애니메이션)
    console.log(styler.rainbow("🎉 축하합니다! 🎉"));
    console.log(styler.styles.todoComplete(task));

    // 📱 텔레그램
    await bot.sendMessage(chatId, templates.templates.todoCompleted(task), {
      parse_mode: "Markdown",
    });
  }

  /**
   * 할일 목록
   */
  async sendTodoList(bot, chatId, todos) {
    const completed = todos.filter((t) => t.completed).length;
    const pending = todos.length - completed;

    // 🖥️ 콘솔
    console.log(styler.moduleTitle("todo"));
    console.log(styler.showProgress(completed, todos.length, "완료율"));

    // 📱 텔레그램
    await bot.sendMessage(
      chatId,
      templates.templates.todoList(todos, completed, pending),
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ 완료하기", callback_data: "todo:complete" },
              { text: "➕ 추가하기", callback_data: "todo:add" },
            ],
            [{ text: "🔙 메뉴로", callback_data: "todo:menu" }],
          ],
        },
      }
    );
  }

  // ===== ⏰ 타이머 =====

  /**
   * 타이머 시작
   */
  async sendTimerStart(bot, chatId, minutes) {
    // 🖥️ 콘솔
    console.log(styler.styles.timerStart(minutes));
    console.log(
      chalk.gray(
        `종료 예정: ${new Date(
          Date.now() + minutes * 60000
        ).toLocaleTimeString()}`
      )
    );

    // 📱 텔레그램
    await bot.sendMessage(chatId, templates.templates.timerStart(minutes), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏸️ 일시정지", callback_data: "timer:pause" }],
          [{ text: "⏹️ 중지", callback_data: "timer:stop" }],
        ],
      },
    });
  }

  /**
   * 타이머 종료 알림
   */
  async sendTimerEnd(bot, chatId, duration) {
    // 🖥️ 콘솔 (화려한 알림)
    console.log("\n" + chalk.yellow.bold("🔔".repeat(10)));
    console.log(styler.styles.timerEnd());
    console.log(chalk.yellow.bold("🔔".repeat(10)) + "\n");

    // 📱 텔레그램
    await bot.sendMessage(chatId, templates.templates.timerEnd(duration), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⏰ 다시 설정", callback_data: "timer:menu" }],
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      },
    });
  }

  // ===== 🏢 근무시간 =====

  /**
   * 출근 완료
   */
  async sendWorkCheckIn(bot, chatId, time, userName) {
    // 🖥️ 콘솔
    console.log(styler.styles.workStart(time));
    console.log(
      styler.createBox(
        "출근 기록",
        `👤 ${userName}\n🕐 ${time}\n💼 좋은 하루 되세요!`,
        "success"
      )
    );

    // 📱 텔레그램
    await bot.sendMessage(chatId, templates.templates.workCheckIn(time), {
      parse_mode: "Markdown",
    });
  }

  // ===== 🔮 운세 =====

  /**
   * 운세 결과
   */
  async sendFortune(bot, chatId, category, fortune, luckyItem) {
    // 🖥️ 콘솔 (무지개 효과)
    console.log(styler.rainbow("🔮 === 오늘의 운세 === 🔮"));
    console.log(styler.styles.fortune(category, fortune));
    console.log(chalk.green(`🍀 행운 아이템: ${luckyItem}`));

    // 📱 텔레그램
    await bot.sendMessage(
      chatId,
      templates.templates.fortuneResult(category, fortune, luckyItem),
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "💼 직장운", callback_data: "fortune:work" },
              { text: "❤️ 애정운", callback_data: "fortune:love" },
            ],
            [
              { text: "💰 금전운", callback_data: "fortune:money" },
              { text: "🏥 건강운", callback_data: "fortune:health" },
            ],
            [{ text: "🔙 메뉴로", callback_data: "fortune:menu" }],
          ],
        },
      }
    );
  }

  // ===== ❌ 에러 처리 =====

  /**
   * 에러 메시지
   */
  async sendError(bot, chatId, errorMessage) {
    // 🖥️ 콘솔
    console.log(styler.styles.error(errorMessage));
    logger.error(`에러 발생: ${errorMessage}`);

    // 📱 텔레그램
    await bot.sendMessage(chatId, templates.templates.error(errorMessage), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 다시 시도", callback_data: "retry" }],
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      },
    });
  }

  // ===== ⏳ 로딩 =====

  /**
   * 로딩 메시지
   */
  async sendLoading(bot, chatId) {
    // 🖥️ 콘솔
    console.log(chalk.blue("⏳ 처리 중..."));

    // 📱 텔레그램
    return await bot.sendMessage(chatId, templates.templates.loading(), {
      parse_mode: "Markdown",
    });
  }

  /**
   * 로딩 메시지 업데이트
   */
  async updateLoadingSuccess(bot, chatId, messageId, action) {
    // 🖥️ 콘솔
    console.log(styler.styles.success(`${action} 완료`));

    // 📱 텔레그램
    await bot.editMessageText(templates.templates.success(action), {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
    });
  }

  // ===== 🎮 유틸리티 =====

  /**
   * 확인 요청
   */
  async sendConfirm(bot, chatId, action) {
    // 🖥️ 콘솔
    console.log(chalk.yellow(`❓ 확인 요청: ${action}`));

    // 📱 텔레그램
    await bot.sendMessage(chatId, templates.templates.confirm(action), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: templates.buttons.yesNo,
      },
    });
  }

  /**
   * 성공 알림 (간단)
   */
  async sendSuccess(bot, chatId, action) {
    // 🖥️ 콘솔
    console.log(styler.styles.success(action));

    // 📱 텔레그램
    await bot.sendMessage(chatId, templates.templates.success(action), {
      parse_mode: "Markdown",
    });
  }
}

// 싱글톤으로 export
module.exports = new BotResponses();
