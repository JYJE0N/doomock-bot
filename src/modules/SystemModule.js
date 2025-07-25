// src/modules/SystemModule.js - v3.0.1 중복 초기화 방지 수정판
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const { getUserName } = require("../utils/UserHelper");

/**
 * 🏠 SystemModule - 시스템 핵심 모듈
 * ✅ 중복 초기화 방지 완료
 * ✅ Railway 환경 체크 최적화
 * ✅ 표준 매개변수 준수
 *
 * 주요 기능:
 * - 메인 메뉴 관리 (데이터만 제공, UI는 NavigationHandler)
 * - 도움말 시스템
 * - 시스템 상태 모니터링
 * - 설정 관리
 * - Railway 환경 최적화
 */
class SystemModule extends BaseModule {
  constructor(bot, options = {}) {
    super("SystemModule", {
      bot,
      db: options.db,
      moduleManager: options.moduleManager,
      validationManager: options.validationManager,
      config: options.config,
    });

    // 🛡️ 중복 초기화 방지 플래그들
    this.systemCheckCompleted = false;
    this.railwayCheckCompleted = false;
    this.initializationInProgress = false;

    // 🎯 시스템 설정 (Railway 환경변수 기반)
    this.config = {
      version: process.env.npm_package_version || "3.0.1",
      environment: process.env.NODE_ENV || "development",
      isRailway: !!process.env.RAILWAY_ENVIRONMENT,
      botName: process.env.BOT_NAME || "doomock_todoBot",
      maxUsersInStatus: parseInt(process.env.MAX_USERS_IN_STATUS) || 10,
      enableDetailedStatus: process.env.ENABLE_DETAILED_STATUS === "true",
      memoryWarningThreshold: parseInt(process.env.MEMORY_WARNING_MB) || 400,
      ...this.config,
    };

    // 📊 시스템 통계 (한 번만 초기화)
    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      totalErrors: 0,
      lastActivity: null,
      systemChecks: 0,
    };

    logger.info("🏠 SystemModule v3.0.1 생성됨");
  }

  /**
   * 🎯 시스템 모듈 초기화 (중복 방지)
   */
  async onInitialize() {
    try {
      // 🛡️ 중복 실행 완전 방지
      if (this.initializationInProgress) {
        logger.debug("SystemModule 초기화 진행 중 - 대기");
        return;
      }

      if (this.systemCheckCompleted) {
        logger.debug("SystemModule 이미 초기화됨 - 스킵");
        return;
      }

      // 🔒 초기화 진행 중 표시
      this.initializationInProgress = true;

      logger.info("🎯 SystemModule 초기화 시작...");

      // ✅ Railway 환경 체크 (한 번만)
      await this.performRailwayCheck();

      // ✅ 시스템 체크 실행 (한 번만)
      await this.performSystemCheck();

      // ✅ 초기화 완료 표시
      this.systemCheckCompleted = true;
      this.systemStats.startTime = Date.now();

      logger.info("✅ 시스템 체크 완료");
    } catch (error) {
      logger.error("❌ SystemModule 초기화 실패:", error);
      throw error;
    } finally {
      // 🔓 초기화 진행 상태 해제
      this.initializationInProgress = false;
    }
  }

  /**
   * 🚂 Railway 환경 체크 (중복 방지)
   */
  async performRailwayCheck() {
    try {
      // 🛡️ 중복 실행 방지
      if (this.railwayCheckCompleted) {
        return;
      }

      if (this.config.isRailway) {
        logger.info("🚂 Railway 환경에서 실행 중");

        // Railway 관련 정보 로깅 (한 번만)
        if (process.env.RAILWAY_ENVIRONMENT_NAME) {
          logger.debug(`🌍 환경: ${process.env.RAILWAY_ENVIRONMENT_NAME}`);
        }

        if (process.env.RAILWAY_SERVICE_NAME) {
          logger.debug(`🚀 서비스: ${process.env.RAILWAY_SERVICE_NAME}`);
        }
      }

      this.railwayCheckCompleted = true;
    } catch (error) {
      logger.error("❌ Railway 환경 체크 실패:", error);
    }
  }

  /**
   * ✅ 시스템 체크 (중복 방지 및 최적화)
   */
  async performSystemCheck() {
    try {
      // 🛡️ 중복 실행 방지
      if (this.systemStats.systemChecks > 0) {
        logger.debug("시스템 체크 이미 완료됨 - 스킵");
        return;
      }

      // 메모리 체크
      const memUsage = process.memoryUsage();
      const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      if (memUsedMB > this.config.memoryWarningThreshold) {
        logger.warn(`⚠️ 높은 메모리 사용량: ${memUsedMB}MB`);
      } else {
        logger.debug(`💾 메모리 사용량: ${memUsedMB}MB`);
      }

      // 환경 정보 확인 (한 번만)
      logger.debug(`💻 플랫폼: ${process.platform}`);
      logger.debug(`⚡ Node.js: ${process.version}`);
      logger.debug(`🎯 봇 버전: ${this.config.version}`);

      // 시스템 체크 횟수 증가
      this.systemStats.systemChecks++;
    } catch (error) {
      logger.error("❌ 시스템 체크 실패:", error);
    }
  }

  /**
   * 🎯 액션 등록 (표준 setupActions 패턴)
   */
  setupActions() {
    this.registerActions({
      // 메인 액션들 (NavigationHandler가 호출)
      menu: this.showMainMenu.bind(this),
      help: this.showHelp.bind(this),
      status: this.showStatus.bind(this),
      settings: this.showSettings.bind(this),

      // 상세 기능들
      about: this.showAbout.bind(this),
      version: this.showVersion.bind(this),
      uptime: this.showUptime.bind(this),
      modules: this.showModules.bind(this),

      // 설정 관련
      "settings:reset": this.resetSettings.bind(this),
      "settings:export": this.exportSettings.bind(this),
      "settings:import": this.importSettings.bind(this),
    });
  }

  // ===== 📋 메인 액션 메서드들 (표준 매개변수 준수) =====

  /**
   * 🏠 메인 메뉴 표시
   * @param {Object} bot - 텔레그램 봇 인스턴스
   * @param {Object} callbackQuery - 콜백 쿼리 객체
   * @param {Object} params - 추가 매개변수
   * @param {Object} moduleManager - 모듈 매니저 인스턴스
   */
  async showMainMenu(bot, callbackQuery, params, moduleManager) {
    try {
      const { from } = callbackQuery;
      const userName = getUserName(from);

      // 📊 시스템 상태 조회
      const statusData = await this.getSystemStatusData(moduleManager);

      // 🎨 메인 메뉴 텍스트 구성
      const menuText = this.buildMainMenuText(userName, statusData);

      // ⌨️ 인라인 키보드 구성
      const keyboard = {
        inline_keyboard: [
          [
            { text: "📝 할일 관리", callback_data: "todo:menu" },
            { text: "⏰ 타이머", callback_data: "timer:menu" },
          ],
          [
            { text: "🕐 근무시간", callback_data: "worktime:menu" },
            { text: "🏖️ 휴가 관리", callback_data: "vacation:menu" },
          ],
          [
            { text: "📊 시스템 상태", callback_data: "system:status" },
            { text: "⚙️ 설정", callback_data: "system:settings" },
          ],
          [
            { text: "❓ 도움말", callback_data: "system:help" },
            { text: "ℹ️ 정보", callback_data: "system:about" },
          ],
        ],
      };

      // 메시지 편집
      await this.editMessage(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        menuText,
        { reply_markup: keyboard }
      );

      // 📊 통계 업데이트
      this.systemStats.totalCallbacks++;
      this.systemStats.lastActivity = TimeHelper.getCurrentTime("log");

      return { success: true };
    } catch (error) {
      logger.error("❌ SystemModule 메인 메뉴 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "메인 메뉴를 불러오는 중 오류가 발생했습니다."
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    try {
      const helpText = this.buildHelpText();

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📝 할일", callback_data: "todo:help" },
            { text: "⏰ 타이머", callback_data: "timer:help" },
          ],
          [
            { text: "📊 상태", callback_data: "system:status" },
            { text: "🏠 메인", callback_data: "system:menu" },
          ],
        ],
      };

      await this.editMessage(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        helpText,
        { reply_markup: keyboard }
      );

      return { success: true };
    } catch (error) {
      logger.error("❌ SystemModule 도움말 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "도움말을 불러오는 중 오류가 발생했습니다."
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * 📊 시스템 상태 표시
   */
  async showStatus(bot, callbackQuery, params, moduleManager) {
    try {
      const statusData = await this.getSystemStatusData(moduleManager);
      const statusText = this.buildStatusText(statusData);

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:status" },
            { text: "📈 상세 정보", callback_data: "system:uptime" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.editMessage(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        statusText,
        { reply_markup: keyboard }
      );

      return { success: true };
    } catch (error) {
      logger.error("❌ SystemModule 상태 표시 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "상태를 불러오는 중 오류가 발생했습니다."
      );
      return { success: false, error: error.message };
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 📊 시스템 상태 데이터 조회
   */
  async getSystemStatusData(moduleManager) {
    try {
      const uptime = this.getUptime();
      const memoryUsage = process.memoryUsage();

      let activeModuleCount = 0;
      if (moduleManager && moduleManager.moduleInstances) {
        activeModuleCount = moduleManager.moduleInstances.size;
      }

      return {
        uptime,
        memoryUsage,
        activeModuleCount,
        systemStats: this.systemStats,
      };
    } catch (error) {
      logger.error("❌ 시스템 상태 데이터 조회 실패:", error);
      return {
        uptime: "알 수 없음",
        memoryUsage: { heapUsed: 0 },
        activeModuleCount: 0,
        systemStats: this.systemStats,
      };
    }
  }

  /**
   * ⏰ 업타임 계산
   */
  getUptime() {
    try {
      const uptimeMs = Date.now() - this.systemStats.startTime;
      const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
      const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

      return `${hours}시간 ${minutes}분`;
    } catch (error) {
      logger.error("❌ 업타임 계산 실패:", error);
      return "알 수 없음";
    }
  }

  /**
   * 🎨 메인 메뉴 텍스트 생성
   */
  buildMainMenuText(userName, statusData) {
    const { uptime, activeModuleCount } = statusData;

    return `🏠 **두목봇 메인 메뉴**

안녕하세요, ${userName}님! 👋

📊 **시스템 정보**
• 버전: ${this.config.version}
• 환경: ${this.config.environment}
• 업타임: ${uptime}
• 활성 모듈: ${activeModuleCount}개

원하는 기능을 선택해주세요!`;
  }

  /**
   * ❓ 도움말 텍스트 생성
   */
  buildHelpText() {
    return `❓ **도움말**

🔹 **기본 명령어:**
• \`/start\` - 봇 시작
• \`/menu\` - 메인 메뉴
• \`/help\` - 도움말
• \`/status\` - 시스템 상태
• \`/cancel\` - 작업 취소

🔹 **주요 기능:**
• 📝 **할일 관리** - 업무 목록 관리
• ⏰ **타이머** - 집중 시간 측정
• 🕐 **근무시간** - 출퇴근 기록
• 🏖️ **휴가 관리** - 연차/월차 관리

🔹 **사용 팁:**
• 메뉴 버튼을 통해 편리하게 이용하세요
• 작업 중 \`/cancel\`로 언제든 취소 가능
• 문제 발생 시 \`/start\`로 초기화

더 자세한 정보는 각 기능의 도움말을 확인하세요!`;
  }

  /**
   * 📊 상태 텍스트 생성
   */
  buildStatusText(statusData) {
    const { uptime, memoryUsage, activeModuleCount } = statusData;

    return `📊 **시스템 상태**

🔹 **기본 정보**
• 버전: ${this.config.version}
• 환경: ${this.config.environment}
• 업타임: ${uptime}

🔹 **성능 지표**
• 메모리 사용량: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB
• 처리한 콜백: ${this.systemStats.totalCallbacks}개
• 처리한 메시지: ${this.systemStats.totalMessages}개
• 에러 발생: ${this.systemStats.totalErrors}개

🔹 **Railway 정보**
• Railway 환경: ${this.config.isRailway ? "✅" : "❌"}
• 활성 모듈: ${activeModuleCount}개
• 마지막 활동: ${this.systemStats.lastActivity || "없음"}

시스템이 정상적으로 작동 중입니다! 🟢`;
  }

  // ===== 🎯 미구현 액션 메서드들 (기본 구현) =====

  async showSettings(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "설정 관리");
  }

  async showAbout(bot, callbackQuery, params, moduleManager) {
    try {
      const aboutText = `ℹ️ **${this.config.botName} 정보**

📱 **버전**: ${this.config.version}
🏗️ **아키텍처**: 모듈화 설계
🚀 **플랫폼**: Railway
⚡ **런타임**: Node.js

🔹 **특징**:
• 모듈화된 구조로 확장 가능
• Railway 환경 최적화
• 실시간 상태 모니터링
• 표준화된 매개변수 체계

🔹 **지원 기능**:
• 할일 관리, 타이머, 근무시간 추적
• 휴가 관리, 리마인더, 날씨 정보
• 음성 변환(TTS), 운세

개발자: 두몫 👨‍💻`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📱 버전", callback_data: "system:version" },
            { text: "⏰ 업타임", callback_data: "system:uptime" },
          ],
          [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await this.editMessage(
        bot,
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        aboutText,
        { reply_markup: keyboard }
      );

      return { success: true };
    } catch (error) {
      logger.error("❌ SystemModule 정보 표시 실패:", error);
      await this.sendError(
        bot,
        callbackQuery,
        "정보를 불러오는 중 오류가 발생했습니다."
      );
      return { success: false, error: error.message };
    }
  }

  async showVersion(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "버전 정보");
  }

  async showUptime(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "업타임 상세");
  }

  async showModules(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "모듈 관리");
  }

  async resetSettings(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "설정 초기화");
  }

  async exportSettings(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "설정 내보내기");
  }

  async importSettings(bot, callbackQuery, params, moduleManager) {
    await this.sendNotImplemented(bot, callbackQuery, "설정 가져오기");
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * 🚧 미구현 기능 알림
   */
  async sendNotImplemented(bot, callbackQuery, featureName) {
    const text = `🚧 **기능 개발 중**

"${featureName}" 기능은 현재 개발 중입니다.
곧 사용하실 수 있도록 준비하고 있어요! 

다른 기능을 이용해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "🔙 메인 메뉴", callback_data: "system:menu" }],
      ],
    };

    await this.editMessage(
      bot,
      callbackQuery.message.chat.id,
      callbackQuery.message.message_id,
      text,
      { reply_markup: keyboard }
    );
  }

  /**
   * 📨 메시지 처리 (표준 onHandleMessage 패턴)
   */
  async onHandleMessage(bot, msg) {
    try {
      const {
        text,
        chat: { id: chatId },
        from: { id: userId },
      } = msg;

      if (!text) return false;

      // 시스템 명령어 처리
      const lowerText = text.toLowerCase().trim();

      if (lowerText === "/start" || lowerText === "/menu") {
        await this.sendMainMenu(bot, chatId);
        return true;
      }

      if (lowerText === "/help") {
        await this.sendHelp(bot, chatId);
        return true;
      }

      if (lowerText === "/status") {
        await this.sendStatus(bot, chatId);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("❌ SystemModule 메시지 처리 실패:", error);
      return false;
    }
  }

  /**
   * 🏠 메인 메뉴 전송 (명령어용)
   */
  async sendMainMenu(bot, chatId) {
    try {
      const menuText = `🏠 **두목봇 메인 메뉴**

환영합니다! 👋

📊 **시스템 정보**
• 버전: ${this.config.version}
• 환경: ${this.config.environment}

원하는 기능을 선택해주세요!`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📝 할일 관리", callback_data: "todo:menu" },
            { text: "⏰ 타이머", callback_data: "timer:menu" },
          ],
          [
            { text: "📊 시스템 상태", callback_data: "system:status" },
            { text: "❓ 도움말", callback_data: "system:help" },
          ],
        ],
      };

      await bot.sendMessage(chatId, menuText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      // 📊 통계 업데이트
      this.systemStats.totalMessages++;
      this.systemStats.lastActivity = TimeHelper.getCurrentTime("log");
    } catch (error) {
      logger.error("❌ SystemModule 메인 메뉴 전송 실패:", error);
    }
  }

  /**
   * ❓ 도움말 전송 (명령어용)
   */
  async sendHelp(bot, chatId) {
    try {
      const helpText = this.buildHelpText();

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await bot.sendMessage(chatId, helpText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      this.systemStats.totalMessages++;
    } catch (error) {
      logger.error("❌ SystemModule 도움말 전송 실패:", error);
    }
  }

  /**
   * 📊 상태 전송 (명령어용)
   */
  async sendStatus(bot, chatId) {
    try {
      const statusData = await this.getSystemStatusData(this.moduleManager);
      const statusText = this.buildStatusText(statusData);

      const keyboard = {
        inline_keyboard: [
          [{ text: "🏠 메인 메뉴", callback_data: "system:menu" }],
        ],
      };

      await bot.sendMessage(chatId, statusText, {
        reply_markup: keyboard,
        parse_mode: "Markdown",
      });

      this.systemStats.totalMessages++;
    } catch (error) {
      logger.error("❌ SystemModule 상태 전송 실패:", error);
    }
  }

  /**
   * 모듈 상태 조회 (BaseModule 오버라이드)
   */
  getStatus() {
    return {
      ...super.getStatus(),
      systemInfo: {
        version: this.config.version,
        environment: this.config.environment,
        isRailway: this.config.isRailway,
        uptime: this.getUptime(),
      },
      systemStats: this.systemStats,
      initializationFlags: {
        systemCheckCompleted: this.systemCheckCompleted,
        railwayCheckCompleted: this.railwayCheckCompleted,
        initializationInProgress: this.initializationInProgress,
      },
    };
  }

  /**
   * 정리 작업 (BaseModule 오버라이드)
   */
  async onCleanup() {
    try {
      logger.info("🧹 SystemModule 정리 시작...");

      // 시스템 통계 정리
      this.systemStats = {
        startTime: Date.now(),
        totalCallbacks: 0,
        totalMessages: 0,
        totalErrors: 0,
        lastActivity: null,
        systemChecks: 0,
      };

      // 플래그 초기화
      this.systemCheckCompleted = false;
      this.railwayCheckCompleted = false;
      this.initializationInProgress = false;

      logger.info("✅ SystemModule 정리 완료");
    } catch (error) {
      logger.error("❌ SystemModule 정리 실패:", error);
    }
  }
}

module.exports = SystemModule;
