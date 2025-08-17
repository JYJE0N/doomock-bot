/**
 * 🎫 DoomockBot 이벤트 카탈로그 - 통합 버전
 * EventRegistry를 기반으로 모든 이벤트 타입을 관리
 */

// 새로운 EventRegistry 사용
const {
  EVENTS,
  EVENT_SCHEMAS,
  EVENT_PRIORITIES,
  EVENT_FLOWS,
  EVENT_COLORS,
  EventRegistry,
  getEventRegistry
} = require("./EventRegistry");

// 레거시 호환성을 위한 내보내기
module.exports = {
  EVENTS,
  EVENT_SCHEMAS,
  EVENT_PRIORITIES,
  EVENT_FLOWS,
  EVENT_COLORS,
  // 새로운 기능들
  EventRegistry,
  getEventRegistry
};
