// src/utils/TelegramFormatter.js

const logger = require("./Logger");
const { MessageStyler } = require("./MessageStyler");
const EnhancedBotResponses = require("./EnhancedBotResponses");
/**
 * 🎨 TelegramFormatter v3.0.1 - MarkdownV2 화려한 메시지 생성기
 *
 * 🌟 지원 기능:
 * - MarkdownV2 완벽 지원
 * - 동적 이모지 애니메이션
 * - 진행률 바
 * - 박스 스타일 메시지
 * - 사용자 친화적 UI
 */
class TelegramFormatter {
  constructor() {
    // 🎨 MarkdownV2 특수문자 이스케이프
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

    // 🌈 동적 이모지 세트
    this.emojiSets = {
      loading: ["⏳", "⌛", "⏳", "⌛"],
      celebration: ["🎉", "🎊", "✨", "🎁", "🎈"],
      success: ["✅", "🎯", "💯", "⭐", "🌟"],
      warning: ["⚠️", "🚨", "📢", "💡", "🔔"],
      error: ["❌", "💥", "🚫", "⛔", "😱"],
      time: ["🕐", "🕑", "🕒", "🕓", "🕔", "🕕"],
      weather: ["☀️", "⛅", "🌤️", "🌦️", "🌧️", "⛈️"],
      progress: ["▱", "▰"],
    };

    // 🎨 색상 코드 (MarkdownV2 스타일)
    this.styles = {
      bold: (text) => `*${this.escape(text)}*`,
      italic: (text) => `_${this.escape(text)}_`,
      code: (text) => `\`${this.escape(text)}\``,
      strikethrough: (text) => `~${this.escape(text)}~`,
      underline: (text) => `__${this.escape(text)}__`,
      spoiler: (text) => `||${this.escape(text)}||`,
      link: (text, url) => `[${this.escape(text)}](${url})`,
    };

    logger.success("🎨 TelegramFormatter v3.0.1 초기화 완료");
  }

  /**
   * 🔒 MarkdownV2 특수문자 이스케이프
   */
  escape(text) {
    if (!text) return "";
    let escaped = text.toString();
    for (const char of this.escapeChars) {
      escaped = escaped.replace(new RegExp("\\" + char, "g"), "\\" + char);
    }
    return escaped;
  }

  /**
   * 📦 화려한 박스 메시지 생성
   */
  createBox(title, content, style = "default") {
    const styles = {
      default: { border: "━", corner: "┃", title: "📋" },
      success: { border: "═", corner: "║", title: "✅" },
      error: { border: "═", corner: "║", title: "❌" },
      warning: { border: "─", corner: "│", title: "⚠️" },
      info: { border: "─", corner: "│", title: "ℹ️" },
      celebration: { border: "★", corner: "✦", title: "🎉" },
    };

    const boxStyle = styles[style] || styles.default;
    const line = boxStyle.border.repeat(30);

    return `
${boxStyle.corner}${line}${boxStyle.corner}
${boxStyle.corner} ${boxStyle.title} ${this.styles.bold(title)} ${
      boxStyle.corner
    }
${boxStyle.corner}${line}${boxStyle.corner}
${boxStyle.corner} ${content} ${boxStyle.corner}
${boxStyle.corner}${line}${boxStyle.corner}
    `.trim();
  }

  /**
   * 📊 동적 진행률 바 생성
   */
  createProgressBar(current, total, width = 10, showPercentage = true) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(width * (current / total));
    const empty = width - filled;

    // 동적 색상 (이모지로 표현)
    const getProgressEmoji = (percent) => {
      if (percent >= 100) return "🟢";
      if (percent >= 75) return "🟡";
      if (percent >= 50) return "🟠";
      if (percent >= 25) return "🔴";
      return "⚫";
    };

    const filledBar = "▰".repeat(filled);
    const emptyBar = "▱".repeat(empty);
    const emoji = getProgressEmoji(percentage);

    const bar = `${emoji} \`${filledBar}${emptyBar}\``;

    return showPercentage
      ? `${bar} ${this.styles.bold(percentage + "%")}`
      : bar;
  }

  /**
   * 🎯 메뉴 카드 생성 (화려한 메인 메뉴)
   */
  createMenuCard(userName, stats) {
    const timeEmoji = this.getTimeEmoji();
    const greeting = this.getGreeting();

    return `
${this.styles.bold("🏠 메인 메뉴")}

${timeEmoji} ${greeting}, ${this.styles.bold(userName)}님\\!

━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ${this.styles.bold("오늘의 현황")}

📝 할일: ${this.styles.code(stats.todos + "개")}
⏰ 타이머: ${this.styles.code(stats.timers + "개")}  
🏢 근무: ${this.styles.code(stats.workHours + "시간")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${this.styles.italic("원하는 기능을 선택해주세요\\!")}
    `.trim();
  }

  /**
   * 📝 Todo 목록 카드 (화려한 할일 목록)
   */
  createTodoListCard(todos, pagination) {
    const { currentPage, totalPages, totalCount } = pagination;

    let content = `
${this.styles.bold("📝 할일 목록")}

${this.createProgressBar(todos.filter((t) => t.completed).length, todos.length)}
완료률: ${Math.round(
      (todos.filter((t) => t.completed).length / todos.length) * 100
    )}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    todos.forEach((todo, index) => {
      const status = todo.completed ? "✅" : "⏳";
      const priority = "🔥".repeat(todo.priority || 1);
      const text = todo.completed
        ? this.styles.strikethrough(todo.title)
        : this.styles.bold(todo.title);

      content += `\n${status} ${text} ${priority}`;

      if (todo.dueDate) {
        const isOverdue = new Date(todo.dueDate) < new Date();
        const dueDateText = isOverdue
          ? `🚨 ${this.styles.bold("기한 초과")}`
          : `⏰ ${todo.dueDate}`;
        content += `\n   ${dueDateText}`;
      }
    });

    content += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    content += `\n📄 페이지: ${this.styles.code(
      currentPage + "/" + totalPages
    )}`;
    content += `\n📊 전체: ${this.styles.code(totalCount + "개")}`;

    return content;
  }

  /**
   * ⏰ 타이머 상태 카드 (실시간 업데이트)
   */
  createTimerCard(timer) {
    const { name, duration, elapsed, isRunning } = timer;
    const remaining = duration - elapsed;
    const progress = (elapsed / duration) * 100;

    const statusEmoji = isRunning ? "▶️" : "⏸️";
    const urgencyEmoji = remaining < 300 ? "🚨" : remaining < 900 ? "⚠️" : "⏰";

    return `
${statusEmoji} ${this.styles.bold(name)}

${this.createProgressBar(elapsed, duration, 15)}

${urgencyEmoji} 남은 시간: ${this.styles.bold(this.formatTime(remaining))}
⏱️ 경과 시간: ${this.styles.code(this.formatTime(elapsed))}
🎯 목표 시간: ${this.styles.code(this.formatTime(duration))}

${
  isRunning
    ? `${this.styles.italic("타이머가 실행 중입니다\\.")}`
    : `${this.styles.italic("타이머가 일시정지되었습니다\\.")}`
}
    `.trim();
  }

  /**
   * 🏢 근무시간 대시보드 (시각적 근무 현황)
   */
  createWorkDashboard(workData) {
    const { checkInTime, currentWorkHours, targetHours, breaks } = workData;
    const progress = (currentWorkHours / targetHours) * 100;
    const overtime = currentWorkHours > targetHours;

    let content = `
${this.styles.bold("🏢 근무시간 대시보드")}

${this.getWorkStatusEmoji(progress)} ${this.styles.bold("현재 상태")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

🕐 출근: ${this.styles.code(checkInTime)}
⏰ 현재 근무: ${this.styles.bold(this.formatTime(currentWorkHours * 60))}
🎯 목표 시간: ${this.styles.code(this.formatTime(targetHours * 60))}

${this.createProgressBar(currentWorkHours, targetHours, 12)}
`;

    if (overtime) {
      const overtimeHours = currentWorkHours - targetHours;
      content += `\n🔥 초과 근무: ${this.styles.bold(
        this.formatTime(overtimeHours * 60)
      )}`;
    }

    if (breaks.length > 0) {
      content += `\n\n☕ ${this.styles.bold("휴식 기록")}`;
      breaks.forEach((brk) => {
        content += `\n   ⏸️ ${brk.start} - ${brk.end} (${brk.duration}분)`;
      });
    }

    return content;
  }

  /**
   * 🌤️ 날씨 카드 (동적 날씨 정보)
   */
  createWeatherCard(weather) {
    const { city, temp, feelsLike, condition, humidity, wind } = weather;
    const weatherEmoji = this.getWeatherEmoji(condition);
    const tempColor = this.getTempColor(temp);

    return `
${weatherEmoji} ${this.styles.bold(city + " 날씨")}

🌡️ 온도: ${tempColor(temp + "°C")} (체감 ${feelsLike}°C)
☁️ 상태: ${this.styles.bold(condition)}
💧 습도: ${this.styles.code(humidity + "%")}
💨 바람: ${this.styles.code(wind + "km/h")}

${this.createProgressBar(humidity, 100, 10)}
습도

${this.getWeatherAdvice(temp, condition)}
    `.trim();
  }

  /**
   * 🔔 알림 카드 (긴급도별 스타일링)
   */
  createNotificationCard(notification) {
    const { title, message, urgency, time } = notification;
    const urgencyStyles = {
      low: { emoji: "ℹ️", style: "info" },
      medium: { emoji: "⚠️", style: "warning" },
      high: { emoji: "🚨", style: "error" },
      critical: { emoji: "💥", style: "error" },
    };

    const style = urgencyStyles[urgency] || urgencyStyles.medium;

    return this.createBox(
      `${style.emoji} ${title}`,
      `
${this.styles.bold(message)}

⏰ 시간: ${this.styles.code(time)}
🚨 긴급도: ${this.styles.bold(urgency.toUpperCase())}
      `.trim(),
      style.style
    );
  }

  /**
   * 🎉 성공 애니메이션 메시지
   */
  createSuccessAnimation(title, message) {
    const celebrationEmojis = this.emojiSets.celebration.join(" ");

    return `
${celebrationEmojis}

${this.styles.bold("🎊 " + title + " 🎊")}

${this.styles.italic(message)}

${celebrationEmojis}
    `.trim();
  }

  /**
   * ❌ 에러 메시지 (사용자 친화적)
   */
  createErrorMessage(error, suggestion) {
    return this.createBox(
      "❌ 오류 발생",
      `
${this.styles.bold(error)}

💡 ${this.styles.italic("해결 방법:")}
${suggestion}

🔄 ${this.styles.underline("다시 시도하거나 관리자에게 문의해주세요\\.")}
      `.trim(),
      "error"
    );
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  getTimeEmoji() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "🌅";
    if (hour >= 12 && hour < 18) return "☀️";
    if (hour >= 18 && hour < 22) return "🌆";
    return "🌙";
  }

  getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "좋은 아침";
    if (hour >= 12 && hour < 17) return "좋은 오후";
    if (hour >= 17 && hour < 22) return "좋은 저녁";
    return "안녕하세요";
  }

  getWorkStatusEmoji(progress) {
    if (progress >= 100) return "🎯";
    if (progress >= 75) return "🟢";
    if (progress >= 50) return "🟡";
    if (progress >= 25) return "🟠";
    return "🔴";
  }

  getWeatherEmoji(condition) {
    const weatherMap = {
      sunny: "☀️",
      clear: "🌞",
      cloudy: "☁️",
      rainy: "🌧️",
      stormy: "⛈️",
      snowy: "❄️",
      foggy: "🌫️",
      windy: "💨",
    };
    return weatherMap[condition.toLowerCase()] || "🌤️";
  }

  getTempColor(temp) {
    if (temp > 30) return this.styles.bold; // 더움
    if (temp > 20) return (text) => text; // 보통
    if (temp > 10) return this.styles.italic; // 시원함
    return this.styles.bold; // 추움
  }

  getWeatherAdvice(temp, condition) {
    if (temp < 0) return "🧥 " + this.styles.bold("따뜻하게 입으세요\\!");
    if (temp < 10) return "🧥 " + this.styles.italic("겉옷을 챙기세요\\!");
    if (temp < 20) return "👔 " + this.styles.italic("가벼운 긴팔이 좋아요\\!");
    if (temp < 28) return "👕 " + this.styles.italic("반팔이 적당해요\\!");
    return "🌊 " + this.styles.bold("시원하게 입으세요\\!");
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  }
}

module.exports = {
  TelegramFormatter: new TelegramFormatter(),
  // EnhancedBotResponses: new EnhancedBotResponses(),
};

// 모듈에서 사용법:
// const enhancedResponses = require("../utils/EnhancedBotResponses");

// 화려한 메인 메뉴 전송
// await enhancedResponses.sendMainMenu(bot, chatId, userName, {
//   todos: 5,
//   timers: 2,
//   workHours: 7.5
// });

// // 성공 애니메이션
// await enhancedResponses.sendSuccessAnimation(bot, chatId,
//   "할일 추가 완료!",
//   "새로운 할일이 성공적으로 추가되었습니다!"
// );

// // 사용자 친화적 에러
// await enhancedResponses.sendFriendlyError(bot, chatId,
//   "할일을 찾을 수 없습니다",
//   "목록을 새로고침하거나 새로운 할일을 추가해보세요"
// );
