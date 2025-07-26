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
  async create(serviceName, options = {}) {
    try {
      const registration = this.serviceRegistry.get(serviceName);

      if (!registration) {
        throw new Error(`서비스 '${serviceName}'이 등록되지 않음`);
      }

      const { ServiceClass } = registration;

      // 🎯 서비스별 매개변수 자동 설정
      let serviceInstance;

      switch (serviceName) {
        case "todo":
          // TodoService는 db 매개변수 필요
          serviceInstance = new ServiceClass(options.db || this.defaultDb);
          break;

        case "worktime":
          // WorktimeService는 db 매개변수 필요
          serviceInstance = new ServiceClass(options.db || this.defaultDb);
          break;

        case "reminder":
          // ReminderService는 매개변수 없음
          serviceInstance = new ServiceClass();
          break;

        case "fortune":
          // 운세는 매개변수 없음
          serviceInstance = new ServiceClass();
          break;

        case "tts":
          // TTSService는 매개변수 없음
          serviceInstance = new ServiceClass();
          break;

        case "timer":
          // TimerService는 db 매개변수 필요
          serviceInstance = new ServiceClass(options.db || this.defaultDb);
          break;

        case "leave":
          // LeaveService는 db 매개변수 필요
          serviceInstance = new ServiceClass(options.db || this.defaultDb);
          break;

        case "weather":
          // 날씨는 db 매개변수 필요
          serviceInstance = new ServiceClass(options.db || this.defaultDb);
          break;

        case "insight":
          // 인사이트 db 매개변수 필요
          serviceInstance = new ServiceClass(options.db || this.defaultDb);
          break;

        default:
          // 기본: 매개변수 없이 생성 시도
          try {
            serviceInstance = new ServiceClass();
          } catch (noParamError) {
            // 실패 시 db 매개변수로 재시도
            serviceInstance = new ServiceClass(options.db || this.defaultDb);
          }
      }

      // 🎯 서비스 초기화
      if (serviceInstance && typeof serviceInstance.initialize === "function") {
        await serviceInstance.initialize();
      }

      // 캐싱 설정
      if (this.config.enableCaching) {
        this.serviceInstances.set(serviceName, serviceInstance);
      }

      this.stats.totalCreated++;
      logger.success(`✅ 서비스 생성 성공: ${serviceName}`);

      return serviceInstance;
    } catch (error) {
      logger.error(`❌ 서비스 생성 실패 (${serviceName}):`, error);
      this.stats.totalErrors++;

      // 🛡️ Mock 서비스 반환 (크래시 방지)
      return this.createMockService(serviceName);
    }
  }

  /**
   * 🎭 Mock 서비스 생성 (오류 방지용)
   */
  createMockService(serviceName) {
    const mockService = {
      serviceName,
      status: "mock",
      isInitialized: true,

      // 기본 메서드들
      async initialize() {
        return true;
      },
      async getStatus() {
        return "mock_active";
      },
      async cleanup() {
        return true;
      },

      // 서비스별 Mock 메서드
      ...this.getServiceSpecificMocks(serviceName),
    };

    logger.warn(`🎭 Mock 서비스 생성: ${serviceName}`);
    return mockService;
  }

  /**
   * 🎯 서비스별 Mock 메서드 정의
   */
  getServiceSpecificMocks(serviceName) {
    const mocks = {
      todo: {
        async getTodos() {
          return [];
        },
        async addTodo() {
          return { id: "mock", success: false, message: "Mock 서비스" };
        },
        async updateTodo() {
          return { success: false, message: "Mock 서비스" };
        },
        async deleteTodo() {
          return { success: false, message: "Mock 서비스" };
        },
      },

      worktime: {
        async getTodayRecord() {
          return null;
        },
        async checkin() {
          return { success: false, message: "Mock 서비스" };
        },
        async checkout() {
          return { success: false, message: "Mock 서비스" };
        },
        async getRecentHistory() {
          return [];
        },
      },

      reminder: {
        async addReminder() {
          return { success: false, message: "Mock 서비스" };
        },
        async getReminders() {
          return [];
        },
        async deleteReminder() {
          return { success: false, message: "Mock 서비스" };
        },
        async parseReminderCommand() {
          return { success: false, message: "Mock 서비스" };
        },
      },

      tts: {
        async convertTextToSpeech() {
          return { success: false, message: "Mock 서비스" };
        },
        async stopTTS() {
          return { success: false, message: "Mock 서비스" };
        },
        getSupportedLanguages() {
          return {};
        },
      },

      timer: {
        async startTimer() {
          return { success: false, message: "Mock 서비스" };
        },
        async stopTimer() {
          return { success: false, message: "Mock 서비스" };
        },
        async getActiveTimers() {
          return [];
        },
      },
    };

    return mocks[serviceName] || {};
  }

  /**
   * 🔧 기본 DB 연결 설정
   */
  setDefaultDatabase(db) {
    this.defaultDb = db;
    logger.info("🔧 ServiceBuilder에 기본 DB 설정됨");
  }

  /**
   * 🔍 서비스 조회 (느슨한 연결)
   */
  get(serviceName) {
    try {
      if (!serviceName) {
        throw new Error("서비스명이 필요합니다");
      }

      // 캐시된 인스턴스 확인
      if (this.serviceInstances.has(serviceName)) {
        const instance = this.serviceInstances.get(serviceName);

        // 헬스 체크
        if (this.isServiceHealthy(instance)) {
          return instance;
        } else {
          // 비정상 인스턴스 제거
          this.serviceInstances.delete(serviceName);
          logger.warn(`🧹 비정상 서비스 인스턴스 제거: ${serviceName}`);
          return null;
        }
      }

      return null;
    } catch (error) {
      logger.error(`❌ 서비스 조회 실패 (${serviceName}):`, error);
      return null;
    }
  }

  /**
   * 🏥 서비스 헬스 체크
   */
  isServiceHealthy(service) {
    try {
      if (!service) return false;

      // 기본 헬스 체크
      if (typeof service.getStatus === "function") {
        const status = service.getStatus();
        return status.isConnected !== false;
      }

      // 서비스가 존재하면 일단 정상으로 간주
      return true;
    } catch (error) {
      logger.debug(`헬스 체크 실패:`, error);
      return false;
    }
  }

  /**
   * 🔍 자동 서비스 등록
   */
  async autoRegisterServices() {
    try {
      logger.info("🔍 서비스 자동 등록 시작...");

      const fs = require("fs");
      const path = require("path");

      // services 디렉토리 경로
      const servicesDir = path.join(__dirname, "..", "services");

      // 디렉토리 존재 확인
      if (!fs.existsSync(servicesDir)) {
        logger.warn(`⚠️ services 디렉토리가 없음: ${servicesDir}`);
        return;
      }

      // 서비스 파일들 읽기
      const files = fs.readdirSync(servicesDir);
      let registeredCount = 0;

      for (const file of files) {
        // BaseService.js는 제외
        if (file === "BaseService.js" || !file.endsWith("Service.js")) {
          continue;
        }

        try {
          // 서비스 클래스 로드
          const ServiceClass = require(path.join(servicesDir, file));

          // 서비스명 추출 (예: TodoService.js -> todo)
          const serviceName = file.replace("Service.js", "").toLowerCase();

          // 서비스 등록
          this.register(serviceName, ServiceClass, {
            autoRegistered: true,
            priority: 5,
          });

          registeredCount++;
          logger.debug(`📝 자동 등록: ${serviceName}`);
        } catch (error) {
          logger.error(`❌ 서비스 자동 등록 실패 (${file}):`, error);
        }
      }

      logger.info(`✅ ${registeredCount}개 서비스 자동 등록 완료`);
    } catch (error) {
      logger.error("❌ 서비스 자동 등록 중 오류:", error);
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
   * 🔗 의존성 그래프 업데이트
   */
  updateDependencyGraph(serviceName, dependencies) {
    // 서비스의 의존성 저장
    this.dependencyGraph.set(serviceName, dependencies);

    // 역방향 의존성도 추적 (누가 이 서비스를 사용하는지)
    for (const dep of dependencies) {
      if (!this.dependencyGraph.has(`_reverse_${dep}`)) {
        this.dependencyGraph.set(`_reverse_${dep}`, new Set());
      }
      this.dependencyGraph.get(`_reverse_${dep}`).add(serviceName);
    }
  }

  /**
   * 🌀 순환 의존성 체크
   */
  hasCircularDependency(serviceName, targetDependency, visited = new Set()) {
    if (serviceName === targetDependency) {
      return true;
    }

    if (visited.has(serviceName)) {
      return false;
    }

    visited.add(serviceName);

    const dependencies = this.dependencyGraph.get(serviceName) || [];
    for (const dep of dependencies) {
      if (this.hasCircularDependency(dep, targetDependency, visited)) {
        return true;
      }
    }

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
      const serviceList = [
        { name: "todo", path: "../services/TodoService", required: false },
        { name: "timer", path: "../services/TimerService", required: false },
        {
          name: "worktime",
          path: "../services/WorktimeService",
          required: false,
        },
        { name: "leave", path: "../services/LeaveService", required: true }, // LeaveService는 작동함
        {
          name: "reminder",
          path: "../services/ReminderService",
          required: false,
        },
        {
          name: "fortune",
          path: "../services/FortuneService",
          required: false,
        },
        {
          name: "weather",
          path: "../services/WeatherService",
          required: false,
        },
        { name: "tts", path: "../services/TTSService", required: false },
      ];

      let successCount = 0;
      let failCount = 0;

      for (const service of serviceList) {
        try {
          const ServiceClass = require(service.path);

          this.serviceRegistry.set(service.name, {
            ServiceClass,
            path: service.path,
            required: service.required,
            registered: true,
          });

          successCount++;
          logger.debug(`✅ 서비스 등록: ${service.name}`);
        } catch (error) {
          failCount++;
          logger.warn(
            `⚠️ 서비스 등록 실패: ${service.name} - ${error.message}`
          );

          // 🎭 실패한 서비스는 Mock으로 등록
          this.serviceRegistry.set(service.name, {
            ServiceClass: null,
            path: service.path,
            required: service.required,
            registered: false,
            mock: true,
          });
        }
      }

      this.stats.totalRegistered = successCount;

      logger.info(
        `🔍 자동 등록 완료: ${successCount}개 성공, ${failCount}개 실패 (Mock 대체)`
      );

      return { success: successCount, failed: failCount };
    } catch (error) {
      logger.error("❌ 자동 서비스 등록 실패:", error);
      throw error;
    }
  }

  /**
   * 🎯 안전한 서비스 요청 (get 메서드 개선)
   */
  async get(serviceName, options = {}) {
    try {
      // 캐시된 인스턴스 확인
      if (this.config.enableCaching && this.serviceInstances.has(serviceName)) {
        const cachedService = this.serviceInstances.get(serviceName);
        this.stats.cacheHits++;
        return cachedService;
      }

      this.stats.cacheMisses++;

      // 새로 생성
      return await this.create(serviceName, options);
    } catch (error) {
      logger.error(`❌ 서비스 요청 실패 (${serviceName}):`, error);

      // 🎭 Mock 서비스 반환
      return this.createMockService(serviceName);
    }
  }

  /**
   * 🧹 정리 스케줄러 시작
   */
  startCleanupScheduler() {
    try {
      // 기존 타이머 정리
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }

      // 새 타이머 설정
      this.cleanupTimer = setInterval(() => {
        this.performCleanup();
      }, this.config.cleanupInterval);

      logger.debug(
        `🧹 ServiceBuilder 정리 스케줄러 시작 (${this.config.cleanupInterval}ms 간격)`
      );
    } catch (error) {
      logger.error("❌ 정리 스케줄러 시작 실패:", error);
    }
  }

  /**
   * 🧹 정리 작업 수행
   */
  async performCleanup() {
    try {
      logger.debug("🧹 ServiceBuilder 정리 작업 시작...");

      let cleanedCount = 0;
      const now = Date.now();

      // 비정상 서비스 인스턴스 정리
      for (const [serviceName, instance] of this.serviceInstances) {
        if (!this.isServiceHealthy(instance)) {
          this.serviceInstances.delete(serviceName);
          cleanedCount++;
          logger.debug(`🧹 비정상 서비스 제거: ${serviceName}`);
        }
      }

      // 통계 업데이트
      this.updateHealthStats();

      if (cleanedCount > 0) {
        logger.info(`🧹 ${cleanedCount}개 비정상 서비스 정리 완료`);
      }
    } catch (error) {
      logger.error("❌ 정리 작업 중 오류:", error);
    }
  }

  /**
   * 📊 헬스 통계 업데이트
   */
  updateHealthStats() {
    let healthyCount = 0;
    let unhealthyCount = 0;

    for (const [serviceName, instance] of this.serviceInstances) {
      if (this.isServiceHealthy(instance)) {
        healthyCount++;
      } else {
        unhealthyCount++;
      }
    }

    this.stats.healthyServices = healthyCount;
    this.stats.unhealthyServices = unhealthyCount;
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

      // 타이머 정리
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      // 모든 서비스 정리
      for (const [serviceName, instance] of this.serviceInstances) {
        try {
          if (instance && typeof instance.cleanup === "function") {
            await instance.cleanup();
          }
        } catch (error) {
          logger.error(`❌ 서비스 정리 실패 (${serviceName}):`, error);
        }
      }

      // 인스턴스 제거
      this.serviceInstances.clear();
      this.serviceRegistry.clear();
      this.dependencyGraph.clear();

      // 상태 초기화
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
