// src/utils/MessageStyler.js - Chalk 스타일링
const chalk = require("chalk");

class MessageStyler {
  constructor() {
    // 메시지 타입별 스타일
    this.styles = {
      // 시스템 메시지
      system: (msg) => chalk.blue.bold(`🤖 [시스템] ${msg}`),

      // 사용자 액션
      userJoin: (name) =>
        chalk.green(`👋 ${chalk.bold(name)}님이 입장하셨습니다!`),
      userLeave: (name) =>
        chalk.yellow(`👋 ${chalk.bold(name)}님이 나가셨습니다.`),

      // 할일 관련
      todoAdd: (task) =>
        chalk.green(`✅ 새 할일 추가: ${chalk.underline(task)}`),
      todoComplete: (task) => chalk.green.strikethrough(`✓ 완료: ${task}`),
      todoDelete: (task) => chalk.red(`🗑️  삭제됨: ${task}`),

      // 타이머 관련
      timerStart: (time) => chalk.cyan(`⏰ 타이머 시작! ${chalk.bold(time)}분`),
      timerEnd: () => chalk.yellow.bold(`🔔 띵동! 타이머가 끝났습니다!`),

      // 근무시간
      workStart: (time) => chalk.green(`🏢 출근 완료! (${time})`),
      workEnd: (time) => chalk.blue(`🏠 퇴근 완료! (${time})`),

      // 운세
      fortune: (type, msg) => {
        const icons = {
          work: "💼",
          love: "❤️",
          money: "💰",
          health: "🏥",
        };
        return chalk.magenta(`${icons[type] || "🔮"} ${chalk.italic(msg)}`);
      },

      // 날씨
      weather: (temp, desc) => {
        const color =
          temp > 25 ? chalk.red : temp > 15 ? chalk.yellow : chalk.cyan;
        return color(`🌡️  ${temp}°C - ${desc}`);
      },

      // 에러/경고
      error: (msg) => chalk.red.bold(`❌ 오류: ${msg}`),
      warning: (msg) => chalk.yellow(`⚠️  주의: ${msg}`),
      success: (msg) => chalk.green.bold(`✅ ${msg}`),

      // 리마인더
      reminder: (msg, time) =>
        chalk.yellow.inverse(` 🔔 알림: ${msg} (${time}) `),
    };
  }

  // 메시지 박스 생성
  createBox(title, content, style = "default") {
    const boxStyles = {
      default: chalk.white,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.cyan,
      special: chalk.magenta,
    };

    const color = boxStyles[style] || chalk.white;
    const width =
      Math.max(title.length, ...content.split("\n").map((l) => l.length)) + 4;
    const line = "─".repeat(width - 2);

    let box = color(`┌${line}┐\n`);
    box += color(`│ `) + chalk.bold(title.padEnd(width - 4)) + color(` │\n`);
    box += color(`├${line}┤\n`);

    content.split("\n").forEach((line) => {
      box += color(`│ `) + line.padEnd(width - 4) + color(` │\n`);
    });

    box += color(`└${line}┘`);

    return box;
  }

  // 진행 상황 표시
  showProgress(current, total, label = "") {
    const percentage = Math.round((current / total) * 100);
    const barWidth = 20;
    const filled = Math.round(barWidth * (current / total));

    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
    const color =
      percentage < 30
        ? chalk.red
        : percentage < 70
        ? chalk.yellow
        : chalk.green;

    return color(`${label} [${bar}] ${percentage}% (${current}/${total})`);
  }

  // 무지개 텍스트
  rainbow(text) {
    const colors = ["red", "yellow", "green", "cyan", "blue", "magenta"];
    return text
      .split("")
      .map((char, i) => chalk[colors[i % colors.length]](char))
      .join("");
  }

  // 모듈별 타이틀
  moduleTitle(moduleName, icon) {
    const titles = {
      todo: () => chalk.blue.bold(`📝 === 할일 관리 ===`),
      timer: () => chalk.cyan.bold(`⏰ === 타이머 ===`),
      worktime: () => chalk.green.bold(`🏢 === 근무시간 ===`),
      fortune: () => this.rainbow(`🔮 === 오늘의 운세 ===`),
      weather: () => chalk.cyan(`🌤️  === 날씨 정보 ===`),
      reminder: () => chalk.yellow.bold(`🔔 === 리마인더 ===`),
    };

    return titles[moduleName]
      ? titles[moduleName]()
      : chalk.bold(`${icon} === ${moduleName} ===`);
  }

  // 상태 아이콘
  statusIcon(status) {
    const icons = {
      online: chalk.green("🟢"),
      offline: chalk.gray("⚫"),
      busy: chalk.yellow("🟡"),
      error: chalk.red("🔴"),
      loading: chalk.blue("🔵"),
    };

    return icons[status] || chalk.gray("⚪");
  }

  // 시간 포맷 (색상 포함)
  formatTime(date = new Date()) {
    const hours = date.getHours();
    const timeStr = date.toLocaleTimeString("ko-KR");

    // 시간대별 색상
    if (hours >= 6 && hours < 12) {
      return chalk.yellow(`🌅 ${timeStr}`); // 아침
    } else if (hours >= 12 && hours < 18) {
      return chalk.cyan(`☀️  ${timeStr}`); // 낮
    } else if (hours >= 18 && hours < 22) {
      return chalk.magenta(`🌆 ${timeStr}`); // 저녁
    } else {
      return chalk.blue(`🌙 ${timeStr}`); // 밤
    }
  }

  // 사용자 레벨/등급 표시
  userLevel(level) {
    const levels = {
      1: chalk.gray("🥉 브론즈"),
      2: chalk.white("🥈 실버"),
      3: chalk.yellow("🥇 골드"),
      4: chalk.cyan("💎 다이아몬드"),
      5: chalk.magenta("👑 마스터"),
    };

    return levels[level] || chalk.gray("🆕 신규");
  }
}

// 싱글톤으로 export
module.exports = new MessageStyler();
