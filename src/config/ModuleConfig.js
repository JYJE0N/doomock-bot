// src/config/ModuleConfig.js - 기본 모듈 설정

class ModuleConfig {
  static getModuleConfigs() {
    return {
      // 📝 할일 관리 모듈
      TodoModule: {
        enabled: true,
        priority: 1,
        required: false,
        path: "../modules/TodoModule",
        features: ["todo", "task", "productivity"],
        commands: ["todo", "할일", "add"],
        callbacks: ["todo"],
        description: "할일 관리 및 생산성 도구",
      },

      // 🔮 운세 모듈
      FortuneModule: {
        enabled: true,
        priority: 2,
        required: false,
        path: "../modules/FortuneModule",
        features: ["fortune", "tarot", "luck"],
        commands: ["fortune", "운세", "tarot", "타로"],
        callbacks: ["fortune"],
        description: "운세, 타로, 행운 정보",
      },

      // 🌤️ 날씨 모듈
      WeatherModule: {
        enabled: true,
        priority: 3,
        required: false,
        path: "../modules/WeatherModule",
        features: ["weather", "forecast"],
        commands: ["weather", "날씨"],
        callbacks: ["weather"],
        description: "날씨 정보 및 예보",
      },

      // ⏰ 타이머 모듈
      TimerModule: {
        enabled: true,
        priority: 4,
        required: false,
        path: "../modules/TimerModule",
        features: ["timer", "pomodoro", "alarm"],
        commands: ["timer", "타이머", "pomodoro"],
        callbacks: ["timer"],
        description: "타이머 및 포모도로 기능",
      },

      // 🏖️ 휴가 관리 모듈
      LeaveModule: {
        enabled: true,
        priority: 5,
        required: false,
        path: "../modules/LeaveModule",
        features: ["leave", "vacation", "annual"],
        commands: ["leave", "휴가", "연차"],
        callbacks: ["leave"],
        description: "휴가 및 연차 관리",
      },

      // 🕐 근무시간 모듈
      WorktimeModule: {
        enabled: true,
        priority: 6,
        required: false,
        path: "../modules/WorktimeModule",
        features: ["worktime", "checkin", "checkout"],
        commands: ["worktime", "근무", "출근", "퇴근"],
        callbacks: ["worktime"],
        description: "근무시간 관리",
      },

      // 📊 인사이트 모듈
      InsightModule: {
        enabled: true,
        priority: 7,
        required: false,
        path: "../modules/InsightModule",
        features: ["insight", "analytics", "report"],
        commands: ["insight", "인사이트", "분석"],
        callbacks: ["insight"],
        description: "데이터 분석 및 인사이트",
      },

      // 🛠️ 유틸리티 모듈
      UtilsModule: {
        enabled: true,
        priority: 8,
        required: false,
        path: "../modules/UtilsModule",
        features: ["utils", "tools", "tts"],
        commands: ["utils", "유틸", "tts"],
        callbacks: ["utils"],
        description: "유틸리티 도구 및 TTS",
      },

      // 🔔 리마인더 모듈
      ReminderModule: {
        enabled: true,
        priority: 9,
        required: false,
        path: "../modules/ReminderModule",
        features: ["reminder", "notification", "alarm"],
        commands: ["reminder", "리마인더", "알림"],
        callbacks: ["reminder"],
        description: "리마인더 및 알림 서비스",
      },
    };
  }

  // 기능 활성화 확인
  static isFeatureEnabled(moduleName) {
    const configs = this.getModuleConfigs();
    const config = configs[moduleName];
    return config ? config.enabled : false;
  }

  // 모듈 우선순위 조회
  static getModulePriority(moduleName) {
    const configs = this.getModuleConfigs();
    const config = configs[moduleName];
    return config ? config.priority : 100;
  }

  // 활성화된 모듈 목록
  static getEnabledModules() {
    const configs = this.getModuleConfigs();
    return Object.entries(configs)
      .filter(([, config]) => config.enabled)
      .sort(([, a], [, b]) => (a.priority || 100) - (b.priority || 100))
      .map(([name]) => name);
  }

  // 모듈 정보 조회
  static getModuleInfo(moduleName) {
    const configs = this.getModuleConfigs();
    return configs[moduleName] || null;
  }
}

module.exports = ModuleConfig;
