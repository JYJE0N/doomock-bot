// ========================================
// 🎨 src/utils/Message/UnifiedMessageSystem.js
// ========================================
// 모든 메시지 기능을 하나로 통합! Logger에 주입될 예정
// ========================================

const chalk = require("chalk");

/**
 * 🎨 통합 메시지 시스템 v3.0.1
 *
 * 🌟 특징:
 * - 텔레그램 + 콘솔 동시 처리
 * - MarkdownV2 완벽 지원
 * - 알록달록한 콘솔 출력
 * - 표준 매개변수 준수
 * - 중복 코드 완전 제거
 */
class UnifiedMessageSystem {
  constructor() {
    this.version = "3.0.1";

    // 🎨 MarkdownV2 이스케이프 문자들
    this.escapeChars = [
      "_",
      "*",
      "[",
      "]",
      "(",
      ")",
      "~",
      "`",
      ">",
      "#",
      "+",
      "-",
      "=",
      "|",
      "{",
      "}",
      ".",
      "!",
    ];

    // 🌈 콘솔 스타일 시스템
    this.consoleStyles = this.initConsoleStyles();

    // 📱 텔레그램 옵션
    this.telegramOptions = {
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    };

    // 🎯 이모지 세트들
    this.emojiSets = {
      loading: ["⏳", "⌛", "⏳", "⌛"],
      celebration: ["🎉", "🎊", "✨", "🎁", "🎈"],
      success: ["✅", "🎯", "💯", "⭐", "🌟"],
      warning: ["⚠️", "🚨", "📢", "💡", "🔔"],
      error: ["❌", "💥", "🚫", "⛔", "😱"],
      modules: {
        todo: "📝",
        timer: "⏰",
        worktime: "🏢",
        fortune: "🔮",
        weather: "🌤️",
        reminder: "🔔",
      },
    };

    console.log(this.rainbow("🎨 UnifiedMessageSystem v3.0.1 초기화 완료!"));
  }

  // ===== 🌈 커스텀 rainbow 메서드 구현 =====

  rainbow(text) {
    const colors = ["red", "yellow", "green", "cyan", "blue", "magenta"];
    return text
      .split("")
      .map((char, i) => chalk[colors[i % colors.length]](char))
      .join("");
  }

  // ===== 🎨 콘솔 스타일 초기화 =====
  initConsoleStyles() {
    return {
      // 기본 스타일들
      success: (text) => chalk.green.bold(`✅ ${text}`),
      error: (text) => chalk.red.bold(`❌ ${text}`),
      warning: (text) => chalk.yellow.bold(`⚠️ ${text}`),
      info: (text) => chalk.blue(`ℹ️ ${text}`),
      debug: (text) => chalk.gray(`🔍 ${text}`),

      // 사용자 관련
      userJoin: (userName) =>
        chalk.green.bold(`👋 ${userName}님이 접속했습니다!`),
      userMessage: (userName, message) =>
        chalk.cyan(`📨 ${userName}: ${message}`),

      // 모듈별 색상
      moduleTitle: (moduleName, icon) => {
        const colors = {
          todo: chalk.blue.bold,
          timer: chalk.cyan.bold,
          worktime: chalk.green.bold,
          fortune: (text) => this.rainbow(text), // ✅ 수정: this.rainbow 사용
          weather: chalk.yellow.bold,
          reminder: chalk.magenta.bold,
        };
        const colorFn = colors[moduleName] || chalk.white.bold;
        return colorFn(`${icon} === ${moduleName.toUpperCase()} ===`);
      },

      // 작업 관련
      todoAdd: (task) => chalk.green(`➕ 할일 추가: ${task}`),
      todoComplete: (task) => chalk.green.bold(`🎯 완료: ${task}`),
      todoDelete: (task) => chalk.red(`🗑️ 삭제: ${task}`),

      // 시스템 관련
      system: (message) => chalk.blue.bold(`🤖 ${message}`),
      database: (operation) => chalk.yellow(`💾 DB: ${operation}`),
      network: (action) => chalk.cyan(`🌐 ${action}`),

      // 진행률 바 (콘솔용)
      progressBar: (current, total, width = 20) => {
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round(width * (current / total));
        const empty = width - filled;

        const bar =
          chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
        const color =
          percentage >= 80
            ? chalk.green
            : percentage >= 60
            ? chalk.yellow
            : chalk.red;

        return `${bar} ${color.bold(`${percentage}%`)} (${current}/${total})`;
      },
    };
  }

  // ===== 🌈 특수 효과들 =====
  rainbow(text) {
    const colors = ["red", "yellow", "green", "cyan", "blue", "magenta"];
    return text
      .split("")
      .map((char, i) => chalk[colors[i % colors.length]](char))
      .join("");
  }

  gradient(text, startColor = "#FF6B6B", endColor = "#4ECDC4") {
    try {
      // Chalk hex 지원 확인
      const halfPoint = Math.floor(text.length / 2);
      return (
        chalk.hex(startColor)(text.slice(0, halfPoint)) +
        chalk.hex(endColor)(text.slice(halfPoint))
      );
    } catch (error) {
      // Fallback: 일반 색상 사용
      return (
        chalk.red(text.slice(0, text.length / 2)) +
        chalk.blue(text.slice(text.length / 2))
      );
    }
  }

  // ===== 📱 MarkdownV2 처리 =====
  escape(text) {
    if (!text) return "";
    let escaped = text.toString();
    for (const char of this.escapeChars) {
      escaped = escaped.replace(new RegExp("\\" + char, "g"), "\\" + char);
    }
    return escaped;
  }

  // MarkdownV2 스타일들
  markdownStyles = {
    bold: (text) => `*${this.escape(text)}*`,
    italic: (text) => `_${this.escape(text)}_`,
    code: (text) => `\`${this.escape(text)}\``,
    strikethrough: (text) => `~${this.escape(text)}~`,
    underline: (text) => `__${this.escape(text)}__`,
    spoiler: (text) => `||${this.escape(text)}||`,
    link: (text, url) => `[${this.escape(text)}](${url})`,
  };

  // ===== 🎯 통합 메시지 전송 시스템 =====

  /**
   * 🏠 메인 메뉴 - 콘솔 + 텔레그램 동시 처리
   */
  async sendMainMenu(bot, chatId, userName, stats = {}) {
    // 🖥️ 알록달록한 콘솔 출력
    console.log(this.consoleStyles.moduleTitle("main", "🏠"));
    console.log(this.consoleStyles.userJoin(userName));
    console.log(chalk.cyan("📊 통계:"), JSON.stringify(stats, null, 2));

    // 📱 화려한 텔레그램 메시지
    const menuText = `
🏠 ${this.markdownStyles.bold("두목봇 메인 메뉴")}

${this.getGreeting()} ${this.markdownStyles.bold(
      userName
    )}님\\! ${this.getTimeEmoji()}

📊 ${this.markdownStyles.italic("오늘의 현황")}
• 할일: ${stats.todos || 0}개
• 타이머: ${stats.timers || 0}개 실행중
• 근무시간: ${stats.workHours || 0}시간

${this.markdownStyles.bold("원하는 기능을 선택해주세요\\!")}
    `.trim();

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

    try {
      const sentMessage = await bot.sendMessage(chatId, menuText, {
        ...this.telegramOptions,
        reply_markup: keyboard,
      });

      console.log(this.consoleStyles.success("메인 메뉴 전송 완료"));
      return sentMessage;
    } catch (error) {
      console.log(this.consoleStyles.error("메인 메뉴 전송 실패"));
      return await this.sendFallbackMessage(
        bot,
        chatId,
        "메뉴를 불러오는 중 오류가 발생했습니다."
      );
    }
  }

  /**
   * 📝 할일 목록 - 통합 처리
   */
  async sendTodoList(bot, chatId, todos = [], pagination = {}) {
    // 🖥️ 콘솔 출력
    console.log(this.consoleStyles.moduleTitle("todo", "📝"));
    console.log(this.consoleStyles.todoAdd(`${todos.length}개 할일 표시`));

    // 📱 텔레그램 메시지
    let todoText = `📝 ${this.markdownStyles.bold("할일 목록")}\n\n`;

    if (todos.length === 0) {
      todoText += `${this.markdownStyles.italic(
        "등록된 할일이 없습니다\\."
      )}\n\n`;
      todoText += `➕ ${this.markdownStyles.bold(
        "새로운 할일을 추가해보세요\\!"
      )}`;
    } else {
      todos.forEach((todo, index) => {
        const status = todo.completed ? "✅" : "⭕";
        const task = todo.completed
          ? this.markdownStyles.strikethrough(todo.task)
          : this.markdownStyles.bold(todo.task);
        todoText += `${status} ${index + 1}\\. ${task}\n`;
      });

      // 진행률 표시
      const completed = todos.filter((t) => t.completed).length;
      const progressText = this.createTelegramProgressBar(
        completed,
        todos.length
      );
      todoText += `\n📊 ${progressText}`;
    }

    // 페이지네이션 처리
    const keyboard = this.createTodoKeyboard(pagination);

    try {
      return await bot.sendMessage(chatId, todoText, {
        ...this.telegramOptions,
        reply_markup: keyboard,
      });
    } catch (error) {
      console.log(this.consoleStyles.error("할일 목록 전송 실패"));
      return await this.sendFallbackMessage(
        bot,
        chatId,
        "할일 목록을 불러올 수 없습니다."
      );
    }
  }

  /**
   * ✅ 성공 메시지 - 통합 처리
   */
  async sendSuccess(bot, chatId, title, description = "") {
    // 🖥️ 화려한 콘솔 출력
    console.log(this.rainbow("🎉 ===== 성공! ====="));
    console.log(this.consoleStyles.success(title));
    if (description) console.log(this.consoleStyles.info(description));

    // 📱 텔레그램 메시지
    const successText = `
✅ ${this.markdownStyles.bold(title)}

${description ? this.markdownStyles.italic(description) : ""}

🎉 ${this.markdownStyles.bold("완료되었습니다\\!")}
    `.trim();

    try {
      return await bot.sendMessage(chatId, successText, this.telegramOptions);
    } catch (error) {
      return await this.sendFallbackMessage(bot, chatId, title);
    }
  }

  /**
   * ❌ 에러 메시지 - 통합 처리
   */
  async sendError(bot, chatId, title, description = "") {
    // 🖥️ 콘솔 출력
    console.log(this.consoleStyles.error(title));
    if (description) console.log(this.consoleStyles.warning(description));

    // 📱 텔레그램 메시지
    const errorText = `
❌ ${this.markdownStyles.bold(title)}

${description ? this.markdownStyles.italic(description) : ""}

🔄 ${this.markdownStyles.bold("다시 시도해주세요\\.")}
    `.trim();

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 다시 시도", callback_data: "retry" },
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
        ],
      ],
    };

    try {
      return await bot.sendMessage(chatId, errorText, {
        ...this.telegramOptions,
        reply_markup: keyboard,
      });
    } catch (error) {
      return await this.sendFallbackMessage(bot, chatId, title);
    }
  }

  /**
   * ⏳ 로딩 메시지 - 애니메이션 효과
   */
  async sendLoading(bot, chatId, message = "처리 중") {
    // 🖥️ 콘솔
    console.log(chalk.blue(`⏳ ${message}...`));

    // 📱 텔레그램
    const loadingText = `⏳ ${this.markdownStyles.italic(
      message + "\\.\\.\\."
    )}`;

    try {
      return await bot.sendMessage(chatId, loadingText, this.telegramOptions);
    } catch (error) {
      return await this.sendFallbackMessage(bot, chatId, message);
    }
  }

  /**
   * 🔄 로딩 메시지 업데이트
   */
  async updateLoading(bot, chatId, messageId, newText, isSuccess = true) {
    const emoji = isSuccess ? "✅" : "❌";
    const style = isSuccess
      ? this.markdownStyles.bold
      : this.markdownStyles.italic;

    // 🖥️ 콘솔
    const consoleStyle = isSuccess
      ? this.consoleStyles.success
      : this.consoleStyles.error;
    console.log(consoleStyle(newText));

    // 📱 텔레그램
    const updatedText = `${emoji} ${style(newText)}`;

    try {
      return await bot.editMessageText(updatedText, {
        chat_id: chatId,
        message_id: messageId,
        ...this.telegramOptions,
      });
    } catch (error) {
      console.log(this.consoleStyles.error("메시지 업데이트 실패"));
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 📊 텔레그램용 진행률 바
   */
  createTelegramProgressBar(current, total, width = 10) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(width * (current / total));
    const empty = width - filled;

    const filledBar = "▰".repeat(filled);
    const emptyBar = "▱".repeat(empty);

    return `\`${filledBar}${emptyBar}\` ${this.markdownStyles.bold(
      percentage + "%"
    )} \\(${current}/${total}\\)`;
  }

  /**
   * 🎹 할일 키보드 생성
   */
  createTodoKeyboard(pagination = {}) {
    const { currentPage = 1, totalPages = 1 } = pagination;
    const buttons = [];

    // 페이지네이션
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

  /**
   * 🛡️ Fallback 메시지 (최후의 수단)
   */
  async sendFallbackMessage(bot, chatId, text) {
    try {
      return await bot.sendMessage(chatId, `❌ ${text}`, {
        parse_mode: "HTML",
      });
    } catch (error) {
      console.log(this.consoleStyles.error("Fallback 메시지도 실패"));
      return await bot.sendMessage(chatId, text); // 마지막 수단: 일반 텍스트
    }
  }

  /**
   * 🕐 시간별 인사말
   */
  getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "좋은 아침";
    if (hour >= 12 && hour < 17) return "좋은 오후";
    if (hour >= 17 && hour < 22) return "좋은 저녁";
    return "안녕하세요";
  }

  /**
   * 🕐 시간별 이모지
   */
  getTimeEmoji() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "🌅";
    if (hour >= 12 && hour < 18) return "☀️";
    if (hour >= 18 && hour < 22) return "🌆";
    return "🌙";
  }

  /**
   * 📊 통계 정보 반환
   */
  getStats() {
    return {
      version: this.version,
      features: [
        "통합 메시지 시스템",
        "MarkdownV2 지원",
        "알록달록 콘솔 출력",
        "표준 매개변수 준수",
        "Fallback 메커니즘",
      ],
      supportedModules: Object.keys(this.emojiSets.modules),
    };
  }
}

// ========================================
// 🔧 Logger 주입용 확장 시스템
// ========================================

/**
 * 🎨 Logger 확장 - 알록달록 기능 주입
 */
class LoggerEnhancer {
  constructor(logger, messageSystem) {
    this.logger = logger;
    this.messageSystem = messageSystem;

    // Logger에 메시지 기능들 주입
    this.injectMessageFeatures();

    console.log(chalk.rainbow("🎨 Logger 알록달록 업그레이드 완료!"));
  }

  /**
   * 🎯 Logger에 새로운 메서드들 주입
   */
  injectMessageFeatures() {
    // ✅ 수정: rainbow 메서드를 messageSystem에서 바인딩
    this.logger.rainbow = this.messageSystem.rainbow.bind(this.messageSystem);
    this.logger.gradient = this.messageSystem.gradient.bind(this.messageSystem);

    // 통합 메시지 메서드들 추가
    this.logger.sendMainMenu = this.messageSystem.sendMainMenu.bind(
      this.messageSystem
    );
    this.logger.sendSuccess = this.messageSystem.sendSuccess.bind(
      this.messageSystem
    );
    this.logger.sendError = this.messageSystem.sendError.bind(
      this.messageSystem
    );

    // 콘솔 스타일 추가
    this.logger.styles = this.messageSystem.consoleStyles;

    // 통계 메서드 추가
    this.logger.getMessageStats = () => this.messageSystem.getStats();

    // 새로운 로그 레벨들 추가
    this.logger.celebration = (message) => {
      console.log(this.messageSystem.rainbow(`🎉 ${message}`));
    };

    this.logger.progress = (label, current, total) => {
      console.log(this.messageSystem.consoleStyles.progressBar(current, total));
    };

    this.logger.moduleLog = (moduleName, message, data) => {
      console.log(
        this.messageSystem.consoleStyles.moduleTitle(
          moduleName,
          this.messageSystem.emojiSets.modules[moduleName] || "📦"
        )
      );
      if (data) console.log(chalk.gray(JSON.stringify(data, null, 2)));
    };
  }
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = {
  UnifiedMessageSystem,
  LoggerEnhancer,
};
