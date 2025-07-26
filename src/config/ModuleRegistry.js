// src/config/moduleRegistry.js - 중앙 모듈 레지스트리

/**
 * 📦 모듈 레지스트리 - 모든 모듈 정의를 한 곳에서 관리
 *
 * 장점:
 * 1. 한눈에 모든 모듈 파악 가능
 * 2. 우선순위 관리 쉬움
 * 3. 환경별 활성화/비활성화 쉬움
 * 4. 새 모듈 추가가 간단함
 */

const modules = [
  // ===== 🏛️ 시스템 모듈 (최우선) =====
  {
    key: "system",
    name: "시스템",
    description: "시스템 관리 및 설정",
    path: "./src/modules/SystemModule",
    priority: 1,
    required: true, // 필수 모듈
    enabled: true,
    config: {
      showInMenu: false, // 메인 메뉴에 표시 안 함
    },
  },

  // ===== 📱 핵심 기능 모듈 =====
  {
    key: "todo",
    name: "할일 관리",
    description: "할일을 관리합니다",
    path: "./src/modules/TodoModule",
    priority: 10,
    enabled: process.env.MODULE_TODO_ENABLED !== "false",
    config: {
      icon: "📝",
      commands: ["/todo", "/할일"],
    },
  },
  {
    key: "timer",
    name: "타이머",
    description: "타이머와 포모도로 기능",
    path: "./src/modules/TimerModule",
    priority: 20,
    enabled: process.env.MODULE_TIMER_ENABLED !== "false",
    config: {
      icon: "⏰",
      commands: ["/timer", "/타이머"],
    },
  },
  {
    key: "worktime",
    name: "근무시간",
    description: "출퇴근 및 근무시간 관리",
    path: "./src/modules/WorktimeModule",
    priority: 30,
    enabled: process.env.MODULE_WORKTIME_ENABLED !== "false",
    config: {
      icon: "🏢",
      commands: ["/work", "/출근", "/퇴근"],
    },
  },

  // ===== 🌟 부가 기능 모듈 =====
  {
    key: "leave",
    name: "휴가 관리",
    description: "휴가 신청 및 관리",
    path: "./src/modules/LeaveModule",
    priority: 40,
    enabled: process.env.MODULE_LEAVE_ENABLED !== "false",
    config: {
      icon: "🏖️",
      commands: ["/leave", "/휴가"],
    },
  },
  {
    key: "reminder",
    name: "리마인더",
    description: "알림 설정 및 관리",
    path: "./src/modules/ReminderModule",
    priority: 50,
    enabled: process.env.MODULE_REMINDER_ENABLED !== "false",
    config: {
      icon: "🔔",
      commands: ["/remind", "/알림"],
    },
  },

  // ===== 🎨 엔터테인먼트 모듈 =====
  {
    key: "fortune",
    name: "운세",
    description: "오늘의 운세 확인",
    path: "./src/modules/FortuneModule",
    priority: 60,
    enabled: process.env.MODULE_FORTUNE_ENABLED !== "false",
    config: {
      icon: "🔮",
      commands: ["/fortune", "/운세"],
    },
  },
  {
    key: "weather",
    name: "날씨",
    description: "날씨 정보 제공",
    path: "./src/modules/WeatherModule",
    priority: 70,
    enabled: process.env.MODULE_WEATHER_ENABLED !== "false",
    config: {
      icon: "🌤️",
      commands: ["/weather", "/날씨"],
      apiRequired: true,
    },
  },

  // ===== 🔧 유틸리티 모듈 =====
  {
    key: "tts",
    name: "TTS",
    description: "텍스트를 음성으로 변환",
    path: "./src/modules/TTSModule",
    priority: 80,
    enabled: process.env.MODULE_TTS_ENABLED !== "false",
    config: {
      icon: "🔊",
      commands: ["/tts", "/음성"],
      apiRequired: true,
    },
  },
  {
    key: "insight",
    name: "인사이트",
    description: "데이터 분석 및 통계",
    path: "./src/modules/InsightModule",
    priority: 90,
    enabled: process.env.MODULE_INSIGHT_ENABLED !== "false",
    config: {
      icon: "📊",
      commands: ["/insight", "/통계"],
    },
  },
];

// 환경별 필터링
function getEnabledModules() {
  return modules.filter((module) => module.enabled);
}

// 우선순위 정렬
function getModulesByPriority() {
  return [...modules].sort((a, b) => a.priority - b.priority);
}

// 명령어 맵 생성
function getCommandMap() {
  const commandMap = new Map();

  modules.forEach((module) => {
    if (module.config.commands) {
      module.config.commands.forEach((cmd) => {
        commandMap.set(cmd, module.key);
      });
    }
  });

  return commandMap;
}

module.exports = {
  modules,
  getEnabledModules,
  getModulesByPriority,
  getCommandMap,
};
