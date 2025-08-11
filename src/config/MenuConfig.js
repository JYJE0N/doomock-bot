// src/config/MenuConfig.js - 단순화된 메뉴 설정
const logger = require("../utils/core/Logger");
const { getEnabledModules } = require("./ModuleRegistry");

/**
 * 🎨 MenuConfig - 메뉴 생성 및 관리
 * 
 * 핵심 기능:
 * - 메인 메뉴 생성
 * - 모듈별 키보드 생성
 * - 표준 버튼 스타일 제공
 */
class MenuConfig {
  constructor() {
    this.stats = {
      menusGenerated: 0,
      keyboardsCreated: 0,
      lastGenerated: null
    };

    logger.debug("🎨 MenuConfig 초기화 완료");
  }

  /**
   * 메인 메뉴 생성
   */
  createMainMenu() {
    this.stats.menusGenerated++;
    this.stats.lastGenerated = new Date().toISOString();

    const enabledModules = getEnabledModules().filter(module => module.showInMenu);
    
    // 2열 그리드로 배치
    const buttons = [];
    for (let i = 0; i < enabledModules.length; i += 2) {
      const row = [];
      const module1 = enabledModules[i];
      const module2 = enabledModules[i + 1];

      row.push({
        text: `${module1.emoji || '📱'} ${module1.displayName}`,
        callback_data: `${module1.key}:menu`
      });

      if (module2) {
        row.push({
          text: `${module2.emoji || '📱'} ${module2.displayName}`,
          callback_data: `${module2.key}:menu`
        });
      }

      buttons.push(row);
    }

    return {
      text: this.getWelcomeMessage(),
      reply_markup: {
        inline_keyboard: buttons
      }
    };
  }

  /**
   * 환영 메시지 생성
   */
  getWelcomeMessage() {
    const hour = new Date().getHours();
    let greeting = "안녕하세요";
    
    if (hour < 12) greeting = "좋은 아침입니다";
    else if (hour < 18) greeting = "안녕하세요";
    else greeting = "좋은 저녁입니다";

    return `🤖 *두목봇*\n\n${greeting}! 필요한 기능을 선택해주세요.`;
  }

  /**
   * 뒤로가기 키보드 생성
   */
  createBackKeyboard(moduleKey = null) {
    this.stats.keyboardsCreated++;

    const buttons = [];
    
    if (moduleKey) {
      buttons.push([
        { text: "🔙 메뉴", callback_data: `${moduleKey}:menu` }
      ]);
    }
    
    buttons.push([
      { text: "🏠 메인 메뉴", callback_data: "system:menu" }
    ]);

    return {
      inline_keyboard: buttons
    };
  }

  /**
   * 확인/취소 키보드 생성
   */
  createConfirmKeyboard(confirmAction, cancelAction = null) {
    this.stats.keyboardsCreated++;

    const buttons = [
      [
        { text: "✅ 확인", callback_data: confirmAction },
        { text: "❌ 취소", callback_data: cancelAction || "system:menu" }
      ]
    ];

    return {
      inline_keyboard: buttons
    };
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      enabledModules: getEnabledModules().length
    };
  }

  /**
   * 통계 출력 (개발용)
   */
  logStats() {
    const stats = this.getStats();
    logger.info("🎨 MenuConfig 통계", stats);
  }
}

module.exports = new MenuConfig();