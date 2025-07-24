// src/config/BotCommandsRegistry.js - BotFather 명령어 표준 레지스트리
const logger = require("../utils/Logger");

class BotCommandsRegistry {
  constructor() {
    this.commands = new Map();
    this.moduleCommands = new Map();
    this.adminCommands = new Map();

    this.setupStandardCommands();
    logger.info("📋 BotCommandsRegistry 초기화 완료");
  }

  // 🏛️ 표준 명령어 설정 (기존 구조 유지)
  setupStandardCommands() {
    // ======= 시스템 핵심 명령어 ======= (기존 유지)
    this.commands.set("start", {
      command: "start",
      description: "봇 시작 및 메인 메뉴",
      category: "system",
      isPublic: true,
      handler: "CommandHandler.handleStart",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      scope: ["private", "group"],
    });

    this.commands.set("help", {
      command: "help",
      description: "도움말 및 사용법 보기",
      category: "system",
      isPublic: true,
      handler: "CommandHandler.handleHelp",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      scope: ["private", "group"],
    });

    this.commands.set("cancel", {
      command: "cancel",
      description: "현재 작업 취소",
      category: "system",
      isPublic: true,
      handler: "CommandHandler.handleCancel",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      scope: ["private", "group"],
    });

    this.commands.set("status", {
      command: "status",
      description: "봇 상태 및 업타임 확인",
      category: "system",
      isPublic: true,
      handler: "CommandHandler.handleStatus",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
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
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      quickActions: ["add", "list", "stats"],
    });

    this.moduleCommands.set("fortune", {
      command: "fortune",
      description: "오늘의 운세 (일반/업무/연애/재물)",
      module: "FortuneModule",
      category: "entertainment",
      isPublic: true,
      handler: "FortuneModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      quickActions: ["today", "work", "love", "money"],
    });

    this.moduleCommands.set("weather", {
      command: "weather",
      description: "날씨 정보 및 예보 확인",
      module: "WeatherModule",
      category: "info",
      isPublic: true,
      handler: "WeatherModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      quickActions: ["now", "today", "tomorrow"],
    });

    this.moduleCommands.set("timer", {
      command: "timer",
      description: "타이머 및 리마인더 (뽀모도르)",
      module: "TimerModule",
      category: "productivity",
      isPublic: true,
      handler: "TimerModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      quickActions: ["start", "stop", "pomodoro"],
    });

    // 🏖️ 휴가 관리 모듈 (업데이트된 버전)
    this.moduleCommands.set("leave", {
      command: "leave",
      description: "통합 휴가 관리 (연차/월차/반차/반반차/병가)",
      module: "LeaveModule",
      category: "work",
      isPublic: true,
      handler: "LeaveModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      quickActions: ["status", "use", "history", "statistics"],
      // 🎯 휴가 타입별 상세 정보
      leaveTypes: {
        ANNUAL: { name: "연차", emoji: "🏖️", allowedDays: [1, 0.5, 0.25] },
        MONTHLY: { name: "월차", emoji: "📅", allowedDays: [1, 0.5, 0.25] },
        HALF_DAY: { name: "반차", emoji: "🌅", allowedDays: [0.5] },
        QUARTER_DAY: { name: "반반차", emoji: "⏰", allowedDays: [0.25] },
        SICK: { name: "병가", emoji: "🤒", allowedDays: [1, 0.5, 0.25] },
      },
    });

    this.moduleCommands.set("insight", {
      command: "insight",
      description: "마케팅 인사이트 (미세먼지 분석)",
      module: "InsightModule",
      category: "business",
      isPublic: true,
      handler: "InsightModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      quickActions: ["dashboard", "report", "alert"],
    });

    this.moduleCommands.set("utils", {
      command: "utils",
      description: "유틸리티 (TTS/음성변환/파일)",
      module: "UtilsModule",
      category: "tools",
      isPublic: true,
      handler: "UtilsModule.handleMessage",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      quickActions: ["tts", "voice", "file"],
    });

    // ======= 관리자 명령어 =======
    this.adminCommands.set("admin", {
      command: "admin",
      description: "관리자 메뉴 (통계/모듈관리)",
      category: "admin",
      isPublic: false,
      handler: "CommandHandler.handleAdmin",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      scope: ["private"],
      requiredRole: "admin",
    });

    this.adminCommands.set("stats", {
      command: "stats",
      description: "봇 상세 통계 및 성능 지표",
      category: "admin",
      isPublic: false,
      handler: "AdminModule.handleStats",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      scope: ["private"],
      requiredRole: "admin",
    });

    this.adminCommands.set("logs", {
      command: "logs",
      description: "실시간 로그 및 에러 모니터링",
      category: "admin",
      isPublic: false,
      handler: "AdminModule.handleLogs",
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
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

  // 🏖️ 휴가 관련 특수 메서드들 (새로 추가)
  getLeaveCommand() {
    return this.moduleCommands.get("leave");
  }

  getLeaveTypes() {
    const leaveCommand = this.getLeaveCommand();
    return leaveCommand?.leaveTypes || {};
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

      logger.success(`✅ BotFather 명령어 ${commands.length}개 등록 완료:`);
      commands.forEach((cmd) => {
        logger.info(`   /${cmd.command} - ${cmd.description}`);
      });

      return true;
    } catch (error) {
      logger.error("❌ BotFather 명령어 등록 실패:", error);
      return false;
    }
  }

  // 🔄 명령어 동적 추가 (런타임 확장용)
  addModuleCommand(commandName, config) {
    if (this.moduleCommands.has(commandName)) {
      logger.warn(`⚠️ 명령어 ${commandName} 이미 존재함, 덮어쓰기`);
    }

    // 표준 매개변수 강제 적용
    const standardizedConfig = {
      ...config,
      params: "(bot, callbackQuery, subAction, params, moduleManager)",
      isPublic: config.isPublic !== false, // 기본값 true
    };

    this.moduleCommands.set(commandName, standardizedConfig);
    logger.info(`✅ 모듈 명령어 /${commandName} 추가됨`);
  }

  // 🗑️ 명령어 제거
  removeModuleCommand(commandName) {
    if (this.moduleCommands.has(commandName)) {
      this.moduleCommands.delete(commandName);
      logger.info(`🗑️ 모듈 명령어 /${commandName} 제거됨`);
      return true;
    }
    return false;
  }

  // 🏖️ 휴가 도움말 생성 (새로 추가)
  generateLeaveHelpText() {
    const leaveCommand = this.getLeaveCommand();
    if (!leaveCommand) {
      return "휴가 명령어를 찾을 수 없습니다.";
    }

    let helpText = "🏖️ **휴가 관리 시스템 도움말**\n\n";

    helpText += "**📋 기본 명령어**\n";
    helpText += "• /leave - 휴가 관리 메인 메뉴\n\n";

    if (leaveCommand.leaveTypes) {
      helpText += "**🏖️ 휴가 종류**\n";
      Object.entries(leaveCommand.leaveTypes).forEach(([type, config]) => {
        helpText += `${config.emoji} **${
          config.name
        }**: ${config.allowedDays.join("일, ")}일 사용 가능\n`;
      });
      helpText += "\n";
    }

    helpText += "**⏰ 사용 단위**\n";
    helpText += "• 1일: 하루종일 (09:00-18:00)\n";
    helpText += "• 0.5일: 반나절 (오전/오후 선택)\n";
    helpText += "• 0.25일: 반반나절 (2시간)\n\n";

    helpText += "**📊 활용 팁**\n";
    helpText += "• 연차는 1일, 0.5일, 0.25일 단위로 사용 가능\n";
    helpText += "• 월차는 매월 자동으로 1일씩 지급\n";
    helpText += "• 반차는 오전/오후 선택 가능\n";
    helpText += "• 반반차는 출퇴근 시간 활용\n";
    helpText += "• 병가는 연차에서 차감되지 않음";

    return helpText;
  }
}
// 싱글톤 인스턴스
const botCommandsRegistry = new BotCommandsRegistry();

module.exports = botCommandsRegistry;
