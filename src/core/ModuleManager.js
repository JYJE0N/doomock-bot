// src/core/ModuleManager.js - 모듈 관리자 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 📦 ModuleManager v3.0.1 (리팩토링)
 *
 * 🔧 주요 개선사항:
 * - 중복 처리 방지 로직 강화
 * - 표준 매개변수 체계 준수
 * - 콜백 데이터 파싱 개선
 * - 에러 처리 표준화
 * - 모듈 생명주기 관리 개선
 */
class ModuleManager {
  constructor(config = {}) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      enableCache: true,
      ...config,
    };

    // 📦 모듈 관리
    this.moduleRegistry = new Map();
    this.moduleInstances = new Map();
    this.initializingModules = new Set();

    // 🚫 중복 처리 방지
    this.processingCallbacks = new Set();
    this.processingMessages = new Set();

    // ⏰ 정리 타이머
    this.cleanupInterval = null;

    // 📊 통계
    this.stats = {
      totalModules: 0,
      activeModules: 0,
      failedModules: 0,
      callbacksHandled: 0,
      messagesHandled: 0,
      errorsCount: 0,
      averageInitTime: 0,
      totalInitTime: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastActivity: null,
    };

    this.isInitialized = false;

    logger.info("📦 ModuleManager 생성됨");
  }

  /**
   * 🚀 모듈 관리자 초기화
   */
  async initialize() {
    try {
      logger.moduleStart("ModuleManager", "3.0.1");

      // 등록된 모듈들 초기화
      await this.initializeAllModules();

      // 정리 작업 스케줄
      this.scheduleCleanup();

      this.isInitialized = true;
      logger.success("✅ ModuleManager 초기화 완료", {
        totalModules: this.stats.totalModules,
        activeModules: this.stats.activeModules,
        failedModules: this.stats.failedModules,
      });
    } catch (error) {
      logger.error("❌ ModuleManager 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 📦 모듈 등록 및 관리 =====

  /**
   * 📝 모듈 등록
   */
  registerModule(moduleKey, ModuleClass, config = {}) {
    try {
      // 모듈 설정 검증
      if (!moduleKey || typeof moduleKey !== "string") {
        throw new Error("모듈 키는 문자열이어야 합니다");
      }

      if (!ModuleClass || typeof ModuleClass !== "function") {
        throw new Error("모듈 클래스가 필요합니다");
      }

      // 중복 등록 방지
      if (this.moduleRegistry.has(moduleKey)) {
        logger.warn(`⚠️ 모듈 중복 등록: ${moduleKey}`);
        return false;
      }

      // 모듈 설정 준비
      const moduleConfig = {
        key: moduleKey,
        name: config.name || moduleKey,
        description: config.description || `${moduleKey} 모듈`,
        ModuleClass,
        priority: config.priority || 50,
        required: config.required || false,
        enabled: config.enabled !== false,
        config: config.moduleConfig || {},
        registeredAt: TimeHelper.getTimestamp(),
        initialized: false,
        initializedAt: null,
        initError: null,
      };

      // 레지스트리에 등록
      this.moduleRegistry.set(moduleKey, moduleConfig);
      this.stats.totalModules++;

      logger.info(`📝 모듈 등록됨: ${moduleKey}`, {
        module: moduleKey,
        name: moduleConfig.name,
        priority: moduleConfig.priority,
        enabled: moduleConfig.enabled,
      });

      return true;
    } catch (error) {
      logger.error(`❌ 모듈 등록 실패 (${moduleKey}):`, error);
      return false;
    }
  }

  /**
   * 🚀 모든 모듈 초기화
   */
  async initializeAllModules() {
    logger.info("🚀 모든 모듈 초기화 시작...");

    // 우선순위 순으로 정렬
    const sortedModules = Array.from(this.moduleRegistry.entries())
      .filter(([key, config]) => config.enabled)
      .sort(([, a], [, b]) => a.priority - b.priority);

    // 순차적으로 초기화
    for (const [moduleKey, moduleConfig] of sortedModules) {
      await this.initializeModule(moduleKey);
    }

    logger.success(
      `✅ 모듈 초기화 완료: ${this.stats.activeModules}/${this.stats.totalModules}`
    );
  }

  /**
   * 🔧 개별 모듈 초기화
   */
  async initializeModule(moduleKey) {
    const startTime = Date.now();

    try {
      // 중복 초기화 방지
      if (this.initializingModules.has(moduleKey)) {
        logger.debug(`🔄 ${moduleKey} 이미 초기화 중`);
        return;
      }

      const moduleConfig = this.moduleRegistry.get(moduleKey);
      if (!moduleConfig) {
        throw new Error(`등록되지 않은 모듈: ${moduleKey}`);
      }

      if (moduleConfig.initialized) {
        logger.debug(`✅ ${moduleKey} 이미 초기화됨`);
        return;
      }

      this.initializingModules.add(moduleKey);
      logger.debug(`🔧 ${moduleConfig.name} 초기화 중...`);

      // ✅ 수정: 모듈 인스턴스 생성 시 ServiceBuilder 전달
      const moduleInstance = new moduleConfig.ModuleClass(
        this.config.bot || this.bot,
        {
          bot: this.config.bot || this.bot,
          db: this.config.db || this.db,
          serviceBuilder: this.serviceBuilder || this.config.serviceBuilder, // ⭐ ServiceBuilder 추가!
          moduleManager: this,
          moduleKey: moduleKey,
          moduleConfig: moduleConfig.config,
          config: moduleConfig.config,
        }
      );

      // 모듈 초기화
      if (typeof moduleInstance.initialize === "function") {
        await moduleInstance.initialize();
      }

      // 인스턴스 등록
      this.moduleInstances.set(moduleKey, moduleInstance);

      // 초기화 완료 표시
      moduleConfig.initialized = true;
      moduleConfig.initializedAt = TimeHelper.getTimestamp();

      // 통계 업데이트
      const initTime = Date.now() - startTime;
      this.updateInitTimeStats(initTime);
      this.stats.activeModules++;

      logger.success(`✅ ${moduleConfig.name} 초기화 완료 (${initTime}ms)`);
    } catch (error) {
      logger.error(`❌ ${moduleKey} 초기화 실패:`, error);

      const moduleConfig = this.moduleRegistry.get(moduleKey);
      if (moduleConfig) {
        moduleConfig.initError = error.message;
        this.stats.failedModules++;
      }

      throw error;
    } finally {
      this.initializingModules.delete(moduleKey);
    }
  }

  // ===== 🎯 콜백 및 메시지 처리 (표준 패턴) =====

  /**
   * 🎯 콜백 처리 (NavigationHandler에서 호출)
   * 표준 매개변수: (bot, callbackQuery, subAction, params, moduleManager)
   */
  async handleCallback(bot, callbackQuery, subAction, params, moduleManager) {
    const callbackId = callbackQuery.id;
    const startTime = Date.now();

    try {
      // 🚫 중복 처리 방지
      if (this.processingCallbacks.has(callbackId)) {
        logger.debug(`🔄 중복 콜백 무시: ${callbackId}`);
        return true;
      }
      this.processingCallbacks.add(callbackId);

      // 📋 콜백 데이터 파싱
      const { moduleKey, action, additionalParams } = this.parseCallbackData(
        callbackQuery.data
      );

      logger.debug(
        `🎯 ModuleManager 콜백: ${moduleKey}:${action}${
          additionalParams.length > 0 ? `:${additionalParams.join(":")}` : ""
        }`
      );

      // 🔍 모듈 존재 확인
      if (!this.hasModule(moduleKey)) {
        logger.warn(`❓ 모듈 없음: ${moduleKey}`);
        return false;
      }

      // 📦 모듈 인스턴스 가져오기
      const moduleInstance = this.getModule(moduleKey);
      if (!moduleInstance) {
        logger.warn(`❓ 모듈 인스턴스 없음: ${moduleKey}`);
        return false;
      }

      // 🎯 콜백 처리 (표준 매개변수 사용)
      if (typeof moduleInstance.handleCallback === "function") {
        const handled = await moduleInstance.handleCallback(
          bot,
          callbackQuery,
          action, // subAction
          additionalParams, // params
          this // moduleManager
        );

        if (handled) {
          this.stats.callbacksHandled++;
          this.stats.lastActivity = TimeHelper.getLogTimeString();
          return true;
        }
      }

      logger.debug(`❓ 처리되지 않은 콜백: ${moduleKey}:${action}`);
      return false;
    } catch (error) {
      logger.error("❌ ModuleManager 콜백 처리 오류:", error);
      this.stats.errorsCount++;
      return false;
    } finally {
      // 🧹 정리
      this.processingCallbacks.delete(callbackId);

      // 📊 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    }
  }

  /**
   * 💬 메시지 처리 (표준 패턴)
   */
  async handleMessage(bot, msg) {
    const messageId = `${msg.from.id}_${msg.message_id}`;
    const startTime = Date.now();

    try {
      // 🚫 중복 처리 방지
      if (this.processingMessages.has(messageId)) {
        logger.debug(`🔄 중복 메시지 무시: ${messageId}`);
        return;
      }
      this.processingMessages.add(messageId);

      logger.debug("💬 ModuleManager 메시지 처리 시작");

      // 우선순위 순으로 모듈에 메시지 전달
      const sortedKeys = Array.from(this.moduleInstances.keys()).sort(
        (a, b) => {
          const configA = this.moduleRegistry.get(a);
          const configB = this.moduleRegistry.get(b);
          return configA.priority - configB.priority;
        }
      );

      for (const moduleKey of sortedKeys) {
        const moduleInstance = this.moduleInstances.get(moduleKey);

        if (
          moduleInstance &&
          typeof moduleInstance.handleMessage === "function"
        ) {
          try {
            const handled = await moduleInstance.handleMessage(bot, msg);

            if (handled) {
              logger.debug(`✅ 메시지 처리됨: ${moduleKey}`);
              this.stats.messagesHandled++;
              this.stats.lastActivity = TimeHelper.getLogTimeString();
              return;
            }
          } catch (moduleError) {
            logger.error(`❌ ${moduleKey} 메시지 처리 오류:`, moduleError);
            continue; // 다음 모듈 시도
          }
        }
      }

      logger.debug("💬 처리되지 않은 메시지");
    } catch (error) {
      logger.error("❌ ModuleManager 메시지 처리 오류:", error);
      this.stats.errorsCount++;
    } finally {
      // 🧹 정리
      this.processingMessages.delete(messageId);

      // 📊 통계 업데이트
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
    }
  }

  // ===== 🔧 유틸리티 메서드들 =====

  /**
   * 🔍 콜백 데이터 파싱 (표준 형식)
   */
  parseCallbackData(callbackData) {
    try {
      if (!callbackData || typeof callbackData !== "string") {
        logger.warn("❓ ModuleManager: 빈 콜백 데이터");
        return {
          moduleKey: "system",
          action: "menu",
          additionalParams: [],
        };
      }

      // 🔍 콜론(:) 기준으로 파싱
      const parts = callbackData.split(":");

      const result = {
        moduleKey: parts[0] || "system",
        action: parts[1] || "menu",
        additionalParams: parts.slice(2) || [],
      };

      // 🔍 상세 디버그 로그
      if (logger.level === "debug") {
        logger.debug(
          `🔍 ModuleManager 파싱: "${callbackData}" → ${result.moduleKey}:${
            result.action
          }${
            result.additionalParams.length > 0
              ? `:${result.additionalParams.join(":")}`
              : ""
          }`
        );
      }

      return result;
    } catch (error) {
      logger.error("❌ ModuleManager 콜백 파싱 오류:", error);
      return {
        moduleKey: "system",
        action: "menu",
        additionalParams: [],
      };
    }
  }

  /**
   * 🔍 모듈 존재 확인
   */
  hasModule(moduleKey) {
    return this.moduleInstances.has(moduleKey);
  }

  /**
   * 📦 모듈 인스턴스 가져오기
   */
  getModule(moduleKey) {
    return this.moduleInstances.get(moduleKey);
  }

  /**
   * 📋 활성 모듈 목록 조회
   */
  getActiveModules() {
    return Array.from(this.moduleInstances.keys());
  }

  /**
   * 📊 활성 모듈 상태 조회
   */
  getActiveModulesStatus() {
    const modules = [];

    for (const [key, instance] of this.moduleInstances.entries()) {
      const config = this.moduleRegistry.get(key);
      if (config) {
        modules.push({
          key,
          name: config.name,
          description: config.description,
          priority: config.priority,
          status: instance.getStatus ? instance.getStatus() : { active: true },
        });
      }
    }

    return modules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * ⏰ 정리 작업 스케줄
   */
  scheduleCleanup() {
    // 3분마다 오래된 처리 세트 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleProcesses();
    }, 3 * 60 * 1000);

    logger.debug("⏰ ModuleManager 자동 정리 작업 예약됨 (3분 간격)");
  }

  /**
   * 🧹 오래된 프로세스 정리
   */
  cleanupStaleProcesses() {
    const callbacksSize = this.processingCallbacks.size;
    const messagesSize = this.processingMessages.size;

    // 처리 중인 항목들이 너무 많으면 정리 (메모리 누수 방지)
    if (callbacksSize > 100) {
      this.processingCallbacks.clear();
      logger.warn(`🧹 ModuleManager 콜백 처리 맵 정리됨 (${callbacksSize}개)`);
    }

    if (messagesSize > 100) {
      this.processingMessages.clear();
      logger.warn(`🧹 ModuleManager 메시지 처리 맵 정리됨 (${messagesSize}개)`);
    }
  }

  /**
   * 📊 초기화 시간 통계 업데이트
   */
  updateInitTimeStats(initTime) {
    this.stats.totalInitTime += initTime;
    const activeModules = this.stats.activeModules;

    if (activeModules > 0) {
      this.stats.averageInitTime = Math.round(
        this.stats.totalInitTime / activeModules
      );
    }
  }

  /**
   * 📊 응답 시간 통계 업데이트
   */
  updateResponseTimeStats(responseTime) {
    this.stats.totalResponseTime += responseTime;
    const totalRequests =
      this.stats.callbacksHandled + this.stats.messagesHandled;

    if (totalRequests > 0) {
      this.stats.averageResponseTime = Math.round(
        this.stats.totalResponseTime / totalRequests
      );
    }
  }

  // ===== 🔄 모듈 생명주기 관리 =====

  /**
   * 🔄 모듈 재시작
   */
  async restartModule(moduleKey) {
    try {
      logger.info(`🔄 ${moduleKey} 모듈 재시작 중...`);

      // 기존 인스턴스 정리
      await this.stopModule(moduleKey);

      // 다시 초기화
      await this.initializeModule(moduleKey);

      logger.success(`✅ ${moduleKey} 모듈 재시작 완료`);
      return true;
    } catch (error) {
      logger.error(`❌ ${moduleKey} 모듈 재시작 실패:`, error);
      return false;
    }
  }

  /**
   * 🛑 모듈 중지
   */
  async stopModule(moduleKey) {
    try {
      const moduleInstance = this.moduleInstances.get(moduleKey);
      const moduleConfig = this.moduleRegistry.get(moduleKey);

      if (moduleInstance) {
        // 정리 메서드 호출
        if (typeof moduleInstance.cleanup === "function") {
          await moduleInstance.cleanup();
        }

        // 인스턴스 제거
        this.moduleInstances.delete(moduleKey);
        this.stats.activeModules--;
      }

      if (moduleConfig) {
        moduleConfig.initialized = false;
        moduleConfig.initializedAt = null;
      }

      logger.info(`🛑 ${moduleKey} 모듈 중지됨`);
      return true;
    } catch (error) {
      logger.error(`❌ ${moduleKey} 모듈 중지 실패:`, error);
      return false;
    }
  }

  /**
   * 🔄 모든 모듈 재시작
   */
  async restartAllModules() {
    try {
      logger.info("🔄 모든 모듈 재시작 중...");

      // 모든 모듈 중지
      const moduleKeys = Array.from(this.moduleInstances.keys());
      for (const moduleKey of moduleKeys) {
        await this.stopModule(moduleKey);
      }

      // 모든 모듈 재시작
      await this.initializeAllModules();

      logger.success("✅ 모든 모듈 재시작 완료");
      return true;
    } catch (error) {
      logger.error("❌ 모든 모듈 재시작 실패:", error);
      return false;
    }
  }

  // ===== 📊 상태 및 통계 =====

  /**
   * 📊 ModuleManager 상태 조회
   */
  getStatus() {
    return {
      className: "ModuleManager",
      version: "3.0.1",
      isInitialized: this.isInitialized,
      stats: {
        ...this.stats,
        processing: {
          callbacks: this.processingCallbacks.size,
          messages: this.processingMessages.size,
        },
      },
      modules: {
        registered: this.moduleRegistry.size,
        instances: this.moduleInstances.size,
        active: this.getActiveModules(),
        initializing: Array.from(this.initializingModules),
      },
      config: this.config,
      lastActivity: this.stats.lastActivity,
    };
  }

  /**
   * 📊 상세 모듈 상태 텍스트 생성
   */
  generateStatusText() {
    const status = this.getStatus();

    let text = `📦 **ModuleManager v3.0.1 상태**\n\n`;

    text += `**🔧 시스템 상태**:\n`;
    text += `• 초기화: ${status.isInitialized ? "✅" : "❌"}\n`;
    text += `• 등록된 모듈: ${status.stats.totalModules}개\n`;
    text += `• 활성 모듈: ${status.stats.activeModules}개\n`;
    text += `• 실패 모듈: ${status.stats.failedModules}개\n\n`;

    text += `**📊 처리 통계**:\n`;
    text += `• 콜백 처리: ${status.stats.callbacksHandled}회\n`;
    text += `• 메시지 처리: ${status.stats.messagesHandled}회\n`;
    text += `• 평균 응답: ${status.stats.averageResponseTime}ms\n`;
    text += `• 평균 초기화: ${status.stats.averageInitTime}ms\n`;
    text += `• 에러: ${status.stats.errorsCount}개\n\n`;

    text += `**⚡ 현재 처리**:\n`;
    text += `• 콜백: ${status.stats.processing.callbacks}개\n`;
    text += `• 메시지: ${status.stats.processing.messages}개\n\n`;

    // 활성 모듈 목록
    if (status.modules.active.length > 0) {
      text += `**📋 활성 모듈**:\n`;
      const activeModules = this.getActiveModulesStatus();
      activeModules.forEach((module) => {
        text += `• ${module.name} (${module.key})\n`;
      });
    }

    return text;
  }

  /**
   * 🧮 모듈별 통계 조회
   */
  getModuleStats() {
    const stats = {};

    for (const [key, instance] of this.moduleInstances.entries()) {
      if (instance.getStatus && typeof instance.getStatus === "function") {
        stats[key] = instance.getStatus();
      }
    }

    return stats;
  }

  // ===== 🛑 정리 작업 =====

  /**
   * 🛑 ModuleManager 정리
   */
  async cleanup() {
    try {
      logger.info("🛑 ModuleManager 정리 시작...");

      // 정리 타이머 중지
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // 모든 모듈 정리
      const moduleKeys = Array.from(this.moduleInstances.keys());
      for (const moduleKey of moduleKeys) {
        await this.stopModule(moduleKey);
      }

      // 처리 맵 정리
      this.processingCallbacks.clear();
      this.processingMessages.clear();
      this.initializingModules.clear();

      // 레지스트리 정리
      this.moduleRegistry.clear();
      this.moduleInstances.clear();

      // 통계 초기화
      this.stats = {
        totalModules: 0,
        activeModules: 0,
        failedModules: 0,
        callbacksHandled: 0,
        messagesHandled: 0,
        errorsCount: 0,
        averageInitTime: 0,
        totalInitTime: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
        lastActivity: null,
      };

      this.isInitialized = false;
      logger.success("✅ ModuleManager 정리 완료");
    } catch (error) {
      logger.error("❌ ModuleManager 정리 실패:", error);
    }
  }

  // ===== 🔧 고급 기능들 =====

  /**
   * 🔍 모듈 검색
   */
  findModules(searchTerm) {
    const results = [];

    for (const [key, config] of this.moduleRegistry.entries()) {
      if (
        key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.description.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        results.push({
          key,
          ...config,
          isActive: this.moduleInstances.has(key),
        });
      }
    }

    return results;
  }

  /**
   * 📊 성능 분석
   */
  getPerformanceAnalysis() {
    const modules = this.getActiveModulesStatus();
    const analysis = {
      totalModules: modules.length,
      averageResponseTime: this.stats.averageResponseTime,
      totalRequests: this.stats.callbacksHandled + this.stats.messagesHandled,
      errorRate:
        this.stats.errorsCount /
        Math.max(1, this.stats.callbacksHandled + this.stats.messagesHandled),
      modulePerformance: [],
    };

    // 각 모듈의 성능 정보 수집
    for (const module of modules) {
      if (module.status && module.status.stats) {
        analysis.modulePerformance.push({
          key: module.key,
          name: module.name,
          requests:
            (module.status.stats.callbacksHandled || 0) +
            (module.status.stats.messagesHandled || 0),
          errors: module.status.stats.errorsCount || 0,
          averageResponseTime: module.status.stats.averageResponseTime || 0,
        });
      }
    }

    return analysis;
  }

  /**
   * 🔧 모듈 설정 업데이트
   */
  updateModuleConfig(moduleKey, newConfig) {
    try {
      const moduleConfig = this.moduleRegistry.get(moduleKey);
      if (!moduleConfig) {
        throw new Error(`모듈을 찾을 수 없습니다: ${moduleKey}`);
      }

      // 설정 병합
      moduleConfig.config = { ...moduleConfig.config, ...newConfig };

      // 활성 인스턴스가 있으면 설정 업데이트
      const moduleInstance = this.moduleInstances.get(moduleKey);
      if (moduleInstance && typeof moduleInstance.updateConfig === "function") {
        moduleInstance.updateConfig(moduleConfig.config);
      }

      logger.info(`🔧 ${moduleKey} 설정 업데이트됨`);
      return true;
    } catch (error) {
      logger.error(`❌ ${moduleKey} 설정 업데이트 실패:`, error);
      return false;
    }
  }

  /**
   * 💾 모듈 상태 내보내기
   */
  exportModuleStates() {
    const states = {
      timestamp: TimeHelper.getTimestamp(),
      moduleManager: this.getStatus(),
      modules: {},
    };

    for (const [key, instance] of this.moduleInstances.entries()) {
      if (instance.getStatus && typeof instance.getStatus === "function") {
        states.modules[key] = instance.getStatus();
      }
    }

    return states;
  }
  /**
   * 🏗️ ServiceBuilder 설정 (ModuleManager 생성자에 추가)
   */
  setServiceBuilder(serviceBuilder) {
    this.serviceBuilder = serviceBuilder;
    logger.debug("🏗️ ServiceBuilder 연결됨");
  }

  /**
   * 🔍 ServiceBuilder 가져오기
   */
  getServiceBuilder() {
    return this.serviceBuilder;
  }
}
// 싱글톤 인스턴스
let moduleManagerInstance = null;

/**
 * ModuleManager 인스턴스 생성 또는 반환
 */
function createModuleManager(config = {}) {
  if (!moduleManagerInstance) {
    moduleManagerInstance = new ModuleManager(config);
  }
  return moduleManagerInstance;
}

module.exports = { ModuleManager, createModuleManager };
