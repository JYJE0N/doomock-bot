// ========================================
// 🎨 src/utils/Message/UnifiedMessageSystem.js
// ========================================
// 모든 메시지 기능을 하나로 통합! Logger에 주입될 예정
// ========================================

const chalk = require("chalk");

/**
 * 🎨 통합 메시지 시스템 v4.0.1
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
    this.version = "4.0.1";

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
      "!"
    ];

    // 🌈 콘솔 스타일 시스템
    this.consoleStyles = this.initConsoleStyles();

    // 📱 텔레그램 옵션
    this.telegramOptions = {
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true
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
        reminder: "🔔"
      }
    };

    // ✅ 수정: this.rainbow 사용 (chalk.rainbow 대신)
    console.log(this.rainbow("🎨 UnifiedMessageSystem v4.0.1 초기화 완료!"));
  }

  // ===== 🌈 커스텀 rainbow 메서드 구현 =====

  /**
   * 🌈 커스텀 rainbow 효과 (chalk.rainbow은 존재하지 않음)
   */
  rainbow(text) {
    const colors = ["red", "yellow", "green", "cyan", "blue", "magenta"];
    return text
      .split("")
      .map((char, i) => chalk[colors[i % colors.length]](char))
      .join("");
  }

  /**
   * 🌅 그라데이션 효과
   */
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
      userJoin: (userName) => chalk.green.bold(`👋 ${userName}님이 접속했습니다!`),
      userMessage: (userName, message) => chalk.cyan(`📨 ${userName}: ${message}`),

      // 모듈별 색상
      moduleTitle: (moduleName, icon) => {
        const colors = {
          todo: chalk.blue.bold,
          timer: chalk.cyan.bold,
          worktime: chalk.green.bold,
          fortune: (text) => this.rainbow(text), // ✅ 수정: this.rainbow 사용
          weather: chalk.yellow.bold,
          reminder: chalk.magenta.bold
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

        const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
        const color =
          percentage >= 80 ? chalk.green : percentage >= 60 ? chalk.yellow : chalk.red;

        return `${bar} ${color.bold(`${percentage}%`)} (${current}/${total})`;
      }
    };
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
    link: (text, url) => `[${this.escape(text)}](${url})`
  };

  // ===== 🎯 시간 관련 유틸리티 =====

  /**
   * 🕐 시간대별 인사말
   */
  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return "🌙 안녕히 주무세요";
    if (hour < 12) return "🌅 좋은 아침";
    if (hour < 18) return "☀️ 좋은 오후";
    return "🌆 좋은 저녁";
  }

  /**
   * ⏰ 시간대별 이모지
   */
  getTimeEmoji() {
    const hour = new Date().getHours();
    if (hour < 6) return "🌙";
    if (hour < 12) return "☀️";
    if (hour < 18) return "🌤️";
    return "🌆";
  }

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

${this.getGreeting()} ${this.markdownStyles.bold(userName)}님\\! ${this.getTimeEmoji()}

📊 ${this.markdownStyles.italic("오늘의 현황")}
• 할일: ${stats.todos || 0}개
• 타이머: ${stats.timers || 0}개 실행중
• 근무시간: ${stats.workHours || 0}시간

${this.markdownStyles.bold("원하는 기능을 선택해주세요\\!")}
    `.trim();

    try {
      if (bot && chatId) {
        await bot.sendMessage(chatId, menuText, this.telegramOptions);
      }
    } catch (error) {
      console.log(chalk.red("❌ 텔레그램 메시지 전송 실패:"), error.message);
    }
  }

  /**
   * 📝 할일 목록 표시
   */
  async sendTodoList(bot, chatId, todos, page = 1, pageSize = 10) {
    // 🖥️ 콘솔 출력
    console.log(this.consoleStyles.moduleTitle("todo", "📝"));
    console.log(chalk.blue(`📝 할일 목록 표시: ${todos.length}개 (페이지 ${page})`));

    if (todos.length === 0) {
      const emptyText = `📝 ${this.markdownStyles.bold("할일 목록")}

${this.markdownStyles.italic("등록된 할일이 없습니다\\.")}

➕ 새로운 할일을 추가해보세요\\!`;

      try {
        if (bot && chatId) {
          await bot.sendMessage(chatId, emptyText, this.telegramOptions);
        }
      } catch (error) {
        console.log(chalk.red("❌ 빈 할일 목록 전송 실패:"), error.message);
      }
      return;
    }

    // 페이지네이션
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedTodos = todos.slice(startIndex, endIndex);
    const totalPages = Math.ceil(todos.length / pageSize);

    let todoText = `📝 ${this.markdownStyles.bold("할일 목록")} \\(${page}/${totalPages}\\)\n\n`;

    paginatedTodos.forEach((todo, index) => {
      const displayIndex = startIndex + index + 1;
      const status = todo.completed ? "✅" : "◻️";
      const priority =
        todo.priority === "high" ? "🔴" : todo.priority === "medium" ? "🟡" : "🔵";

      todoText += `${status} ${priority} ${this.markdownStyles.bold(displayIndex.toString())}\\. ${this.escape(todo.title)}\n`;

      if (todo.description) {
        todoText += `   ${this.markdownStyles.italic(this.escape(todo.description))}\n`;
      }

      if (todo.dueDate) {
        todoText += `   📅 ${this.escape(todo.dueDate)}\n`;
      }

      todoText += "\n";
    });

    todoText += `📊 ${this.markdownStyles.italic(`총 ${todos.length}개의 할일`)}`;

    try {
      if (bot && chatId) {
        await bot.sendMessage(chatId, todoText, this.telegramOptions);
      }
    } catch (error) {
      console.log(chalk.red("❌ 할일 목록 전송 실패:"), error.message);
    }
  }

  /**
   * ✅ 성공 메시지
   */
  async sendSuccess(bot, chatId, message, details = null) {
    // 🖥️ 콘솔 출력
    console.log(this.rainbow(`🎉 성공: ${message}`));
    if (details) {
      console.log(chalk.gray(`   세부사항: ${JSON.stringify(details, null, 2)}`));
    }

    // 📱 텔레그램 메시지
    const successEmoji =
      this.emojiSets.success[Math.floor(Math.random() * this.emojiSets.success.length)];
    const telegramText = `${successEmoji} ${this.markdownStyles.bold("성공\\!")}

${this.escape(message)}${details ? `\n\n${this.markdownStyles.code(JSON.stringify(details, null, 2))}` : ""}`;

    try {
      if (bot && chatId) {
        await bot.sendMessage(chatId, telegramText, this.telegramOptions);
      }
    } catch (error) {
      console.log(chalk.red("❌ 성공 메시지 전송 실패:"), error.message);
    }
  }

  /**
   * ❌ 에러 메시지
   */
  async sendError(bot, chatId, message, error = null) {
    // 🖥️ 콘솔 출력
    console.log(chalk.red.bold(`❌ 에러: ${message}`));
    if (error) {
      console.log(chalk.gray(`   상세: ${error.message || error}`));
    }

    // 📱 텔레그램 메시지
    const errorEmoji =
      this.emojiSets.error[Math.floor(Math.random() * this.emojiSets.error.length)];
    const telegramText = `${errorEmoji} ${this.markdownStyles.bold("오류 발생")}

${this.escape(message)}

${this.markdownStyles.italic("잠시 후 다시 시도해주세요\\.")}`;

    try {
      if (bot && chatId) {
        await bot.sendMessage(chatId, telegramText, this.telegramOptions);
      }
    } catch (error) {
      console.log(chalk.red("❌ 에러 메시지 전송 실패:"), error.message);
    }
  }

  /**
   * ⏳ 로딩 메시지
   */
  async sendLoading(bot, chatId, message) {
    // 🖥️ 콘솔 출력
    const loadingEmoji = this.emojiSets.loading[0];
    console.log(chalk.blue(`${loadingEmoji} 로딩: ${message}`));

    // 📱 텔레그램 메시지
    const telegramText = `⏳ ${this.markdownStyles.italic(this.escape(message))}`;

    try {
      if (bot && chatId) {
        const sentMessage = await bot.sendMessage(
          chatId,
          telegramText,
          this.telegramOptions
        );
        return sentMessage.message_id;
      }
    } catch (error) {
      console.log(chalk.red("❌ 로딩 메시지 전송 실패:"), error.message);
    }
    return null;
  }

  /**
   * 🔄 로딩 메시지 업데이트
   */
  async updateLoading(bot, chatId, messageId, newMessage) {
    // 🖥️ 콘솔 출력
    console.log(chalk.blue(`🔄 로딩 업데이트: ${newMessage}`));

    // 📱 텔레그램 메시지 수정
    const telegramText = `⌛ ${this.markdownStyles.italic(this.escape(newMessage))}`;

    try {
      if (bot && chatId && messageId) {
        await bot.editMessageText(telegramText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "MarkdownV2"
        });
      }
    } catch (error) {
      console.log(chalk.red("❌ 로딩 메시지 업데이트 실패:"), error.message);
    }
  }

  /**
   * 📊 통계 정보
   */
  getStats() {
    return {
      version: this.version,
      escapeChars: this.escapeChars.length,
      emojiSets: Object.keys(this.emojiSets).length,
      modules: Object.keys(this.emojiSets.modules).length,
      features: [
        "통합 메시지 시스템",
        "MarkdownV2 지원",
        "알록달록 콘솔 출력",
        "표준 매개변수 준수",
        "Fallback 메커니즘"
      ],
      supportedModules: Object.keys(this.emojiSets.modules)
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

    // ✅ 수정: messageSystem.rainbow() 사용 (chalk.rainbow 대신)
    console.log(this.messageSystem.rainbow("🎨 Logger 알록달록 업그레이드 완료!"));
  }

  /**
   * 🎯 Logger에 새로운 메서드들 주입
   */
  injectMessageFeatures() {
    // 기존 Logger 메서드 강화
    this.logger.rainbow = this.messageSystem.rainbow.bind(this.messageSystem);
    this.logger.gradient = this.messageSystem.gradient.bind(this.messageSystem);

    // 통합 메시지 메서드들 추가
    this.logger.sendMainMenu = this.messageSystem.sendMainMenu.bind(this.messageSystem);
    this.logger.sendTodoList = this.messageSystem.sendTodoList.bind(this.messageSystem);
    this.logger.sendSuccess = this.messageSystem.sendSuccess.bind(this.messageSystem);
    this.logger.sendError = this.messageSystem.sendError.bind(this.messageSystem);
    this.logger.sendLoading = this.messageSystem.sendLoading.bind(this.messageSystem);
    this.logger.updateLoading = this.messageSystem.updateLoading.bind(this.messageSystem);

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
  LoggerEnhancer
};
