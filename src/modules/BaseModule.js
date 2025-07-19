// src/modules/BaseModule.js - 디버깅 강화 + 호환성 개선

const Logger = require("../utils/Logger");
const { getUserName } = require("../utils/UserHelper");

class BaseModule {
  constructor(name, config = {}) {
    this.name = name;
    this.moduleName = name.replace("Module", "").toLowerCase(); // 'todo', 'fortune' 등
    this.config = {
      enabled: true,
      priority: 100,
      dependencies: [],
      commands: [],
      callbacks: [],
      features: [], // 지원하는 기능 목록
      ...config,
    };

    this.isInitialized = false;
    this.isLoaded = false;
    this.stats = {
      commandCount: 0,
      callbackCount: 0,
      errorCount: 0,
      lastUsed: null,
    };

    // ✅ 표준 액션 매핑
    this.actionMap = new Map();
    this.initializeActionMap();

    Logger.module(this.name, "created", { config: this.config });
  }

  // ✅ 표준 액션 매핑 초기화
  initializeActionMap() {
    // 🔧 기본 액션들 (모든 모듈 공통)
    this.actionMap.set("menu", this.showMenu.bind(this));
    this.actionMap.set("help", this.showHelp.bind(this));
    this.actionMap.set("status", this.showStatus.bind(this));

    // 🚀 기본 서브메뉴 액션들 추가
    this.registerDefaultActions();

    // 서브클래스에서 추가 액션 등록
    this.registerActions();

    Logger.debug(`${this.name}: ${this.actionMap.size}개 액션 등록됨`, {
      actions: Array.from(this.actionMap.keys()),
    });
  }

  // 🚀 기본 서브메뉴 액션들 등록
  registerDefaultActions() {
    // 모든 모듈이 공통으로 가질 수 있는 기본 액션들
    this.actionMap.set("list", this.showList.bind(this));
    this.actionMap.set("add", this.startAdd.bind(this));
    this.actionMap.set("setting", this.showSetting.bind(this));
    this.actionMap.set("stats", this.showStats.bind(this));
    this.actionMap.set("clear", this.handleClear.bind(this));
    this.actionMap.set("refresh", this.handleRefresh.bind(this));

    // 상태 관련
    this.actionMap.set("start", this.handleStart.bind(this));
    this.actionMap.set("stop", this.handleStop.bind(this));
    this.actionMap.set("pause", this.handlePause.bind(this));
    this.actionMap.set("resume", this.handleResume.bind(this));

    // 데이터 관리
    this.actionMap.set("history", this.showHistory.bind(this));
    this.actionMap.set("export", this.handleExport.bind(this));
    this.actionMap.set("import", this.handleImport.bind(this));

    // 특정 모듈용 액션들
    this.actionMap.set("current", this.showCurrent.bind(this));
    this.actionMap.set("forecast", this.showForecast.bind(this));
    this.actionMap.set("today", this.showToday.bind(this));
    this.actionMap.set("work", this.showWork.bind(this));
    this.actionMap.set("love", this.showLove.bind(this));
    this.actionMap.set("money", this.showMoney.bind(this));
    this.actionMap.set("health", this.showHealth.bind(this));
    this.actionMap.set("general", this.showGeneral.bind(this));
    this.actionMap.set("dashboard", this.showDashboard.bind(this));
    this.actionMap.set("quick", this.showQuick.bind(this));
    this.actionMap.set("national", this.showNational.bind(this));
    this.actionMap.set("tarot", this.showTarot.bind(this));
    this.actionMap.set("tarot3", this.showTarot3.bind(this));
    this.actionMap.set("lucky", this.showLucky.bind(this));
    this.actionMap.set("all", this.showAll.bind(this));
    this.actionMap.set("meeting", this.showMeeting.bind(this));
  }

  // ✅ 서브클래스에서 액션 등록 (오버라이드)
  registerActions() {
    // 서브클래스에서 구현
    // 예: this.actionMap.set('custom_action', this.customMethod.bind(this));
  }

  // ✅ 통합 콜백 처리기 (CallbackManager가 이것만 호출하면 됨)
  async handleCallback(bot, callbackQuery, subAction, params) {
    const {
      message: {
        chat: { id: chatId },
        message_id: messageId,
      },
      from: { id: userId },
    } = callbackQuery;
    const userName = getUserName(callbackQuery.from);

    try {
      this.updateStats("callback");

      Logger.info(`🔧 ${this.name}: ${subAction} 액션 요청`);
      Logger.debug(`🔍 ${this.name}: 사용 가능한 액션들`, {
        availableActions: Array.from(this.actionMap.keys()),
        requestedAction: subAction,
      });

      // 🔧 동적 액션 먼저 확인 (toggle_1, delete_2 등)
      if (await this.handleDynamicAction(bot, callbackQuery, subAction)) {
        Logger.info(`✅ ${this.name}: 동적 액션 ${subAction} 처리 완료`);
        return true;
      }

      // 액션 맵에서 핸들러 찾기
      const handler = this.actionMap.get(subAction);

      if (handler) {
        Logger.info(`✅ ${this.name}: ${subAction} 액션 실행 시작`);
        await handler(bot, chatId, messageId, userId, userName, params);
        Logger.info(`✅ ${this.name}: ${subAction} 액션 실행 완료`);
        return true;
      } else {
        // 등록되지 않은 액션 처리
        Logger.warn(`⚠️ ${this.name}: 등록되지 않은 액션 ${subAction}`);
        await this.handleUnregisteredAction(bot, chatId, messageId, subAction);
        return false;
      }
    } catch (error) {
      Logger.error(`❌ ${this.name} 콜백 처리 오류 (${subAction}):`, error);
      await this.handleError(bot, chatId, error);
      return false;
    }
  }

  // 🚀 동적 액션 처리 (서브클래스에서 오버라이드)
  async handleDynamicAction(bot, callbackQuery, action) {
    // 기본적으로 동적 액션은 처리하지 않음
    // 서브클래스에서 toggle_1, delete_2 등을 처리
    return false;
  }

  // ✅ 필수 구현: 메뉴 표시
  async showMenu(bot, chatId, messageId, userId, userName) {
    try {
      Logger.info(`🔧 ${this.name}: showMenu 호출됨`);

      const menuData = this.getMenuData(userName);
      Logger.debug(`🔧 ${this.name}: 메뉴 데이터 생성됨`, {
        textLength: menuData.text?.length,
        buttonCount: menuData.keyboard?.inline_keyboard?.length,
      });

      // 🔧 안전한 텍스트로 변환 (마크다운 제거)
      const safeText = this.sanitizeText(menuData.text);

      await this.editMessage(bot, chatId, messageId, safeText, {
        reply_markup: menuData.keyboard,
      });

      Logger.info(`✅ ${this.name}: showMenu 완료`);
    } catch (error) {
      Logger.error(`❌ ${this.name}: showMenu 오류`, error);
      throw error;
    }
  }

  // 🔧 텍스트 안전화 메서드 (마크다운 제거)
  sanitizeText(text) {
    if (!text) return text;

    // 마크다운 문법 제거
    return text
      .replace(/\*\*(.*?)\*\*/g, "$1") // **bold** → bold
      .replace(/\*(.*?)\*/g, "$1") // *italic* → italic
      .replace(/`(.*?)`/g, "$1") // `code` → code
      .replace(/\[(.*?)\]\(.*?\)/g, "$1") // [text](link) → text
      .replace(/^#{1,6}\s+/gm, "") // # header → header
      .replace(/^\s*[-*+]\s+/gm, "• ") // - list → • list
      .replace(/^\s*\d+\.\s+/gm, "") // 1. list → list
      .trim();
  }

  // ✅ 메뉴 데이터 제공 (서브클래스에서 오버라이드)
  getMenuData(userName) {
    const displayName = this.getDisplayName();

    return {
      text: `${displayName}\n\n📋 기능 목록:`,
      keyboard: {
        inline_keyboard: [
          [
            { text: "📋 목록", callback_data: `${this.moduleName}_list` },
            { text: "➕ 추가", callback_data: `${this.moduleName}_add` },
          ],
          [
            { text: "📊 통계", callback_data: `${this.moduleName}_stats` },
            { text: "⚙️ 설정", callback_data: `${this.moduleName}_setting` },
          ],
          [
            { text: "❓ 도움말", callback_data: `${this.moduleName}_help` },
            { text: "🔙 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      },
    };
  }

  // 🚀 기본 서브메뉴 메서드들 (서브클래스에서 오버라이드 가능)

  async showList(bot, chatId, messageId, userId, userName) {
    const text = `📋 ${this.getDisplayName()} 목록\n\n🚧 목록 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async startAdd(bot, chatId, messageId, userId, userName) {
    const text = `➕ ${this.getDisplayName()} 추가\n\n🚧 추가 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showStats(bot, chatId, messageId, userId, userName) {
    const text =
      `📊 ${this.getDisplayName()} 통계\n\n` +
      `🔧 모듈명: ${this.name}\n` +
      `⚡ 상태: ${this.isInitialized ? "활성" : "비활성"}\n` +
      `📈 사용 횟수: ${this.stats.callbackCount}회\n` +
      `🕐 마지막 사용: ${
        this.stats.lastUsed ? this.stats.lastUsed.toLocaleString() : "없음"
      }`;

    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showSetting(bot, chatId, messageId, userId, userName) {
    const text = `⚙️ ${this.getDisplayName()} 설정\n\n🚧 설정 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  // 🚀 운세 모듈용 특화 메서드들
  async showTarot(bot, chatId, messageId, userId, userName) {
    const text = `🎴 타로카드\n\n🚧 타로카드 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showTarot3(bot, chatId, messageId, userId, userName) {
    const text = `🎴 타로카드 3장 스프레드\n\n🚧 타로카드 3장 뽑기 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showLucky(bot, chatId, messageId, userId, userName) {
    const text = `🍀 행운 정보\n\n🚧 행운 정보 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showAll(bot, chatId, messageId, userId, userName) {
    const text = `🌟 종합 정보\n\n🚧 종합 정보 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showMeeting(bot, chatId, messageId, userId, userName) {
    const text = `🍻 회식운\n\n🚧 회식운 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showGeneral(bot, chatId, messageId, userId, userName) {
    const text = `🌟 종합 운세\n\n🚧 종합 운세 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showWork(bot, chatId, messageId, userId, userName) {
    const text = `💼 업무운\n\n🚧 업무운 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showLove(bot, chatId, messageId, userId, userName) {
    const text = `💖 연애운\n\n🚧 연애운 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showMoney(bot, chatId, messageId, userId, userName) {
    const text = `💰 재물운\n\n🚧 재물운 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showHealth(bot, chatId, messageId, userId, userName) {
    const text = `🏥 건강운\n\n🚧 건강운 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  // 더 많은 기본 메서드들...
  async handleClear(bot, chatId, messageId, userId, userName) {
    const text = `🗑️ ${this.getDisplayName()} 삭제\n\n🚧 삭제 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async handleRefresh(bot, chatId, messageId, userId, userName) {
    const text = `🔄 ${this.getDisplayName()} 새로고침\n\n🚧 새로고침 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showCurrent(bot, chatId, messageId, userId, userName) {
    const text = `📍 현재 ${this.getDisplayName()}\n\n🚧 현재 상태 조회 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showToday(bot, chatId, messageId, userId, userName) {
    const text = `📅 오늘의 ${this.getDisplayName()}\n\n🚧 오늘 정보를 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showDashboard(bot, chatId, messageId, userId, userName) {
    const text = `📊 ${this.getDisplayName()} 대시보드\n\n🚧 대시보드 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showHistory(bot, chatId, messageId, userId, userName) {
    const text = `📜 ${this.getDisplayName()} 히스토리\n\n🚧 히스토리 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showForecast(bot, chatId, messageId, userId, userName) {
    const text = `🔮 ${this.getDisplayName()} 예보\n\n🚧 예보 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showQuick(bot, chatId, messageId, userId, userName) {
    const text = `⚡ 빠른 ${this.getDisplayName()}\n\n🚧 빠른 조회 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async showNational(bot, chatId, messageId, userId, userName) {
    const text = `🇰🇷 전국 ${this.getDisplayName()}\n\n🚧 전국 정보를 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async handleStart(bot, chatId, messageId, userId, userName) {
    const text = `▶️ ${this.getDisplayName()} 시작\n\n🚧 시작 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async handleStop(bot, chatId, messageId, userId, userName) {
    const text = `⏹️ ${this.getDisplayName()} 정지\n\n🚧 정지 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async handlePause(bot, chatId, messageId, userId, userName) {
    const text = `⏸️ ${this.getDisplayName()} 일시정지\n\n🚧 일시정지 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async handleResume(bot, chatId, messageId, userId, userName) {
    const text = `▶️ ${this.getDisplayName()} 재개\n\n🚧 재개 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async handleExport(bot, chatId, messageId, userId, userName) {
    const text = `📤 ${this.getDisplayName()} 내보내기\n\n🚧 내보내기 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  async handleImport(bot, chatId, messageId, userId, userName) {
    const text = `📥 ${this.getDisplayName()} 가져오기\n\n🚧 가져오기 기능을 준비 중입니다.`;
    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  // ✅ 모듈 표시 이름 가져오기
  getDisplayName() {
    const displayNames = {
      todo: "📝 할일 관리",
      fortune: "🔮 운세",
      timer: "⏰ 타이머",
      weather: "🌤️ 날씨",
      insight: "📊 인사이트",
      utils: "🛠️ 유틸리티",
      reminder: "🔔 리마인더",
      worktime: "🕐 근무시간",
      leave: "📅 휴가 관리",
    };

    return displayNames[this.moduleName] || this.name;
  }

  // ✅ 기본 도움말 표시
  async showHelp(bot, chatId, messageId) {
    const helpText = this.getHelpMessage();
    const safeText = this.sanitizeText(helpText);

    await this.editMessage(bot, chatId, messageId, safeText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔙 메뉴로", callback_data: `${this.moduleName}_menu` },
            { text: "🏠 메인 메뉴", callback_data: "main_menu" },
          ],
        ],
      },
    });
  }

  // ✅ 기본 상태 표시
  async showStatus(bot, chatId, messageId) {
    const statusText =
      `📊 ${this.getDisplayName()} 상태\n\n` +
      `🔧 모듈명: ${this.name}\n` +
      `⚡ 상태: ${this.isInitialized ? "활성" : "비활성"}\n` +
      `📈 사용 통계: ${this.stats.callbackCount}회`;

    await this.editMessage(bot, chatId, messageId, statusText, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  // ✅ 등록되지 않은 액션 처리
  async handleUnregisteredAction(bot, chatId, messageId, action) {
    const text =
      `❌ 알 수 없는 액션: ${action}\n\n` +
      `${this.getDisplayName()}에서 처리할 수 없는 요청입니다.\n\n` +
      `사용 가능한 액션: ${Array.from(this.actionMap.keys())
        .slice(0, 10)
        .join(", ")}${this.actionMap.size > 10 ? "..." : ""}`;

    await this.editMessage(bot, chatId, messageId, text, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  // ✅ 에러 처리
  async handleError(bot, chatId, error) {
    const errorText =
      "❌ 오류 발생\n\n처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";

    await this.sendMessage(bot, chatId, errorText, {
      reply_markup: this.getBackToMenuKeyboard(),
    });
  }

  // 🚀 편의 메서드: 뒤로가기 키보드
  getBackToMenuKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🔙 메뉴로", callback_data: `${this.moduleName}_menu` },
          { text: "🏠 메인 메뉴", callback_data: "main_menu" },
        ],
      ],
    };
  }

  // ✅ 도움말 메시지 (서브클래스에서 오버라이드)
  getHelpMessage() {
    return `❓ ${this.getDisplayName()} 도움말\n\n이 모듈의 도움말이 준비 중입니다.`;
  }

  // ✅ 기본 메시지 처리
  async handleMessage(bot, msg) {
    // 기본적으로 메시지를 처리하지 않음
    return false;
  }

  // ✅ 초기화 메서드 (서브클래스에서 오버라이드)
  async initialize() {
    this.isInitialized = true;
    Logger.info(`✅ ${this.name} 초기화 완료`);
  }

  // ✅ 유틸리티 메서드들
  updateStats(type) {
    switch (type) {
      case "command":
        this.stats.commandCount++;
        break;
      case "callback":
        this.stats.callbackCount++;
        break;
      case "error":
        this.stats.errorCount++;
        break;
    }
    this.stats.lastUsed = new Date();
  }

  async sendMessage(bot, chatId, text, options = {}) {
    try {
      const safeText = this.sanitizeText(text);
      return await bot.sendMessage(chatId, safeText, options);
    } catch (error) {
      Logger.error(`메시지 전송 실패 [${this.name}]:`, error);
    }
  }

  // 🔧 메시지 수정 메서드 - 마크다운 제거
  async editMessage(bot, chatId, messageId, text, options = {}) {
    try {
      // 🔧 마크다운 제거하고 안전한 텍스트로 변환
      const safeText = this.sanitizeText(text);

      return await bot.editMessageText(safeText, {
        chat_id: chatId,
        message_id: messageId,
        ...options,
      });
    } catch (error) {
      // 메시지 수정 실패 시 새 메시지 전송
      Logger.warn(
        `메시지 수정 실패, 새 메시지 전송 [${this.name}]:`,
        error.message
      );
      const safeText = this.sanitizeText(text);
      return await this.sendMessage(bot, chatId, safeText, options);
    }
  }

  // ✅ 모듈 정보
  getModuleInfo() {
    return {
      name: this.name,
      moduleName: this.moduleName,
      displayName: this.getDisplayName(),
      isInitialized: this.isInitialized,
      isLoaded: this.isLoaded,
      stats: this.stats,
      availableActions: Array.from(this.actionMap.keys()),
    };
  }

  toString() {
    return `[Module: ${this.name}]`;
  }
}

module.exports = BaseModule;
