// ========================================
// 🎹 src/config/MenuConfig.js v3.0.1
// ========================================
// LoggerEnhancer 알록달록 + 표준 메뉴 구조 정의
// ========================================

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🎹 MenuConfig v3.0.1 - 알록달록 메뉴 시스템
 *
 * ✨ 새로운 기능들:
 * - 🌈 LoggerEnhancer 알록달록 메뉴 생성
 * - 📱 MarkdownV2 완벽 지원
 * - 🎨 동적 테마 시스템
 * - 🎭 메뉴 애니메이션 효과
 * - 📊 실시간 메뉴 통계
 */

// 🌈 LoggerEnhancer 활용
const messageSystem = logger.messageSystem;

/**
 * 🎯 표준 메뉴 구조 (v3.0.1)
 * - 2열 짝수 구조 유지
 * - 콜백데이터는 콜론(:) 사용
 * - 일관된 아이콘 시스템
 * - 🌈 알록달록 지원!
 */
const MENU_CONFIG = {
  // 메인 메뉴 구조 (2열 x 4행 + 시스템 행)
  mainMenu: {
    title: "🤖 **두목봇 v3\\.0\\.1**",
    subtitle: "🌈 _알록달록 모드 활성화\\!_",

    modules: [
      {
        position: 1,
        key: "todo",
        name: "할일",
        icon: "📝",
        callback: "todo:menu",
        description: "할일 관리 및 체크리스트",
        enhanced: true,
        color: "blue",
        features: ["priority", "deadline", "categories", "rainbow"],
      },
      {
        position: 2,
        key: "reminder",
        name: "리마인더",
        icon: "⏰",
        callback: "reminder:menu",
        description: "알림 및 일정 관리",
        enhanced: false,
        color: "purple",
        features: ["recurring", "snooze"],
      },
      {
        position: 3,
        key: "worktime",
        name: "퇴근계산기",
        icon: "🏢",
        callback: "worktime:menu",
        description: "출퇴근 시간 관리",
        enhanced: true,
        color: "green",
        features: ["dashboard", "analytics", "rainbow"],
      },
      {
        position: 4,
        key: "leave",
        name: "연차계산기",
        icon: "🏖️",
        callback: "leave:menu",
        description: "연차/휴가 관리",
        enhanced: false,
        color: "cyan",
        features: ["approval", "calendar"],
      },
      {
        position: 5,
        key: "timer",
        name: "집중타이머",
        icon: "⏱️",
        callback: "timer:menu",
        description: "포모도로 타이머",
        enhanced: true,
        color: "orange",
        features: ["pomodoro", "statistics", "rainbow"],
      },
      {
        position: 6,
        key: "weather",
        name: "날씨",
        icon: "🌤️",
        callback: "weather:menu",
        description: "날씨 및 미세먼지 정보",
        enhanced: false,
        color: "yellow",
        features: ["forecast", "alerts"],
      },
      {
        position: 7,
        key: "fortune",
        name: "운세",
        icon: "🔮",
        callback: "fortune:menu",
        description: "오늘의 운세",
        enhanced: false,
        color: "magenta",
        features: ["daily", "zodiac"],
      },
      {
        position: 8,
        key: "tts",
        name: "TTS",
        icon: "🔊",
        callback: "tts:menu",
        description: "텍스트 음성 변환",
        enhanced: false,
        color: "red",
        features: ["multiLanguage", "voiceSelection"],
      },
    ],

    systemRow: [
      {
        key: "help",
        name: "❓ 도움말",
        callback: "system:help",
        color: "blue",
      },
      {
        key: "settings",
        name: "⚙️ 설정",
        callback: "system:settings",
        color: "purple",
      },
    ],

    // 🌈 알록달록 설정
    rainbow: {
      enabled: true,
      themes: {
        morning: ["yellow", "orange", "red"],
        afternoon: ["blue", "cyan", "green"],
        evening: ["purple", "magenta", "pink"],
        night: ["blue", "purple", "magenta"],
      },
      animations: {
        loading: ["⏳", "⌛", "🔄", "⚡"],
        success: ["✅", "🎉", "🌟", "💫"],
      },
    },
  },

  // 서브 메뉴 표준 구조 (알록달록 강화!)
  subMenuTemplate: {
    // 모든 서브메뉴 하단에 공통으로 들어가는 버튼
    commonFooter: [
      {
        key: "main",
        name: "🏠 메인메뉴",
        callback: "system:menu",
        color: "green",
      },
      {
        key: "back",
        name: "🔙 뒤로가기",
        callback: "{module}:menu", // 동적 치환
        color: "blue",
      },
    ],

    // 🌈 알록달록 공통 설정
    rainbow: {
      headerColors: ["cyan", "magenta"],
      buttonColors: ["blue", "purple", "green", "yellow"],
      footerColors: ["gray", "white"],
    },
  },

  // 각 모듈별 서브메뉴 구조 (알록달록!)
  moduleMenus: {
    todo: {
      title: "📝 **할일 관리**",
      subtitle: "🌈 _Enhanced 모드_",
      enhanced: true,
      buttons: [
        ["📋 목록보기", "todo:list", "blue"],
        ["➕ 할일추가", "todo:add", "green"],
        ["✅ 완료목록", "todo:completed", "purple"],
        ["🔍 검색", "todo:search", "yellow"],
        ["📊 통계", "todo:stats", "orange"],
        ["🏷️ 카테고리", "todo:categories", "cyan"],
      ],
      rainbow: {
        theme: ["blue", "cyan", "green"],
        animations: true,
      },
    },

    reminder: {
      title: "⏰ **리마인더**",
      subtitle: "_스마트 알림 시스템_",
      enhanced: false,
      buttons: [
        ["📅 예정알림", "reminder:list", "blue"],
        ["➕ 알림추가", "reminder:add", "green"],
        ["🔔 반복설정", "reminder:recurring", "purple"],
        ["📋 알림기록", "reminder:history", "yellow"],
        ["⚙️ 알림설정", "reminder:settings", "orange"],
        ["🔕 무음시간", "reminder:silence", "red"],
      ],
      rainbow: {
        theme: ["purple", "blue", "cyan"],
        animations: false,
      },
    },

    worktime: {
      title: "🏢 **퇴근계산기**",
      subtitle: "🌈 _Enhanced 모드_",
      enhanced: true,
      buttons: [
        ["🚀 출근하기", "worktime:checkin", "green"],
        ["🏃 퇴근하기", "worktime:checkout", "red"],
        ["📊 오늘근무", "worktime:today", "blue"],
        ["📅 주간현황", "worktime:weekly", "purple"],
        ["📈 월간통계", "worktime:monthly", "orange"],
        ["⚙️ 근무설정", "worktime:settings", "yellow"],
      ],
      rainbow: {
        theme: ["green", "blue", "purple"],
        animations: true,
      },
    },

    leave: {
      title: "🏖️ **연차계산기**",
      subtitle: "_휴가 관리 시스템_",
      enhanced: false,
      buttons: [
        ["📊 연차현황", "leave:status", "blue"],
        ["✏️ 연차사용", "leave:use", "green"],
        ["📅 사용내역", "leave:history", "purple"],
        ["📈 연차통계", "leave:stats", "yellow"],
        ["🗓️ 공휴일", "leave:holidays", "orange"],
        ["⚙️ 연차설정", "leave:settings", "cyan"],
      ],
      rainbow: {
        theme: ["cyan", "blue", "purple"],
        animations: false,
      },
    },

    timer: {
      title: "⏱️ **집중타이머**",
      subtitle: "🌈 _Enhanced 포모도로_",
      enhanced: true,
      buttons: [
        ["▶️ 시작하기", "timer:start", "green"],
        ["⏸️ 일시정지", "timer:pause", "yellow"],
        ["🍅 포모도로", "timer:pomodoro", "red"],
        ["☕ 휴식시간", "timer:break", "blue"],
        ["📊 오늘기록", "timer:today", "purple"],
        ["⚙️ 타이머설정", "timer:settings", "orange"],
      ],
      rainbow: {
        theme: ["orange", "red", "yellow"],
        animations: true,
      },
    },

    weather: {
      title: "🌤️ **날씨/미세먼지**",
      subtitle: "_실시간 기상 정보_",
      enhanced: false,
      buttons: [
        ["🌡️ 현재날씨", "weather:current", "blue"],
        ["📅 주간예보", "weather:weekly", "green"],
        ["💨 미세먼지", "weather:dust", "red"],
        ["🌧️ 강수확률", "weather:rain", "cyan"],
        ["📍 지역설정", "weather:location", "yellow"],
        ["🔔 날씨알림", "weather:alerts", "orange"],
      ],
      rainbow: {
        theme: ["yellow", "blue", "green"],
        animations: false,
      },
    },

    fortune: {
      title: "🔮 **오늘의 운세**",
      subtitle: "_신비로운 미래 예측_",
      enhanced: false,
      buttons: [
        ["✨ 오늘운세", "fortune:today", "purple"],
        ["💕 애정운", "fortune:love", "pink"],
        ["💰 금전운", "fortune:money", "yellow"],
        ["💼 직장운", "fortune:work", "blue"],
        ["📅 이번주", "fortune:weekly", "green"],
        ["🎴 타로카드", "fortune:tarot", "red"],
      ],
      rainbow: {
        theme: ["purple", "magenta", "pink"],
        animations: false,
      },
    },

    tts: {
      title: "🔊 **TTS 음성변환**",
      subtitle: "_텍스트를 음성으로_",
      enhanced: false,
      buttons: [
        ["🎤 텍스트입력", "tts:input", "blue"],
        ["📄 파일변환", "tts:file", "green"],
        ["🗣️ 음성선택", "tts:voice", "purple"],
        ["⚡ 속도조절", "tts:speed", "yellow"],
        ["📚 변환기록", "tts:history", "orange"],
        ["⚙️ TTS설정", "tts:settings", "red"],
      ],
      rainbow: {
        theme: ["red", "orange", "yellow"],
        animations: false,
      },
    },
  },

  // 🌈 글로벌 알록달록 설정
  rainbow: {
    themes: {
      default: ["blue", "purple", "cyan"],
      enhanced: ["green", "blue", "purple"],
      success: ["green", "cyan", "blue"],
      warning: ["yellow", "orange", "red"],
      error: ["red", "orange", "yellow"],
    },
    timeBasedThemes: {
      morning: ["yellow", "orange", "pink"], // 6-12시
      afternoon: ["blue", "cyan", "green"], // 12-18시
      evening: ["purple", "magenta", "pink"], // 18-22시
      night: ["blue", "purple", "magenta"], // 22-6시
    },
    animations: {
      enabled: true,
      loading: ["⏳", "⌛", "🔄", "⚡", "🚀"],
      success: ["✅", "🎉", "🌟", "💫", "🎊"],
      processing: ["🔄", "⚙️", "🛠️", "🔧", "⚡"],
    },
  },
};

/**
 * 🎹 MenuBuilder v3.0.1 - 알록달록 메뉴 생성기
 */
class MenuBuilder {
  constructor() {
    this.messageSystem = messageSystem;
    this.stats = {
      menusGenerated: 0,
      rainbowMenus: 0,
      lastGenerated: null,
    };

    // 🌈 초기화 로그
    console.log(this.messageSystem.rainbow("🎹 MenuBuilder v3.0.1 초기화됨"));
  }

  /**
   * 🌈 시간대별 테마 선택
   */
  getTimeBasedTheme() {
    const hour = new Date().getHours();

    if (hour >= 6 && hour < 12)
      return MENU_CONFIG.rainbow.timeBasedThemes.morning;
    if (hour >= 12 && hour < 18)
      return MENU_CONFIG.rainbow.timeBasedThemes.afternoon;
    if (hour >= 18 && hour < 22)
      return MENU_CONFIG.rainbow.timeBasedThemes.evening;
    return MENU_CONFIG.rainbow.timeBasedThemes.night;
  }

  /**
   * 🎨 랜덤 애니메이션 이모지
   */
  getRandomAnimation(type = "loading") {
    const animations =
      MENU_CONFIG.rainbow.animations[type] ||
      MENU_CONFIG.rainbow.animations.loading;
    return animations[Math.floor(Math.random() * animations.length)];
  }

  /**
   * 📱 MarkdownV2 에스케이프
   */
  escapeMarkdownV2(text) {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
  }

  /**
   * 🌈 메인 메뉴 키보드 생성 (알록달록!)
   */
  buildMainMenuKeyboard() {
    console.log(
      this.messageSystem.gradient(
        "🎹 메인 메뉴 키보드 생성 중...",
        "blue",
        "purple"
      )
    );

    const keyboard = { inline_keyboard: [] };
    const modules = MENU_CONFIG.mainMenu.modules;

    // 2열씩 배치
    for (let i = 0; i < modules.length; i += 2) {
      const row = [];

      // 첫 번째 버튼
      const module1 = modules[i];
      const button1Text = module1.enhanced
        ? `${module1.icon} ${module1.name} ⭐`
        : `${module1.icon} ${module1.name}`;

      row.push({
        text: button1Text,
        callback_data: module1.callback,
      });

      // 두 번째 버튼
      if (i + 1 < modules.length) {
        const module2 = modules[i + 1];
        const button2Text = module2.enhanced
          ? `${module2.icon} ${module2.name} ⭐`
          : `${module2.icon} ${module2.name}`;

        row.push({
          text: button2Text,
          callback_data: module2.callback,
        });
      }

      keyboard.inline_keyboard.push(row);
    }

    // 시스템 행 추가 (도움말, 설정)
    const systemRow = MENU_CONFIG.mainMenu.systemRow.map((btn) => ({
      text: btn.name,
      callback_data: btn.callback,
    }));
    keyboard.inline_keyboard.push(systemRow);

    // 🌈 생성 통계 업데이트
    this.stats.menusGenerated++;
    this.stats.lastGenerated = TimeHelper.getLogTimeString();

    console.log(
      this.messageSystem.gradient(
        "✅ 메인 메뉴 키보드 생성 완료",
        "green",
        "blue"
      )
    );

    return keyboard;
  }

  /**
   * 🎨 모듈별 서브메뉴 키보드 생성 (알록달록!)
   */
  buildModuleMenuKeyboard(moduleName) {
    console.log(
      this.messageSystem.gradient(
        `🎨 ${moduleName} 서브메뉴 생성 중...`,
        "purple",
        "pink"
      )
    );

    const moduleMenu = MENU_CONFIG.moduleMenus[moduleName];
    if (!moduleMenu) {
      console.log(
        this.messageSystem.gradient(
          `❌ ${moduleName} 메뉴 설정 없음`,
          "red",
          "orange"
        )
      );
      return null;
    }

    const keyboard = { inline_keyboard: [] };

    // 모듈 버튼들 (2열씩)
    for (let i = 0; i < moduleMenu.buttons.length; i += 2) {
      const row = [];

      // 첫 번째 버튼
      const [text1, callback1] = moduleMenu.buttons[i];
      row.push({ text: text1, callback_data: callback1 });

      // 두 번째 버튼 (있으면)
      if (i + 1 < moduleMenu.buttons.length) {
        const [text2, callback2] = moduleMenu.buttons[i + 1];
        row.push({ text: text2, callback_data: callback2 });
      }

      keyboard.inline_keyboard.push(row);
    }

    // 공통 하단 버튼 (메인메뉴, 뒤로가기)
    keyboard.inline_keyboard.push([
      {
        text: "🏠 메인메뉴",
        callback_data: "system:menu",
      },
      {
        text: "🔙 뒤로가기",
        callback_data: `${moduleName}:menu`,
      },
    ]);

    // 🌈 Enhanced 모듈 통계 업데이트
    if (moduleMenu.enhanced) {
      this.stats.rainbowMenus++;
    }

    console.log(
      this.messageSystem.gradient(
        `✅ ${moduleName} 서브메뉴 생성 완료`,
        "green",
        "cyan"
      )
    );

    return keyboard;
  }

  /**
   * 🌈 메인 메뉴 텍스트 생성 (알록달록!)
   */
  buildMainMenuText(userName = "사용자", additionalInfo = {}) {
    console.log(
      this.messageSystem.gradient(
        `🎨 메인 메뉴 텍스트 생성: ${userName}`,
        "cyan",
        "magenta"
      )
    );

    const currentTime = TimeHelper.format(new Date(), "time");
    const greeting = this.getTimeBasedGreeting();
    const theme = this.getTimeBasedTheme();
    const randomEmoji = this.getRandomAnimation("success");

    // Enhanced 모듈 개수
    const enhancedModules = MENU_CONFIG.mainMenu.modules.filter(
      (m) => m.enhanced
    );
    const totalModules = MENU_CONFIG.mainMenu.modules.length;

    const menuText = `
${MENU_CONFIG.mainMenu.title}
${MENU_CONFIG.mainMenu.subtitle}

${randomEmoji} ${greeting} *${this.escapeMarkdownV2(userName)}*님\\!

⏰ **현재 시간:** ${this.escapeMarkdownV2(currentTime)}
📦 **활성 모듈:** ${totalModules}개 \\(⭐Enhanced: ${
      enhancedModules.length
    }개\\)
🎨 **테마:** ${this.getThemeName()} 모드

📌 **주요 기능**
${MENU_CONFIG.mainMenu.modules
  .map((m) => {
    const status = m.enhanced ? " ⭐" : "";
    return `• ${m.icon} ${this.escapeMarkdownV2(
      m.name
    )}${status}: ${this.escapeMarkdownV2(m.description)}`;
  })
  .join("\n")}

💡 _각 메뉴를 눌러 자세한 기능을 확인하세요\\!_
`.trim();

    // 🌈 생성 로그
    console.log(
      this.messageSystem.gradient(
        "✅ 메인 메뉴 텍스트 생성 완료",
        "green",
        "blue"
      )
    );

    return menuText;
  }

  /**
   * 🎨 모듈 메뉴 텍스트 생성 (알록달록!)
   */
  buildModuleMenuText(moduleName, additionalInfo = {}) {
    console.log(
      this.messageSystem.gradient(
        `🎨 ${moduleName} 메뉴 텍스트 생성...`,
        "purple",
        "blue"
      )
    );

    const moduleMenu = MENU_CONFIG.moduleMenus[moduleName];
    if (!moduleMenu) {
      console.log(
        this.messageSystem.gradient(
          `❌ ${moduleName} 메뉴 설정 없음`,
          "red",
          "orange"
        )
      );
      return null;
    }

    let text = `${moduleMenu.title}\n`;

    // Enhanced 모듈 표시
    if (moduleMenu.enhanced && moduleMenu.subtitle) {
      text += `${moduleMenu.subtitle}\n`;
    }

    text += "\n";

    // 모듈별 추가 정보 표시 (알록달록!)
    if (additionalInfo.stats) {
      text += `📊 **현재 상태**\n`;
      Object.entries(additionalInfo.stats).forEach(([key, value]) => {
        text += `• ${this.escapeMarkdownV2(key)}: *${this.escapeMarkdownV2(
          String(value)
        )}*\n`;
      });
      text += "\n";
    }

    // 시간 정보 추가
    const currentTime = TimeHelper.format(new Date(), "time");
    text += `⏰ ${this.escapeMarkdownV2(currentTime)} 기준\n\n`;

    text += `원하는 기능을 선택해주세요\\!`;

    console.log(
      this.messageSystem.gradient(
        `✅ ${moduleName} 메뉴 텍스트 생성 완료`,
        "green",
        "cyan"
      )
    );

    return text;
  }

  /**
   * 🕐 시간대별 인사말
   */
  getTimeBasedGreeting() {
    const hour = new Date().getHours();
    const greetings = {
      morning: ["좋은 아침", "상쾌한 아침", "활기찬 아침"],
      afternoon: ["좋은 오후", "즐거운 오후", "활력찬 오후"],
      evening: ["좋은 저녁", "편안한 저녁", "따뜻한 저녁"],
      night: ["안녕하세요", "늦은 시간", "수고하셨습니다"],
    };

    let timeSlot;
    if (hour >= 6 && hour < 12) timeSlot = "morning";
    else if (hour >= 12 && hour < 18) timeSlot = "afternoon";
    else if (hour >= 18 && hour < 22) timeSlot = "evening";
    else timeSlot = "night";

    const options = greetings[timeSlot];
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * 🎨 현재 테마 이름
   */
  getThemeName() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "Morning Rainbow";
    if (hour >= 12 && hour < 18) return "Afternoon Sky";
    if (hour >= 18 && hour < 22) return "Evening Sunset";
    return "Night Aurora";
  }

  /**
   * 📊 MenuBuilder 통계
   */
  getStats() {
    return {
      ...this.stats,
      enhancedModules: MENU_CONFIG.mainMenu.modules.filter((m) => m.enhanced)
        .length,
      totalModules: MENU_CONFIG.mainMenu.modules.length,
      rainbowEnabled: MENU_CONFIG.rainbow.animations.enabled,
    };
  }

  /**
   * 🌈 MenuBuilder 상태 표시
   */
  showRainbowStats() {
    console.log(this.messageSystem.rainbow("🎹 ═══ MenuBuilder 통계 ═══"));
    console.log(
      this.messageSystem.gradient(
        `📊 생성된 메뉴: ${this.stats.menusGenerated}개`,
        "blue",
        "cyan"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `⭐ 알록달록 메뉴: ${this.stats.rainbowMenus}개`,
        "purple",
        "pink"
      )
    );
    console.log(
      this.messageSystem.gradient(
        `⏰ 마지막 생성: ${this.stats.lastGenerated || "없음"}`,
        "green",
        "blue"
      )
    );
    console.log(this.messageSystem.rainbow("🎹 ══════════════════"));
  }
}

// 모듈 레지스트리 업데이트 (알록달록!)
const MODULE_REGISTRY = {
  version: "3.0.1",
  enhanced: true,
  rainbow: true,

  modules: [
    {
      key: "system",
      name: "SystemModule",
      description: "시스템 관리",
      enabled: true,
      priority: 0,
      hidden: true, // 메인 메뉴에 표시 안함
      enhanced: true,
      rainbow: true,
    },
    {
      key: "todo",
      name: "TodoModule",
      description: "할일 관리",
      enabled: true,
      priority: 1,
      enhanced: true,
      rainbow: true,
    },
    {
      key: "reminder",
      name: "ReminderModule",
      description: "리마인더",
      enabled: true,
      priority: 2,
      enhanced: false,
      rainbow: false,
    },
    {
      key: "worktime",
      name: "WorktimeModule",
      description: "퇴근계산기",
      enabled: true,
      priority: 3,
      enhanced: true,
      rainbow: true,
    },
    {
      key: "leave",
      name: "LeaveModule",
      description: "연차계산기",
      enabled: true,
      priority: 4,
      enhanced: false,
      rainbow: false,
    },
    {
      key: "timer",
      name: "TimerModule",
      description: "집중타이머",
      enabled: true,
      priority: 5,
      enhanced: true,
      rainbow: true,
    },
    {
      key: "weather",
      name: "WeatherModule",
      description: "날씨/미세먼지",
      enabled: true,
      priority: 6,
      enhanced: false,
      rainbow: false,
    },
    {
      key: "fortune",
      name: "FortuneModule",
      description: "운세",
      enabled: true,
      priority: 7,
      enhanced: false,
      rainbow: false,
    },
    {
      key: "tts",
      name: "TTSModule",
      description: "TTS 음성변환",
      enabled: true,
      priority: 8,
      enhanced: false,
      rainbow: false,
    },
  ],

  // 🌈 레지스트리 통계
  stats: {
    totalModules: 9,
    enhancedModules: 4,
    rainbowModules: 4,
    lastUpdate: null,
  },
};

// 🎯 싱글톤 MenuBuilder 인스턴스
let menuBuilderInstance = null;

/**
 * 🎹 MenuBuilder 싱글톤 인스턴스
 */
function getMenuBuilder() {
  if (!menuBuilderInstance) {
    menuBuilderInstance = new MenuBuilder();
  }
  return menuBuilderInstance;
}

/**
 * 🌈 알록달록 메뉴 통계 표시
 */
function showMenuStats() {
  const builder = getMenuBuilder();
  builder.showRainbowStats();
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = {
  MENU_CONFIG,
  MODULE_REGISTRY,
  MenuBuilder,
  getMenuBuilder,
  showMenuStats,

  // 버전 정보
  version: "3.0.1",
  enhanced: true,
  rainbow: true,
};
