// src/config/BotCommandsRegistry.js - BotFather 명령어 표준 레지스트리
// Railway 환경 v3.0.1 리팩토링 표준

const Logger = require("../utils/Logger");

class BotCommandsRegistry {
  constructor() {
    this.commands = new Map();
    this.moduleCommands = new Map();
    this.adminCommands = new Map();

    this.setupStandardCommands();
    Logger.info("📋 BotCommandsRegistry 초기화 완료");
  }

  // 🏛️ 표준 명령어 설정 (BotFather setCommands용)
  setupStandardCommands() {
    // ======= 시스템 핵심 명령어 =======
    this.commands.set("start", {
      command: "start",
      description: "봇 시작 및 메인 메뉴",
      category: "system",
      isPublic: true,
      handler: "CommandHandler.handleStart",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      scope: ["private", "group"],
    });

    this.commands.set("help", {
      command: "help",
      description: "도움말 및 사용법 보기",
      category: "system",
      isPublic: true,
      handler: "CommandHandler.handleHelp",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      scope: ["private", "group"],
    });

    this.commands.set("cancel", {
      command: "cancel",
      description: "현재 작업 취소",
      category: "system",
      isPublic: true,
      handler: "CommandHandler.handleCancel",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      scope: ["private", "group"],
    });

    this.commands.set("status", {
      command: "status",
      description: "봇 상태 및 업타임 확인",
      category: "system",
      isPublic: true,
      handler: "CommandHandler.handleStatus",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      scope: ["private", "group"],
    });

    // ======= 모듈 명령어 =======
    this.moduleCommands.set("todo", {
      command: "todo",
      description: "할일 관리 (추가/완료/목록)",
      module: "TodoModule",
      category: "productivity",
      isPublic: true,
      handler: "TodoModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      quickActions: ["add", "list", "stats"],
    });

    this.moduleCommands.set("fortune", {
      command: "fortune",
      description: "오늘의 운세 (일반/업무/연애/재물)",
      module: "FortuneModule",
      category: "entertainment",
      isPublic: true,
      handler: "FortuneModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      quickActions: ["today", "work", "love", "money"],
    });

    this.moduleCommands.set("weather", {
      command: "weather",
      description: "날씨 정보 및 예보 확인",
      module: "WeatherModule",
      category: "info",
      isPublic: true,
      handler: "WeatherModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      quickActions: ["now", "today", "tomorrow"],
    });

    this.moduleCommands.set("timer", {
      command: "timer",
      description: "타이머 및 리마인더 (뽀모도르)",
      module: "TimerModule",
      category: "productivity",
      isPublic: true,
      handler: "TimerModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      quickActions: ["start", "stop", "pomodoro"],
    });

    this.moduleCommands.set("leave", {
      command: "leave",
      description: "휴가 관리 (연차/병가 신청)",
      module: "LeaveModule",
      category: "work",
      isPublic: true,
      handler: "LeaveModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      quickActions: ["status", "request", "history"],
    });

    this.moduleCommands.set("insight", {
      command: "insight",
      description: "마케팅 인사이트 (미세먼지 분석)",
      module: "InsightModule",
      category: "business",
      isPublic: true,
      handler: "InsightModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      quickActions: ["dashboard", "report", "alert"],
    });

    this.moduleCommands.set("utils", {
      command: "utils",
      description: "유틸리티 (TTS/음성변환/파일)",
      module: "UtilsModule",
      category: "tools",
      isPublic: true,
      handler: "UtilsModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      quickActions: ["tts", "voice", "file"],
    });

    this.moduleCommands.set("worktime", {
      command: "worktime",
      description: "근무시간 관리 (출퇴근 체크)",
      module: "WorktimeModule",
      category: "work",
      isPublic: true,
      handler: "WorktimeModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      quickActions: ["checkin", "checkout", "status"],
    });

    // ======= 관리자 명령어 =======
    this.adminCommands.set("admin", {
      command: "admin",
      description: "관리자 메뉴 (통계/모듈관리)",
      category: "admin",
      isPublic: false,
      handler: "CommandHandler.handleAdmin",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      scope: ["private"],
      requiredRole: "admin",
    });

    this.adminCommands.set("stats", {
      command: "stats",
      description: "봇 상세 통계 및 성능 지표",
      category: "admin",
      isPublic: false,
      handler: "AdminModule.handleStats",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      scope: ["private"],
      requiredRole: "admin",
    });

    this.adminCommands.set("logs", {
      command: "logs",
      description: "실시간 로그 및 에러 모니터링",
      category: "admin",
      isPublic: false,
      handler: "AdminModule.handleLogs",
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      scope: ["private"],
      requiredRole: "admin",
    });
  }

  // 🎯 BotFather용 공개 명령어 목록 생성
  getBotFatherCommands() {
    const publicCommands = [];

    // 시스템 명령어 추가
    for (const [key, cmd] of this.commands) {
      if (cmd.isPublic) {
        publicCommands.push({
          command: cmd.command,
          description: cmd.description,
        });
      }
    }

    // 모듈 명령어 추가
    for (const [key, cmd] of this.moduleCommands) {
      if (cmd.isPublic) {
        publicCommands.push({
          command: cmd.command,
          description: cmd.description,
        });
      }
    }

    return publicCommands;
  }

  // 🔧 명령어 매핑 가져오기 (CommandHandler용)
  getCommandMapping() {
    const mapping = new Map();

    // 모든 명령어를 Map으로 병합
    for (const [key, cmd] of this.commands) {
      mapping.set(`/${cmd.command}`, cmd);
    }

    for (const [key, cmd] of this.moduleCommands) {
      mapping.set(`/${cmd.command}`, cmd);
    }

    // 관리자 명령어는 별도 처리
    for (const [key, cmd] of this.adminCommands) {
      mapping.set(`/${cmd.command}`, {
        ...cmd,
        isAdmin: true,
      });
    }

    return mapping;
  }

  // 📋 모듈별 명령어 가져오기
  getModuleCommands(moduleName) {
    const moduleCommands = [];

    for (const [key, cmd] of this.moduleCommands) {
      if (cmd.module === moduleName) {
        moduleCommands.push(cmd);
      }
    }

    return moduleCommands;
  }

  // 🔍 명령어 검색
  findCommand(commandName) {
    // 시스템 명령어 검색
    if (this.commands.has(commandName)) {
      return this.commands.get(commandName);
    }

    // 모듈 명령어 검색
    if (this.moduleCommands.has(commandName)) {
      return this.moduleCommands.get(commandName);
    }

    // 관리자 명령어 검색
    if (this.adminCommands.has(commandName)) {
      return this.adminCommands.get(commandName);
    }

    return null;
  }

  // 📊 명령어 통계
  getCommandStats() {
    return {
      totalCommands:
        this.commands.size + this.moduleCommands.size + this.adminCommands.size,
      systemCommands: this.commands.size,
      moduleCommands: this.moduleCommands.size,
      adminCommands: this.adminCommands.size,
      publicCommands: this.getBotFatherCommands().length,
    };
  }

  // 🚀 BotFather setCommands 실행 헬퍼
  async setBotFatherCommands(bot) {
    try {
      const commands = this.getBotFatherCommands();

      await bot.setMyCommands(commands);

      Logger.success(`✅ BotFather 명령어 ${commands.length}개 등록 완료:`);
      commands.forEach((cmd) => {
        Logger.info(`   /${cmd.command} - ${cmd.description}`);
      });

      return true;
    } catch (error) {
      Logger.error("❌ BotFather 명령어 등록 실패:", error);
      return false;
    }
  }

  // 🔄 명령어 동적 추가 (런타임 확장용)
  addModuleCommand(commandName, config) {
    if (this.moduleCommands.has(commandName)) {
      Logger.warn(`⚠️ 명령어 ${commandName} 이미 존재함, 덮어쓰기`);
    }

    // 표준 매개변수 강제 적용
    const standardizedConfig = {
      ...config,
      params: "(bot, callbackQuery, subAction, params, menuManager)",
      isPublic: config.isPublic !== false, // 기본값 true
    };

    this.moduleCommands.set(commandName, standardizedConfig);
    Logger.info(`✅ 모듈 명령어 /${commandName} 추가됨`);
  }

  // 🗑️ 명령어 제거
  removeModuleCommand(commandName) {
    if (this.moduleCommands.has(commandName)) {
      this.moduleCommands.delete(commandName);
      Logger.info(`🗑️ 모듈 명령어 /${commandName} 제거됨`);
      return true;
    }
    return false;
  }
}

// 싱글톤 인스턴스
const botCommandsRegistry = new BotCommandsRegistry();

module.exports = botCommandsRegistry;
