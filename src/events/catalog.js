// src/events/catalog.js
/**
 * 📋 이벤트 카탈로그
 *
 * 명명 규칙: {domain}:{action}:{status?}
 * - domain: 이벤트가 속한 도메인
 * - action: 수행되는 작업
 * - status: 선택적 상태 (success, failed, pending 등)
 */

const EVENTS = {
  // 🖥️ 시스템 이벤트
  SYSTEM: {
    STARTUP: "system:startup",
    SHUTDOWN: "system:shutdown",
    ERROR: "system:error",
    READY: "system:ready",
    HEALTH_CHECK: "system:health_check",
    HEALTH_CHECK_PASSED: "system:health_check:passed",
    HEALTH_CHECK_FAILED: "system:health_check:failed"
  },

  // 👤 사용자 상호작용
  USER: {
    MESSAGE: "user:message",
    COMMAND: "user:command",
    CALLBACK: "user:callback",
    LOGIN: "user:login",
    LOGIN_SUCCESS: "user:login:success",
    LOGIN_FAILED: "user:login:failed",
    LOGOUT: "user:logout",
    SESSION_START: "user:session:start",
    SESSION_END: "user:session:end"
  },

  // 📝 할일 관련
  TODO: {
    CREATE: "todo:create", // 생성 요청
    CREATED: "todo:created", // 생성 완료
    UPDATE: "todo:update", // 수정 요청
    UPDATED: "todo:updated", // 수정 완료
    DELETE: "todo:delete", // 삭제 요청
    DELETED: "todo:deleted", // 삭제 완료
    COMPLETE: "todo:complete", // 완료 요청
    COMPLETED: "todo:completed", // 완료됨
    LIST: "todo:list", // 목록 요청
    LISTED: "todo:listed" // 목록 반환
  },

  // 🗓️ 일정 관련
  SCHEDULE: {
    CREATE: "schedule:create",
    CREATED: "schedule:created",
    UPDATE: "schedule:update",
    UPDATED: "schedule:updated",
    DELETE: "schedule:delete",
    DELETED: "schedule:deleted",
    REMINDER: "schedule:reminder",
    REMINDER_SENT: "schedule:reminder:sent"
  },

  // 🏈 스포츠 관련
  SPORTS: {
    MATCH_START: "sports:match:start",
    MATCH_END: "sports:match:end",
    SCORE_UPDATE: "sports:score:update",
    TEAM_UPDATE: "sports:team:update",
    STANDINGS_UPDATE: "sports:standings:update"
  },

  // 💾 데이터베이스
  DATABASE: {
    CONNECT: "database:connect",
    CONNECTED: "database:connected",
    DISCONNECT: "database:disconnect",
    DISCONNECTED: "database:disconnected",
    QUERY: "database:query",
    QUERY_SUCCESS: "database:query:success",
    QUERY_ERROR: "database:query:error",
    TRANSACTION_START: "database:transaction:start",
    TRANSACTION_COMMIT: "database:transaction:commit",
    TRANSACTION_ROLLBACK: "database:transaction:rollback"
  },

  // 🎨 렌더링
  RENDER: {
    REQUEST: "render:request",
    COMPLETE: "render:complete",
    ERROR: "render:error",
    MARKDOWN: "render:markdown",
    BUTTON: "render:button",
    MENU: "render:menu",
    UPDATE: "render:update"
  },

  // 🔔 알림
  NOTIFICATION: {
    SEND: "notification:send",
    SENT: "notification:sent",
    FAILED: "notification:failed",
    SCHEDULE: "notification:schedule",
    SCHEDULED: "notification:scheduled",
    CANCEL: "notification:cancel",
    CANCELLED: "notification:cancelled"
  },

  // 📊 통계/분석
  ANALYTICS: {
    TRACK: "analytics:track",
    PAGE_VIEW: "analytics:page_view",
    EVENT: "analytics:event",
    USER_ACTION: "analytics:user_action",
    ERROR: "analytics:error"
  },

  // 🔌 모듈 관련
  MODULE: {
    LOAD: "module:load",
    LOADED: "module:loaded",
    UNLOAD: "module:unload",
    UNLOADED: "module:unloaded",
    ERROR: "module:error",
    RESPONSE: "module:response"
  }
};

// 이벤트 스키마 정의
const EVENT_SCHEMAS = {
  // 사용자 메시지 스키마
  [EVENTS.USER.MESSAGE]: {
    userId: { type: "string", required: true },
    messageId: { type: "string", required: true },
    text: { type: "string", required: false },
    chat: { type: "object", required: true },
    timestamp: { type: "string", required: true }
  },

  // 사용자 명령어 스키마
  [EVENTS.USER.COMMAND]: {
    userId: { type: "string", required: true },
    command: { type: "string", required: true },
    args: { type: "array", required: false },
    chat: { type: "object", required: true }
  },

  // 콜백 쿼리 스키마
  [EVENTS.USER.CALLBACK]: {
    userId: { type: "string", required: true },
    callbackId: { type: "string", required: true },
    data: { type: "string", required: true },
    messageId: { type: "string", required: false }
  },

  // 할일 생성 스키마
  [EVENTS.TODO.CREATE]: {
    userId: { type: "string", required: true },
    text: { type: "string", required: true },
    priority: { type: "string", required: false },
    dueDate: { type: "string", required: false }
  },

  // 할일 생성 완료 스키마
  [EVENTS.TODO.CREATED]: {
    id: { type: "string", required: true },
    userId: { type: "string", required: true },
    text: { type: "string", required: true },
    createdAt: { type: "string", required: true }
  },

  // 렌더링 요청 스키마
  [EVENTS.RENDER.REQUEST]: {
    type: { type: "string", required: true },
    data: { type: "object", required: true },
    userId: { type: "string", required: true },
    options: { type: "object", required: false }
  },

  // 시스템 에러 스키마
  [EVENTS.SYSTEM.ERROR]: {
    error: { type: "string", required: true },
    stack: { type: "string", required: false },
    originalEvent: { type: "string", required: false },
    timestamp: { type: "string", required: true }
  }
};

module.exports = {
  EVENTS,
  EVENT_SCHEMAS
};
