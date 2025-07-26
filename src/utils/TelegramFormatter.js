// src/utils/TelegramFormatter.js - 텔레그램 메시지 포맷터
const TimeHelper = require("./TimeHelper");

/**
 * 🎨 텔레그램 메시지 포맷터
 * 알록달록하고 예쁜 메시지 생성
 */
class TelegramFormatter {
  constructor() {
    // 이모지 팔레트
    this.emojis = {
      // 상태
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
      question: "❓",
      exclamation: "❗",

      // 장식
      star: "⭐",
      sparkles: "✨",
      fire: "🔥",
      rocket: "🚀",
      rainbow: "🌈",
      heart: "❤️",

      // 구분선
      dot: "•",
      arrow: "➤",
      check: "✓",
      bullet: "▸",

      // 숫자
      one: "1️⃣",
      two: "2️⃣",
      three: "3️⃣",
      four: "4️⃣",
      five: "5️⃣",

      // 시간
      clock: "🕐",
      calendar: "📅",
      alarm: "⏰",

      // 기타
      folder: "📁",
      document: "📄",
      pin: "📌",
      label: "🏷️",
      link: "🔗",
      key: "🔑",
    };

    // 장식 테두리
    this.borders = {
      simple: {
        top: "━━━━━━━━━━━━━━━━━━━━",
        bottom: "━━━━━━━━━━━━━━━━━━━━",
        left: "┃",
        right: "┃",
      },
      double: {
        top: "═══════════════════",
        bottom: "═══════════════════",
        left: "║",
        right: "║",
      },
      rounded: {
        topLeft: "╭",
        topRight: "╮",
        bottomLeft: "╰",
        bottomRight: "╯",
        horizontal: "─",
        vertical: "│",
      },
      fancy: {
        top: "⋆⋅☆⋅⋆ ───────────",
        bottom: "─────────── ⋆⋅☆⋅⋆",
        divider: "· · • • • ✤ • • • · ·",
      },
    };

    // 메시지 템플릿
    this.templates = {
      welcome: (userName) => `
🌈 <b>환영합니다, ${userName}님!</b> 🌈

✨ 두목봇과 함께하는 즐거운 하루 되세요!
${this.borders.fancy.divider}

🎯 <b>주요 기능</b>
${this.emojis.bullet} <code>/todo</code> - 할일 관리
${this.emojis.bullet} <code>/timer</code> - 타이머 설정
${this.emojis.bullet} <code>/weather</code> - 날씨 확인
${this.emojis.bullet} <code>/help</code> - 도움말

${this.borders.fancy.bottom}
`,

      success: (title, message) => `
${this.emojis.success} <b>${title}</b>

${message}

<i>✨ 성공적으로 완료되었습니다!</i>
`,

      error: (title, message) => `
${this.emojis.error} <b>${title}</b>

${message}

<i>다시 시도해 주세요.</i>
`,

      list: (title, items, options = {}) => {
        const emoji = options.emoji || this.emojis.bullet;
        const itemsText = items
          .map((item, index) => {
            const itemEmoji = options.numbered
              ? this.getNumberEmoji(index + 1)
              : emoji;
            return `${itemEmoji} ${item}`;
          })
          .join("\n");

        return `
📋 <b>${title}</b>
${this.borders.simple.top}

${itemsText}

${this.borders.simple.bottom}
`;
      },

      card: (title, content, footer) => `
${this.createRoundedBox(`
  🎯 <b>${title}</b>
  
  ${content}
  
  ${footer ? `<i>${footer}</i>` : ""}
`)}
`,

      notification: (type, message) => {
        const types = {
          info: { emoji: "ℹ️", color: "🔵" },
          success: { emoji: "✅", color: "🟢" },
          warning: { emoji: "⚠️", color: "🟡" },
          error: { emoji: "❌", color: "🔴" },
        };

        const { emoji, color } = types[type] || types.info;

        return `
${color} ${emoji} <b>알림</b> ${emoji} ${color}

${message}
`;
      },
    };
  }

  /**
   * 숫자 이모지 변환
   */
  getNumberEmoji(num) {
    const numbers = [
      "0️⃣",
      "1️⃣",
      "2️⃣",
      "3️⃣",
      "4️⃣",
      "5️⃣",
      "6️⃣",
      "7️⃣",
      "8️⃣",
      "9️⃣",
      "🔟",
    ];
    return num <= 10 ? numbers[num] : `${num}.`;
  }

  /**
   * 둥근 테두리 박스 생성
   */
  createRoundedBox(content) {
    const lines = content.trim().split("\n");
    const maxLength = Math.max(
      ...lines.map((line) => this.stripTags(line).length)
    );
    const padding = 2;

    const top = `╭${"─".repeat(maxLength + padding * 2)}╮`;
    const bottom = `╰${"─".repeat(maxLength + padding * 2)}╯`;

    const boxedLines = lines.map((line) => {
      const stripped = this.stripTags(line);
      const pad = maxLength - stripped.length;
      return `│${" ".repeat(padding)}${line}${" ".repeat(pad + padding)}│`;
    });

    return [top, ...boxedLines, bottom].join("\n");
  }

  /**
   * HTML 태그 제거 (길이 계산용)
   */
  stripTags(text) {
    return text.replace(/<[^>]*>/g, "").replace(/[^\x00-\x7F]/g, "xx");
  }

  /**
   * 진행률 바 생성
   */
  createProgressBar(current, total, width = 10) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * width);
    const empty = width - filled;

    const bar = "█".repeat(filled) + "░".repeat(empty);

    return `${bar} ${percentage}%`;
  }

  /**
   * 할일 목록 포맷
   */
  formatTodoList(todos) {
    if (todos.length === 0) {
      return this.templates.notification(
        "info",
        "📝 할일이 없습니다.\n새로운 할일을 추가해보세요!"
      );
    }

    const items = todos.map((todo, index) => {
      const status = todo.completed ? "✅" : "⬜";
      const priority = "⭐".repeat(todo.priority || 1);
      const text = todo.completed
        ? `<s>${todo.text}</s>`
        : `<b>${todo.text}</b>`;

      return `${status} ${text} ${priority}`;
    });

    return this.templates.list("📝 할일 목록", items, { numbered: false });
  }

  /**
   * 메뉴 생성
   */
  createMenu(title, items, columns = 2) {
    const keyboard = [];
    let row = [];

    items.forEach((item, index) => {
      row.push({
        text: `${item.emoji || "•"} ${item.text}`,
        callback_data: item.data,
      });

      if ((index + 1) % columns === 0) {
        keyboard.push(row);
        row = [];
      }
    });

    if (row.length > 0) {
      keyboard.push(row);
    }

    const menuText = `
🎯 <b>${title}</b>

<i>원하는 기능을 선택하세요:</i>
`;

    return {
      text: menuText,
      reply_markup: {
        inline_keyboard: keyboard,
      },
    };
  }

  /**
   * 시간 포맷 (예쁘게)
   */
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return `방금 전`;
  }

  /**
   * 통계 카드 생성
   */
  createStatsCard(stats) {
    const items = Object.entries(stats).map(([key, value]) => {
      const label = this.camelToKorean(key);
      return `${this.emojis.bullet} ${label}: <b>${value}</b>`;
    });

    return `
📊 <b>통계</b>
${this.borders.rounded.topLeft}${"─".repeat(20)}${this.borders.rounded.topRight}
${items.map((item) => `${this.borders.rounded.vertical} ${item}`).join("\n")}
${this.borders.rounded.bottomLeft}${"─".repeat(20)}${
      this.borders.rounded.bottomRight
    }
`;
  }

  /**
   * camelCase를 한글로 변환
   */
  camelToKorean(text) {
    const translations = {
      totalTodos: "전체 할일",
      completedTodos: "완료된 할일",
      pendingTodos: "대기중인 할일",
      todayAdded: "오늘 추가됨",
      // 필요에 따라 추가
    };

    return translations[text] || text;
  }
}

// 싱글톤 인스턴스
let formatterInstance = null;

function getFormatter() {
  if (!formatterInstance) {
    formatterInstance = new TelegramFormatter();
  }
  return formatterInstance;
}

module.exports = { TelegramFormatter, getFormatter };

// 애니메이션 효과 (연속 메시지)
// const loadingMessage = await bot.sendMessage(chatId, '⏳ 처리중...');
// await new Promise(resolve => setTimeout(resolve, 1000));
// await bot.editMessageText('⏳ 처리중... 50%', {
//   chat_id: chatId,
//   message_id: loadingMessage.message_id
// });
// await new Promise(resolve => setTimeout(resolve, 1000));
// await bot.editMessageText('✅ 완료!', {
//   chat_id: chatId,
//   message_id: loadingMessage.message_id
// });

// 이모지 애니메이션
// const emojis = ['🌑', '🌒', '🌓', '🌔', '🌕'];
// for (const emoji of emojis) {
//   await bot.editMessageText(emoji, {
//     chat_id: chatId,
//     message_id: messageId
//   });
//   await new Promise(resolve => setTimeout(resolve, 200));
// }

/*
// 모듈에서 사용
const { getFormatter } = require('../utils/TelegramFormatter');
const formatter = getFormatter();

// 환영 메시지
await bot.sendMessage(chatId, formatter.templates.welcome(userName), {
  parse_mode: 'HTML'
});

// 성공 메시지
await bot.sendMessage(chatId, formatter.templates.success(
  '할일 추가 완료!',
  '새로운 할일이 추가되었습니다.'
), {
  parse_mode: 'HTML'
});

// 할일 목록
const todos = [
  { text: '코딩하기', completed: true, priority: 3 },
  { text: '운동하기', completed: false, priority: 2 }
];
await bot.sendMessage(chatId, formatter.formatTodoList(todos), {
  parse_mode: 'HTML'
});

// 메뉴 생성
const menu = formatter.createMenu('메인 메뉴', [
  { emoji: '📝', text: '할일 관리', data: 'todo:menu' },
  { emoji: '⏰', text: '타이머', data: 'timer:menu' },
  { emoji: '🌤️', text: '날씨', data: 'weather:menu' },
  { emoji: '⚙️', text: '설정', data: 'system:settings' }
]);

await bot.sendMessage(chatId, menu.text, {
  parse_mode: 'HTML',
  reply_markup: menu.reply_markup
});
*/
