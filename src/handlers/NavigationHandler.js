// src/handlers/NavigationHandler.js - 중앙 네비게이션 핸들러 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🎹 NavigationHandler v3.0.1 (리팩토링)
 * 
 * 🔧 주요 개선사항:
 * - 콜백 데이터 파싱 로직 강화
 * - 중복 처리 방지 개선
 * - 시스템 네비게이션 표준화
 * - 에러 처리 고도화
 * - Railway 환경 최적화
 */
class NavigationHandler {
  constructor() {
    // 📊 통계
    this.stats = {
      navigationsHandled: 0,
      keyboardsGenerated: 0,
      errorsCount: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      systemNavigations: 0,
      moduleNavigations: 0
    };

    // 🚫 중복 처리 방지 캐시
    this.callbackCache = new Map();
    this.cacheTimeout = 5000; // 5초

    // 🎹 모듈 이모지 매핑
    this.moduleEmojiMap = {
      todo: "📝",
      timer: "⏰", 
      worktime: "🕐",
      vacation: "🏖️",
      system: "⚙️",
      example: "📱",
      demo: "🎪",
      test: "🧪"
    };

    this.moduleManager = null;
    this.isInitialized = false;

    logger.info("🎹 NavigationHandler 생성됨");
  }

  /**
   * 🚀 NavigationHandler 초기화
   */
  async initialize(moduleManager) {
    try {
      logger.moduleStart("NavigationHandler", "3.0.1");

      this.moduleManager = moduleManager;

      // 캐시 정리 스케줄
      this.scheduleCacheCleanup();

      this.isInitialized = true;
      logger.success("✅ NavigationHandler 초기화 완료", {
        moduleManager: !!this.moduleManager
      });

    } catch (error) {
      logger.error("❌ NavigationHandler 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 네비게이션 처리 (메인 엔트리포인트)
   * 표준 매개변수: (bot, callbackQuery, subAction, params, moduleManager)
   */
  async handleNavigation(bot, callbackQuery, subAction, params, moduleManager) {
    const startTime = Date.now();
    const callbackId = callbackQuery.id;

    try {
      // 🚫 중복 처리 방지
      if (this.callbackCache.has(callbackId)) {
        logger.debug(`🔄 중복 네비게이션 콜백 무시: ${callbackId}`);
        return true;
    } catch (error) {
      logger.error("❌ 정보 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 정보 텍스트 생성
   */
  buildAboutText() {
    let text = `ℹ️ **두목봇 v3.0.1**\n\n`;

    text += `**🤖 봇 정보**\n`;
    text += `• 이름: 두목봇\n`;
    text += `• 버전: v3.0.1\n`;
    text += `• 개발: Navigation 중앙처리 시스템\n`;
    text += `• 아키텍처: 모듈형 마이크로서비스\n\n`;

    text += `**🔧 주요 기능**\n`;
    text += `• 📝 할일 관리\n`;
    text += `• ⏰ 타이머 기능\n`;
    text += `• 🕐 근무시간 관리\n`;
    text += `• 🏖️ 휴가 관리\n\n`;

    text += `**🏗️ 기술 스택**\n`;
    text += `• Runtime: Node.js ${process.version}\n`;
    text += `• Database: MongoDB\n`;
    text += `• Platform: Railway\n`;
    text += `• Architecture: 중앙집중식 모듈 시스템\n\n`;

    text += `**📊 성능**\n`;
    text += `• 가동시간: ${this.formatUptime(process.uptime())}\n`;
    text += `• 처리 요청: ${this.stats.navigationsHandled}회\n`;
    text += `• 평균 응답: ${this.stats.averageResponseTime}ms\n\n`;

    text += `🚀 지속적으로 업데이트되고 있습니다!`;

    return text;
  }

  /**
   * ⌨️ 정보 키보드 생성
   */
  buildAboutKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📋 변경 기록", callback_data: "system:changelog" },
          { text: "📄 라이센스", callback_data: "system:license" }
        ],
        [
          { text: "🐛 버그 신고", callback_data: "system:bug_report" },
          { text: "💡 기능 제안", callback_data: "system:feature_request" }
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
      ]
    };
  }

  /**
   * ❓ 도움말 메뉴 표시
   */
  async showHelpMenu(bot, callbackQuery, moduleManager) {
    try {
      const helpText = this.buildHelpText();
      const keyboard = this.buildHelpKeyboard();

      await this.updateMessage(bot, callbackQuery, helpText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 도움말 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 도움말 텍스트 생성
   */
  buildHelpText() {
    return `❓ **도움말**\n\n**🎯 기본 사용법**:\n1. 메인 메뉴에서 원하는 기능 선택\n2. 각 모듈의 메뉴를 통해 작업 수행\n3. 🏠 버튼으로 언제든지 메인 메뉴 복귀\n\n**⌨️ 단축키**:\n• /start - 메인 메뉴\n• /help - 도움말\n• /status - 시스템 상태\n\n**💡 팁**:\n• 각 모듈마다 고유한 기능이 있습니다\n• 문제 발생시 🔄 새로고침 버튼 활용\n• 궁금한 점은 정보 메뉴 참고`;
  }

  /**
   * ⌨️ 도움말 키보드 생성
   */
  buildHelpKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📖 사용 가이드", callback_data: "system:guide" },
          { text: "🔧 문제 해결", callback_data: "system:troubleshoot" }
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
      ]
    };
  }

  /**
   * 📦 모듈 메뉴 표시
   */
  async showModulesMenu(bot, callbackQuery, moduleManager) {
    try {
      const modulesText = this.buildModulesText(moduleManager);
      const keyboard = this.buildModulesKeyboard(moduleManager);

      await this.updateMessage(bot, callbackQuery, modulesText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 모듈 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 모듈 텍스트 생성
   */
  buildModulesText(moduleManager) {
    let text = `📦 **모듈 관리**\n\n`;

    if (moduleManager) {
      const moduleStatus = moduleManager.getStatus();
      const activeModules = this.getActiveModules(moduleManager);

      text += `**📊 모듈 통계**:\n`;
      text += `• 등록: ${moduleStatus.stats.totalModules}개\n`;
      text += `• 활성: ${moduleStatus.stats.activeModules}개\n`;
      text += `• 실패: ${moduleStatus.stats.failedModules}개\n\n`;

      if (activeModules.length > 0) {
        text += `**🟢 활성 모듈**:\n`;
        activeModules.forEach(module => {
          text += `• ${module.emoji} **${module.name}**\n`;
          text += `  ${module.description}\n`;
        });
      }
    } else {
      text += `❌ ModuleManager를 사용할 수 없습니다.`;
    }

    return text;
  }

  /**
   * ⌨️ 모듈 키보드 생성
   */
  buildModulesKeyboard(moduleManager) {
    const keyboard = { inline_keyboard: [] };

    if (moduleManager) {
      const activeModules = this.getActiveModules(moduleManager);
      
      // 각 모듈의 상태 보기 버튼 (최대 4개)
      const displayModules = activeModules.slice(0, 4);
      for (let i = 0; i < displayModules.length; i += 2) {
        const row = [];
        
        const module1 = displayModules[i];
        row.push({
          text: `${module1.emoji} ${module1.shortName}`,
          callback_data: `${module1.key}:status`
        });
        
        if (i + 1 < displayModules.length) {
          const module2 = displayModules[i + 1];
          row.push({
            text: `${module2.emoji} ${module2.shortName}`,
            callback_data: `${module2.key}:status`
          });
        }
        
        keyboard.inline_keyboard.push(row);
      }
    }

    // 시스템 버튼들
    keyboard.inline_keyboard.push([
      { text: "🔄 모듈 새로고침", callback_data: "system:modules" },
      { text: "📊 시스템 상태", callback_data: "system:status" }
    ]);
    
    keyboard.inline_keyboard.push([
      { text: "🏠 메인 메뉴", callback_data: "system:menu" }
    ]);

    return keyboard;
  }

  // ===== 🛠️ 고급 메뉴들 =====

  /**
   * 📋 변경 기록 표시
   */
  async showChangelog(bot, callbackQuery) {
    try {
      const changelogText = `📋 **변경 기록 v3.0.1**\n\n**🔧 주요 변경사항**:\n• NavigationHandler 중앙처리 시스템 구현\n• 표준 매개변수 체계 도입\n• BaseModule actionMap 방식 적용\n• 중복 처리 방지 로직 강화\n• Railway 환경 최적화\n• Logger 시스템 개선\n\n**🐛 버그 수정**:\n• 콜백 중복 처리 문제 해결\n• 메모리 누수 방지\n• 에러 처리 표준화\n\n**📈 성능 개선**:\n• 응답 시간 단축\n• 메모리 사용량 최적화\n• 안정성 향상`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
        ]
      };

      await this.updateMessage(bot, callbackQuery, changelogText, keyboard);
      return true;
    } catch (error) {
      logger.error("❌ 변경 기록 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📄 라이센스 표시
   */
  async showLicense(bot, callbackQuery) {
    try {
      const licenseText = `📄 **라이센스 정보**\n\n**두목봇 v3.0.1**\n\n이 소프트웨어는 MIT 라이센스 하에 배포됩니다.\n\n**주요 조건**:\n• 상업적/비상업적 사용 가능\n• 수정 및 배포 가능\n• 라이센스 표시 의무\n• 보증 없음\n\n**사용된 오픈소스**:\n• Node.js (MIT)\n• Telegraf (MIT)\n• MongoDB Driver (Apache 2.0)\n• Winston (MIT)\n• Chalk (MIT)\n\n저작권 © 2024 두목봇 개발팀`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
        ]
      };

      await this.updateMessage(bot, callbackQuery, licenseText, keyboard);
      return true;
    } catch (error) {
      logger.error("❌ 라이센스 표시 오류:", error);
      return false;
    }
  }

  /**
   * 🛠️ 고급 설정 표시
   */
  async showAdvancedSettings(bot, callbackQuery) {
    try {
      const advancedText = `🛠️ **고급 설정**\n\n⚠️ **주의사항**\n이 설정들은 시스템의 동작에 직접적인 영향을 미칩니다.\n변경 전 충분히 검토해주세요.\n\n**📊 현재 설정**:\n• 환경: ${process.env.NODE_ENV || 'development'}\n• 로그 레벨: ${process.env.LOG_LEVEL || 'info'}\n• Railway: ${process.env.RAILWAY_ENVIRONMENT ? '활성' : '비활성'}\n• 타임아웃: 30초\n• 재시도: 3회\n\n**🔧 조정 가능한 설정**:\n• 응답 타임아웃\n• 재시도 횟수\n• 캐시 유효시간\n• 로그 레벨`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "⏱️ 타임아웃 설정", callback_data: "system:timeout" },
            { text: "🔄 재시도 설정", callback_data: "system:retry" }
          ],
          [
            { text: "📝 로그 설정", callback_data: "system:logging" },
            { text: "💾 캐시 설정", callback_data: "system:cache" }
          ],
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
        ]
      };

      await this.updateMessage(bot, callbackQuery, advancedText, keyboard);
      return true;
    } catch (error) {
      logger.error("❌ 고급 설정 표시 오류:", error);
      return false;
    }
  }

  /**
   * 🔄 초기화 확인 표시
   */
  async showResetConfirmation(bot, callbackQuery) {
    try {
      const resetText = `🔄 **시스템 초기화**\n\n⚠️ **경고**\n이 작업은 다음을 초기화합니다:\n\n• 모든 사용자 상태\n• 캐시된 데이터\n• 임시 설정\n• 활성 세션\n\n**주의**: 데이터베이스는 초기화되지 않습니다.\n\n정말로 시스템을 초기화하시겠습니까?`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ 초기화 실행", callback_data: "system:reset_confirm" },
            { text: "❌ 취소", callback_data: "system:menu" }
          ]
        ]
      };

      await this.updateMessage(bot, callbackQuery, resetText, keyboard);
      return true;
    } catch (error) {
      logger.error("❌ 초기화 확인 표시 오류:", error);
      return false;
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📋 활성 모듈 목록 조회
   */
  getActiveModules(moduleManager) {
    if (!moduleManager) return [];

    try {
      const modules = moduleManager.getActiveModulesStatus();
      return modules
        .map((module) => ({
          key: module.key,
          name: module.name,
          shortName: module.name.substring(0, 4),
          emoji: this.getModuleEmoji(module.key),
          description: module.description || `${module.name} 기능`,
          priority: module.priority || 99
        }))
        .sort((a, b) => a.priority - b.priority);
    } catch (error) {
      logger.error("활성 모듈 조회 오류:", error);
      return [];
    }
  }

  /**
   * 🎨 모듈 이모지 매핑
   */
  getModuleEmoji(moduleKey) {
    return this.moduleEmojiMap[moduleKey] || "📦";
  }

  /**
   * 📝 메시지 업데이트
   */
  async updateMessage(bot, callbackQuery, text, keyboard) {
    try {
      const {
        message: {
          chat: { id: chatId },
          message_id: messageId
        }
      } = callbackQuery;

      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: keyboard
      });

    } catch (error) {
      logger.error("메시지 업데이트 오류:", error);
      throw error;
    }
  }

  // ===== 🚨 에러 처리 메서드들 =====

  /**
   * 🚨 시스템 오류 표시
   */
  async showSystemError(bot, callbackQuery, errorMessage) {
    try {
      const errorText = `🚨 **시스템 오류**\n\n${errorMessage}\n\n🔧 **해결 방법**:\n• 🔄 메인 메뉴로 돌아가기\n• 📊 시스템 상태 확인\n• 잠시 후 다시 시도\n\n⚠️ 문제가 지속되면 관리자에게 문의해주세요.`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 메인 메뉴", callback_data: "system:menu" },
            { text: "📊 시스템 상태", callback_data: "system:status" }
          ]
        ]
      };

      await this.updateMessage(bot, callbackQuery, errorText, keyboard);
    } catch (error) {
      logger.error("❌ 시스템 오류 표시 실패:", error);
    }
  }

  /**
   * ❓ 알 수 없는 네비게이션 처리
   */
  async handleUnknownNavigation(bot, callbackQuery, moduleKey, action) {
    logger.warn(`❓ 처리되지 않은 네비게이션: ${moduleKey}:${action}`);

    const errorText = `❓ **처리할 수 없는 요청**\n\n모듈: \`${moduleKey}\`\n액션: \`${action}\`\n\n해당 기능이 아직 구현되지 않았거나\n모듈이 비활성화되었습니다.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🏠 메인 메뉴", callback_data: "system:menu" },
          { text: "📊 시스템 상태", callback_data: "system:status" }
        ]
      ]
    };

    await this.updateMessage(bot, callbackQuery, errorText, keyboard);
  }

  // ===== 📊 통계 및 유틸리티 =====

  /**
   * ⏱️ 업타임 포맷팅
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}일 ${hours}시간`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    try {
      this.stats.totalResponseTime += responseTime;

      if (this.stats.navigationsHandled === 0) {
        this.stats.averageResponseTime = responseTime;
      } else {
        this.stats.averageResponseTime = Math.round(
          this.stats.totalResponseTime / (this.stats.navigationsHandled + 1)
        );
      }
    } catch (error) {
      logger.debug("📊 응답 시간 통계 업데이트 오류:", error);
    }
  }

  /**
   * ⏰ 캐시 정리 스케줄
   */
  scheduleCacheCleanup() {
    // 1분마다 만료된 캐시 정리
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupExpiredCache();
    }, 60 * 1000);

    logger.debug("⏰ NavigationHandler 캐시 정리 스케줄됨 (1분 간격)");
  }

  /**
   * 🧹 만료된 캐시 정리
   */
  cleanupExpiredCache() {
    const initialSize = this.callbackCache.size;
    
    // 전체 캐시가 너무 클 경우 모두 정리
    if (initialSize > 1000) {
      this.callbackCache.clear();
      logger.debug(`🧹 NavigationHandler 캐시 전체 정리됨 (${initialSize}개)`);
    }
  }

  // ===== 📊 상태 및 진단 =====

  /**
   * 📊 NavigationHandler 상태 조회
   */
  getStatus() {
    return {
      className: "NavigationHandler",
      version: "3.0.1",
      isInitialized: this.isInitialized,
      isHealthy: this.stats.errorsCount < 10,
      stats: {
        ...this.stats,
        cacheSize: this.callbackCache.size
      },
      config: {
        hasModuleManager: !!this.moduleManager,
        cacheTimeout: this.cacheTimeout,
        moduleEmojiMapSize: Object.keys(this.moduleEmojiMap).length
      },
      lastActivity: TimeHelper.getLogTimeString()
    };
  }

  /**
   * 📊 상세 상태 텍스트 생성
   */
  generateStatusText() {
    const status = this.getStatus();

    return `🎹 **NavigationHandler v3.0.1 상태**

🔧 **시스템 상태**:
• 초기화: ${status.isInitialized ? "✅" : "❌"}
• 상태: ${status.isHealthy ? "정상" : "오류"}
• ModuleManager: ${status.config.hasModuleManager ? "✅" : "❌"}

📊 **처리 통계**:
• 네비게이션 처리: ${status.stats.navigationsHandled}회
• 시스템 네비게이션: ${status.stats.systemNavigations}회
• 모듈 네비게이션: ${status.stats.moduleNavigations}회
• 키보드 생성: ${status.stats.keyboardsGenerated}개
• 평균 응답: ${status.stats.averageResponseTime}ms
• 에러: ${status.stats.errorsCount}개

⚡ **캐시 상태**:
• 캐시 크기: ${status.stats.cacheSize}개
• 캐시 타임아웃: ${status.config.cacheTimeout}ms

🎨 **모듈 이모지**: ${status.config.moduleEmojiMapSize}개 등록됨`;
  }

  /**
   * 🏥 헬스체크
   */
  healthCheck() {
    const issues = [];

    // 기본 상태 확인
    if (!this.isInitialized) {
      issues.push("NavigationHandler가 초기화되지 않음");
    }

    if (!this.moduleManager) {
      issues.push("ModuleManager가 연결되지 않음");
    }

    // 에러율 확인
    if (this.stats.errorsCount > 10) {
      issues.push("높은 에러율 감지");
    }

    // 캐시 크기 확인
    if (this.callbackCache.size > 500) {
      issues.push("캐시 크기가 너무 큼");
    }

    return {
      healthy: issues.length === 0,
      issues,
      status: this.getStatus()
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 NavigationHandler 정리 시작...");

      // 캐시 정리 타이머 중지
      if (this.cacheCleanupInterval) {
        clearInterval(this.cacheCleanupInterval);
        this.cacheCleanupInterval = null;
      }

      // 캐시 정리
      this.callbackCache.clear();

      // 참조 정리
      this.moduleManager = null;

      // 통계 초기화
      this.stats = {
        navigationsHandled: 0,
        keyboardsGenerated: 0,
        errorsCount: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
        systemNavigations: 0,
        moduleNavigations: 0
      };

      this.isInitialized = false;
      logger.success("✅ NavigationHandler 정리 완료");

    } catch (error) {
      logger.error("❌ NavigationHandler 정리 실패:", error);
    }
  }
}

module.exports = NavigationHandler;;
      }
      
      this.callbackCache.set(callbackId, true);
      setTimeout(() => this.callbackCache.delete(callbackId), this.cacheTimeout);

      // 📋 콜백 데이터 파싱 (개선된 로직)
      const { moduleKey, action, additionalParams } = this.parseCallbackData(callbackQuery.data);

      logger.debug(`🎹 NavigationHandler: ${moduleKey}:${action}${additionalParams.length > 0 ? `:${additionalParams.join(":")}` : ""}`, {
        user: getUserName(callbackQuery),
        callbackData: callbackQuery.data
      });

      // 🎛️ 시스템 네비게이션 (직접 처리)
      if (this.isSystemNavigation(moduleKey)) {
        const handled = await this.handleSystemNavigation(
          bot,
          callbackQuery,
          action,
          additionalParams,
          moduleManager || this.moduleManager
        );
        
        if (handled) {
          this.stats.navigationsHandled++;
          this.stats.systemNavigations++;
          return true;
        }
      }

      // 📦 모듈 네비게이션 (ModuleManager로 위임)
      const manager = moduleManager || this.moduleManager;
      if (manager && manager.hasModule(moduleKey)) {
        const handled = await manager.handleCallback(
          bot,
          callbackQuery,
          action, // subAction
          additionalParams, // params
          manager // moduleManager
        );

        if (handled) {
          this.stats.navigationsHandled++;
          this.stats.moduleNavigations++;
          return true;
        }
      }

      // 🚨 처리되지 않은 네비게이션
      await this.handleUnknownNavigation(bot, callbackQuery, moduleKey, action);
      return false;

    } catch (error) {
      logger.error("❌ NavigationHandler 오류:", error);
      this.stats.errorsCount++;
      await this.showSystemError(bot, callbackQuery, "네비게이션 처리 중 오류가 발생했습니다.");
      return false;

    } finally {
      // 📊 응답 시간 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    }
  }

  // ===== 🔧 콜백 데이터 파싱 =====

  /**
   * 🔧 콜백 데이터 파싱 (강화된 로직)
   */
  parseCallbackData(callbackData) {
    try {
      if (!callbackData || typeof callbackData !== "string") {
        logger.warn("❓ NavigationHandler: 빈 콜백 데이터");
        return this.getDefaultCallbackResult();
      }

      // 🔍 콜론(:) 기준으로 파싱
      const parts = callbackData.trim().split(":");
      
      // 최소한의 검증
      if (parts.length < 2) {
        logger.warn(`❓ NavigationHandler: 잘못된 콜백 형식 - "${callbackData}"`);
        return this.getDefaultCallbackResult();
      }

      const result = {
        moduleKey: this.sanitizeModuleKey(parts[0]),
        action: this.sanitizeAction(parts[1]),
        additionalParams: parts.slice(2).filter(param => param.length > 0)
      };

      // 🔍 상세 디버그 로그
      if (process.env.LOG_LEVEL === "debug") {
        logger.debug(`🎹 Navigation 파싱: "${callbackData}" → ${result.moduleKey}:${result.action}${result.additionalParams.length > 0 ? `:${result.additionalParams.join(":")}` : ""}`);
      }

      return result;

    } catch (error) {
      logger.error("❌ NavigationHandler 콜백 파싱 오류:", error);
      return this.getDefaultCallbackResult();
    }
  }

  /**
   * 🔧 기본 콜백 결과 반환
   */
  getDefaultCallbackResult() {
    return {
      moduleKey: "system",
      action: "menu",
      additionalParams: []
    };
  }

  /**
   * 🔧 모듈 키 정리
   */
  sanitizeModuleKey(moduleKey) {
    if (!moduleKey || typeof moduleKey !== "string") {
      return "system";
    }
    
    // 알파벳, 숫자, 언더스코어만 허용
    const sanitized = moduleKey.toLowerCase().replace(/[^a-z0-9_]/g, "");
    return sanitized || "system";
  }

  /**
   * 🔧 액션 정리
   */
  sanitizeAction(action) {
    if (!action || typeof action !== "string") {
      return "menu";
    }
    
    // 알파벳, 숫자, 언더스코어만 허용
    const sanitized = action.toLowerCase().replace(/[^a-z0-9_]/g, "");
    return sanitized || "menu";
  }

  /**
   * 🔍 시스템 네비게이션 여부 확인
   */
  isSystemNavigation(moduleKey) {
    const systemKeys = ["system", "main", "nav", "menu"];
    return systemKeys.includes(moduleKey);
  }

  // ===== 🎛️ 시스템 네비게이션 처리 =====

  /**
   * 🎛️ 시스템 네비게이션 처리
   */
  async handleSystemNavigation(bot, callbackQuery, action, params, moduleManager) {
    try {
      logger.debug(`🎛️ 시스템 네비게이션: ${action}`);

      // 시스템 액션 맵
      const systemActions = {
        menu: () => this.showMainMenu(bot, callbackQuery, moduleManager),
        start: () => this.showMainMenu(bot, callbackQuery, moduleManager),
        status: () => this.showSystemStatus(bot, callbackQuery, moduleManager),
        about: () => this.showAboutMenu(bot, callbackQuery, moduleManager),
        settings: () => this.showSettingsMenu(bot, callbackQuery, moduleManager),
        modules: () => this.showModulesMenu(bot, callbackQuery, moduleManager),
        help: () => this.showHelpMenu(bot, callbackQuery, moduleManager),
        changelog: () => this.showChangelog(bot, callbackQuery),
        license: () => this.showLicense(bot, callbackQuery),
        advanced: () => this.showAdvancedSettings(bot, callbackQuery),
        reset: () => this.showResetConfirmation(bot, callbackQuery)
      };

      const actionHandler = systemActions[action];
      if (actionHandler) {
        await actionHandler();
        return true;
      }

      logger.warn(`❓ 알 수 없는 시스템 액션: ${action}`);
      return false;

    } catch (error) {
      logger.error(`❌ 시스템 네비게이션 처리 실패 (${action}):`, error);
      return false;
    }
  }

  // ===== 🏠 메인 메뉴 및 시스템 메뉴들 =====

  /**
   * 🏠 메인 메뉴 표시
   */
  async showMainMenu(bot, callbackQuery, moduleManager) {
    try {
      const mainText = this.buildMainMenuText(moduleManager);
      const keyboard = this.buildMainMenuKeyboard(moduleManager);

      await this.updateMessage(bot, callbackQuery, mainText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 메인 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 메인 메뉴 텍스트 생성
   */
  buildMainMenuText(moduleManager) {
    let text = `🏠 **두목봇 v3.0.1 메인 메뉴**\n\n`;
    
    text += `안녕하세요! 무엇을 도와드릴까요?\n\n`;
    
    // 활성 모듈 정보
    if (moduleManager) {
      const activeModules = this.getActiveModules(moduleManager);
      text += `📦 **사용 가능한 기능**: ${activeModules.length}개\n`;
      
      // 주요 기능 소개
      const mainFeatures = activeModules.slice(0, 4);
      if (mainFeatures.length > 0) {
        text += `\n🎯 **주요 기능**:\n`;
        mainFeatures.forEach(module => {
          text += `• ${module.emoji} ${module.name}: ${module.description}\n`;
        });
      }
    }
    
    text += `\n아래 버튼을 눌러 원하는 기능을 선택하세요.`;
    
    return text;
  }

  /**
   * ⌨️ 메인 메뉴 키보드 생성
   */
  buildMainMenuKeyboard(moduleManager) {
    const keyboard = { inline_keyboard: [] };
    
    // 활성 모듈 버튼들
    if (moduleManager) {
      const activeModules = this.getActiveModules(moduleManager);
      
      // 모듈 버튼들 (2열로 배치)
      for (let i = 0; i < activeModules.length; i += 2) {
        const row = [];
        
        const module1 = activeModules[i];
        row.push({
          text: `${module1.emoji} ${module1.shortName}`,
          callback_data: `${module1.key}:menu`
        });
        
        if (i + 1 < activeModules.length) {
          const module2 = activeModules[i + 1];
          row.push({
            text: `${module2.emoji} ${module2.shortName}`,
            callback_data: `${module2.key}:menu`
          });
        }
        
        keyboard.inline_keyboard.push(row);
      }
    }
    
    // 시스템 버튼들
    keyboard.inline_keyboard.push([
      { text: "📊 시스템 상태", callback_data: "system:status" },
      { text: "⚙️ 설정", callback_data: "system:settings" }
    ]);
    
    keyboard.inline_keyboard.push([
      { text: "ℹ️ 정보", callback_data: "system:about" },
      { text: "❓ 도움말", callback_data: "system:help" }
    ]);
    
    return keyboard;
  }

  /**
   * 📊 시스템 상태 표시
   */
  async showSystemStatus(bot, callbackQuery, moduleManager) {
    try {
      const statusText = this.buildSystemStatusText(moduleManager);
      const keyboard = this.buildSystemStatusKeyboard();

      await this.updateMessage(bot, callbackQuery, statusText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 시스템 상태 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📊 시스템 상태 텍스트 생성
   */
  buildSystemStatusText(moduleManager) {
    let text = `📊 **시스템 상태 v3.0.1**\n\n`;

    // 시스템 기본 정보
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    text += `🔧 **시스템 정보**:\n`;
    text += `• 가동시간: ${this.formatUptime(uptime)}\n`;
    text += `• 메모리 사용: ${Math.round(memory.heapUsed / 1024 / 1024)}MB\n`;
    text += `• Node.js: ${process.version}\n`;
    text += `• 환경: ${process.env.NODE_ENV || 'development'}\n\n`;

    // NavigationHandler 상태
    text += `🎹 **NavigationHandler**:\n`;
    text += `• 처리된 네비게이션: ${this.stats.navigationsHandled}회\n`;
    text += `• 시스템: ${this.stats.systemNavigations}회\n`;
    text += `• 모듈: ${this.stats.moduleNavigations}회\n`;
    text += `• 평균 응답: ${this.stats.averageResponseTime}ms\n`;
    text += `• 에러: ${this.stats.errorsCount}개\n\n`;

    // ModuleManager 상태
    if (moduleManager) {
      const moduleStatus = moduleManager.getStatus();
      text += `📦 **ModuleManager**:\n`;
      text += `• 등록 모듈: ${moduleStatus.stats.totalModules}개\n`;
      text += `• 활성 모듈: ${moduleStatus.stats.activeModules}개\n`;
      text += `• 실패 모듈: ${moduleStatus.stats.failedModules}개\n`;
      text += `• 콜백 처리: ${moduleStatus.stats.callbacksHandled}회\n`;
      text += `• 메시지 처리: ${moduleStatus.stats.messagesHandled}회\n\n`;
    }

    text += `🔄 마지막 업데이트: ${TimeHelper.format(new Date(), 'time')}`;

    return text;
  }

  /**
   * ⌨️ 시스템 상태 키보드 생성
   */
  buildSystemStatusKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "📦 모듈 상태", callback_data: "system:modules" },
          { text: "🔄 새로고침", callback_data: "system:status" }
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
      ]
    };
  }

  /**
   * ⚙️ 설정 메뉴 표시
   */
  async showSettingsMenu(bot, callbackQuery, moduleManager) {
    try {
      const settingsText = this.buildSettingsText();
      const keyboard = this.buildSettingsKeyboard();

      await this.updateMessage(bot, callbackQuery, settingsText, keyboard);
      this.stats.keyboardsGenerated++;

      return true;
    } catch (error) {
      logger.error("❌ 설정 메뉴 표시 오류:", error);
      return false;
    }
  }

  /**
   * 📝 설정 텍스트 생성
   */
  buildSettingsText() {
    return `⚙️ **시스템 설정**\n\n현재 설정을 확인하고 변경할 수 있습니다.\n\n⚠️ 일부 설정은 시스템 재시작이 필요할 수 있습니다.`;
  }

  /**
   * ⌨️ 설정 키보드 생성
   */
  buildSettingsKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: "🌍 언어 설정", callback_data: "system:language" },
          { text: "🕐 시간대", callback_data: "system:timezone" }
        ],
        [
          { text: "🛠️ 고급 설정", callback_data: "system:advanced" },
          { text: "🔄 초기화", callback_data: "system:reset" }
        ],
        [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }]
      ]
    };
  }

  /**
   * ℹ️ 정보 메뉴 표시
   */
  async showAboutMenu(bot, callbackQuery, moduleManager) {
    try {
      const aboutText = this.buildAboutText();
      const keyboard = this.buildAboutKeyboard();

      await this.updateMessage(bot, callbackQuery, aboutText, keyboard);
      this.stats.keyboardsGenerated++;

      return true