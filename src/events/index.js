/**
 * 🎫 DoomockBot 이벤트 카탈로그
 * 모든 이벤트 타입을 여기서 정의 (지하철 노선도 같은 역할)
 */

const EVENTS = {
  // 🚀 시스템 이벤트
  SYSTEM: {
    STARTUP: "system:startup",
    SHUTDOWN: "system:shutdown",
    READY: "system:ready",
    ERROR: "system:error",
    HEALTH_CHECK: "system:health_check",
    MAINTENANCE: "system:maintenance"
  },

  // 👤 사용자 이벤트
  USER: {
    COMMAND: "user:command", // /start, /help 등
    CALLBACK: "user:callback", // 인라인 버튼 클릭
    MESSAGE: "user:message", // 일반 텍스트 메시지
    LOGIN: "user:login",
    LOGOUT: "user:logout",
    SESSION_START: "user:session:start",
    SESSION_END: "user:session:end"
  },

  // 📝 할일 관리 이벤트
  TODO: {
    CREATE_REQUEST: "todo:create:request",
    CREATED: "todo:created",
    UPDATE_REQUEST: "todo:update:request",
    UPDATED: "todo:updated",
    DELETE_REQUEST: "todo:delete:request",
    DELETED: "todo:deleted",
    COMPLETE_REQUEST: "todo:complete:request",
    COMPLETED: "todo:completed",
    LIST_REQUEST: "todo:list:request",
    LIST_READY: "todo:list:ready"
  },

  // ⏰ 타이머 이벤트
  TIMER: {
    START_REQUEST: "timer:start:request",
    STARTED: "timer:started",
    TICK: "timer:tick", // 매초 업데이트
    PAUSE_REQUEST: "timer:pause:request",
    PAUSED: "timer:paused",
    RESUME_REQUEST: "timer:resume:request",
    RESUMED: "timer:resumed",
    STOP_REQUEST: "timer:stop:request",
    STOPPED: "timer:stopped",
    COMPLETED: "timer:completed"
  },

  // 💼 근무시간 이벤트
  WORKTIME: {
    CLOCK_IN_REQUEST: "worktime:clock_in:request",
    CLOCKED_IN: "worktime:clocked_in",
    CLOCK_OUT_REQUEST: "worktime:clock_out:request",
    CLOCKED_OUT: "worktime:clocked_out",
    BREAK_START: "worktime:break:start",
    BREAK_END: "worktime:break:end",
    STATS_REQUEST: "worktime:stats:request",
    STATS_READY: "worktime:stats:ready"
  },

  // 🌤️ 날씨 이벤트
  WEATHER: {
    CURRENT_REQUEST: "weather:current:request",
    CURRENT_READY: "weather:current:ready",
    FORECAST_REQUEST: "weather:forecast:request",
    FORECAST_READY: "weather:forecast:ready",
    LOCATION_SET: "weather:location:set"
  },

  // 🔮 운세 이벤트
  FORTUNE: {
    REQUEST: "fortune:request",
    READY: "fortune:ready",
    DAILY_REQUEST: "fortune:daily:request",
    DAILY_READY: "fortune:daily:ready"
  },

  // 🎨 렌더링 이벤트
  RENDER: {
    MESSAGE_REQUEST: "render:message:request",
    MESSAGE_SENT: "render:message:sent",
    MENU_REQUEST: "render:menu:request",
    MENU_SENT: "render:menu:sent",
    ERROR_REQUEST: "render:error:request",
    ERROR_SENT: "render:error:sent",
    KEYBOARD_REQUEST: "render:keyboard:request",
    KEYBOARD_READY: "render:keyboard:ready"
  },

  // 🗺️ 네비게이션 이벤트
  NAVIGATION: {
    MODULE_SELECT: "navigation:module:select",
    MENU_SHOW: "navigation:menu:show",
    BACK_REQUEST: "navigation:back:request",
    HOME_REQUEST: "navigation:home:request",
    BREADCRUMB_UPDATE: "navigation:breadcrumb:update"
  },

  // 💾 데이터베이스 이벤트
  DATABASE: {
    CONNECT: "database:connect",
    DISCONNECT: "database:disconnect",
    QUERY: "database:query",
    TRANSACTION_START: "database:transaction:start",
    TRANSACTION_COMMIT: "database:transaction:commit",
    TRANSACTION_ROLLBACK: "database:transaction:rollback",
    ERROR: "database:error"
  }
};

// 🏷️ 이벤트 스키마 정의
const EVENT_SCHEMAS = {
  [EVENTS.USER.COMMAND]: {
    command: "string",
    userId: "number",
    chatId: "number",
    messageId: "number"
  },

  [EVENTS.USER.CALLBACK]: {
    data: "string",
    userId: "number",
    chatId: "number",
    messageId: "number"
  },

  [EVENTS.TODO.CREATE_REQUEST]: {
    text: "string",
    userId: "number",
    priority: "string", // 'high', 'medium', 'low'
    dueDate: "string" // ISO string, optional
  },

  [EVENTS.TODO.CREATED]: {
    id: "number",
    text: "string",
    userId: "number",
    priority: "string",
    createdAt: "string"
  },

  [EVENTS.TIMER.START_REQUEST]: {
    type: "string", // 'focus', 'short', 'long'
    duration: "number", // 분
    userId: "number"
  },

  [EVENTS.TIMER.STARTED]: {
    id: "string",
    type: "string",
    duration: "number",
    userId: "number",
    startTime: "string"
  },

  [EVENTS.RENDER.MESSAGE_REQUEST]: {
    chatId: "number",
    text: "string",
    options: "object" // Telegram options
  },

  [EVENTS.RENDER.MENU_REQUEST]: {
    chatId: "number",
    menuType: "string",
    options: "object"
  }
};

// 🎯 이벤트 우선순위 (높을수록 먼저 처리)
const EVENT_PRIORITIES = {
  [EVENTS.SYSTEM.ERROR]: 10,
  [EVENTS.SYSTEM.SHUTDOWN]: 9,
  [EVENTS.USER.COMMAND]: 8,
  [EVENTS.USER.CALLBACK]: 7,
  [EVENTS.RENDER.ERROR_REQUEST]: 6,
  [EVENTS.RENDER.MESSAGE_REQUEST]: 5,
  [EVENTS.TIMER.TICK]: 1,
  [EVENTS.DATABASE.QUERY]: 1
};

// 🔄 이벤트 플로우 체인 정의 (어떤 이벤트가 어떤 이벤트를 발생시키는지)
const EVENT_FLOWS = {
  [EVENTS.USER.COMMAND]: [
    EVENTS.NAVIGATION.MODULE_SELECT,
    EVENTS.RENDER.MENU_REQUEST
  ],

  [EVENTS.TODO.CREATE_REQUEST]: [
    EVENTS.DATABASE.QUERY,
    EVENTS.TODO.CREATED,
    EVENTS.RENDER.MESSAGE_REQUEST
  ],

  [EVENTS.TIMER.START_REQUEST]: [
    EVENTS.TIMER.STARTED,
    EVENTS.RENDER.MESSAGE_REQUEST
  ]
};

// 🎨 이벤트 색상 (로깅/모니터링용)
const EVENT_COLORS = {
  SYSTEM: "🔧",
  USER: "👤",
  TODO: "📝",
  TIMER: "⏰",
  WORKTIME: "💼",
  WEATHER: "🌤️",
  FORTUNE: "🔮",
  RENDER: "🎨",
  NAVIGATION: "🗺️",
  DATABASE: "💾"
};

module.exports = {
  EVENTS,
  EVENT_SCHEMAS,
  EVENT_PRIORITIES,
  EVENT_FLOWS,
  EVENT_COLORS
};
