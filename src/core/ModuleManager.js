// src/core/ModuleManager.js - EventBus 통합 버전
const logger = require("../utils/core/Logger");
const { getAllEnabledModules } = require("../config/ModuleRegistry");
const EventBus = require('./EventBus');
const { EVENTS } = require('../events/index');

class ModuleManager {
  constructor(options = {}) {
    this.bot = options.bot;
    this.serviceBuilder = options.serviceBuilder;
    this.modules = new Map();
    this.navigationHandler = null; // 중복 제거를 위해 하나만
    
    // EventBus 통합
    this.eventBus = options.eventBus || EventBus.getInstance();
    this.eventSubscriptions = new Map(); // 이벤트 구독 관리

    this.stats = {
      modulesLoaded: 0,
      callbacksProcessed: 0,
      messagesProcessed: 0,
      eventsProcessed: 0,
      errorsCount: 0,
      lastActivity: null
    };

    // EventBus 이벤트 리스너 설정
    this.setupEventListeners();

    logger.info("🎯 ModuleManager 생성됨 - EventBus 통합 지원");
  }

  /**
   * 🎧 EventBus 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 모듈 로드 요청 이벤트
    this.eventSubscriptions.set('module_load', 
      this.eventBus.subscribe(EVENTS.MODULE.LOAD_REQUEST, async (event) => {
        await this.handleModuleLoadRequest(event);
      })
    );

    // 사용자 콜백 이벤트 (기존 콜백 처리를 이벤트로 전환)
    this.eventSubscriptions.set('user_callback', 
      this.eventBus.subscribe(EVENTS.USER.CALLBACK, async (event) => {
        await this.handleCallbackEvent(event);
      })
    );

    // 사용자 명령어 이벤트
    this.eventSubscriptions.set('user_command', 
      this.eventBus.subscribe(EVENTS.USER.COMMAND, async (event) => {
        await this.handleCommandEvent(event);
      })
    );

    // 시스템 에러 이벤트
    this.eventSubscriptions.set('system_error', 
      this.eventBus.subscribe(EVENTS.SYSTEM.ERROR, async (event) => {
        await this.handleSystemError(event);
      })
    );

    logger.debug("🎧 EventBus 리스너 설정 완료");
  }

  /**
   * 🎯 ModuleManager 초기화 (EventBus 통합)
   */
  async initialize(bot, options = {}) {
    try {
      logger.info("🎯 ModuleManager 초기화 시작 (EventBus 통합)...");

      this.bot = bot;

      // Mongoose Manager만 설정
      if (options.mongooseManager) {
        this.mongooseManager = options.mongooseManager;
      }

      // ✅ 중요: ServiceBuilder가 없으면 에러 발생
      if (!this.serviceBuilder) {
        throw new Error(
          "ServiceBuilder가 설정되지 않았습니다. ModuleManager 생성 시 전달해주세요."
        );
      }

      // EventBus 시스템 시작 이벤트 발행
      await this.eventBus.publish(EVENTS.SYSTEM.STARTUP, {
        component: 'ModuleManager',
        timestamp: new Date().toISOString()
      });

      // 모듈 로드
      await this.loadModules(bot);

      // ModuleManager 준비 완료 이벤트 발행
      await this.eventBus.publish(EVENTS.SYSTEM.READY, {
        component: 'ModuleManager',
        modulesLoaded: this.stats.modulesLoaded,
        timestamp: new Date().toISOString()
      });

      logger.success("✅ ModuleManager 초기화 완료 (EventBus 통합)");
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  /**
   * 🎧 EventBus 이벤트 핸들러들
   */

  /**
   * 📦 모듈 로드 요청 처리
   */
  async handleModuleLoadRequest(event) {
    try {
      const { moduleName, moduleKey } = event.payload;
      logger.info(`📦 모듈 로드 요청: ${moduleName || moduleKey}`);
      
      // 실제 모듈 로드 로직 (기존 loadModules에서 추출)
      // 여기서는 이벤트 발행만
      await this.eventBus.publish(EVENTS.MODULE.LOADED, {
        moduleName,
        moduleKey,
        success: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('📦 모듈 로드 실패:', error);
      await this.eventBus.publish(EVENTS.MODULE.ERROR, {
        error: error.message,
        module: event.payload.moduleKey,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 🎯 콜백 이벤트 처리 (기존 방식을 이벤트 기반으로 전환)
   */
  async handleCallbackEvent(event) {
    try {
      this.stats.eventsProcessed++;
      this.stats.lastActivity = new Date();

      const { data, userId, chatId, messageId } = event.payload;
      
      // 콜백 데이터 파싱: module:action:params
      const [moduleKey, subAction, ...params] = data.split(':');

      logger.debug(`🎯 EventBus 콜백 처리:`, {
        moduleKey,
        subAction, 
        params,
        userId
      });

      // 모듈 찾기 및 처리
      const moduleInstance = this.modules.get(moduleKey);
      if (!moduleInstance) {
        await this.eventBus.publish(EVENTS.RENDER.ERROR_REQUEST, {
          chatId,
          error: `${moduleKey} 모듈을 찾을 수 없습니다.`
        });
        return;
      }

      // 모듈에 직접 이벤트 전달 (모듈이 EventBus를 지원하는 경우)
      if (moduleInstance.handleEvent) {
        await moduleInstance.handleEvent(EVENTS.USER.CALLBACK, event);
      } else {
        // 레거시 모듈을 위한 기존 방식 호출
        const callbackQuery = {
          data,
          from: { id: userId },
          message: { message_id: messageId, chat: { id: chatId } }
        };
        await moduleInstance.handleCallback(this.bot, callbackQuery, subAction, params, this);
      }

    } catch (error) {
      logger.error('🎯 콜백 이벤트 처리 실패:', error);
      await this.eventBus.publish(EVENTS.SYSTEM.ERROR, {
        error: error.message,
        module: 'ModuleManager',
        event: 'handleCallbackEvent',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 💬 명령어 이벤트 처리
   */
  async handleCommandEvent(event) {
    try {
      this.stats.eventsProcessed++;
      this.stats.lastActivity = new Date();

      const { command, userId, chatId } = event.payload;
      
      logger.debug(`💬 EventBus 명령어 처리: /${command}`, { userId });

      // 시스템 명령어는 SystemModule에서 처리
      if (['start', 'help', 'status', 'menu'].includes(command)) {
        const systemModule = this.modules.get('system');
        if (systemModule && systemModule.handleEvent) {
          await systemModule.handleEvent(EVENTS.USER.COMMAND, event);
        }
      } else {
        // 다른 모듈들에게 명령어 이벤트 브로드캐스트
        // 각 모듈이 자신이 처리할 명령어인지 판단
        for (const [moduleKey, moduleInstance] of this.modules) {
          if (moduleInstance.handleEvent) {
            try {
              await moduleInstance.handleEvent(EVENTS.USER.COMMAND, event);
            } catch (err) {
              logger.debug(`${moduleKey} 모듈에서 명령어 처리 건너뜀: ${err.message}`);
            }
          }
        }
      }

    } catch (error) {
      logger.error('💬 명령어 이벤트 처리 실패:', error);
      await this.eventBus.publish(EVENTS.SYSTEM.ERROR, {
        error: error.message,
        module: 'ModuleManager',
        event: 'handleCommandEvent',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * ⚠️ 시스템 에러 처리
   */
  async handleSystemError(event) {
    try {
      this.stats.errorsCount++;
      const { error, module, timestamp } = event.payload;
      
      logger.error(`⚠️ 시스템 에러 감지: ${error} (모듈: ${module || 'unknown'})`);
      
      // 필요시 에러 알림 등 추가 처리
      
    } catch (err) {
      logger.error('⚠️ 시스템 에러 처리 중 오류:', err);
    }
  }

  /**
   * 🎯 콜백 처리 (표준 매개변수 전달) - 레거시 호환
   */
  async handleCallback(bot, callbackQuery, moduleKey, subAction, params) {
    try {
      this.stats.callbacksProcessed++;
      this.stats.lastActivity = new Date();

      logger.debug(`🎯 ModuleManager 콜백 처리:`, {
        moduleKey,
        subAction,
        params,
        userId: callbackQuery.from.id
      });

      // 1. 모듈 찾기
      const moduleInstance = this.modules.get(moduleKey);
      if (!moduleInstance) {
        logger.warn(`❓ 모듈을 찾을 수 없음: ${moduleKey}`);
        return {
          success: false,
          error: "module_not_found",
          message: `${moduleKey} 모듈을 찾을 수 없습니다.`,
          module: moduleKey,
          type: "error"
        };
      }

      // 2. 모듈이 초기화되었는지 확인
      if (!moduleInstance.isInitialized) {
        logger.warn(`❓ 모듈이 초기화되지 않음: ${moduleKey}`);
        return {
          success: false,
          error: "module_not_initialized",
          message: `${moduleKey} 모듈이 아직 초기화되지 않았습니다.`,
          module: moduleKey,
          type: "error"
        };
      }

      // 3. ✅ 표준 매개변수로 모듈 콜백 호출
      logger.debug(`🔄 ${moduleKey} 모듈 호출: ${subAction}(${params})`);

      const result = await moduleInstance.handleCallback(
        bot, // 1번째: bot 인스턴스
        callbackQuery, // 2번째: 텔레그램 콜백쿼리
        subAction, // 3번째: 실행할 액션
        params, // 4번째: 매개변수들
        this // 5번째: ModuleManager 인스턴스
      );

      // 4. 결과 검증 및 표준화
      if (!result) {
        logger.warn(`💫 ${moduleKey}.${subAction} 결과 없음`);
        return {
          success: false,
          error: "no_result",
          message: "모듈에서 결과를 반환하지 않았습니다.",
          module: moduleKey,
          type: "error"
        };
      }

      // 5. 성공 로그
      logger.debug(`✅ ${moduleKey}.${subAction} 처리 완료`, {
        resultType: result.type || "unknown",
        hasData: !!result.data
      });

      // 6. 결과에 모듈 정보 추가
      return {
        ...result,
        module: result.module || moduleKey,
        processedBy: "ModuleManager",
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`💥 ModuleManager 콜백 처리 오류:`, error, {
        moduleKey,
        subAction,
        params
      });

      this.stats.errorsCount++;

      return {
        success: false,
        error: "processing_error",
        message: "콜백 처리 중 오류가 발생했습니다.",
        module: moduleKey,
        type: "error",
        originalError: error.message
      };
    }
  }

  /**
   * 🎯 모듈 로드
   */
  async loadModules(bot) {
    const enabledModules = getAllEnabledModules();

    for (const config of enabledModules) {
      try {
        logger.info(`📦 [${config.key}] 모듈 로드 시작...`);

        const ModuleClass = require(config.path);

        const moduleInstance = new ModuleClass(config.key, {
          bot: bot,
          moduleManager: this,
          serviceBuilder: this.serviceBuilder,
          config: config.config || {}
        });

        await moduleInstance.initialize();
        this.modules.set(config.key, moduleInstance);

        logger.success(`✅ [${config.key}] 모듈 로드 완료`);
      } catch (error) {
        logger.error(`💥 [${config.key}] 모듈 로드 실패:`, error);
        logger.warn(`⚠️ ${config.key} 모듈 로드 실패했지만 계속 진행합니다`);
        continue;
      }
    }

    this.stats.modulesLoaded = this.modules.size;
    logger.success(`✅ ${this.modules.size}개 모듈 로드 완료`);
  }

  /**
   * 🎯 NavigationHandler 연결 (중복 제거)
   */
  setNavigationHandler(navigationHandler) {
    this.navigationHandler = navigationHandler;
    logger.debug("🔗 NavigationHandler 연결됨");
  }

  /**
   * 특정 모듈 가져오기
   */
  getModule(moduleKey) {
    return this.modules.get(moduleKey);
  }

  /**
   * 모듈 재시작
   */
  async restartModule(moduleKey) {
    try {
      logger.info(`🔄 ${moduleKey} 모듈 재시작 시작...`);

      const config = getAllEnabledModules().find((m) => m.key === moduleKey);
      if (!config) {
        throw new Error(`모듈 설정을 찾을 수 없습니다: ${moduleKey}`);
      }

      const oldModule = this.modules.get(moduleKey);
      if (oldModule && typeof oldModule.cleanup === "function") {
        await oldModule.cleanup();
        logger.debug(`🧹 ${moduleKey} 기존 모듈 정리 완료`);
      }

      delete require.cache[require.resolve(config.path)];

      const ModuleClass = require(config.path);
      const moduleInstance = new ModuleClass(moduleKey, {
        bot: this.bot,
        moduleManager: this,
        serviceBuilder: this.serviceBuilder,
        config: config.config || {}
      });

      await moduleInstance.initialize();
      this.modules.set(moduleKey, moduleInstance);

      logger.success(`✅ ${moduleKey} 모듈 재시작 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${moduleKey} 모듈 재시작 실패:`, error);
      throw error;
    }
  }

  /**
   * 🚇 EventBus 관련 메서드들
   */

  /**
   * 📊 EventBus 통계 포함 전체 통계
   */
  getStats() {
    const eventBusHealth = this.eventBus.getHealthStatus();
    
    return {
      ...this.stats,
      eventBus: {
        health: eventBusHealth.status,
        score: eventBusHealth.score,
        listeners: eventBusHealth.listeners,
        totalEvents: eventBusHealth.stats.totalEvents,
        errorRate: eventBusHealth.stats.errorRate
      },
      modules: {
        loaded: this.modules.size,
        active: Array.from(this.modules.values()).filter(m => m.isInitialized).length
      }
    };
  }

  /**
   * 📡 이벤트 발행 헬퍼 메서드
   */
  async publishEvent(eventName, payload, metadata = {}) {
    try {
      return await this.eventBus.publish(eventName, payload, {
        source: 'ModuleManager',
        ...metadata
      });
    } catch (error) {
      logger.error(`📡 이벤트 발행 실패: ${eventName}`, error);
      throw error;
    }
  }

  /**
   * 🧹 EventBus 정리 및 종료
   */
  async shutdown() {
    try {
      logger.info('🚇 ModuleManager 종료 시작...');

      // 시스템 종료 이벤트 발행
      await this.eventBus.publish(EVENTS.SYSTEM.SHUTDOWN, {
        component: 'ModuleManager',
        timestamp: new Date().toISOString()
      });

      // 모든 이벤트 구독 해제
      for (const [name, unsubscribe] of this.eventSubscriptions) {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
          logger.debug(`📤 EventBus 구독 해제: ${name}`);
        }
      }
      this.eventSubscriptions.clear();

      // 모듈들 정리
      for (const [key, module] of this.modules) {
        if (typeof module.cleanup === 'function') {
          await module.cleanup();
          logger.debug(`🧹 모듈 정리 완료: ${key}`);
        }
      }
      this.modules.clear();

      logger.success('✅ ModuleManager 종료 완료');
    } catch (error) {
      logger.error('❌ ModuleManager 종료 중 오류:', error);
      throw error;
    }
  }
}

module.exports = ModuleManager;
