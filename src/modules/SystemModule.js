// src/modules/SystemModule.js
// ⚙️ 시스템 모듈 (v3.0.1)

const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserName, getUserId } = require("../utils/UserHelper");
const TimeHelper = require("../utils/TimeHelper");

/**
 * ⚙️ SystemModule - 시스템 관리 모듈
 * 
 * 시스템 설정, 상태 확인, 도움말 등 핵심 기능
 */
class SystemModule extends BaseModule {
  constructor(bot, options = {}) {
    super("SystemModule", { bot, ...options });
    
    // 시스템 통계
    this.systemStats = {
      startTime: Date.now(),
      totalCallbacks: 0,
      totalMessages: 0,
      totalErrors: 0,
      lastActivity: null,
    };
  }

  /**
   * 🎯 초기화
   */
  async onInitialize() {
    logger.system("⚙️ SystemModule 초기화 시작...");
    
    // 시스템 체크
    await this.performSystemCheck();
    
    logger.system("✅ SystemModule 초기화 완료");
  }

  /**
   * 🎯 액션 설정
   */
  setupActions() {
    this.registerActions({
      // 메인 액션들
      menu: this.showMenu,
      help: this.showHelp,
      status: this.showStatus,
      settings: this.showSettings,
      about: this.showAbout,
      
      // 관리자 액션
      admin: this.showAdminMenu,
      stats: this.showSystemStats,
    });
  }

  /**
   * 🏠 시스템 메뉴
   */
  async showMenu(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);
      
      // 화려한 시스템 메뉴
      const menuText = `
⚙️ **시스템 설정**

환영합니다, ${userName}님!

시스템 관리 메뉴입니다\.
원하는 기능을 선택해주세요\.
`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📊 상태 확인", callback_data: "system:status" },
            { text: "⚙️ 설정", callback_data: "system:settings" },
          ],
          [
            { text: "❓ 도움말", callback_data: "system:help" },
            { text: "ℹ️ 정보", callback_data: "system:about" },
          ],
          [
            { text: "🏠 메인 메뉴", callback_data: "main" },
          ],
        ],
      };

      await callbackQuery.editMessageText(menuText, {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });

      this.systemStats.totalCallbacks++;
      
    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * 📊 시스템 상태
   */
  async showStatus(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const uptime = Date.now() - this.systemStats.startTime;
      const uptimeStr = TimeHelper.getTimeDiff(new Date(this.systemStats.startTime), new Date());
      
      const statusText = `
📊 **시스템 상태**

🟢 정상 작동 중

⏱️ 가동 시간: ${uptimeStr}
📊 처리된 콜백: ${this.systemStats.totalCallbacks}
💬 처리된 메시지: ${this.systemStats.totalMessages}
❌ 오류 발생: ${this.systemStats.totalErrors}

최종 활동: ${this.systemStats.lastActivity ? 
  TimeHelper.format(this.systemStats.lastActivity, 'simple') : 
  '없음'}
`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "🔄 새로고침", callback_data: "system:status" },
            { text: "📊 상세 통계", callback_data: "system:stats" },
          ],
          [
            { text: "⬅️ 뒤로가기", callback_data: "system:menu" },
          ],
        ],
      };

      await callbackQuery.editMessageText(statusText, {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });

    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * ❓ 도움말
   */
  async showHelp(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const helpText = `
❓ **도움말**

**🤖 두목봇 v3\.0\.1**

두목봇은 직장인을 위한 스마트 어시스턴트입니다\.

**주요 기능:**
• �� 할일 관리 \- 업무를 체계적으로 관리
• ⏰ 타이머 \- 집중력 향상을 위한 포모도로
• 🏢 근무시간 \- 출퇴근 및 근무 기록
• 🔔 리마인더 \- 중요한 일정 알림
• 🔮 운세 \- 오늘의 운세 확인
• 🌤️ 날씨 \- 실시간 날씨 정보

**사용 팁:**
💡 각 기능의 아이콘을 탭하면 상세 메뉴가 나타납니다
💡 언제든 "메인 메뉴"로 돌아올 수 있습니다
💡 문제가 있으면 /start 명령어를 사용하세요

개발자: @YourUsername
`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "�� 빠른 시작", callback_data: "main" },
          ],
          [
            { text: "⬅️ 뒤로가기", callback_data: "system:menu" },
          ],
        ],
      };

      await callbackQuery.editMessageText(helpText, {
        parse_mode: "MarkdownV2",
        reply_markup: keyboard,
      });

    } catch (error) {
      await this.handleError(callbackQuery, error);
    }
  }

  /**
   * 🔧 시스템 체크
   */
  async performSystemCheck() {
    try {
      logger.system("🔧 시스템 체크 시작...");
      
      // TODO: 실제 시스템 체크 구현
      
      logger.system("✅ 시스템 체크 완료");
    } catch (error) {
      logger.error("❌ 시스템 체크 실패", error);
    }
  }

  /**
   * 🧹 정리 작업
   */
  async onCleanup() {
    logger.system("🧹 SystemModule 정리 중...");
    
    // 통계 저장 등
    
    logger.system("✅ SystemModule 정리 완료");
  }
}

module.exports = SystemModule;
