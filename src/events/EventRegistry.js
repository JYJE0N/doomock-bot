/**
 * 🎯 DoomockBot EventRegistry
 * 통합된 이벤트 정의 및 스키마 레지스트리
 */

const logger = require("../utils/core/Logger");

// 🎫 모든 이벤트 타입 정의
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
    COMMAND: "user:command",
    CALLBACK: "user:callback", 
    MESSAGE: "user:message",
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
    TICK: "timer:tick",
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

  // 🏖️ 휴가 관리 이벤트
  LEAVE: {
    APPLY_REQUEST: "leave:apply:request",
    APPLIED: "leave:applied",
    APPROVE_REQUEST: "leave:approve:request", 
    APPROVED: "leave:approved",
    REJECT_REQUEST: "leave:reject:request",
    REJECTED: "leave:rejected",
    CANCEL_REQUEST: "leave:cancel:request",
    CANCELLED: "leave:cancelled",
    LIST_REQUEST: "leave:list:request",
    LIST_READY: "leave:list:ready"
  },

  // 🌤️ 날씨 이벤트  
  WEATHER: {
    // 현재 날씨 관련
    CURRENT_REQUEST: "weather:current:request",
    CURRENT_READY: "weather:current:ready",
    CURRENT_ERROR: "weather:current:error",
    
    // 예보 관련
    FORECAST_REQUEST: "weather:forecast:request", 
    FORECAST_READY: "weather:forecast:ready",
    FORECAST_ERROR: "weather:forecast:error",
    
    // 도시별 날씨 관련
    CITY_REQUEST: "weather:city:request",
    CITY_READY: "weather:city:ready",
    CITY_LIST_REQUEST: "weather:city:list:request",
    CITY_LIST_READY: "weather:city:list:ready",
    
    // 설정 관련
    DEFAULT_CITY_SET: "weather:default:city:set",
    DEFAULT_CITY_REQUEST: "weather:default:city:request",
    LOCATION_SET: "weather:location:set",
    
    // 메뉴 관련
    MENU_REQUEST: "weather:menu:request",
    MENU_READY: "weather:menu:ready",
    
    // 도움말
    HELP_REQUEST: "weather:help:request",
    HELP_READY: "weather:help:ready"
  },

  // 🔮 운세 이벤트
  FORTUNE: {
    REQUEST: "fortune:request",
    READY: "fortune:ready",
    DAILY_REQUEST: "fortune:daily:request",
    DAILY_READY: "fortune:daily:ready",
    TAROT_REQUEST: "fortune:tarot:request",
    TAROT_READY: "fortune:tarot:ready"
  },

  // 🔊 TTS 이벤트
  TTS: {
    CONVERT_REQUEST: "tts:convert:request",
    CONVERTED: "tts:converted", 
    PLAY_REQUEST: "tts:play:request",
    PLAYED: "tts:played",
    ERROR: "tts:error"
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
    CONNECTED: "database:connected",
    DISCONNECT: "database:disconnect",
    QUERY: "database:query", 
    QUERY_SUCCESS: "database:query:success",
    QUERY_ERROR: "database:query:error",
    TRANSACTION_START: "database:transaction:start",
    TRANSACTION_COMMIT: "database:transaction:commit",
    TRANSACTION_ROLLBACK: "database:transaction:rollback",
    ERROR: "database:error"
  },

  // 🔧 모듈 이벤트
  MODULE: {
    LOAD_REQUEST: "module:load:request",
    LOADED: "module:loaded",
    UNLOAD_REQUEST: "module:unload:request", 
    UNLOADED: "module:unloaded",
    INITIALIZE: "module:initialize",
    INITIALIZED: "module:initialized",
    ERROR: "module:error"
  }
};

// 🏷️ 이벤트 스키마 정의 (상세한 검증 스키마)
const EVENT_SCHEMAS = {
  // 사용자 명령어
  [EVENTS.USER.COMMAND]: {
    command: { type: "string", required: true },
    userId: { type: "number", required: true },
    chatId: { type: "number", required: true },
    messageId: { type: "number", required: false },
    args: { type: "array", required: false }
  },

  // 사용자 콜백
  [EVENTS.USER.CALLBACK]: {
    data: { type: "string", required: true },
    userId: { type: "number", required: true },
    chatId: { type: "number", required: true },
    messageId: { type: "number", required: false }
  },

  // 사용자 메시지
  [EVENTS.USER.MESSAGE]: {
    text: { type: "string", required: true },
    userId: { type: "number", required: true },
    chatId: { type: "number", required: true },
    messageId: { type: "number", required: false }
  },

  // 할일 생성 요청
  [EVENTS.TODO.CREATE_REQUEST]: {
    text: { type: "string", required: true },
    userId: { type: "number", required: true },
    priority: { type: "string", required: false, enum: ["high", "medium", "low"] },
    dueDate: { type: "string", required: false }
  },

  // 할일 생성 완료 
  [EVENTS.TODO.CREATED]: {
    id: { type: "string", required: true },
    text: { type: "string", required: true },
    userId: { type: "number", required: true },
    priority: { type: "string", required: false },
    createdAt: { type: "string", required: true }
  },

  // 타이머 시작 요청
  [EVENTS.TIMER.START_REQUEST]: {
    type: { type: "string", required: true, enum: ["focus", "short", "long", "custom"] },
    duration: { type: "number", required: true },
    userId: { type: "number", required: true },
    chatId: { type: "number", required: true }
  },

  // 타이머 시작됨
  [EVENTS.TIMER.STARTED]: {
    id: { type: "string", required: true },
    type: { type: "string", required: true },
    duration: { type: "number", required: true },
    userId: { type: "number", required: true },
    startTime: { type: "string", required: true }
  },

  // 렌더링 메시지 요청
  [EVENTS.RENDER.MESSAGE_REQUEST]: {
    chatId: { type: "number", required: true },
    text: { type: "string", required: true },
    options: { type: "object", required: false }
  },

  // 렌더링 메뉴 요청
  [EVENTS.RENDER.MENU_REQUEST]: {
    chatId: { type: "number", required: true },
    menuType: { type: "string", required: true },
    data: { type: "object", required: false },
    options: { type: "object", required: false }
  },

  // === 날씨 이벤트 스키마 ===
  
  // 현재 날씨 요청
  [EVENTS.WEATHER.CURRENT_REQUEST]: {
    userId: { type: "number", required: true },
    chatId: { type: "number", required: true },
    cityId: { type: "string", required: false },
    cityName: { type: "string", required: false }
  },

  // 현재 날씨 응답
  [EVENTS.WEATHER.CURRENT_READY]: {
    userId: { type: "number", required: true },
    chatId: { type: "number", required: true },
    weather: { type: "object", required: true },
    cityInfo: { type: "object", required: true }
  },

  // 예보 요청
  [EVENTS.WEATHER.FORECAST_REQUEST]: {
    userId: { type: "number", required: true },
    chatId: { type: "number", required: true },
    cityId: { type: "string", required: false },
    days: { type: "number", required: false }
  },

  // 도시별 날씨 요청
  [EVENTS.WEATHER.CITY_REQUEST]: {
    userId: { type: "number", required: true },
    chatId: { type: "number", required: true },
    cityId: { type: "string", required: true }
  },

  // 도시 목록 요청
  [EVENTS.WEATHER.CITY_LIST_REQUEST]: {
    userId: { type: "number", required: true },
    chatId: { type: "number", required: true }
  },

  // 기본 도시 설정
  [EVENTS.WEATHER.DEFAULT_CITY_SET]: {
    userId: { type: "number", required: true },
    cityId: { type: "string", required: true },
    cityName: { type: "string", required: true }
  },

  // 날씨 메뉴 요청
  [EVENTS.WEATHER.MENU_REQUEST]: {
    userId: { type: "number", required: true },
    chatId: { type: "number", required: true }
  },

  // 시스템 에러
  [EVENTS.SYSTEM.ERROR]: {
    error: { type: "string", required: true },
    module: { type: "string", required: false },
    userId: { type: "number", required: false },
    stack: { type: "string", required: false },
    timestamp: { type: "string", required: true }
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
  [EVENTS.TODO.CREATE_REQUEST]: 4,
  [EVENTS.TIMER.START_REQUEST]: 4,
  [EVENTS.TIMER.TICK]: 2,
  [EVENTS.DATABASE.QUERY]: 1
};

// 🔄 이벤트 플로우 체인 (어떤 이벤트가 어떤 이벤트를 트리거하는지)
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
  ],

  [EVENTS.SYSTEM.ERROR]: [
    EVENTS.RENDER.ERROR_REQUEST
  ]
};

// 🎨 이벤트 카테고리별 색상/아이콘
const EVENT_COLORS = {
  SYSTEM: { icon: "🔧", color: "blue" },
  USER: { icon: "👤", color: "green" },
  TODO: { icon: "📝", color: "yellow" },
  TIMER: { icon: "⏰", color: "orange" },
  WORKTIME: { icon: "💼", color: "purple" },
  LEAVE: { icon: "🏖️", color: "cyan" },
  WEATHER: { icon: "🌤️", color: "lightblue" },
  FORTUNE: { icon: "🔮", color: "magenta" },
  TTS: { icon: "🔊", color: "pink" },
  RENDER: { icon: "🎨", color: "red" },
  NAVIGATION: { icon: "🗺️", color: "brown" },
  DATABASE: { icon: "💾", color: "gray" },
  MODULE: { icon: "🔧", color: "white" }
};

// 📊 EventRegistry 클래스
class EventRegistry {
  constructor() {
    this.events = EVENTS;
    this.schemas = EVENT_SCHEMAS;
    this.priorities = EVENT_PRIORITIES;
    this.flows = EVENT_FLOWS;
    this.colors = EVENT_COLORS;

    logger.info("🎫 EventRegistry 초기화 완료");
  }

  // 🔍 이벤트 존재 확인
  hasEvent(eventName) {
    return this.getAllEvents().includes(eventName);
  }

  // 📋 모든 이벤트 목록 가져오기
  getAllEvents() {
    const allEvents = [];
    
    Object.values(this.events).forEach(category => {
      if (typeof category === 'object') {
        Object.values(category).forEach(event => {
          allEvents.push(event);
        });
      }
    });

    return allEvents;
  }

  // 🏷️ 이벤트 스키마 가져오기
  getSchema(eventName) {
    return this.schemas[eventName] || null;
  }

  // 🎯 이벤트 우선순위 가져오기
  getPriority(eventName) {
    return this.priorities[eventName] || 0;
  }

  // 🔄 이벤트 플로우 가져오기
  getFlow(eventName) {
    return this.flows[eventName] || [];
  }

  // 🎨 이벤트 색상 정보 가져오기
  getEventColor(eventName) {
    const category = eventName.split(':')[0].toUpperCase();
    return this.colors[category] || { icon: "⚪", color: "white" };
  }

  // 📊 이벤트 통계
  getStats() {
    const categories = Object.keys(this.events);
    const totalEvents = this.getAllEvents().length;
    const schemasCount = Object.keys(this.schemas).length;
    const priorityCount = Object.keys(this.priorities).length;
    const flowCount = Object.keys(this.flows).length;

    return {
      categories: categories.length,
      totalEvents,
      schemas: schemasCount,
      priorities: priorityCount,
      flows: flowCount,
      coverage: {
        schemas: Math.round((schemasCount / totalEvents) * 100),
        priorities: Math.round((priorityCount / totalEvents) * 100),
        flows: Math.round((flowCount / totalEvents) * 100)
      }
    };
  }

  // 🔍 카테고리별 이벤트 목록
  getEventsByCategory(category) {
    const upperCategory = category.toUpperCase();
    return this.events[upperCategory] ? Object.values(this.events[upperCategory]) : [];
  }

  // ✅ 이벤트 검증
  validateEvent(eventName, payload) {
    const schema = this.getSchema(eventName);
    if (!schema) {
      logger.debug(`📝 스키마 없는 이벤트: ${eventName}`);
      return true; // 스키마가 없으면 통과
    }

    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      // 필수 필드 체크
      if (rules.required && !(field in payload)) {
        errors.push(`필수 필드 누락: ${field}`);
        continue;
      }

      // 필드가 있을 때만 타입 체크
      if (field in payload) {
        const value = payload[field];
        const expectedType = rules.type;

        // 타입 검증
        if (expectedType === "array" && !Array.isArray(value)) {
          errors.push(`타입 불일치: ${field}는 배열이어야 함`);
        } else if (expectedType !== "array" && typeof value !== expectedType) {
          errors.push(`타입 불일치: ${field}는 ${expectedType}이어야 함`);
        }

        // enum 검증
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`잘못된 값: ${field}는 [${rules.enum.join(', ')}] 중 하나여야 함`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`이벤트 검증 실패 (${eventName}): ${errors.join(', ')}`);
    }

    return true;
  }

  // 📋 이벤트 정보 로그 출력
  logEventInfo() {
    const stats = this.getStats();
    
    logger.info("🎫 EventRegistry 통계:");
    logger.info(`  📊 카테고리: ${stats.categories}개`);
    logger.info(`  🎯 전체 이벤트: ${stats.totalEvents}개`);
    logger.info(`  🏷️ 스키마: ${stats.schemas}개 (${stats.coverage.schemas}%)`);
    logger.info(`  ⏳ 우선순위: ${stats.priorities}개 (${stats.coverage.priorities}%)`);
    logger.info(`  🔄 플로우: ${stats.flows}개 (${stats.coverage.flows}%)`);
  }
}

// 🎯 싱글톤 인스턴스
let eventRegistryInstance = null;

function getEventRegistry() {
  if (!eventRegistryInstance) {
    eventRegistryInstance = new EventRegistry();
  }
  return eventRegistryInstance;
}

module.exports = {
  EVENTS,
  EVENT_SCHEMAS,
  EVENT_PRIORITIES, 
  EVENT_FLOWS,
  EVENT_COLORS,
  EventRegistry,
  getEventRegistry
};