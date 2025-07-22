function getMainMenuConfig() {
  return {
    todo: {
      text: "📝 할일 관리",
      callback_data: "todo:menu",
      emoji: "📝",
      priority: 1,
    },
    leave: {
      text: "📅 휴가 관리",
      callback_data: "leave:menu",
      emoji: "📅",
      priority: 2,
    },
    weather: {
      text: "🌤️ 날씨 정보",
      callback_data: "weather:menu",
      emoji: "🌤️",
      priority: 3,
    },
    fortune: {
      text: "🔮 오늘의 운세",
      callback_data: "fortune:menu",
      emoji: "🔮",
      priority: 4,
    },
    timer: {
      text: "⏰ 타이머",
      callback_data: "timer:menu",
      emoji: "⏰",
      priority: 5,
    },
    insight: {
      text: "📊 인사이트",
      callback_data: "insight:menu",
      emoji: "📊",
      priority: 6,
    },
    utils: {
      text: "🛠️ 유틸리티",
      callback_data: "utils:menu",
      emoji: "🛠️",
      priority: 7,
    },
    reminder: {
      text: "🔔 리마인더",
      callback_data: "reminder:menu",
      emoji: "🔔",
      priority: 8,
    },
    worktime: {
      text: "🕐 근무시간",
      callback_data: "worktime:menu",
      emoji: "🕐",
      priority: 9,
    },
  };
}

function getTodoMenuConfig() {
  return [
    { text: "📝 할일 추가", callback_data: "todo:add" },
    { text: "📋 할일 목록", callback_data: "todo:list" },
    { text: "✅ 완료한 할일", callback_data: "todo:done" },
    { text: "🗑️ 할일 삭제", callback_data: "todo:delete" },
  ];
}

function getLeaveMenuConfig() {
  return [
    { text: "📅 남은 연차 보기", callback_data: "leave:remaining" },
    { text: "➕ 연차 등록", callback_data: "leave:add" },
    { text: "🕓 연차 이력", callback_data: "leave:history" },
  ];
}

function getWeatherMenuConfig() {
  return [
    { text: "🏡 동탄 날씨", callback_data: "weather:dongtan" },
    { text: "📍 위치별 날씨", callback_data: "weather:location" },
  ];
}

function getFortuneMenuConfig() {
  return [
    { text: "🔮 오늘의 운세", callback_data: "fortune:today" },
    { text: "💼 업무 운세", callback_data: "fortune:work" },
    { text: "🍻 회식 운세", callback_data: "fortune:party" },
    { text: "🎴 타로 카드", callback_data: "fortune:tarot" },
    { text: "🔮 3장 스프레드", callback_data: "fortune:tarot3" },
  ];
}

function getTimerMenuConfig() {
  return [
    { text: "⏰ 타이머 시작", callback_data: "timer:start" },
    { text: "⏹️ 타이머 정지", callback_data: "timer:stop" },
  ];
}

function getInsightMenuConfig() {
  return [
    { text: "📈 오늘의 인사이트", callback_data: "insight:today" },
    { text: "🧠 명언 보기", callback_data: "insight:quote" },
  ];
}

function getUtilsMenuConfig() {
  return [
    { text: "🗣️ 말해줘(SAY)", callback_data: "say:message" },
    { text: "📌 공지사항", callback_data: "utils:notice" },
  ];
}

function getReminderMenuConfig() {
  return [
    { text: "🔔 리마인드 등록", callback_data: "remind:add" },
    { text: "📋 리마인드 목록", callback_data: "remind:list" },
  ];
}

module.exports = {
  getMainMenuConfig,
  getTodoMenuConfig,
  getLeaveMenuConfig,
  getWeatherMenuConfig,
  getFortuneMenuConfig,
  getTimerMenuConfig,
  getInsightMenuConfig,
  getUtilsMenuConfig,
  getReminderMenuConfig,
};
