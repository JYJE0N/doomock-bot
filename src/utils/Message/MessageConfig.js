// src/utils/Message/MessageConfig.js
/**
 * 🎨 Message 시스템 설정 관리
 */
const MessageConfig = {
  // 기본 설정
  defaults: {
    parseMode: "MarkdownV2",
    disableWebPagePreview: true,
    enableConsoleLog: true,
    enableFallback: true
  },

  // 모듈별 이모지
  moduleEmojis: {
    todo: "📝",
    timer: "⏰",
    worktime: "🏢",
    fortune: "🔮",
    weather: "🌤️",
    reminder: "🔔",
    system: "🤖"
  },

  // 키보드 템플릿
  keyboards: {
    mainMenu: [
      [
        { text: "📝 할일 관리", callback_data: "todo:menu" },
        { text: "⏰ 타이머", callback_data: "timer:menu" }
      ],
      [
        { text: "🏢 근무시간", callback_data: "worktime:menu" },
        { text: "🔔 리마인더", callback_data: "reminder:menu" }
      ],
      [
        { text: "🔮 운세", callback_data: "fortune:menu" },
        { text: "🌤️ 날씨", callback_data: "weather:menu" }
      ],
      [
        { text: "⚙️ 설정", callback_data: "system:settings" },
        { text: "❓ 도움말", callback_data: "system:help" }
      ]
    ],

    backToMenu: [[{ text: "🔙 메인 메뉴", callback_data: "system:menu" }]],

    yesNo: [
      [
        { text: "✅ 예", callback_data: "confirm:yes" },
        { text: "❌ 아니오", callback_data: "confirm:no" }
      ]
    ]
  },

  // 메시지 템플릿
  templates: {
    loading: "⏳ 처리 중입니다...",
    error: "❌ 오류가 발생했습니다.",
    success: "✅ 완료되었습니다!",
    notFound: "🔍 항목을 찾을 수 없습니다.",
    permission: "🚫 권한이 없습니다."
  }
};

module.exports = MessageConfig;
