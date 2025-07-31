// src/core/ModuleManager.js - Mongoose 지원 버전
const path = require("path");
const logger = require("../utils/Logger");
const { getEnabledModules } = require("../config/ModuleRegistry");

/**
 * 🎯 ModuleManager - 중앙 모듈 관리자 (매개변수 전달 수정)
 *
 * ✅ 핵심 수정사항:
 * - NavigationHandler 파서 표준에 맞는 매개변수 전달
 * - 표준: (bot, callbackQuery, subAction, params, moduleManager)
 * - 모든 모듈이 동일한 매개변수 순서로 호출받음
 */
class ModuleManager {
  constructor(options = {}) {
    this.bot = options.bot;
    this.serviceBuilder = options.serviceBuilder;
    this.modules = new Map();

    // 📊 통계
    this.stats = {
      modulesLoaded: 0,
      callbacksProcessed: 0,
      messagesProcessed: 0,
      errorsCount: 0,
      lastActivity: null,
    };

    logger.info("🎯 ModuleManager 생성됨 - 표준 매개변수 전달 지원");
  }

  /**
   * 🎯 콜백 처리 (수정된 매개변수 전달)
   *
   * NavigationHandler에서 오는 표준 형식:
   * - moduleKey: 모듈 식별자
   * - subAction: 실행할 액션
   * - params: 매개변수들
   */
  async handleCallback(bot, callbackQuery, moduleKey, subAction, params) {
    try {
      this.stats.callbacksProcessed++;
      this.stats.lastActivity = new Date();

      logger.debug(`🎯 ModuleManager 콜백 처리:`, {
        moduleKey,
        subAction,
        params,
        userId: callbackQuery.from.id,
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
          type: "error",
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
          type: "error",
        };
      }

      // 3. ✅ 표준 매개변수로 모듈 콜백 호출
      logger.debug(`🔄 ${moduleKey} 모듈 호출: ${subAction}(${params})`);

      const result = await moduleInstance.handleCallback(
        bot, // 1번째: bot 인스턴스
        callbackQuery, // 2번째: 텔레그램 콜백쿼리
        subAction, // 3번째: 실행할 액션 ✅ 수정됨!
        params, // 4번째: 매개변수들 ✅ 수정됨!
        this // 5번째: ModuleManager 인스턴스 ✅ 수정됨!
      );

      // 4. 결과 검증 및 표준화
      if (!result) {
        logger.warn(`💫 ${moduleKey}.${subAction} 결과 없음`);
        return {
          success: false,
          error: "no_result",
          message: "모듈에서 결과를 반환하지 않았습니다.",
          module: moduleKey,
          type: "error",
        };
      }

      // 5. 성공 로그
      logger.debug(`✅ ${moduleKey}.${subAction} 처리 완료`, {
        resultType: result.type || "unknown",
        hasData: !!result.data,
      });

      // 6. 결과에 모듈 정보 추가 (렌더러가 사용)
      return {
        ...result,
        module: result.module || moduleKey, // 모듈명 보장
        processedBy: "ModuleManager",
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(`💥 ModuleManager 콜백 처리 오류:`, error, {
        moduleKey,
        subAction,
        params,
      });

      this.stats.errorsCount++;

      return {
        success: false,
        error: "processing_error",
        message: "콜백 처리 중 오류가 발생했습니다.",
        module: moduleKey,
        type: "error",
        originalError: error.message,
      };
    }
  }

  /**
   * 💬 메시지 처리 (표준 매개변수)
   */
  async handleMessage(bot, msg) {
    try {
      this.stats.messagesProcessed++;
      this.stats.lastActivity = new Date();

      logger.debug(`💬 ModuleManager 메시지 처리:`, {
        userId: msg.from.id,
        text: msg.text?.substring(0, 50) + (msg.text?.length > 50 ? "..." : ""),
        type: msg.type,
      });

      // 모든 모듈에서 메시지 처리 시도
      for (const [moduleKey, moduleInstance] of this.modules.entries()) {
        if (!moduleInstance.isInitialized) {
          continue; // 초기화되지 않은 모듈은 건너뛰기
        }

        if (typeof moduleInstance.onHandleMessage === "function") {
          try {
            // ✅ 표준 매개변수로 메시지 처리 호출
            const handled = await moduleInstance.onHandleMessage(bot, msg);

            if (handled) {
              logger.debug(`✅ ${moduleKey} 모듈에서 메시지 처리됨`);
              return true;
            }
          } catch (error) {
            logger.error(`❌ ${moduleKey} 모듈 메시지 처리 오류:`, error);
            // 한 모듈 실패해도 다른 모듈 계속 시도
          }
        }
      }

      logger.debug(`💫 어떤 모듈도 메시지를 처리하지 않음`);
      return false;
    } catch (error) {
      logger.error(`💥 ModuleManager 메시지 처리 오류:`, error);
      this.stats.errorsCount++;
      return false;
    }
  }

  /**
   * 🏗️ 모듈 로드 (표준 생성자 매개변수)
   */
  async loadModules(bot) {
    const moduleConfigs = getEnabledModules();

    logger.info(`📦 ${moduleConfigs.length}개의 모듈을 로드합니다...`);

    for (const config of moduleConfigs) {
      try {
        logger.debug(`📁 모듈 로드 시작: ${config.key}`);

        // 모듈 클래스 로드
        const ModuleClass = require(config.path);

        // ✅ BaseModule 표준 생성자 매개변수로 인스턴스 생성
        const moduleInstance = new ModuleClass(config.key, {
          bot: bot, // BaseModule이 기대하는 구조
          moduleManager: this, // ModuleManager 인스턴스
          serviceBuilder: this.serviceBuilder, // 서비스 빌더
          config: config.config || {}, // 모듈별 설정
        });

        // 모듈 초기화
        await moduleInstance.initialize();

        // 모듈 등록
        this.modules.set(config.key, moduleInstance);

        logger.success(`✅ [${config.key}] 모듈 로드 완료`);
      } catch (error) {
        logger.error(`💥 [${config.key}] 모듈 로드 실패:`, error);

        // enhanced 모듈이 실패하면 전체 실패
        if (config.enhanced) {
          throw new Error(
            `핵심 모듈 ${config.key} 로드 실패: ${error.message}`
          );
        }

        // 일반 모듈 실패는 계속 진행
        logger.warn(`⚠️ ${config.key} 모듈 로드 실패했지만 계속 진행`);
      }
    }

    this.stats.modulesLoaded = this.modules.size;
    logger.success(`✅ ${this.modules.size}개 모듈 로드 완료`);

    // 로드된 모듈 목록 로그
    const loadedModules = Array.from(this.modules.keys());
    logger.info(`📋 로드된 모듈: ${loadedModules.join(", ")}`);
  }

  /**
   * 🔄 모듈 재시작
   */
  async restartModule(moduleKey) {
    try {
      logger.info(`🔄 ${moduleKey} 모듈 재시작 시작...`);

      // 모듈 설정 찾기
      const config = getEnabledModules().find((m) => m.key === moduleKey);
      if (!config) {
        throw new Error(`모듈 설정을 찾을 수 없습니다: ${moduleKey}`);
      }

      // 기존 모듈 정리
      const oldModule = this.modules.get(moduleKey);
      if (oldModule && typeof oldModule.cleanup === "function") {
        await oldModule.cleanup();
        logger.debug(`🧹 ${moduleKey} 기존 모듈 정리 완료`);
      }

      // 모듈 캐시에서 제거 (재로드 위해)
      delete require.cache[require.resolve(config.path)];

      // 새 모듈 인스턴스 생성
      const ModuleClass = require(config.path);

      // ✅ 표준 생성자 매개변수 사용
      const moduleInstance = new ModuleClass(moduleKey, {
        bot: this.bot,
        moduleManager: this,
        serviceBuilder: this.serviceBuilder,
        config: config.config || {},
      });

      // 초기화 및 등록
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
   * 📋 모듈 가져오기
   */
  getModule(moduleKey) {
    return this.modules.get(moduleKey);
  }

  /**
   * 📋 모든 모듈 목록
   */
  getModuleList() {
    return Array.from(this.modules.keys());
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    const moduleStatus = {};

    // 각 모듈 상태 수집
    for (const [key, module] of this.modules.entries()) {
      moduleStatus[key] = {
        initialized: module.isInitialized || false,
        stats: module.stats || {},
        hasService: !!module.serviceInstance,
        lastActivity: module.stats?.lastActivity || null,
        errorCount: module.stats?.errorsCount || 0,
      };
    }

    return {
      serviceName: "ModuleManager",
      stats: {
        ...this.stats,
        successRate:
          this.stats.callbacksProcessed > 0
            ? Math.round(
                ((this.stats.callbacksProcessed - this.stats.errorsCount) /
                  this.stats.callbacksProcessed) *
                  100
              )
            : 100,
      },
      modules: {
        total: this.modules.size,
        loaded: this.stats.modulesLoaded,
        active: Array.from(this.modules.values()).filter((m) => m.isInitialized)
          .length,
        details: moduleStatus,
      },
      lastActivity: this.stats.lastActivity,
    };
  }

  /**
   * 🧹 모든 모듈 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 ModuleManager 정리 시작...");

      // 모든 모듈 정리
      const cleanupPromises = [];

      for (const [key, module] of this.modules.entries()) {
        if (typeof module.cleanup === "function") {
          cleanupPromises.push(
            module
              .cleanup()
              .then(() => logger.debug(`✅ ${key} 모듈 정리 완료`))
              .catch((error) =>
                logger.error(`❌ ${key} 모듈 정리 실패:`, error)
              )
          );
        }
      }

      // 모든 모듈 정리 대기
      await Promise.allSettled(cleanupPromises);

      // 서비스 빌더 정리
      if (
        this.serviceBuilder &&
        typeof this.serviceBuilder.cleanup === "function"
      ) {
        await this.serviceBuilder.cleanup();
        logger.debug("✅ ServiceBuilder 정리 완료");
      }

      // 상태 초기화
      this.modules.clear();
      this.stats = {
        modulesLoaded: 0,
        callbacksProcessed: 0,
        messagesProcessed: 0,
        errorsCount: 0,
        lastActivity: null,
      };

      logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 실패:", error);
      throw error;
    }
  }
}

module.exports = ModuleManager;
