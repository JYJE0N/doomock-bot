/**
 * 🔮 FortuneModuleV2 - EventBus 기반 타로카드 운세 모듈
 * 
 * EventBus를 사용한 완전히 분리된 아키텍처로 타로카드 운세 기능을 제공합니다.
 * 
 * 🎯 주요 기능:
 * - 싱글카드, 트리플카드, 캘틱 크로스 뽑기
 * - 질문 기반 타로카드 해석
 * - 사용자 통계 및 이력 관리
 * - 일일 사용 제한
 * - 카드 섞기 애니메이션
 */

const { EVENTS } = require('../events/EventRegistry');
const logger = require('../utils/core/Logger');
const Utils = require('../utils');

class FortuneModuleV2 {
  constructor(moduleName = "fortune", options = {}) {
    this.moduleName = moduleName;
    this.eventBus = options.eventBus || require('../core/EventBus').getInstance();
    this.serviceBuilder = options.serviceBuilder || null;
    
    // Fortune 서비스 (있으면 실제 기능, 없으면 테스트 모드)
    this.fortuneService = null;
    
    // 초기화 상태
    this.isInitialized = false;
    
    // 사용자 상태 관리 (질문 입력 대기 등)
    this.userStates = new Map();
    
    // 캘틱 크로스 결과 임시 저장
    this.lastCelticResults = new Map();
    
    // 모듈 설정
    this.config = {
      maxDrawsPerDay: 3,
      questionTimeout: 300000, // 5분 질문 입력 타임아웃
      fortuneTypes: {
        single: { label: "싱글카드 🃏", emoji: "🃏", cost: 1, description: "하나의 카드로 간단한 운세를 봅니다" },
        triple: { label: "트리플카드 🔮", emoji: "🔮", cost: 1, description: "과거-현재-미래의 흐름을 봅니다" },
        celtic: { label: "캘틱 크로스 ✨", emoji: "✨", cost: 2, special: true, description: "10장 카드로 상세한 해석을 제공합니다" }
      },
      ...options.config
    };
    
    // EventBus 구독 배열 (정리용)
    this.subscriptions = [];
    
    // 상태 정리 타이머
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredStates();
    }, 60000); // 1분마다 정리

    // 더미 타로카드 데이터 (테스트용)
    this.dummyCards = this.generateDummyCards();

    logger.info("🔮 FortuneModuleV2 생성됨 (EventBus 기반)");
  }

  /**
   * 🎯 모듈 초기화
   */
  async initialize() {
    try {
      // ServiceBuilder를 통해 FortuneService 가져오기 (선택적)
      if (this.serviceBuilder) {
        try {
          this.fortuneService = await this.serviceBuilder.getOrCreate("fortune", {
            config: this.config
          });
          logger.info("🔮 FortuneService 연결 완료");
        } catch (serviceError) {
          logger.warn("⚠️ FortuneService 연결 실패 - 테스트 모드로 동작:", serviceError.message);
          this.fortuneService = null;
        }
      }

      // 이벤트 리스너 설정
      this.setupEventListeners();
      
      // 초기화 완료 표시
      this.isInitialized = true;
      
      const mode = this.fortuneService ? "프로덕션" : "테스트";
      logger.success(`🔮 FortuneModuleV2 초기화 완료 (${mode} 모드, EventBus 기반)`);
      return true;
    } catch (error) {
      logger.error("❌ FortuneModuleV2 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎧 EventBus 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 메뉴 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.MENU_REQUEST, async (event) => {
        await this.handleMenuRequest(event);
      })
    );

    // 카드 뽑기 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.SINGLE_CARD_REQUEST, async (event) => {
        await this.handleSingleCardRequest(event);
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.TRIPLE_CARD_REQUEST, async (event) => {
        await this.handleTripleCardRequest(event);
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.CELTIC_CROSS_REQUEST, async (event) => {
        await this.handleCelticCrossRequest(event);
      })
    );

    // 질문 입력 관련
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.QUESTION_REQUEST, async (event) => {
        await this.handleQuestionRequest(event);
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.QUESTION_RECEIVED, async (event) => {
        await this.handleQuestionReceived(event);
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.QUESTION_CANCEL, async (event) => {
        await this.handleQuestionCancel(event);
      })
    );

    // 카드 섞기
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.SHUFFLE_REQUEST, async (event) => {
        await this.handleShuffleRequest(event);
      })
    );

    // 통계 및 이력
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.STATS_REQUEST, async (event) => {
        await this.handleStatsRequest(event);
      })
    );

    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.HISTORY_REQUEST, async (event) => {
        await this.handleHistoryRequest(event);
      })
    );

    // 캘틱 상세보기
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.CELTIC_DETAIL_REQUEST, async (event) => {
        await this.handleCelticDetailRequest(event);
      })
    );

    // 일일 제한 리셋 (개발자용)
    this.subscriptions.push(
      this.eventBus.subscribe(EVENTS.FORTUNE.DAILY_LIMIT_RESET, async (event) => {
        await this.handleDailyLimitReset(event);
      })
    );

    logger.debug("🎧 FortuneModuleV2 EventBus 리스너 설정 완료");
  }

  /**
   * 📝 메뉴 요청 처리
   */
  async handleMenuRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 오늘 뽑기 횟수 조회
      const todayInfo = await this.getTodayDrawInfo(userId);
      const isDeveloper = await this.checkDeveloperStatus(userId);

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.FORTUNE.MENU_READY, {
        userId,
        chatId,
        menuData: {
          todayCount: todayInfo.todayCount,
          remainingDraws: todayInfo.remainingDraws,
          maxDrawsPerDay: this.config.maxDrawsPerDay,
          canDraw: isDeveloper || todayInfo.remainingDraws > 0,
          fortuneTypes: this.config.fortuneTypes,
          isDeveloper
        }
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatMenu(todayInfo, isDeveloper),
          options: {
            reply_markup: this.createMenuKeyboard(todayInfo, isDeveloper),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🔮 메뉴 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🃏 싱글카드 요청 처리
   */
  async handleSingleCardRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 일일 제한 확인
      const limitCheck = await this.checkDailyLimit(userId);
      if (!limitCheck.canDraw) {
        await this.eventBus.publish(EVENTS.FORTUNE.DAILY_LIMIT_EXCEEDED, {
          userId,
          chatId,
          limitData: limitCheck
        });
        return;
      }

      // 싱글카드 뽑기 수행
      const drawResult = await this.performDraw(userId, 'single');

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.FORTUNE.SINGLE_CARD_READY, {
        userId,
        chatId,
        drawData: drawResult
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatDrawResult(drawResult, 'single'),
          options: {
            reply_markup: this.createDrawResultKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🃏 싱글카드 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🔮 트리플카드 요청 처리
   */
  async handleTripleCardRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 일일 제한 확인
      const limitCheck = await this.checkDailyLimit(userId);
      if (!limitCheck.canDraw) {
        await this.eventBus.publish(EVENTS.FORTUNE.DAILY_LIMIT_EXCEEDED, {
          userId,
          chatId,
          limitData: limitCheck
        });
        return;
      }

      // 트리플카드 뽑기 수행
      const drawResult = await this.performDraw(userId, 'triple');

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.FORTUNE.TRIPLE_CARD_READY, {
        userId,
        chatId,
        drawData: drawResult
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatDrawResult(drawResult, 'triple'),
          options: {
            reply_markup: this.createDrawResultKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🔮 트리플카드 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ✨ 캘틱 크로스 요청 처리
   */
  async handleCelticCrossRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 일일 제한 확인 (캘틱 크로스는 2배 소모)
      const limitCheck = await this.checkDailyLimit(userId, 2);
      if (!limitCheck.canDraw) {
        await this.eventBus.publish(EVENTS.FORTUNE.DAILY_LIMIT_EXCEEDED, {
          userId,
          chatId,
          limitData: limitCheck
        });
        return;
      }

      // 질문 입력 요청
      await this.eventBus.publish(EVENTS.FORTUNE.QUESTION_REQUEST, {
        userId,
        chatId,
        fortuneType: 'celtic'
      });

    } catch (error) {
      logger.error('✨ 캘틱 크로스 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 💬 질문 요청 처리 (질문 입력 프롬프트)
   */
  async handleQuestionRequest(event) {
    const { userId, chatId, fortuneType = 'celtic' } = event.payload;

    try {
      // 사용자 질문 입력 상태 설정
      this.setUserQuestionState(userId, {
        state: 'waiting_question',
        fortuneType,
        chatId,
        startTime: Date.now()
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatQuestionPrompt(fortuneType),
          options: {
            reply_markup: this.createQuestionKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('💬 질문 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📨 질문 수신 처리
   */
  async handleQuestionReceived(event) {
    const { userId, chatId, question } = event.payload;

    try {
      // 질문 입력 상태 확인
      const questionState = this.getUserQuestionState(userId);
      if (!questionState || questionState.state !== 'waiting_question') {
        return; // 질문 대기 상태가 아니면 무시
      }

      // 질문 유효성 검증
      if (!this.isValidQuestion(question)) {
        await this.eventBus.publish(EVENTS.FORTUNE.QUESTION_INVALID, {
          userId,
          chatId,
          question,
          reason: "유효하지 않은 질문입니다."
        });
        return;
      }

      // 질문 상태 정리
      this.clearUserQuestionState(userId);

      // 캘틱 크로스 뽑기 수행
      const drawResult = await this.performDraw(userId, questionState.fortuneType, question);

      // 결과를 임시 저장 (상세보기용)
      if (questionState.fortuneType === 'celtic') {
        this.lastCelticResults.set(userId, {
          ...drawResult,
          timestamp: Date.now()
        });
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.FORTUNE.CELTIC_CROSS_READY, {
        userId,
        chatId,
        drawData: drawResult,
        question
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatDrawResult(drawResult, 'celtic'),
          options: {
            reply_markup: this.createCelticResultKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('📨 질문 수신 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * ❌ 질문 취소 처리
   */
  async handleQuestionCancel(event) {
    const { userId, chatId } = event.payload;

    try {
      // 질문 상태 정리
      this.clearUserQuestionState(userId);

      // 메뉴로 돌아가기
      await this.eventBus.publish(EVENTS.FORTUNE.MENU_REQUEST, {
        userId,
        chatId
      });

    } catch (error) {
      logger.error('❌ 질문 취소 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🃏 카드 섞기 요청 처리
   */
  async handleShuffleRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 카드 섞기 수행 (Service가 있으면 실제 처리, 없으면 더미)
      let shuffleResult;
      
      if (this.fortuneService) {
        shuffleResult = await this.fortuneService.shuffleDeck(userId);
      } else {
        // 테스트 모드: 더미 섞기 결과
        shuffleResult = {
          success: true,
          message: "카드가 새롭게 섞였습니다! ✨"
        };
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.FORTUNE.SHUFFLE_READY, {
        userId,
        chatId,
        shuffleData: shuffleResult
      });

      // 애니메이션 및 렌더링 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        // 섞기 애니메이션 표시
        await this.performShuffleAnimation(chatId);
        
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatShuffleResult(shuffleResult),
          options: {
            reply_markup: this.createBackToMenuKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🃏 카드 섞기 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📊 통계 요청 처리
   */
  async handleStatsRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 사용자 통계 조회
      let statsData;
      
      if (this.fortuneService) {
        const statsResult = await this.fortuneService.getUserStats(userId);
        statsData = statsResult.data || this.getDefaultStats();
      } else {
        // 테스트 모드: 더미 통계
        statsData = this.getDefaultStats();
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.FORTUNE.STATS_READY, {
        userId,
        chatId,
        statsData
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatStats(statsData),
          options: {
            reply_markup: this.createBackToMenuKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('📊 통계 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 📋 이력 요청 처리
   */
  async handleHistoryRequest(event) {
    const { userId, chatId, limit = 5 } = event.payload;

    try {
      // 사용자 이력 조회
      let historyData;
      
      if (this.fortuneService) {
        const historyResult = await this.fortuneService.getDrawHistory(userId, limit);
        historyData = historyResult.data || { records: [], total: 0 };
      } else {
        // 테스트 모드: 더미 이력
        historyData = { records: [], total: 0, isEmpty: true };
      }

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.FORTUNE.HISTORY_READY, {
        userId,
        chatId,
        historyData: {
          ...historyData,
          isEmpty: historyData.records.length === 0
        }
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatHistory(historyData),
          options: {
            reply_markup: this.createBackToMenuKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('📋 이력 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🔍 캘틱 상세보기 요청 처리
   */
  async handleCelticDetailRequest(event) {
    const { userId, chatId } = event.payload;

    try {
      // 저장된 캘틱 결과 조회
      const cachedResult = this.lastCelticResults.get(userId);
      
      if (!cachedResult || !cachedResult.cards) {
        await this.eventBus.publish(EVENTS.FORTUNE.ERROR, {
          userId,
          chatId,
          error: "최근 캘틱 크로스 결과가 없습니다."
        });
        return;
      }

      // 상세 해석 생성
      const detailedInterpretation = this.generateDetailedCelticInterpretation(cachedResult);

      // 성공 이벤트 발행
      await this.eventBus.publish(EVENTS.FORTUNE.CELTIC_DETAIL_READY, {
        userId,
        chatId,
        detailData: {
          ...cachedResult,
          detailedInterpretation
        }
      });

      // 렌더링 요청 (테스트에서는 스킵)
      if (process.env.NODE_ENV !== 'test') {
        await this.eventBus.publish(EVENTS.RENDER.MESSAGE_REQUEST, {
          chatId,
          text: this.formatCelticDetail(cachedResult, detailedInterpretation),
          options: {
            reply_markup: this.createBackToMenuKeyboard(),
            parse_mode: 'Markdown'
          }
        });
      }

    } catch (error) {
      logger.error('🔍 캘틱 상세보기 요청 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🔄 일일 제한 리셋 처리 (개발자용)
   */
  async handleDailyLimitReset(event) {
    const { userId, chatId } = event.payload;

    try {
      const isDeveloper = await this.checkDeveloperStatus(userId);
      
      if (!isDeveloper) {
        await this.eventBus.publish(EVENTS.FORTUNE.ERROR, {
          userId,
          chatId,
          error: "개발자만 사용 가능한 기능입니다."
        });
        return;
      }

      // 일일 제한 리셋 (Service가 있으면 실제 처리)
      if (this.fortuneService) {
        // 실제 DB에서 오늘 기록 삭제
        await this.fortuneService.resetDailyLimit(userId);
      }

      // 메뉴로 돌아가기
      await this.eventBus.publish(EVENTS.FORTUNE.MENU_REQUEST, {
        userId,
        chatId
      });

    } catch (error) {
      logger.error('🔄 일일 제한 리셋 처리 실패:', error);
      await this.publishError(error, event);
    }
  }

  /**
   * 🔧 유틸리티 메서드들
   */

  // 오늘 뽑기 정보 조회
  async getTodayDrawInfo(userId) {
    if (!this.fortuneService) {
      return { 
        todayCount: 0, 
        remainingDraws: this.config.maxDrawsPerDay 
      };
    }

    try {
      const limitCheck = await this.fortuneService.checkDailyLimit(userId, this.config.maxDrawsPerDay);
      return {
        todayCount: limitCheck.todayCount || 0,
        remainingDraws: limitCheck.remainingDraws || this.config.maxDrawsPerDay
      };
    } catch (error) {
      logger.warn("오늘 뽑기 정보 조회 실패:", error.message);
      return { 
        todayCount: 0, 
        remainingDraws: this.config.maxDrawsPerDay 
      };
    }
  }

  // 일일 제한 확인
  async checkDailyLimit(userId, cost = 1) {
    const isDeveloper = await this.checkDeveloperStatus(userId);
    
    if (isDeveloper) {
      return { canDraw: true, isDeveloper: true };
    }

    const todayInfo = await this.getTodayDrawInfo(userId);
    return {
      canDraw: todayInfo.remainingDraws >= cost,
      todayCount: todayInfo.todayCount,
      remainingDraws: todayInfo.remainingDraws,
      cost,
      isDeveloper: false
    };
  }

  // 개발자 상태 확인
  async checkDeveloperStatus(userId) {
    // 간단한 더미 구현 (실제로는 환경변수나 DB에서 확인)
    const developerIds = process.env.DEVELOPER_IDS ? process.env.DEVELOPER_IDS.split(',') : [];
    return developerIds.includes(userId.toString());
  }

  // 카드 뽑기 수행
  async performDraw(userId, fortuneType, question = null) {
    if (this.fortuneService) {
      // 실제 서비스 사용
      const result = await this.fortuneService.drawCard(userId, {
        type: fortuneType,
        question
      });
      
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message);
      }
    } else {
      // 테스트 모드: 더미 카드 생성
      return this.generateDummyDrawResult(fortuneType, question);
    }
  }

  // 더미 카드 뽑기 결과 생성
  generateDummyDrawResult(fortuneType, question = null) {
    const cardCount = fortuneType === 'single' ? 1 : fortuneType === 'triple' ? 3 : 10;
    const cards = [];
    
    for (let i = 0; i < cardCount; i++) {
      const randomCard = this.dummyCards[Math.floor(Math.random() * this.dummyCards.length)];
      cards.push({
        ...randomCard,
        isReversed: Math.random() < 0.3, // 30% 확률로 역방향
        position: i
      });
    }

    return {
      cards,
      fortuneType: this.config.fortuneTypes[fortuneType],
      question,
      drawId: `draw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      interpretation: this.generateDummyInterpretation(cards, fortuneType)
    };
  }

  // 더미 카드 데이터 생성
  generateDummyCards() {
    return [
      { name: "The Fool", korean: "바보", emoji: "🃏", arcana: "major", number: 0 },
      { name: "The Magician", korean: "마법사", emoji: "🎩", arcana: "major", number: 1 },
      { name: "The High Priestess", korean: "여교황", emoji: "🔮", arcana: "major", number: 2 },
      { name: "The Empress", korean: "황후", emoji: "👑", arcana: "major", number: 3 },
      { name: "The Emperor", korean: "황제", emoji: "🏛️", arcana: "major", number: 4 },
      { name: "The Hierophant", korean: "교황", emoji: "⛪", arcana: "major", number: 5 },
      { name: "The Lovers", korean: "연인", emoji: "💕", arcana: "major", number: 6 },
      { name: "The Chariot", korean: "전차", emoji: "🏎️", arcana: "major", number: 7 },
      { name: "Strength", korean: "힘", emoji: "💪", arcana: "major", number: 8 },
      { name: "The Hermit", korean: "은둔자", emoji: "🕯️", arcana: "major", number: 9 },
      { name: "Wheel of Fortune", korean: "운명의 수레바퀴", emoji: "🎡", arcana: "major", number: 10 },
      { name: "Justice", korean: "정의", emoji: "⚖️", arcana: "major", number: 11 },
      { name: "The Hanged Man", korean: "매달린 사람", emoji: "🤸", arcana: "major", number: 12 },
      { name: "Death", korean: "죽음", emoji: "💀", arcana: "major", number: 13 },
      { name: "Temperance", korean: "절제", emoji: "🍷", arcana: "major", number: 14 },
      { name: "The Devil", korean: "악마", emoji: "😈", arcana: "major", number: 15 },
      { name: "The Tower", korean: "탑", emoji: "🗼", arcana: "major", number: 16 },
      { name: "The Star", korean: "별", emoji: "⭐", arcana: "major", number: 17 },
      { name: "The Moon", korean: "달", emoji: "🌙", arcana: "major", number: 18 },
      { name: "The Sun", korean: "태양", emoji: "☀️", arcana: "major", number: 19 },
      { name: "Judgement", korean: "심판", emoji: "📯", arcana: "major", number: 20 },
      { name: "The World", korean: "세계", emoji: "🌍", arcana: "major", number: 21 }
    ];
  }

  // 더미 해석 생성
  generateDummyInterpretation(cards, fortuneType) {
    const messages = [
      "새로운 시작의 기운이 느껴집니다.",
      "현재 상황에서 균형을 찾는 것이 중요합니다.", 
      "내면의 목소리에 귀 기울여보세요.",
      "변화의 시기가 다가오고 있습니다.",
      "인내심을 갖고 기다리는 것이 필요합니다."
    ];

    return {
      summary: messages[Math.floor(Math.random() * messages.length)],
      advice: "카드가 전하는 메시지를 깊이 생각해보세요.",
      cards: cards.map(card => ({
        card: card.name,
        meaning: `${card.korean}는 ${card.isReversed ? '도전' : '기회'}을 의미합니다.`
      }))
    };
  }

  // 질문 유효성 검증
  isValidQuestion(text) {
    if (!text || typeof text !== "string") return false;
    
    const trimmed = text.trim();
    if (trimmed.length < 5 || trimmed.length > 200) return false;
    
    // 의미 있는 단어 체크
    const meaningfulWords = [
      "사랑", "일", "직장", "가족", "친구", "미래", "고민", "선택", "결정", 
      "관계", "건강", "돈", "학업", "시험", "이직", "결혼", "연애", "프로젝트"
    ];
    
    return meaningfulWords.some(word => text.includes(word)) || 
           /[가-힣]{2,}/.test(text); // 완성된 한글이 2글자 이상
  }

  // 사용자 질문 상태 설정
  setUserQuestionState(userId, state) {
    this.userStates.set(userId.toString(), {
      ...state,
      timestamp: Date.now()
    });
  }

  // 사용자 질문 상태 조회
  getUserQuestionState(userId) {
    return this.userStates.get(userId.toString()) || null;
  }

  // 사용자 질문 상태 정리
  clearUserQuestionState(userId) {
    this.userStates.delete(userId.toString());
  }

  // 만료된 상태 정리
  cleanupExpiredStates() {
    const now = Date.now();
    
    // 질문 입력 상태 정리
    for (const [userId, state] of this.userStates) {
      if (now - state.timestamp > this.config.questionTimeout) {
        this.userStates.delete(userId);
        logger.debug(`🧹 만료된 질문 상태 정리: ${userId}`);
      }
    }
    
    // 캘틱 결과 정리 (1시간 후)
    for (const [userId, result] of this.lastCelticResults) {
      if (now - result.timestamp > 3600000) {
        this.lastCelticResults.delete(userId);
        logger.debug(`🧹 만료된 캘틱 결과 정리: ${userId}`);
      }
    }
  }

  // 기본 통계 데이터
  getDefaultStats() {
    return {
      totalDraws: 0,
      favoriteCard: null,
      favoriteCardCount: 0,
      typeStats: { single: 0, triple: 0, celtic: 0 },
      todayDraws: 0,
      weeklyDraws: 0,
      isDemo: true
    };
  }

  // 상세 캘틱 해석 생성 (더미)
  generateDetailedCelticInterpretation(celticResult) {
    return {
      sections: [
        {
          title: "🎯 핵심 상황 분석",
          content: "현재 상황과 도전 과제가 명확히 드러나고 있습니다."
        },
        {
          title: "⏰ 시간의 흐름",
          content: "과거에서 미래로 이어지는 명확한 흐름을 볼 수 있습니다."
        },
        {
          title: "🌐 내외부 영향",
          content: "내면과 외부의 영향이 조화를 이루고 있습니다."
        }
      ],
      overallMessage: "카드들이 보여주는 메시지를 깊이 성찰해보세요."
    };
  }

  /**
   * 📝 메시지 포맷팅 메서드들 (더미)
   */
  formatMenu(todayInfo, isDeveloper) {
    return `🔮 **타로카드 운세**\n\n` +
           `오늘 뽑기: ${todayInfo.todayCount}/${this.config.maxDrawsPerDay}\n` +
           `${isDeveloper ? '(개발자 모드)' : ''}`;
  }

  formatDrawResult(drawResult, type) {
    return `✨ **${this.config.fortuneTypes[type].label} 결과**\n\n` +
           `뽑힌 카드: ${drawResult.cards.map(c => `${c.emoji} ${c.korean}`).join(', ')}\n\n` +
           `해석: ${drawResult.interpretation.summary}`;
  }

  formatQuestionPrompt(fortuneType) {
    return `✨ **${this.config.fortuneTypes[fortuneType].label}**\n\n` +
           `궁금한 것을 구체적으로 질문해주세요.\n` +
           `(5자 이상, 200자 이하)`;
  }

  formatShuffleResult(shuffleResult) {
    return `🃏 **카드 섞기 완료**\n\n${shuffleResult.message}`;
  }

  formatStats(statsData) {
    return `📊 **나의 타로 통계**\n\n` +
           `총 뽑기: ${statsData.totalDraws}회\n` +
           `오늘 뽑기: ${statsData.todayDraws}회`;
  }

  formatHistory(historyData) {
    return `📋 **뽑기 이력**\n\n` +
           `${historyData.isEmpty ? '아직 뽑기 이력이 없습니다.' : `총 ${historyData.total}회의 기록`}`;
  }

  formatCelticDetail(result, interpretation) {
    return `🔍 **캘틱 크로스 상세**\n\n${interpretation.overallMessage}`;
  }

  /**
   * 🎹 키보드 생성 메서드들 (더미)
   */
  createMenuKeyboard(todayInfo, isDeveloper) {
    return { 
      inline_keyboard: [
        [{ text: "🃏 싱글카드", callback_data: "fortune_single" }],
        [{ text: "🔮 트리플카드", callback_data: "fortune_triple" }],
        [{ text: "✨ 캘틱 크로스", callback_data: "fortune_celtic" }]
      ] 
    };
  }

  createDrawResultKeyboard() {
    return { 
      inline_keyboard: [
        [{ text: "🔙 메뉴로", callback_data: "fortune_menu" }]
      ] 
    };
  }

  createQuestionKeyboard() {
    return { 
      inline_keyboard: [
        [{ text: "❌ 취소", callback_data: "fortune_cancel" }]
      ] 
    };
  }

  createCelticResultKeyboard() {
    return { 
      inline_keyboard: [
        [{ text: "🔍 상세보기", callback_data: "fortune_detail" }],
        [{ text: "🔙 메뉴로", callback_data: "fortune_menu" }]
      ] 
    };
  }

  createBackToMenuKeyboard() {
    return { 
      inline_keyboard: [
        [{ text: "🔙 메뉴로", callback_data: "fortune_menu" }]
      ] 
    };
  }

  // 섞기 애니메이션 (더미)
  async performShuffleAnimation(chatId) {
    // 실제로는 AnimationHelper를 사용하지만 더미로 대체
    logger.debug("🃏 섞기 애니메이션 수행 (더미)");
  }

  /**
   * ⚠️ 오류 발행
   */
  async publishError(error, originalEvent) {
    await this.eventBus.publish(EVENTS.SYSTEM.ERROR, {
      error: error.message,
      module: this.moduleName,
      stack: error.stack,
      originalEvent: originalEvent?.name,
      timestamp: new Date().toISOString()
    });

    await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
      chatId: originalEvent?.payload?.chatId,
      error: error.message
    });
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 FortuneModuleV2 정리 시작...");

      // 타이머 정리
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // EventBus 구독 해제
      this.subscriptions.forEach(subscription => {
        logger.debug(`📤 이벤트 구독 해제: ${subscription.eventName || 'unknown'}`);
        if (subscription.unsubscribe) {
          subscription.unsubscribe();
        }
      });
      this.subscriptions.length = 0; // 배열 초기화

      // 상태 정리
      this.userStates.clear();
      this.lastCelticResults.clear();

      // 서비스 정리
      if (this.fortuneService && typeof this.fortuneService.cleanup === 'function') {
        await this.fortuneService.cleanup();
      }

      logger.success("✅ FortuneModuleV2 정리 완료");
    } catch (error) {
      logger.error("❌ FortuneModuleV2 정리 중 오류:", error);
    }
  }

  /**
   * 📊 모듈 상태 조회
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: !!this.eventBus,
      serviceConnected: !!this.fortuneService,
      activeStates: this.userStates.size,
      cachedResults: this.lastCelticResults.size,
      subscriptions: this.subscriptions.length,
      config: {
        maxDrawsPerDay: this.config.maxDrawsPerDay,
        questionTimeout: this.config.questionTimeout,
        fortuneTypes: Object.keys(this.config.fortuneTypes)
      },
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }
}

module.exports = FortuneModuleV2;