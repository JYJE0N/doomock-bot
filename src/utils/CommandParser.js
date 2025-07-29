// src/utils/CommandParser.js - 🆕 새로 생성!
const logger = require("./Logger");

/**
 * 🎯 CommandParser - 유일무이한 명령어 파싱 시스템
 *
 * 🏆 특징:
 * - 전체 시스템에서 단 하나만 존재
 * - 모든 명령어 파싱 로직 중앙화
 * - 표준화된 결과 반환
 * - 한글/영어 별칭 지원
 * - 봇 멘션 자동 제거
 */
class CommandParser {
  constructor() {
    // 🎯 명령어 별칭 매핑
    this.commandAliases = {
      // 한국어 → 영어
      할일: "todo",
      할일목록: "todo",
      투두: "todo",
      태스크: "todo",
      타이머: "timer",
      시간: "timer",
      알람: "timer",
      뽀모도로: "timer",
      날씨: "weather",
      기상: "weather",
      온도: "weather",
      운세: "fortune",
      타로: "fortune",
      점: "fortune",
      근무: "worktime",
      출퇴근: "worktime",
      근무시간: "worktime",
      휴가: "leave",
      연차: "leave",
      음성: "tts",
      음성변환: "tts",
      도움말: "help",
      도움: "help",
      메뉴: "menu",
      시작: "start",

      // 영어 별칭
      todos: "todo",
      task: "todo",
      tasks: "todo",
      time: "timer",
      remind: "reminder",
      voice: "tts",
      speech: "tts",

      // 약어
      wt: "worktime",
      tm: "timer",
      td: "todo",
    };

    // 🎯 시스템 명령어 목록
    this.systemCommands = [
      "start",
      "help",
      "status",
      "cancel",
      "menu",
      "about",
      "settings",
      "restart",
      "ping",
    ];

    logger.info("🎯 CommandParser 초기화 완료 - 중앙 집중식 명령어 파싱");
  }

  /**
   * 🔍 메시지에서 명령어 정보 추출 (유일한 파싱 메서드)
   */
  parseMessage(text) {
    if (!text || typeof text !== "string") {
      return {
        isCommand: false,
        type: "text",
        originalText: text || "",
      };
    }

    const trimmedText = text.trim();

    // 명령어 형태 확인 (/로 시작)
    if (trimmedText.startsWith("/")) {
      return this.parseSlashCommand(trimmedText);
    }

    // 키워드 형태 확인 (일반 텍스트)
    return this.parseKeywordCommand(trimmedText);
  }

  /**
   * 🎯 슬래시 명령어 파싱 (/start, /todo 등)
   */
  parseSlashCommand(text) {
    try {
      // 공백으로 분리
      const parts = text.split(/\s+/);
      const commandPart = parts[0];

      // / 제거
      let rawCommand = commandPart.substring(1);

      // 봇 멘션 제거 (@botname)
      if (rawCommand.includes("@")) {
        rawCommand = rawCommand.split("@")[0];
      }

      // 소문자 변환
      const command = rawCommand.toLowerCase();

      // 유효성 검사
      if (!command || command.length === 0) {
        return {
          isCommand: false,
          type: "invalid_command",
          originalText: text,
          error: "empty_command",
        };
      }

      // 별칭 해결
      const resolvedCommand = this.resolveAlias(command);

      // 인수 추출
      const args = parts.slice(1).filter((arg) => arg.length > 0);

      // 명령어 분류
      const commandType = this.classifyCommand(resolvedCommand);

      return {
        isCommand: true,
        type: "slash_command",
        command: resolvedCommand,
        originalCommand: command,
        args: args,
        commandType: commandType,
        originalText: text,
        partsCount: parts.length,
      };
    } catch (error) {
      logger.warn("슬래시 명령어 파싱 오류:", error);
      return {
        isCommand: false,
        type: "parse_error",
        originalText: text,
        error: error.message,
      };
    }
  }

  /**
   * 💬 키워드 명령어 파싱 (할일, todo 등)
   */
  parseKeywordCommand(text) {
    const lowerText = text.toLowerCase().trim();

    // 별칭에서 매칭되는 키워드 찾기
    const matchedAlias = Object.keys(this.commandAliases).find((alias) => {
      return lowerText === alias || lowerText.startsWith(alias + " ");
    });

    if (matchedAlias) {
      const resolvedCommand = this.commandAliases[matchedAlias];
      const commandType = this.classifyCommand(resolvedCommand);

      // 키워드 뒤의 인수 추출
      const args = lowerText.startsWith(matchedAlias + " ")
        ? lowerText
            .substring(matchedAlias.length + 1)
            .split(/\s+/)
            .filter((arg) => arg.length > 0)
        : [];

      return {
        isCommand: true,
        type: "keyword_command",
        command: resolvedCommand,
        originalKeyword: matchedAlias,
        args: args,
        commandType: commandType,
        originalText: text,
      };
    }

    // 명령어가 아닌 일반 텍스트
    return {
      isCommand: false,
      type: "text",
      originalText: text,
    };
  }

  /**
   * 🔄 별칭 해결
   */
  resolveAlias(command) {
    return this.commandAliases[command] || command;
  }

  /**
   * 🏷️ 명령어 분류
   */
  classifyCommand(command) {
    if (this.systemCommands.includes(command)) {
      return "system";
    }

    // 모듈 명령어 체크는 외부에서 주입받을 수 있도록
    return "module";
  }

  /**
   * 📊 파싱 통계
   */
  getStats() {
    return {
      totalAliases: Object.keys(this.commandAliases).length,
      systemCommands: this.systemCommands.length,
      version: "1.0.0",
    };
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const commandParser = new CommandParser();
module.exports = commandParser;
