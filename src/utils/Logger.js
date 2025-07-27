// src/utils/Logger.js - 완전히 정리된 버전! 🎯
const chalk = require("chalk");
const moment = require("moment-timezone");

/**
 * 🎨 깔끔한 로거 클래스
 * - 싱글톤 패턴 간소화
 * - 기능별 명확한 분리
 * - 스파게티 코드 정리 완료!
 */
class Logger {
  static #instance = null;

  /**
   * 싱글톤 인스턴스 반환 (private 필드 사용)
   */
  static getInstance() {
    if (!Logger.#instance) {
      Logger.#instance = new Logger();
    }
    return Logger.#instance;
  }

  constructor() {
    // 중복 생성 방지
    if (Logger.#instance) {
      return Logger.#instance;
    }

    this.#initializeStyles();
    this.#initializeBoxChars();
    this.#checkGradientSupport();

    Logger.#instance = this;
  }

  // ===== 🎨 초기화 메서드들 =====

  #initializeStyles() {
    this.styles = {
      info: {
        badge: chalk.bgBlue.white.bold(" INFO "),
        icon: "💎",
        color: chalk.blue,
      },
      success: {
        badge: chalk.bgGreen.black.bold(" SUCCESS "),
        icon: "✅",
        color: chalk.green,
      },
      warn: {
        badge: chalk.bgYellow.black.bold(" WARN "),
        icon: "⚠️",
        color: chalk.yellow,
      },
      error: {
        badge: chalk.bgRed.white.bold(" ERROR "),
        icon: "❌",
        color: chalk.red,
      },
      debug: {
        badge: chalk.bgMagenta.white.bold(" DEBUG "),
        icon: "🔍",
        color: chalk.magenta,
      },
      system: {
        badge: chalk.bgCyan.black.bold(" SYSTEM "),
        icon: "⚙️",
        color: chalk.cyan,
      },
    };

    this.moduleColors = {
      BotController: chalk.hex("#FF6B6B"),
      NavigationHandler: chalk.hex("#4ECDC4"),
      ModuleManager: chalk.hex("#45B7D1"),
      TodoModule: chalk.hex("#96CEB4"),
      TimerModule: chalk.hex("#FECA57"),
      LeaveModule: chalk.hex("#48C9B0"),
      WorktimeModule: chalk.hex("#6C5CE7"),
      WeatherModule: chalk.hex("#74B9FF"),
      FortuneModule: chalk.hex("#A29BFE"),
      TTSModule: chalk.hex("#FD79A8"),
      ReminderModule: chalk.hex("#FDCB6E"),
    };
  }

  #initializeBoxChars() {
    this.box = {
      topLeft: "╔",
      topRight: "╗",
      bottomLeft: "╚",
      bottomRight: "╝",
      horizontal: "═",
      vertical: "║",
      cross: "╬",
      teeRight: "╠",
      teeLeft: "╣",
    };
  }

  #checkGradientSupport() {
    try {
      this.gradientString = require("gradient-string");
      this.hasGradient = true;
    } catch (error) {
      this.hasGradient = false;
      this.warn("gradient-string 패키지 없음 - 기본 색상 사용");
    }
  }

  // ===== 🕐 시간 관련 =====

  getTimestamp() {
    return chalk.gray(`[${moment().tz("Asia/Seoul").format("HH:mm:ss.SSS")}]`);
  }

  // ===== 🔒 보안 관련 =====

  #sanitize(text) {
    if (!text) return text;

    return String(text)
      .replace(/\d{9,10}:[A-Za-z0-9_-]{35}/g, "BOT_TOKEN_***")
      .replace(
        /mongodb(\+srv)?:\/\/[^:\s]+:[^@\s]+@[^\s]+/g,
        "mongodb://***:***@***"
      )
      .replace(/\d{6,}/g, (match) => match.substring(0, 3) + "***")
      .replace(/[a-zA-Z0-9_-]{32,}/g, "***API_KEY***");
  }

  // ===== 📝 기본 로그 메서드들 =====

  #formatLog(level, message, data) {
    const cleanMessage = this.#sanitize(message);
    const style = this.styles[level];
    const timestamp = this.getTimestamp();

    let output = `${timestamp} ${style.badge} ${style.icon}  ${style.color(
      cleanMessage
    )}`;

    if (data) {
      output += "\n" + this.#formatData(data, level);
    }

    return output;
  }

  #formatData(data, level) {
    const cleanData = this.#sanitize(JSON.stringify(data, null, 2));
    const style = this.styles[level];

    return cleanData
      .split("\n")
      .map((line) => chalk.gray("    │ ") + style.color(line))
      .join("\n");
  }

  info(message, data) {
    console.log(this.#formatLog("info", message, data));
  }

  success(message, data) {
    console.log(this.#formatLog("success", message, data));
  }

  warn(message, data) {
    console.log(this.#formatLog("warn", message, data));
  }

  error(message, data) {
    console.log(this.#formatLog("error", message, data));
  }

  debug(message, data) {
    if (process.env.DEBUG === "true") {
      console.log(this.#formatLog("debug", message, data));
    }
  }

  system(message, data) {
    console.log(this.#formatLog("system", message, data));
  }

  // ===== 📦 모듈별 로그 =====

  module(moduleName, message, data) {
    const moduleColor = this.moduleColors[moduleName] || chalk.white;
    const timestamp = this.getTimestamp();
    const badge = moduleColor.bold(` ${moduleName} `);

    let output = `${timestamp} ${badge} ${message}`;

    if (data) {
      output += "\n" + this.#formatData(data, "info");
    }

    console.log(output);
  }

  // ===== 🎯 네비게이션 로그 =====

  navigation(from, to, params = []) {
    const timestamp = this.getTimestamp();
    const arrow = chalk.cyan("→");
    const fromModule = chalk.bold.yellow(from);
    const toModule = chalk.bold.green(to);
    const paramsStr =
      params.length > 0 ? chalk.gray(`(${params.join(", ")})`) : "";

    console.log(
      `${timestamp} 🎯 ${fromModule} ${arrow} ${toModule} ${paramsStr}`
    );
  }

  // ===== 💬 메시지 로그 =====

  message(user, text, type = "received") {
    const timestamp = this.getTimestamp();
    const icon = type === "received" ? "📨" : "📤";
    const userStr = chalk.bold.cyan(`@${user}`);
    const textStr = chalk.white(
      text.length > 50 ? text.substring(0, 50) + "..." : text
    );

    console.log(`${timestamp} ${icon} ${userStr}: ${textStr}`);
  }

  // ===== 🎨 시각적 요소들 =====

  gradient(text, startColor = "#FF6B6B", endColor = "#4ECDC4") {
    if (this.hasGradient) {
      return this.gradientString(startColor, endColor)(text);
    }
    // 폴백: 그라디언트 없으면 기본 색상
    return chalk.cyan(text);
  }

  banner(title, subtitle) {
    const width = 60;
    const titlePadding = Math.floor((width - title.length - 2) / 2);
    const subtitlePadding = Math.floor((width - subtitle.length - 2) / 2);

    console.log();
    console.log(
      chalk.cyan(
        this.box.topLeft + this.box.horizontal.repeat(width) + this.box.topRight
      )
    );
    console.log(
      chalk.cyan(this.box.vertical) +
        " ".repeat(titlePadding) +
        chalk.bold.white(title) +
        " ".repeat(width - titlePadding - title.length - 1) +
        chalk.cyan(this.box.vertical)
    );
    console.log(
      chalk.cyan(this.box.vertical) +
        " ".repeat(subtitlePadding) +
        chalk.gray(subtitle) +
        " ".repeat(width - subtitlePadding - subtitle.length - 1) +
        chalk.cyan(this.box.vertical)
    );
    console.log(
      chalk.cyan(
        this.box.bottomLeft +
          this.box.horizontal.repeat(width) +
          this.box.bottomRight
      )
    );
    console.log();
  }

  box(title, content, color = "cyan") {
    const boxColor = chalk[color];
    const width = 50;

    console.log();
    console.log(
      boxColor(
        this.box.topLeft + this.box.horizontal.repeat(width) + this.box.topRight
      )
    );
    console.log(
      boxColor(this.box.vertical) +
        " " +
        chalk.bold.white(title.padEnd(width - 2)) +
        " " +
        boxColor(this.box.vertical)
    );
    console.log(
      boxColor(
        this.box.teeRight + this.box.horizontal.repeat(width) + this.box.teeLeft
      )
    );

    content.split("\n").forEach((line) => {
      console.log(
        boxColor(this.box.vertical) +
          " " +
          line.padEnd(width - 2) +
          " " +
          boxColor(this.box.vertical)
      );
    });

    console.log(
      boxColor(
        this.box.bottomLeft +
          this.box.horizontal.repeat(width) +
          this.box.bottomRight
      )
    );
    console.log();
  }

  progress(current, total, label) {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((percentage / 100) * barLength);

    const filled = chalk.green("█").repeat(filledLength);
    const empty = chalk.gray("░").repeat(barLength - filledLength);
    const bar = `${filled}${empty}`;
    const stats = chalk.cyan(`${current}/${total} (${percentage}%)`);

    console.log(`${chalk.bold(label)} ${bar} ${stats}`);
  }

  // ===== 🚀 시작 메시지 =====

  startup() {
    console.clear();

    const logo = [
      "██████╗  ██████╗  ██████╗ ███╗   ███╗ ██████╗  ██████╗██╗  ██╗",
      "██╔══██╗██╔═══██╗██╔═══██╗████╗ ████║██╔═══██╗██╔════╝██║ ██╔╝",
      "██║  ██║██║   ██║██║   ██║██╔████╔██║██║   ██║██║     █████╔╝ ",
      "██║  ██║██║   ██║██║   ██║██║╚██╔╝██║██║   ██║██║     ██╔═██╗ ",
      "██████╔╝╚██████╔╝╚██████╔╝██║ ╚═╝ ██║╚██████╔╝╚██████╗██║  ██╗",
      "╚═════╝  ╚═════╝  ╚═════╝ ╚═╝     ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝",
    ];

    logo.forEach((line) => {
      console.log(this.gradient(line, "#FF6B6B", "#4ECDC4"));
    });

    console.log();
    console.log(chalk.bold.white("🤖 두목봇 v3.0.1 시작 중..."));
    console.log(
      chalk.gray("────────────────────────────────────────────────────")
    );
    console.log();
  }

  complete(message) {
    const timestamp = this.getTimestamp();
    const badge = chalk.bgGreen.black(" COMPLETE ");
    const checkmark = chalk.green("✓");

    console.log(
      `${timestamp} ${badge} ${checkmark} ${chalk.bold.green(message)}`
    );
  }

  // ===== 🔄 로딩 애니메이션 =====

  loading(message) {
    try {
      const ora = require("ora");
      return ora({
        text: message,
        spinner: {
          interval: 80,
          frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
        },
        color: "cyan",
      }).start();
    } catch (error) {
      // ora 없으면 심플한 로딩 메시지
      this.info(`🔄 ${message}`);
      return { stop: () => {}, succeed: () => {}, fail: () => {} };
    }
  }

  // ===== 📋 테이블 출력 =====

  table(headers, rows) {
    try {
      const Table = require("cli-table3");
      const table = new Table({
        head: headers.map((h) => chalk.bold.white(h)),
        style: { head: ["cyan"], border: ["gray"] },
      });

      rows.forEach((row) => table.push(row));
      console.log(table.toString());
    } catch (error) {
      // cli-table3 없으면 심플한 테이블
      this.info("📊 테이블 데이터:");
      console.log(headers.join(" | "));
      console.log("-".repeat(headers.join(" | ").length));
      rows.forEach((row) => console.log(row.join(" | ")));
    }
  }
}

// 🎯 깔끔한 내보내기 - 싱글톤 인스턴스만!
module.exports = Logger.getInstance();
