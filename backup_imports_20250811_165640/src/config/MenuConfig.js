// src/config/MenuConfig.js - 근본 해결: 중복 제거 및 통합

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
// ✅ 통합 레지스트리 사용
const { getEnabledModules, getModuleStats } = require("./ModuleRegistry");

/**
 * 🎨 MenuConfig v4.0.0 - 통합 버전
 *
 * ✅ 근본 변경사항:
 * - MODULE_REGISTRY 중복 제거
 * - ModuleRegistry.js를 단일 진실의 원천으로 사용
 * - UI 테마와 스타일링만 담당
 * - 알록달록 기능은 유지하되 데이터는 통합 레지스트리에서
 */

/**
 * 🎨 UI 테마 및 스타일 설정 (데이터와 분리)
 */
const UI_THEMES = {
  main: {
    title: "🤖 두목봇 v4.0.0",
    subtitle: "🎯 통합 관리 시스템",
    colors: ["🔵", "🟢", "🟡", "🟠", "🔴", "🟣"],
    buttonStyle: "primary"
  },

  module: {
    titlePrefix: "📱",
    backButton: "🔙 메뉴",
    colors: ["🎯", "⚡", "🔧", "🎪"]
  },

  error: {
    title: "🚨 시스템 오류",
    color: "🔴",
    actions: ["🔄 재시도", "🏠 메인 메뉴"]
  },

  success: {
    title: "✅ 작업 완료",
    color: "🟢",
    celebration: ["🎉", "🎊", "✨", "🌟"]
  }
};

/**
 * 🌈 시간대별 인사말 및 테마
 */
const TIME_BASED_THEMES = {
  morning: {
    greeting: "좋은 아침입니다",
    emoji: "🌅",
    theme: "bright"
  },
  afternoon: {
    greeting: "안녕하세요",
    emoji: "☀️",
    theme: "warm"
  },
  evening: {
    greeting: "좋은 저녁입니다",
    emoji: "🌆",
    theme: "cool"
  },
  night: {
    greeting: "늦은 시간입니다",
    emoji: "🌙",
    theme: "dark"
  }
};

/**
 * 🎨 MenuBuilder v4.0.0 - 통합 레지스트리 기반
 * 더이상 자체 데이터를 갖지 않고, ModuleRegistry에서 가져옴
 */
class MenuBuilder {
  constructor() {
    this.stats = {
      menusGenerated: 0,
      keyboardsCreated: 0,
      lastGenerated: null,
      rainbowMenus: 0
    };

    logger.debug("🎨 MenuBuilder v4.0.0 생성됨 (통합 레지스트리 기반)");
  }

  /**
   * 🏠 메인 메뉴 텍스트 생성 (통합 데이터 사용)
   */
  buildMainMenuText(userName = "사용자", additionalInfo = {}) {
    const currentTime = TimeHelper.format(new Date(), "time");
    const timeTheme = this.getTimeBasedTheme();

    // ✅ 통합 레지스트리에서 실제 데이터 가져오기
    const enabledModules = getEnabledModules();
    const stats = getModuleStats();

    let menuText = `${UI_THEMES.main.title}\n${UI_THEMES.main.subtitle}\n\n`;
    menuText += `${timeTheme.emoji} ${timeTheme.greeting}, *${userName}*님!\n\n`;
    menuText += `⏰ *현재 시간:* ${currentTime}\n`;
    menuText += `📦 *활성 모듈:* ${stats.visible}/${stats.total}개\n`;
    menuText += `🎨 *Enhanced:* ${stats.enhanced}개\n\n`;

    if (enabledModules.length > 0) {
      menuText += `**🎯 사용 가능한 기능**\n`;
      enabledModules.forEach((module) => {
        const enhancedMark = module.enhanced ? " ⭐" : "";
        menuText += `${module.icon} ${module.displayName}${enhancedMark}\n`;
      });
    } else {
      menuText += `⚠️ 사용 가능한 모듈이 없습니다.\n`;
    }

    menuText += `\n💡 _원하는 기능을 선택해주세요!_`;

    this.stats.menusGenerated++;
    this.stats.lastGenerated = TimeHelper.getLogTimeString();

    return menuText;
  }

  /**
   * 🎨 모듈별 메뉴 텍스트 생성
   */
  buildModuleMenuText(moduleKey, additionalInfo = {}) {
    // ✅ 통합 레지스트리에서 모듈 정보 가져오기
    const { findModuleByKey } = require("./ModuleRegistry");
    const moduleInfo = findModuleByKey(moduleKey);

    if (!moduleInfo) {
      return `❌ 모듈 정보를 찾을 수 없습니다: ${moduleKey}`;
    }

    let text = `📱 *${moduleInfo.displayName}*\n`;
    text += `${moduleInfo.description}\n\n`;

    // Enhanced 모듈 표시
    if (moduleInfo.enhanced) {
      text += `⭐ *Enhanced 모듈*\n`;
      text += `🌈 알록달록 기능 지원\n\n`;
    }

    // 추가 정보 표시
    if (additionalInfo.stats) {
      text += `📊 *모듈 통계*\n`;
      Object.entries(additionalInfo.stats).forEach(([key, value]) => {
        text += `• ${key}: ${value}\n`;
      });
      text += `\n`;
    }

    text += `원하는 기능을 선택해주세요.`;

    return text;
  }

  /**
   * ⏰ 시간대별 테마 가져오기
   */
  getTimeBasedTheme() {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) return TIME_BASED_THEMES.morning;
    if (hour >= 12 && hour < 18) return TIME_BASED_THEMES.afternoon;
    if (hour >= 18 && hour < 22) return TIME_BASED_THEMES.evening;
    return TIME_BASED_THEMES.night;
  }

  /**
   * 🎲 랜덤 애니메이션 이모지
   */
  getRandomAnimation(type = "success") {
    const animations = {
      success: ["🎉", "🎊", "✨", "🌟", "💫", "⭐"],
      loading: ["⏳", "⏰", "🔄", "🔃", "⚡", "💨"],
      error: ["❌", "⚠️", "🚨", "💥", "🔴", "❗"]
    };

    const emojis = animations[type] || animations.success;
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  /**
   * 📊 통계 정보 표시
   */
  showRainbowStats() {
    const stats = getModuleStats();

    console.log(`🌈 MenuBuilder v4.0.0 통계:`);
    console.log(`   메뉴 생성: ${this.stats.menusGenerated}회`);
    console.log(`   키보드 생성: ${this.stats.keyboardsCreated}회`);
    console.log(`   레인보우 메뉴: ${this.stats.rainbowMenus}회`);
    console.log(`   마지막 생성: ${this.stats.lastGenerated || "없음"}`);
    console.log(`🎯 모듈 통계:`);
    console.log(`   전체: ${stats.total}개`);
    console.log(`   활성: ${stats.enabled}개`);
    console.log(`   표시: ${stats.visible}개`);
    console.log(`   Enhanced: ${stats.enhanced}개`);
  }

  /**
   * 📊 통계 가져오기
   */
  getStats() {
    return {
      ...this.stats,
      moduleStats: getModuleStats()
    };
  }
}

// 🎯 싱글톤 인스턴스
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
 * 🌈 통계 표시
 */
function showMenuStats() {
  const builder = getMenuBuilder();
  builder.showRainbowStats();
}

// ========================================
// 🚀 모듈 내보내기
// ========================================

module.exports = {
  // 🎨 UI 테마 및 스타일
  UI_THEMES,
  TIME_BASED_THEMES,

  // 🎹 메뉴 빌더
  MenuBuilder,
  getMenuBuilder,
  showMenuStats,

  // 🔧 유틸리티 함수들
  getTimeBasedTheme: () => new MenuBuilder().getTimeBasedTheme(),
  getRandomAnimation: (type) => new MenuBuilder().getRandomAnimation(type),

  // 버전 정보
  version: "4.0.0",
  unified: true,
  legacy: false // 레거시 데이터 제거됨
};

logger.info("🎨 MenuConfig v4.0.0 로드됨 (통합 레지스트리 기반)");
