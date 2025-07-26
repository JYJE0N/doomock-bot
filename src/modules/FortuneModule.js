// src/modules/FortuneModule.js - 표준화된 운세 모듈

const BaseModule = require("../core/BaseModule");
const { getUserName } = require("../utils/UserHelper");
const FortuneService = require("../services/FortuneService");
const logger = require("../utils/Logger");

class FortuneModule extends BaseModule {
  constructor(bot, options = {}) {
    super("FortuneModule", {
      bot,
      serviceBuilder: options.serviceBuilder,
      moduleManager: options.moduleManager,
      moduleKey: options.moduleKey,
      moduleConfig: options.moduleConfig,
      config: options.config,
    });

    // ✅ 4단계: 모듈별 설정 (기존 유지 + 병합)
    this.config = {
      enableDetailedReading: process.env.FORTUNE_DETAILED === "true",
      maxReadingsPerDay: parseInt(process.env.FORTUNE_MAX_PER_DAY) || 3,
      enableTarot: process.env.FORTUNE_TAROT_ENABLED !== "false",
      enableZodiac: process.env.FORTUNE_ZODIAC_ENABLED !== "false",
      ...this.config, // 👈 BaseModule config 병합
    };

    // 🔮 운세 관련 데이터
    this.fortuneTypes = {
      general: "오늘의 운세",
      work: "연애운",
      love: "금전운",
      neutral: "직장운",
      money: "건강운",
      health: "타로 카드",
      meeting: "별자리운",
    };

    this.tarotTypes = {
      oneTarot: "한 장 타로",
      threeTarot: "세 장 타로",
    };

    logger.info("🔮 FortuneModule v3.0.1 생성됨 (표준화 적용)");
  }

  // ✅ 표준 액션 등록
  setupActions() {
    this.registerActions({
      // 📋 메인 액션들
      menu: this.handleMenuAction.bind(this),
      help: this.handleHelpAction.bind(this),

      // 🔮 운세 관련 액션들
      general: this.handleGeneralFortuneAction.bind(this),
      work: this.handleWorkFortuneAction.bind(this),
      love: this.handleLoveFortuneAction.bind(this),
      neutral: this.handleNeutralFortuneAction.bind(this),
      money: this.handleMoneyFortuneAction.bind(this),
      health: this.handleHealthFortuneAction.bind(this),
      meeting: this.handleMeetingFortuneAction.bind(this),

      // 🎴 타로 카드
      oneTarot: this.handleOneTarotAction.bind(this),
      threeTarot: this.handleThreeTarotAction.bind(this),

      // ⚙️ 설정
      settings: this.handleSettingsAction.bind(this),
    });

    logger.debug("🔮 FortuneModule 액션 등록 완료");
  }

  // ✅ 모듈 초기화
  async onInitialize() {
    try {
      logger.info("🔮 FortuneModule 초기화 시작...");

      // 🔧 ServiceBuilder를 통한 서비스 요청 (있으면)
      // this.fortuneService = await this.getService("fortune");

      // 기본 운세 데이터 초기화
      await this.initializeFortuneData();

      logger.success("✅ FortuneModule 초기화 완료");
    } catch (error) {
      logger.error("❌ FortuneModule 초기화 실패:", error);
      throw error;
    }
  }

  // ==================== 액션 핸들러 ====================

  /**
   * 운세 메뉴 표시
   */
  async handleMenuAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      const userName = getUserName(callbackQuery);

      // ❌ 삭제: 키보드 생성 코드
      // const keyboard = { inline_keyboard: [...] };

      // ✅ 추가: 데이터 반환
      return {
        success: true,
        action: "show_fortune_menu",
        data: {
          type: "fortune_menu",
          userName,
          availableTypes: Object.values(this.fortuneTypes),
          userSettings: await this.getUserFortuneSettings(
            callbackQuery.from.id
          ),
          todayReadings: await this.getTodayReadingsCount(
            callbackQuery.from.id
          ),
        },
      };
    } catch (error) {
      logger.error("❌ FortuneModule 메뉴 액션 실패:", error);
      return { success: false, error: error.message, action: "show_error" };
    }
  }

  /**
   * ❓ 도움말 액션 - ✅ 표준 매개변수 + 데이터 반환
   */
  async handleHelpAction(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      // ❌ 삭제: 키보드 생성 및 직접 메시지 전송

      // ✅ 추가: 데이터 반환
      return {
        success: true,
        action: "show_fortune_help",
        data: {
          type: "fortune_help",
          content: {
            description: "🔮 다양한 운세를 확인해보세요!",
            features: [
              "📅 오늘의 운세 - 전반적인 하루 운세",
              "💕 연애운 - 사랑과 관련된 운세",
              "💰 금전운 - 재물과 관련된 운세",
              "💼 직장운 - 업무와 관련된 운세",
              "🏥 건강운 - 몸과 마음의 건강",
              "🎴 한장타로 - 신비로운 타로 점술",
              "⭐ 세장타로 - 과거, 현재, 미래",
            ],
            tips: [
              "타로 카드는 진지한 마음으로 선택하세요",
              "운세는 참고용이며 즐거운 마음으로 봐주세요",
            ],
          },
        },
      };
    } catch (error) {
      logger.error("❌ FortuneModule 도움말 액션 실패:", error);
      return { success: false, error: error.message, action: "show_error" };
    }
  }

  // ==================== 유틸리티 메서드 ====================

  /**
   * 운세 관련 텍스트인지 확인
   */
  isFortuneRelated(text) {
    const fortuneKeywords = [
      "운세",
      "타로",
      "점",
      "오늘운세",
      "내운세",
      "종합운",
      "업무운",
      "연애운",
      "재물운",
      "건강운",
      "회식운",
      "행운",
      "카드",
      "점술",
      "운명",
    ];

    return fortuneKeywords.some((keyword) =>
      text.toLowerCase().includes(keyword)
    );
  }

  /**
   * 운세 명령어 처리 (레거시 지원)
   */
  async handleFortuneCommand(bot, msg, text) {
    const {
      chat: { id: chatId },
    } = msg;
    const userName = getUserName(msg.from);

    try {
      // 간단한 텍스트 매칭
      if (text.includes("종합운") || text.includes("전체")) {
        const fortune = this.fortuneService.getGeneralFortune();
        await bot.sendMessage(
          chatId,
          `🌟 **${userName}님의 오늘 종합운세**\n\n${fortune}`,
          {
            parse_mode: "Markdown",
          }
        );
      } else if (text.includes("업무운") || text.includes("직장")) {
        const fortune = this.fortuneService.getWorkFortune();
        await bot.sendMessage(
          chatId,
          `💼 **${userName}님의 오늘 업무운**\n\n${fortune}`,
          {
            parse_mode: "Markdown",
          }
        );
      } else if (text.includes("타로")) {
        const tarot = this.fortuneService.getTarotCard();
        await bot.sendMessage(
          chatId,
          `🃏 **${userName}님의 타로카드**\n\n${tarot}`,
          {
            parse_mode: "Markdown",
          }
        );
      } else {
        // 기본 운세 메뉴 표시
        await this.showFortuneMenu(bot, {
          message: { chat: { id: chatId } },
          from: msg.from,
        });
      }
    } catch (error) {
      logger.error("운세 명령어 처리 오류:", error);
      await bot.sendMessage(
        chatId,
        "❌ 운세를 가져오는 중 오류가 발생했습니다."
      );
    }
  }
}

module.exports = FortuneModule;
