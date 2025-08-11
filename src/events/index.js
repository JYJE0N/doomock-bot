// src/events/index.js
module.exports = {
  // 🖥️ 시스템 이벤트
  SYSTEM: {
    STARTUP: "system:startup",
    SHUTDOWN: "system:shutdown",
    ERROR: "system:error",
    READY: "system:ready"
  },

  // 👤 사용자 상호작용
  USER: {
    MESSAGE: "user:message", // 일반 메시지
    COMMAND: "user:command", // 명령어
    CALLBACK: "user:callback", // 콜백 버튼
    NATURAL_LANGUAGE: "user:natural" // 자연어 처리
  },

  // 🎨 UI 렌더링
  RENDER: {
    MENU: "render:menu", // 메뉴 렌더링
    MESSAGE: "render:message", // 메시지 전송
    KEYBOARD: "render:keyboard", // 키보드 생성
    UPDATE: "render:update" // 메시지 업데이트
  },

  // 📱 모듈 이벤트
  MODULE: {
    TODO_CREATE: "module:todo:create",
    TODO_COMPLETE: "module:todo:complete",
    TODO_LIST: "module:todo:list",

    TIMER_START: "module:timer:start",
    TIMER_STOP: "module:timer:stop",
    TIMER_TICK: "module:timer:tick",

    WORKTIME_CHECKIN: "module:worktime:checkin",
    WORKTIME_CHECKOUT: "module:worktime:checkout"
  },

  // 💾 데이터베이스
  DATABASE: {
    CONNECTED: "database:connected",
    ERROR: "database:error",
    QUERY: "database:query"
  }
};
