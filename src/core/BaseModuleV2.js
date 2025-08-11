// BaseModuleV2.js - EventBus 기반 V2 모듈 표준 베이스 클래스

const logger = require("../utils/core/Logger");
const EventBus = require("./EventBus");
const ErrorHandler = require("../utils/core/ErrorHandler");

/**
 * V2 모듈의 베이스 클래스
 * EventBus 기반의 느슨한 결합과 이벤트 중심 아키텍처를 제공
 */
class BaseModuleV2 {
  constructor(moduleName, options = {}) {
    // 필수 속성
    this.moduleName = moduleName;
    this.eventBus = options.eventBus || EventBus.getInstance();
    this.serviceBuilder = options.serviceBuilder || null;
    
    // 설정 (하위 클래스에서 오버라이드 가능)
    this.config = this.getDefaultConfig();
    if (options.config) {
      this.config = { ...this.config, ...options.config };
    }
    
    // 상태 관리
    this.subscriptions = [];
    this.userStates = new Map();
    this.isInitialized = false;
    
    // 서비스 인스턴스 (하위 클래스에서 설정)
    this.service = null;
    
    // 자동 정리 타이머
    if (this.config.enableAutoCleanup) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredStates();
      }, this.config.cleanupInterval);
    }
    
    logger.info(`📦 ${this.moduleName}V2 생성됨 (EventBus 기반)`);
  }
  
  /**
   * 기본 설정 (하위 클래스에서 오버라이드)
   */
  getDefaultConfig() {
    return {
      timeout: 300000,           // 5분 기본 타임아웃
      maxUserStates: 1000,       // 최대 사용자 상태 수
      cleanupInterval: 60000,    // 1분마다 정리
      enableAutoCleanup: true,   // 자동 정리 활성화
      enableAutoResponse: false, // 자동 응답 비활성화
      testMode: process.env.NODE_ENV === 'test'
    };
  }
  
  /**
   * 모듈 초기화
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn(`⚠️ ${this.moduleName}V2 이미 초기화됨`);
      return true;
    }
    
    try {
      // 1. 서비스 연결 (하위 클래스 구현)
      await this.connectService();
      
      // 2. 이벤트 리스너 설정 (하위 클래스 구현)
      this.setupEventListeners();
      
      // 3. 추가 초기화 (하위 클래스 구현)
      await this.onInitialize();
      
      this.isInitialized = true;
      
      const modeText = this.service ? '프로덕션 모드' : '테스트 모드';
      logger.success(`✅ ${this.moduleName}V2 초기화 완료 (${modeText}, EventBus 기반)`);
      
      return true;
    } catch (error) {
      logger.error(`❌ ${this.moduleName}V2 초기화 실패:`, error);
      throw error;
    }
  }
  
  /**
   * 서비스 연결 (하위 클래스에서 구현)
   */
  async connectService() {
    if (!this.serviceBuilder) {
      logger.warn(`⚠️ ${this.moduleName}V2 ServiceBuilder 없음 - 테스트 모드`);
      return;
    }
    
    try {
      const serviceName = this.getServiceName();
      this.service = await this.serviceBuilder.getOrCreate(serviceName);
      
      if (this.service) {
        logger.info(`✅ ${this.moduleName}Service 연결 완료`);
      } else {
        logger.warn(`⚠️ ${this.moduleName}Service 연결 실패 - 테스트 모드로 동작`);
      }
    } catch (error) {
      logger.warn(`⚠️ ${this.moduleName}Service 연결 실패 - 테스트 모드로 동작:`, error.message);
    }
  }
  
  /**
   * 서비스 이름 반환 (하위 클래스에서 오버라이드)
   */
  getServiceName() {
    return this.moduleName.toLowerCase();
  }
  
  /**
   * 이벤트 리스너 설정 (하위 클래스에서 반드시 구현)
   */
  setupEventListeners() {
    throw new Error(`${this.moduleName}V2: setupEventListeners() must be implemented`);
  }
  
  /**
   * 추가 초기화 로직 (하위 클래스에서 필요시 구현)
   */
  async onInitialize() {
    // 하위 클래스에서 필요시 구현
  }
  
  /**
   * 이벤트 구독 헬퍼
   */
  subscribe(eventName, handler) {
    const boundHandler = handler.bind(this);
    const unsubscribe = this.eventBus.subscribe(eventName, boundHandler);
    this.subscriptions.push(unsubscribe);
    logger.debug(`📥 이벤트 구독: ${eventName}`);
    return unsubscribe;
  }
  
  /**
   * 이벤트 발행 헬퍼
   */
  async publish(eventName, payload, metadata = {}) {
    return await this.eventBus.publish(eventName, payload, {
      ...metadata,
      source: this.moduleName
    });
  }
  
  /**
   * 사용자 상태 관리
   */
  setUserState(userId, state) {
    const userIdStr = userId.toString();
    
    // 최대 상태 수 체크
    if (this.userStates.size >= this.config.maxUserStates && !this.userStates.has(userIdStr)) {
      this.cleanupOldestState();
    }
    
    this.userStates.set(userIdStr, {
      ...state,
      timestamp: Date.now()
    });
  }
  
  getUserState(userId) {
    return this.userStates.get(userId.toString()) || null;
  }
  
  clearUserState(userId) {
    return this.userStates.delete(userId.toString());
  }
  
  /**
   * 만료된 상태 정리
   */
  cleanupExpiredStates() {
    const now = Date.now();
    const expired = [];
    
    this.userStates.forEach((state, userId) => {
      if (now - state.timestamp > this.config.timeout) {
        expired.push(userId);
      }
    });
    
    if (expired.length > 0) {
      expired.forEach(userId => this.clearUserState(userId));
      logger.debug(`🧹 ${this.moduleName}V2: ${expired.length}개 만료 상태 정리`);
    }
  }
  
  /**
   * 가장 오래된 상태 제거
   */
  cleanupOldestState() {
    let oldestUserId = null;
    let oldestTime = Date.now();
    
    this.userStates.forEach((state, userId) => {
      if (state.timestamp < oldestTime) {
        oldestTime = state.timestamp;
        oldestUserId = userId;
      }
    });
    
    if (oldestUserId) {
      this.clearUserState(oldestUserId);
      logger.debug(`🧹 ${this.moduleName}V2: 가장 오래된 상태 제거`);
    }
  }
  
  /**
   * 표준 오류 처리 (ErrorHandler 사용)
   */
  async publishError(error, originalEvent, operation = '작업') {
    const chatId = originalEvent?.payload?.chatId;
    const userId = originalEvent?.payload?.userId;
    
    // 통합 에러 처리
    ErrorHandler.processModuleError(this.moduleName, operation, error, {
      throwError: false,
      eventBus: this.eventBus,
      chatId,
      logContext: { userId }
    });
  }
  
  /**
   * 비동기 작업 래퍼 (자동 에러 처리)
   */
  async safeExecute(operation, asyncFn, originalEvent = null) {
    const chatId = originalEvent?.payload?.chatId;
    
    return await ErrorHandler.wrap(this.moduleName, operation, asyncFn, {
      eventBus: this.eventBus,
      chatId
    });
  }
  
  /**
   * 사용자 친화적 오류 메시지 (deprecated - ErrorHandler 사용 권장)
   */
  getUserFriendlyError(error) {
    return ErrorHandler.getUserMessage(this.moduleName, '작업', error);
  }
  
  /**
   * 레거시 콜백 호환 - V1과의 브릿지
   * ModuleManager가 이 메서드를 호출하면 적절한 처리를 수행
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    try {
      // 하위 클래스에서 오버라이드하면 그것을 사용
      if (this.onHandleCallback) {
        return await this.onHandleCallback(bot, callbackQuery, subAction, params, moduleManager);
      }
      
      // 기본적으로는 해당 액션에 대한 핸들러를 직접 호출
      const handlerName = `handle${subAction.charAt(0).toUpperCase()}${subAction.slice(1)}`;
      const handler = this[handlerName];
      
      if (handler && typeof handler === 'function') {
        const userId = callbackQuery.from.id;
        const chatId = callbackQuery.message.chat.id;
        
        // 핸들러 직접 호출
        const result = await handler.call(this, {
          payload: {
            userId,
            chatId,
            params,
            callbackQuery
          }
        });
        
        return result || {
          type: subAction,
          module: this.moduleName,
          success: true
        };
      }
      
      logger.debug(`${this.moduleName}V2: 액션 핸들러 없음 - ${subAction}`);
      return null;
    } catch (error) {
      logger.error(`${this.moduleName}V2 콜백 처리 오류:`, error);
      throw error;
    }
  }
  
  /**
   * 모듈 상태 조회
   */
  getStatus() {
    return {
      moduleName: this.moduleName,
      isInitialized: this.isInitialized,
      serviceConnected: !!this.service,
      activeStates: this.userStates.size,
      subscriptions: this.subscriptions.length,
      config: this.config
    };
  }
  
  /**
   * 모듈 정리
   */
  async cleanup() {
    try {
      logger.info(`🧹 ${this.moduleName}V2 정리 시작...`);
      
      // 타이머 정리
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      // 이벤트 구독 해제
      this.subscriptions.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          try {
            unsubscribe();
          } catch (error) {
            logger.error(`구독 해제 실패:`, error);
          }
        }
      });
      this.subscriptions = [];
      
      // 상태 정리
      this.userStates.clear();
      
      // 서비스 정리
      if (this.service && typeof this.service.cleanup === 'function') {
        await this.service.cleanup();
      }
      
      // 추가 정리 (하위 클래스)
      await this.onCleanup();
      
      this.isInitialized = false;
      
      logger.success(`✅ ${this.moduleName}V2 정리 완료`);
    } catch (error) {
      logger.error(`❌ ${this.moduleName}V2 정리 실패:`, error);
      throw error;
    }
  }
  
  /**
   * 추가 정리 로직 (하위 클래스에서 필요시 구현)
   */
  async onCleanup() {
    // 하위 클래스에서 필요시 구현
  }
}

module.exports = BaseModuleV2;