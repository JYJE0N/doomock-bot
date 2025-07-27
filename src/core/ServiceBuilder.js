// src/core/ServiceBuilder.js - 서비스 중앙 관리 시스템 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const fs = require("fs");
const path = require("path");

/**
 * 🏗️ ServiceBuilder v3.0.1 - 서비스 중앙 관리 시스템
 *
 * 📋 핵심 책임:
 * 1. 기초공사: 서비스 등록, 표준 의존성 주입, 초기화 순서 관리
 * 2. 중앙 관리: 서비스 생성/캐싱, 상태 추적, 연결 관리
 * 3. 느슨한 연결: 모듈과 서비스 간 의존성 분리
 */
class ServiceBuilder {
  constructor() {
    // 🗂️ 서비스 레지스트리 (서비스 클래스 등록소)
    this.serviceRegistry = new Map();

    // 🏭 서비스 인스턴스 팩토리 (생성된 인스턴스들)
    this.serviceInstances = new Map();

    // 🔗 의존성 그래프 (서비스 간 의존성 관계)
    this.dependencyGraph = new Map();

    // 🗄️ 기본 DB 연결
    this.defaultDb = null;

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
   * 🔍 서비스 존재 확인
   */
  has(serviceName) {
    return this.serviceInstances.has(serviceName);
  }

  /**
   * 🎯 서비스 가져오기 또는 생성 (핵심 메서드!)
   */
  async getOrCreate(serviceName, options = {}) {
    try {
      // 1. 기존 인스턴스 확인
      if (this.serviceInstances.has(serviceName)) {
        this.stats.cacheHits++;
        logger.debug(`📦 기존 서비스 반환: ${serviceName}`);
        return this.serviceInstances.get(serviceName);
      }

      // 2. 새로 생성
      this.stats.cacheMisses++;
      logger.debug(`🏭 새 서비스 생성 필요: ${serviceName}`);

      return await this.create(serviceName, options);
    } catch (error) {
      logger.error(`❌ getOrCreate 실패 (${serviceName}):`, error);
      throw error;
    }
  }

  /**
   * 🏭 서비스 생성 (중앙 관리)
   */
  /**
   * 🏭 서비스 생성 (중앙 관리) - 완전 수정된 버전
   */
  async create(serviceName, options = {}) {
    try {
      const registration = this.serviceRegistry.get(serviceName);

      if (!registration) {
        throw new Error(`서비스 '${serviceName}'이 등록되지 않음`);
      }

      const { ServiceClass } = registration;
      let serviceInstance;
      const startTime = Date.now();

      try {
        // 🔧 모든 서비스에 대해 표준화된 생성자 옵션
        const dbConnection = options.db || this.defaultDb;

        const serviceOptions = {
          db: dbConnection, // 모든 서비스가 options.db로 받음
          apiKey: options.config?.apiKey, // ← API 키 전달
          config: {
            ...registration.config,
            ...options.config,
          },
        };

        // ✅ 모든 서비스를 동일한 방식으로 생성
        serviceInstance = new ServiceClass(serviceOptions);

        // 🔍 DB 연결 후처리 (TimerService 등을 위해)
        if (serviceInstance.dbManager) {
          // DatabaseManager 인스턴스가 있는 경우
          await serviceInstance.dbManager.ensureConnection();

          // ✅ 핵심: this.db에 실제 DB 연결 할당
          if (!serviceInstance.db && this.defaultDb) {
            serviceInstance.db = this.defaultDb;
          }
        }

        // 초기화 메서드가 있으면 실행
        if (typeof serviceInstance.initialize === "function") {
          await serviceInstance.initialize();
        }

        // 인스턴스 캐싱
        if (registration.singleton) {
          this.serviceInstances.set(serviceName, serviceInstance);
        }

        // 통계 업데이트
        const creationTime = Date.now() - startTime;
        this.updateCreationStats(creationTime);

        logger.success(
          `✅ ${serviceName} 서비스 생성 완료 (${creationTime}ms)`
        );

        return serviceInstance;
      } catch (error) {
        // 🎭 실패 시 Mock 서비스 생성 (개발 모드)
        if (
          process.env.NODE_ENV === "development" ||
          process.env.ENABLE_MOCK_SERVICES === "true"
        ) {
          logger.warn(`⚠️ Mock 서비스 생성: ${serviceName}`);

          const mockService = this.createMockService(
            serviceName,
            serviceOptions
          );

          if (registration.singleton) {
            this.serviceInstances.set(serviceName, mockService);
          }

          return mockService;
        }

        this.stats.totalErrors++;
        logger.error(`❌ ${serviceName} 서비스 생성 실패:`, error);
        throw error;
      }
    } catch (error) {
      logger.error(`❌ create 실패 (${serviceName}):`, error);
      throw error;
    }
  }

  /**
   * 🎭 Mock 서비스 생성기 (개발/테스트용)
   */
  createMockService(serviceName, options = {}) {
    const mockMethods = {
      initialize: async () => {
        logger.debug(`🎭 Mock ${serviceName} 초기화됨`);
      },
      cleanup: async () => {
        logger.debug(`🎭 Mock ${serviceName} 정리됨`);
      },
      // 기본적인 Mock 메서드들
      getUserStats: async () => ({ total: 0, active: 0, completed: 0 }),
      getStatus: async () => ({ isActive: false, message: "Mock 서비스" }),
      getDetailedStatus: async () => ({ status: "mock", uptime: 0 }),
    };

    // 서비스별 특화 Mock 메서드
    switch (serviceName) {
      case "timer":
        Object.assign(mockMethods, {
          startTimer: async () => ({
            success: true,
            message: "Mock 타이머 시작",
          }),
          stopTimer: async () => ({
            success: true,
            message: "Mock 타이머 정지",
          }),
          getTimerStatus: async () => ({
            isActive: false,
            message: "Mock 타이머",
          }),
        });
        break;
      case "leave":
        Object.assign(mockMethods, {
          useLeave: async () => ({ success: true, message: "Mock 연차 사용" }),
          getLeaveStatus: async () => ({ total: 15, used: 0, remaining: 15 }),
          getLeaveHistory: async () => [],
        });
        break;
      case "worktime":
        Object.assign(mockMethods, {
          checkIn: async () => ({ success: true, message: "Mock 출근" }),
          checkOut: async () => ({ success: true, message: "Mock 퇴근" }),
          getWorkStatus: async () => ({
            isWorking: false,
            message: "Mock 근무",
          }),
        });
        break;
    }

    return new Proxy(
      {},
      {
        get(target, prop) {
          if (mockMethods[prop]) {
            return mockMethods[prop];
          }
          // 정의되지 않은 메서드는 기본 응답 반환
          return async () => {
            logger.debug(`🎭 Mock ${serviceName}.${prop}() 호출됨`);
            return { success: false, message: `Mock ${serviceName} 응답` };
          };
        },
      }
    );
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
        async getTodoById() {
          return null;
        },
        async toggleTodo() {
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
      },

      tts: {
        async convertTextToSpeech() {
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
   * 🔍 자동 서비스 등록
   */
  async autoRegisterServices() {
    try {
      logger.info("🔍 서비스 자동 등록 시작...");

      const servicesDir = path.join(__dirname, "..", "services");

      // 디렉토리 존재 확인
      if (!fs.existsSync(servicesDir)) {
        logger.warn(`⚠️ services 디렉토리가 없음: ${servicesDir}`);
        return;
      }

      const files = fs.readdirSync(servicesDir);
      let registeredCount = 0;

      // 서비스 매핑 정의
      const serviceMapping = {
        "TodoService.js": { name: "todo", priority: 1, required: true },
        "WeatherService.js": { name: "weather", priority: 2, required: false },
        "ReminderService.js": {
          name: "reminder",
          priority: 3,
          required: false,
        },
        "WorktimeService.js": {
          name: "worktime",
          priority: 4,
          required: false,
        },
        "FortuneService.js": { name: "fortune", priority: 5, required: false },
        "TimerService.js": { name: "timer", priority: 6, required: false },
        "LeaveService.js": { name: "leave", priority: 7, required: false },
        "TTSService.js": { name: "tts", priority: 8, required: false },
      };

      for (const file of files) {
        // 제외할 파일들
        const excludeFiles = [
          "BaseService.js",
          "HealthService.js",
          ".DS_Store",
        ];

        if (excludeFiles.includes(file) || !file.endsWith("Service.js")) {
          continue;
        }

        try {
          // 파일이 실제로 존재하는지 확인
          const filePath = path.join(servicesDir, file);
          if (!fs.existsSync(filePath)) {
            continue;
          }

          const ServiceClass = require(filePath);
          const mapping = serviceMapping[file];

          if (mapping && ServiceClass) {
            // 서비스 등록
            this.register(mapping.name, ServiceClass, {
              priority: mapping.priority,
              required: mapping.required,
              singleton: true,
              config: {},
            });

            registeredCount++;
            logger.debug(`📝 자동 등록: ${mapping.name} (${file})`);
          } else {
            logger.warn(`⚠️ 매핑 없음: ${file}`);
          }
        } catch (error) {
          logger.error(`❌ 서비스 자동 등록 실패 (${file}):`, error);
        }
      }

      logger.success(`🎉 ${registeredCount}개 서비스 자동 등록 완료`);
    } catch (error) {
      logger.error("❌ 서비스 자동 등록 중 오류:", error);
    }
  }

  /**
   * 🔧 기본 DB 연결 설정
   */
  setDefaultDatabase(db) {
    this.defaultDb = db;
    logger.info("🔧 ServiceBuilder에 기본 DB 설정됨");
  }

  /**
   * 📊 생성 통계 업데이트
   */
  updateCreationStats(creationTime) {
    this.stats.totalCreated++;
    this.stats.averageCreationTime = Math.round(
      (this.stats.averageCreationTime * (this.stats.totalCreated - 1) +
        creationTime) /
        this.stats.totalCreated
    );
    this.stats.lastActivity = TimeHelper.getLogTimeString();
  }

  /**
   * 🔗 의존성 그래프 업데이트
   */
  updateDependencyGraph(serviceName, dependencies) {
    this.dependencyGraph.set(serviceName, dependencies);
  }

  /**
   * 🧹 정리 스케줄러 시작
   */
  startCleanupScheduler() {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    logger.debug("🧹 ServiceBuilder 정리 스케줄러 시작됨");
  }

  /**
   * 🧹 정리 작업 수행
   */
  performCleanup() {
    let cleanedCount = 0;

    for (const [serviceName, instance] of this.serviceInstances.entries()) {
      if (!this.isServiceHealthy(instance)) {
        this.serviceInstances.delete(serviceName);
        cleanedCount++;
        logger.debug(`🧹 비정상 서비스 제거: ${serviceName}`);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`🧹 ${cleanedCount}개 서비스 정리됨`);
    }
  }

  /**
   * 🏥 서비스 헬스 체크
   */
  isServiceHealthy(service) {
    try {
      if (!service) return false;

      if (typeof service.getStatus === "function") {
        const status = service.getStatus();
        return status.isConnected !== false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 📊 상태 조회
   */
  getStatus() {
    const healthyServices = Array.from(this.serviceInstances.values()).filter(
      (service) => this.isServiceHealthy(service)
    ).length;

    return {
      isInitialized: this.isInitialized,
      stats: {
        ...this.stats,
        healthyServices,
        unhealthyServices: this.serviceInstances.size - healthyServices,
      },
      registeredServices: Array.from(this.serviceRegistry.keys()),
      activeServices: Array.from(this.serviceInstances.keys()),
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      logger.info("🧹 ServiceBuilder 정리 시작...");

      // 정리 타이머 중지
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      // 모든 서비스 정리
      for (const [serviceName, instance] of this.serviceInstances.entries()) {
        if (typeof instance.cleanup === "function") {
          await instance.cleanup();
        }
      }

      // 캐시 정리
      this.serviceInstances.clear();
      this.serviceRegistry.clear();
      this.dependencyGraph.clear();

      this.isInitialized = false;

      logger.info("✅ ServiceBuilder 정리 완료");
    } catch (error) {
      logger.error("❌ ServiceBuilder 정리 실패:", error);
    }
  }
}

// 싱글톤 인스턴스
let serviceBuilderInstance = null;

/**
 * ServiceBuilder 인스턴스 생성 또는 반환
 */
function createServiceBuilder() {
  if (!serviceBuilderInstance) {
    serviceBuilderInstance = new ServiceBuilder();
  }
  return serviceBuilderInstance;
}

module.exports = { ServiceBuilder, createServiceBuilder };
