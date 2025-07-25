// src/core/ServiceBuilder.js - 서비스 중앙 관리 시스템 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏗️ ServiceBuilder v3.0.1 - 서비스 중앙 관리 시스템
 *
 * 📋 핵심 책임:
 * 1. 기초공사: 서비스 등록, 표준 의존성 주입, 초기화 순서 관리
 * 2. 중앙 관리: 서비스 생성/캐싱, 상태 추적, 연결 관리
 * 3. 느슨한 연결: 모듈과 서비스 간 의존성 분리
 *
 * 🎯 사용법:
 * - ServiceBuilder.register('todo', TodoService)
 * - ServiceBuilder.create('todo', db, options)
 * - ServiceBuilder.get('todo') // 기존 인스턴스 반환
 */
class ServiceBuilder {
  constructor() {
    // 🗂️ 서비스 레지스트리 (서비스 클래스 등록소)
    this.serviceRegistry = new Map();

    // 🏭 서비스 인스턴스 팩토리 (생성된 인스턴스들)
    this.serviceInstances = new Map();

    // 🔗 의존성 그래프 (서비스 간 의존성 관계)
    this.dependencyGraph = new Map();

    // ⚙️ 설정
    this.config = {
      enableCaching: process.env.SERVICE_CACHE_ENABLED !== "false",
      maxRetries: parseInt(process.env.SERVICE_MAX_RETRIES) || 3,
      timeout: parseInt(process.env.SERVICE_TIMEOUT) || 30000,
      enableHealthCheck: process.env.SERVICE_HEALTH_CHECK === "true",
      cleanupInterval: parseInt(process.env.SERVICE_CLEANUP_INTERVAL) || 300000, // 5분
    };

    // 📊 통계 및 상태 관리
    this.stats = {
      totalRegistered: 0,
      totalCreated: 0,
      totalErrors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageCreationTime: 0,
      lastActivity: null,
      healthyServices: 0,
      unhealthyServices: 0,
    };

    // 🔄 초기화 상태
    this.isInitialized = false;
    this.initializationInProgress = false;

    // 🧹 정리 스케줄러
    this.cleanupTimer = null;

    logger.info("🏗️ ServiceBuilder v3.0.1 생성됨");
  }

  /**
   * 🎯 ServiceBuilder 초기화
   */
  async initialize() {
    if (this.initializationInProgress || this.isInitialized) {
      logger.debug("ServiceBuilder 이미 초기화됨");
      return;
    }

    this.initializationInProgress = true;

    try {
      logger.info("🎯 ServiceBuilder 초기화 시작...");

      // 기본 서비스들 자동 등록
      await this.autoRegisterServices();

      // 정리 스케줄러 시작
      if (this.config.enableHealthCheck) {
        this.startCleanupScheduler();
      }

      this.isInitialized = true;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      logger.success(
        `✅ ServiceBuilder 초기화 완료 (${this.stats.totalRegistered}개 서비스 등록)`
      );
    } catch (error) {
      logger.error("❌ ServiceBuilder 초기화 실패:", error);
      throw error;
    } finally {
      this.initializationInProgress = false;
    }
  }

  /**
   * 📝 서비스 등록 (기초공사)
   */
  register(serviceName, ServiceClass, options = {}) {
    try {
      // 입력 검증
      if (!serviceName || typeof serviceName !== "string") {
        throw new Error("서비스명은 문자열이어야 합니다");
      }

      if (!ServiceClass || typeof ServiceClass !== "function") {
        throw new Error("ServiceClass는 클래스여야 합니다");
      }

      // 중복 등록 체크
      if (this.serviceRegistry.has(serviceName)) {
        logger.warn(`⚠️ 서비스 재등록: ${serviceName}`);
      }

      // 서비스 메타데이터 생성
      const serviceMetadata = {
        ServiceClass,
        serviceName,
        registeredAt: TimeHelper.getTimestamp(),
        priority: options.priority || 5,
        dependencies: options.dependencies || [],
        required: options.required || false,
        singleton: options.singleton !== false, // 기본값: true
        config: options.config || {},
        ...options,
      };

      // 레지스트리에 등록
      this.serviceRegistry.set(serviceName, serviceMetadata);

      // 의존성 그래프 업데이트
      this.updateDependencyGraph(serviceName, serviceMetadata.dependencies);

      this.stats.totalRegistered++;
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      logger.debug(
        `📝 서비스 등록 완료: ${serviceName} (우선순위: ${serviceMetadata.priority})`
      );

      return true;
    } catch (error) {
      logger.error(`❌ 서비스 등록 실패 (${serviceName}):`, error);
      this.stats.totalErrors++;
      throw error;
    }
  }

  /**
   * 🏭 서비스 생성 (중앙 관리)
   */
  async create(serviceName, db, options = {}) {
    const startTime = Date.now();

    try {
      // 입력 검증
      if (!serviceName) {
        throw new Error("서비스명이 필요합니다");
      }

      // 캐시된 인스턴스 확인 (싱글톤)
      if (this.config.enableCaching && this.serviceInstances.has(serviceName)) {
        const cachedInstance = this.serviceInstances.get(serviceName);
        if (cachedInstance && this.isServiceHealthy(cachedInstance)) {
          this.stats.cacheHits++;
          logger.debug(`🎯 캐시된 서비스 반환: ${serviceName}`);
          return cachedInstance;
        } else {
          // 비정상 인스턴스 제거
          this.serviceInstances.delete(serviceName);
          logger.warn(`🧹 비정상 서비스 인스턴스 제거: ${serviceName}`);
        }
      }

      this.stats.cacheMisses++;

      // 서비스 메타데이터 조회
      const serviceMetadata = this.serviceRegistry.get(serviceName);
      if (!serviceMetadata) {
        throw new Error(`등록되지 않은 서비스: ${serviceName}`);
      }

      logger.debug(`🏭 서비스 생성 시작: ${serviceName}`);

      // 의존성 해결
      const resolvedDependencies = await this.resolveDependencies(
        serviceName,
        db,
        options
      );

      // 서비스 인스턴스 생성
      const serviceInstance = await this.createServiceInstance(
        serviceMetadata,
        db,
        {
          ...options,
          dependencies: resolvedDependencies,
        }
      );

      // 초기화
      if (
        serviceInstance.initialize &&
        typeof serviceInstance.initialize === "function"
      ) {
        await serviceInstance.initialize();
      }

      // 캐싱 (싱글톤인 경우)
      if (serviceMetadata.singleton && this.config.enableCaching) {
        this.serviceInstances.set(serviceName, serviceInstance);
      }

      // 통계 업데이트
      this.stats.totalCreated++;
      this.updateCreationTimeStats(Date.now() - startTime);
      this.stats.lastActivity = TimeHelper.getLogTimeString();

      logger.debug(
        `✅ 서비스 생성 완료: ${serviceName} (${Date.now() - startTime}ms)`
      );

      return serviceInstance;
    } catch (error) {
      logger.error(`❌ 서비스 생성 실패 (${serviceName}):`, error);
      this.stats.totalErrors++;
      throw error;
    }
  }

  /**
   * 🔍 서비스 조회 (느슨한 연결)
   */
  get(serviceName) {
    try {
      if (!this.serviceInstances.has(serviceName)) {
        logger.warn(`⚠️ 서비스 인스턴스를 찾을 수 없음: ${serviceName}`);
        return null;
      }

      const instance = this.serviceInstances.get(serviceName);

      // 헬스체크
      if (!this.isServiceHealthy(instance)) {
        logger.warn(`🏥 비정상 서비스 감지: ${serviceName}`);
        this.serviceInstances.delete(serviceName);
        return null;
      }

      this.stats.cacheHits++;
      return instance;
    } catch (error) {
      logger.error(`❌ 서비스 조회 실패 (${serviceName}):`, error);
      return null;
    }
  }

  /**
   * 📦 여러 서비스 한번에 등록
   */
  registerBatch(services) {
    const results = {
      success: [],
      failed: [],
    };

    // 우선순위 순으로 정렬
    const sortedServices = Object.entries(services).sort((a, b) => {
      const priorityA = a[1].priority || 5;
      const priorityB = b[1].priority || 5;
      return priorityA - priorityB;
    });

    for (const [serviceName, config] of sortedServices) {
      try {
        this.register(serviceName, config.ServiceClass, config.options);
        results.success.push(serviceName);
      } catch (error) {
        results.failed.push({ serviceName, error: error.message });
        logger.error(`❌ 배치 등록 실패: ${serviceName}`, error);
      }
    }

    logger.info(
      `📦 배치 등록 완료: 성공 ${results.success.length}개, 실패 ${results.failed.length}개`
    );

    return results;
  }

  // ===== 🔧 내부 헬퍼 메서드들 =====

  /**
   * 🔗 의존성 해결
   */
  async resolveDependencies(serviceName, db, options) {
    const serviceMetadata = this.serviceRegistry.get(serviceName);
    const resolvedDependencies = {};

    if (
      !serviceMetadata.dependencies ||
      serviceMetadata.dependencies.length === 0
    ) {
      return resolvedDependencies;
    }

    logger.debug(
      `🔗 의존성 해결 중: ${serviceName} -> [${serviceMetadata.dependencies.join(
        ", "
      )}]`
    );

    for (const dependencyName of serviceMetadata.dependencies) {
      try {
        // 순환 의존성 체크
        if (this.hasCircularDependency(serviceName, dependencyName)) {
          throw new Error(
            `순환 의존성 감지: ${serviceName} <-> ${dependencyName}`
          );
        }

        // 의존성 서비스 생성 또는 조회
        let dependencyInstance = this.get(dependencyName);
        if (!dependencyInstance) {
          dependencyInstance = await this.create(dependencyName, db, options);
        }

        resolvedDependencies[dependencyName] = dependencyInstance;
      } catch (error) {
        logger.error(
          `❌ 의존성 해결 실패: ${serviceName} -> ${dependencyName}`,
          error
        );
        throw error;
      }
    }

    return resolvedDependencies;
  }

  /**
   * 🏭 서비스 인스턴스 실제 생성
   */
  async createServiceInstance(serviceMetadata, db, options) {
    const { ServiceClass, serviceName } = serviceMetadata;

    try {
      // 표준 의존성 주입
      const serviceOptions = {
        db,
        config: {
          ...serviceMetadata.config,
          ...options.config,
        },
        dependencies: options.dependencies || {},
        serviceName,
        serviceMetadata,
        serviceBuilder: this,
        ...options,
      };

      // 인스턴스 생성
      const instance = new ServiceClass(serviceOptions);

      // 메타데이터 추가
      instance._serviceMetadata = {
        name: serviceName,
        createdAt: TimeHelper.getTimestamp(),
        version: "3.0.1",
        builder: "ServiceBuilder",
      };

      return instance;
    } catch (error) {
      logger.error(`❌ 서비스 인스턴스 생성 실패: ${serviceName}`, error);
      throw error;
    }
  }

  /**
   * 🔄 의존성 그래프 업데이트
   */
  updateDependencyGraph(serviceName, dependencies) {
    this.dependencyGraph.set(serviceName, dependencies || []);
  }

  /**
   * 🌀 순환 의존성 체크
   */
  hasCircularDependency(serviceA, serviceB, visited = new Set()) {
    if (visited.has(serviceA)) {
      return true;
    }

    visited.add(serviceA);

    const dependencies = this.dependencyGraph.get(serviceA) || [];

    for (const dependency of dependencies) {
      if (
        dependency === serviceB ||
        this.hasCircularDependency(dependency, serviceB, visited)
      ) {
        return true;
      }
    }

    visited.delete(serviceA);
    return false;
  }

  /**
   * 🏥 서비스 헬스체크
   */
  isServiceHealthy(serviceInstance) {
    if (!serviceInstance) return false;

    try {
      // 기본 헬스체크
      if (
        serviceInstance.getStatus &&
        typeof serviceInstance.getStatus === "function"
      ) {
        const status = serviceInstance.getStatus();
        return status && status.isConnected !== false;
      }

      // 최소한의 체크
      return serviceInstance.db && serviceInstance.collection;
    } catch (error) {
      logger.debug(`🏥 헬스체크 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 📊 생성 시간 통계 업데이트
   */
  updateCreationTimeStats(creationTime) {
    if (this.stats.averageCreationTime === 0) {
      this.stats.averageCreationTime = creationTime;
    } else {
      // 지수 평활법
      this.stats.averageCreationTime =
        this.stats.averageCreationTime * 0.9 + creationTime * 0.1;
    }
  }

  /**
   * 🔍 기본 서비스 자동 등록
   */
  async autoRegisterServices() {
    try {
      const serviceConfigs = {
        todo: {
          ServiceClass: require("../services/TodoService"),
          options: { priority: 1, required: true },
        },
        timer: {
          ServiceClass: require("../services/TimerService"),
          options: { priority: 2, required: true },
        },
        worktime: {
          ServiceClass: require("../services/WorktimeService"),
          options: { priority: 3, required: true },
        },
        leave: {
          ServiceClass: require("../services/LeaveService"),
          options: { priority: 4, required: true },
        },
        reminder: {
          ServiceClass: require("../services/ReminderService"),
          options: { priority: 5, required: false },
        },
        fortune: {
          ServiceClass: require("../services/FortuneService"),
          options: { priority: 6, required: false },
        },
        weather: {
          ServiceClass: require("../services/WeatherService"),
          options: { priority: 7, required: false },
        },
        tts: {
          ServiceClass: require("../services/TTSService"),
          options: { priority: 8, required: false },
        },
      };

      const results = this.registerBatch(serviceConfigs);

      logger.info(
        `🔍 자동 등록 완료: ${results.success.length}개 성공, ${results.failed.length}개 실패`
      );

      if (results.failed.length > 0) {
        logger.warn(
          "⚠️ 자동 등록 실패 서비스들:",
          results.failed.map((f) => f.serviceName)
        );
      }
    } catch (error) {
      logger.error("❌ 자동 서비스 등록 실패:", error);
    }
  }

  /**
   * 🧹 정리 스케줄러 시작
   */
  startCleanupScheduler() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.cleanupInterval);

    logger.debug("🧹 ServiceBuilder 정리 스케줄러 시작됨");
  }

  /**
   * 🏥 헬스체크 수행
   */
  performHealthCheck() {
    try {
      let healthyCount = 0;
      let unhealthyCount = 0;

      for (const [serviceName, instance] of this.serviceInstances) {
        if (this.isServiceHealthy(instance)) {
          healthyCount++;
        } else {
          unhealthyCount++;
          this.serviceInstances.delete(serviceName);
          logger.warn(`🧹 비정상 서비스 인스턴스 제거: ${serviceName}`);
        }
      }

      this.stats.healthyServices = healthyCount;
      this.stats.unhealthyServices = unhealthyCount;

      if (unhealthyCount > 0) {
        logger.info(
          `🏥 헬스체크 완료: 정상 ${healthyCount}개, 제거 ${unhealthyCount}개`
        );
      }
    } catch (error) {
      logger.error("❌ 헬스체크 수행 실패:", error);
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    const registeredServices = Array.from(this.serviceRegistry.keys());
    const activeServices = Array.from(this.serviceInstances.keys());

    return {
      initialized: this.isInitialized,
      config: this.config,
      stats: this.stats,
      services: {
        registered: registeredServices,
        active: activeServices,
        registeredCount: registeredServices.length,
        activeCount: activeServices.length,
      },
      dependencyGraph: Object.fromEntries(this.dependencyGraph),
      lastActivity: this.stats.lastActivity,
    };
  }

  /**
   * 🔍 서비스 상세 정보
   */
  getServiceDetails(serviceName) {
    const metadata = this.serviceRegistry.get(serviceName);
    const instance = this.serviceInstances.get(serviceName);

    if (!metadata) {
      return { error: `서비스를 찾을 수 없음: ${serviceName}` };
    }

    return {
      metadata,
      hasInstance: !!instance,
      instanceStatus: instance ? this.isServiceHealthy(instance) : null,
      dependencies: this.dependencyGraph.get(serviceName) || [],
      instanceMetadata: instance?._serviceMetadata || null,
    };
  }

  /**
   * 🧹 정리
   */
  async cleanup() {
    try {
      logger.info("🧹 ServiceBuilder 정리 시작...");

      // 스케줄러 정리
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      // 서비스 인스턴스들 정리
      for (const [serviceName, instance] of this.serviceInstances) {
        try {
          if (instance.cleanup && typeof instance.cleanup === "function") {
            await instance.cleanup();
          }
          logger.debug(`✅ ${serviceName} 서비스 정리 완료`);
        } catch (error) {
          logger.error(`❌ ${serviceName} 서비스 정리 실패:`, error);
        }
      }

      // 내부 상태 정리
      this.serviceRegistry.clear();
      this.serviceInstances.clear();
      this.dependencyGraph.clear();

      this.stats = {
        totalRegistered: 0,
        totalCreated: 0,
        totalErrors: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageCreationTime: 0,
        lastActivity: null,
        healthyServices: 0,
        unhealthyServices: 0,
      };

      this.isInitialized = false;

      logger.info("✅ ServiceBuilder 정리 완료");
    } catch (error) {
      logger.error("❌ ServiceBuilder 정리 실패:", error);
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const serviceBuilder = new ServiceBuilder();

module.exports = serviceBuilder;
