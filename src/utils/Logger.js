// src/utils/Logger.js 수정된 부분
const winston = require("winston");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs");

// 예쁜 로거 클래스 - 싱글톤 패턴 적용
class EnhancedLogger {
  static instance = null; // 정적 인스턴스 변수

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance() {
    if (!EnhancedLogger.instance) {
      EnhancedLogger.instance = new EnhancedLogger();
    }
    return EnhancedLogger.instance;
  }

  constructor() {
    // 이미 인스턴스가 있으면 기존 인스턴스 반환
    if (EnhancedLogger.instance) {
      return EnhancedLogger.instance;
    }

    // 로그 레벨별 스타일 정의
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

    // 모듈별 색상 테마
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

    // ASCII 아트 박스 문자
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

    // 인스턴스를 static 변수에 저장
    EnhancedLogger.instance = this;
  }

  // ... (나머지 메서드들은 동일)

  /**
   * 타임스탬프 생성
   */
  getTimestamp() {
    const time = moment().tz("Asia/Seoul").format("HH:mm:ss.SSS");
    return chalk.gray(`[${time}]`);
  }

  /**
   * 기본 로그 포맷
   */
  formatLog(level, message, data) {
    const style = this.styles[level];
    const timestamp = this.getTimestamp();

    let output = `${timestamp} ${style.badge} ${style.icon}  ${style.color(
      message
    )}`;

    if (data) {
      output += "\n" + this.formatData(data, level);
    }

    return output;
  }

  /**
   * 데이터 포맷팅
   */
  formatData(data, level) {
    const style = this.styles[level];
    const json = JSON.stringify(data, null, 2);
    const lines = json.split("\n");

    return lines
      .map((line) => chalk.gray("    │ ") + style.color(line))
      .join("\n");
  }

  /**
   * 🎯 로그 메서드들
   */
  info(message, data) {
    console.log(this.formatLog("info", message, data));
  }

  success(message, data) {
    console.log(this.formatLog("success", message, data));
  }

  warn(message, data) {
    console.log(this.formatLog("warn", message, data));
  }

  error(message, data) {
    console.log(this.formatLog("error", message, data));
  }

  debug(message, data) {
    if (process.env.DEBUG === "true") {
      console.log(this.formatLog("debug", message, data));
    }
  }

  system(message, data) {
    console.log(this.formatLog("system", message, data));
  }

  /**
   * 📦 모듈별 로그
   */
  module(moduleName, message, data) {
    const moduleColor = this.moduleColors[moduleName] || chalk.white;
    const timestamp = this.getTimestamp();
    const badge = moduleColor.bold(` ${moduleName} `);

    let output = `${timestamp} ${badge} ${message}`;

    if (data) {
      output += "\n" + this.formatData(data, "info");
    }

    console.log(output);
  }

  /**
   * 🎨 화려한 배너 출력
   */
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

  /**
   * 📊 진행 상황 표시
   */
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

  /**
   * 🌈 그라데이션 텍스트
   */
  gradient(text, startColor, endColor) {
    const gradient = require("gradient-string");
    return gradient(startColor, endColor)(text);
  }

  /**
   * 📋 테이블 출력
   */
  table(headers, rows) {
    const Table = require("cli-table3");

    const table = new Table({
      head: headers.map((h) => chalk.bold.white(h)),
      style: {
        head: ["cyan"],
        border: ["gray"],
      },
    });

    rows.forEach((row) => table.push(row));
    console.log(table.toString());
  }

  /**
   * 🚀 시작 메시지
   */
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

  /**
   * ✅ 완료 메시지
   */
  complete(message) {
    const checkmark = chalk.green("✓");
    const badge = chalk.bgGreen.black(" COMPLETE ");
    console.log(
      `${this.getTimestamp()} ${badge} ${checkmark} ${chalk.bold.green(
        message
      )}`
    );
  }

  /**
   * 🔄 로딩 애니메이션
   */
  loading(message) {
    const ora = require("ora");
    return ora({
      text: message,
      spinner: {
        interval: 80,
        frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
      },
      color: "cyan",
    }).start();
  }

  /**
   * 📍 네비게이션 로그
   */
  navigation(from, to, params) {
    const arrow = chalk.cyan("→");
    const fromModule = chalk.bold.yellow(from);
    const toModule = chalk.bold.green(to);
    const paramsStr = params ? chalk.gray(`(${params.join(", ")})`) : "";

    console.log(
      `${this.getTimestamp()} 🎯 ${fromModule} ${arrow} ${toModule} ${paramsStr}`
    );
  }

  /**
   * 💬 메시지 로그
   */
  message(user, text, type = "received") {
    const icon = type === "received" ? "📨" : "📤";
    const userStr = chalk.bold.cyan(`@${user}`);
    const textStr = chalk.white(
      text.substring(0, 50) + (text.length > 50 ? "..." : "")
    );

    console.log(`${this.getTimestamp()} ${icon} ${userStr}: ${textStr}`);
  }

  /**
   * 🎨 박스 메시지
   */
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
}

// ===== 파일 끝부분 수정 =====

// 방법 3: getInstance() 메서드로 싱글톤 인스턴스 내보내기
module.exports = EnhancedLogger.getInstance();

// 클래스도 함께 내보내고 싶다면:
// module.exports = {
//   default: EnhancedLogger.getInstance(),
//   EnhancedLogger: EnhancedLogger,
//   Logger: EnhancedLogger.getInstance()
// };
