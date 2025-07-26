// src/config/menuConfig.js - 표준 메뉴 구조 정의

/**
 * 🎯 표준 메뉴 구조
 * - 2열 짝수 구조
 * - 콜백데이터는 콜론(:) 사용
 * - 일관된 아이콘 시스템
 */
const MENU_CONFIG = {
  // 메인 메뉴 구조 (2열 x 4행 + 시스템 행)
  mainMenu: {
    modules: [
      {
        position: 1,
        key: "todo",
        name: "할일",
        icon: "📝",
        callback: "todo:menu",
        description: "할일 관리 및 체크리스트",
      },
      {
        position: 2,
        key: "reminder",
        name: "리마인더",
        icon: "⏰",
        callback: "reminder:menu",
        description: "알림 및 일정 관리",
      },
      {
        position: 3,
        key: "worktime",
        name: "퇴근계산기",
        icon: "🏢",
        callback: "worktime:menu",
        description: "출퇴근 시간 관리",
      },
      {
        position: 4,
        key: "leave",
        name: "연차계산기",
        icon: "🏖️",
        callback: "leave:menu",
        description: "연차/휴가 관리",
      },
      {
        position: 5,
        key: "timer",
        name: "집중타이머",
        icon: "⏱️",
        callback: "timer:menu",
        description: "포모도로 타이머",
      },
      {
        position: 6,
        key: "weather",
        name: "날씨",
        icon: "🌤️",
        callback: "weather:menu",
        description: "날씨 및 미세먼지 정보",
      },
      {
        position: 7,
        key: "fortune",
        name: "운세",
        icon: "🔮",
        callback: "fortune:menu",
        description: "오늘의 운세",
      },
      {
        position: 8,
        key: "tts",
        name: "TTS",
        icon: "🔊",
        callback: "tts:menu",
        description: "텍스트 음성 변환",
      },
    ],
    systemRow: [
      {
        key: "help",
        name: "❓ 도움말",
        callback: "system:help",
      },
      {
        key: "settings",
        name: "⚙️ 설정",
        callback: "system:settings",
      },
    ],
  },

  // 서브 메뉴 표준 구조
  subMenuTemplate: {
    // 모든 서브메뉴 하단에 공통으로 들어가는 버튼
    commonFooter: [
      {
        key: "main",
        name: "🏠 메인메뉴",
        callback: "system:menu",
      },
      {
        key: "back",
        name: "🔙 뒤로가기",
        callback: "{module}:menu", // 동적 치환
      },
    ],
  },

  // 각 모듈별 서브메뉴 구조
  moduleMenus: {
    todo: {
      title: "📝 할일 관리",
      buttons: [
        ["📋 목록보기", "todo:list"],
        ["➕ 할일추가", "todo:add"],
        ["✅ 완료목록", "todo:completed"],
        ["🔍 검색", "todo:search"],
        ["📊 통계", "todo:stats"],
        ["🏷️ 카테고리", "todo:categories"],
      ],
    },

    reminder: {
      title: "⏰ 리마인더",
      buttons: [
        ["📅 예정알림", "reminder:list"],
        ["➕ 알림추가", "reminder:add"],
        ["🔔 반복설정", "reminder:recurring"],
        ["📋 알림기록", "reminder:history"],
        ["⚙️ 알림설정", "reminder:settings"],
        ["🔕 무음시간", "reminder:silence"],
      ],
    },

    worktime: {
      title: "🏢 퇴근계산기",
      buttons: [
        ["🚀 출근하기", "worktime:checkin"],
        ["🏃 퇴근하기", "worktime:checkout"],
        ["📊 오늘근무", "worktime:today"],
        ["📅 주간현황", "worktime:weekly"],
        ["📈 월간통계", "worktime:monthly"],
        ["⚙️ 근무설정", "worktime:settings"],
      ],
    },

    leave: {
      title: "🏖️ 연차계산기",
      buttons: [
        ["📊 연차현황", "leave:status"],
        ["✏️ 연차사용", "leave:use"],
        ["📅 사용내역", "leave:history"],
        ["📈 연차통계", "leave:stats"],
        ["🗓️ 공휴일", "leave:holidays"],
        ["⚙️ 연차설정", "leave:settings"],
      ],
    },

    timer: {
      title: "⏱️ 집중타이머",
      buttons: [
        ["▶️ 시작하기", "timer:start"],
        ["⏸️ 일시정지", "timer:pause"],
        ["🍅 포모도로", "timer:pomodoro"],
        ["☕ 휴식시간", "timer:break"],
        ["📊 오늘기록", "timer:today"],
        ["⚙️ 타이머설정", "timer:settings"],
      ],
    },

    weather: {
      title: "🌤️ 날씨/미세먼지",
      buttons: [
        ["🌡️ 현재날씨", "weather:current"],
        ["📅 주간예보", "weather:weekly"],
        ["💨 미세먼지", "weather:dust"],
        ["🌧️ 강수확률", "weather:rain"],
        ["📍 지역설정", "weather:location"],
        ["🔔 날씨알림", "weather:alerts"],
      ],
    },

    fortune: {
      title: "🔮 오늘의 운세",
      buttons: [
        ["✨ 오늘운세", "fortune:today"],
        ["💕 애정운", "fortune:love"],
        ["💰 금전운", "fortune:money"],
        ["💼 직장운", "fortune:work"],
        ["📅 이번주", "fortune:weekly"],
        ["🎯 띠별운세", "fortune:zodiac"],
      ],
    },

    tts: {
      title: "🔊 TTS 음성변환",
      buttons: [
        ["🎤 텍스트입력", "tts:input"],
        ["📄 파일변환", "tts:file"],
        ["🗣️ 음성선택", "tts:voice"],
        ["⚡ 속도조절", "tts:speed"],
        ["📚 변환기록", "tts:history"],
        ["⚙️ TTS설정", "tts:settings"],
      ],
    },
  },
};

// NavigationHandler에서 사용할 메뉴 생성 함수들
class MenuBuilder {
  /**
   * 메인 메뉴 키보드 생성
   */
  static buildMainMenuKeyboard() {
    const keyboard = { inline_keyboard: [] };
    const modules = MENU_CONFIG.mainMenu.modules;

    // 2열씩 배치
    for (let i = 0; i < modules.length; i += 2) {
      const row = [];

      // 첫 번째 버튼
      const module1 = modules[i];
      row.push({
        text: `${module1.icon} ${module1.name}`,
        callback_data: module1.callback,
      });

      // 두 번째 버튼
      if (i + 1 < modules.length) {
        const module2 = modules[i + 1];
        row.push({
          text: `${module2.icon} ${module2.name}`,
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

    return keyboard;
  }

  /**
   * 모듈별 서브메뉴 키보드 생성
   */
  static buildModuleMenuKeyboard(moduleName) {
    const moduleMenu = MENU_CONFIG.moduleMenus[moduleName];
    if (!moduleMenu) return null;

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

    return keyboard;
  }

  /**
   * 메인 메뉴 텍스트 생성
   */
  static buildMainMenuText(userName = "사용자") {
    return `🤖 **두목봇 v3.0.1**

안녕하세요, ${userName}님! 👋
필요한 기능을 선택해주세요.

📌 **주요 기능**
${MENU_CONFIG.mainMenu.modules
  .map((m) => `• ${m.icon} ${m.name}: ${m.description}`)
  .join("\n")}

💡 각 메뉴를 눌러 자세한 기능을 확인하세요!`;
  }

  /**
   * 모듈 메뉴 텍스트 생성
   */
  static buildModuleMenuText(moduleName, additionalInfo = {}) {
    const moduleMenu = MENU_CONFIG.moduleMenus[moduleName];
    if (!moduleMenu) return null;

    let text = `${moduleMenu.title}\n\n`;

    // 모듈별 추가 정보 표시
    if (additionalInfo.stats) {
      text += `📊 **현재 상태**\n`;
      Object.entries(additionalInfo.stats).forEach(([key, value]) => {
        text += `• ${key}: ${value}\n`;
      });
      text += "\n";
    }

    text += `원하는 기능을 선택해주세요.`;

    return text;
  }
}

// 모듈 레지스트리 업데이트
const MODULE_REGISTRY = {
  modules: [
    {
      key: "system",
      name: "SystemModule",
      description: "시스템 관리",
      enabled: true,
      priority: 0,
      hidden: true, // 메인 메뉴에 표시 안함
    },
    {
      key: "todo",
      name: "TodoModule",
      description: "할일 관리",
      enabled: true,
      priority: 1,
    },
    {
      key: "reminder",
      name: "ReminderModule",
      description: "리마인더",
      enabled: true,
      priority: 2,
    },
    {
      key: "worktime",
      name: "WorktimeModule",
      description: "퇴근계산기",
      enabled: true,
      priority: 3,
    },
    {
      key: "leave",
      name: "LeaveModule",
      description: "연차계산기",
      enabled: true,
      priority: 4,
    },
    {
      key: "timer",
      name: "TimerModule",
      description: "집중타이머",
      enabled: true,
      priority: 5,
    },
    {
      key: "weather",
      name: "WeatherModule",
      description: "날씨/미세먼지",
      enabled: true,
      priority: 6,
    },
    {
      key: "fortune",
      name: "FortuneModule",
      description: "운세",
      enabled: true,
      priority: 7,
    },
    {
      key: "tts",
      name: "TTSModule",
      description: "TTS 음성변환",
      enabled: true,
      priority: 8,
    },
  ],
};

module.exports = {
  MENU_CONFIG,
  MODULE_REGISTRY,
  MenuBuilder,
};
