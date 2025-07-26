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
  async create(serviceName, options = {}) {
    try {
      const registration = this.serviceRegistry.get(serviceName);

      if (!registration) {
        // TodoService 특별 처리 (임시)
        if (serviceName === "todo") {
          logger.warn(`⚠️ TodoService가 등록되지 않음 - 동적 로드 시도`);

          try {
            const TodoService = require("../services/TodoService");
            this.register("todo", TodoService, {
              priority: 1,
              required: true,
            });

            return await this.create(serviceName, options);
          } catch (loadError) {
            logger.error(`❌ TodoService 동적 로드 실패:`, loadError);
            throw new Error(`TodoService를 로드할 수 없습니다`);
          }
        }

        throw new Error(`서비스 '${serviceName}'이 등록되지 않음`);
      }

      const { ServiceClass } = registration;

      // 서비스 인스턴스 생성
      let serviceInstance;
      const startTime = Date.now();

      try {
        // 서비스별 매개변수 설정
        const db = options.db || this.defaultDb;

        // TodoService는 특별한 매개변수 구조 사용
        if (serviceName === "todo") {
          serviceInstance = new ServiceClass({
            db: db,
            config: registration.config,
          });
        } else {
          // 기타 서비스들은 기본 구조
          serviceInstance = new ServiceClass(db);
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
        logger.error(`❌ ${serviceName} 서비스 생성 실패:`, error);
        this.stats.totalErrors++;

        // Mock 서비스 반환으로 안전성 확보
        return this.createMockService(serviceName);
      }
    } catch (error) {
      logger.error(`❌ 서비스 생성 실패 (${serviceName}):`, error);
      this.stats.totalErrors++;
      throw error;
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
        return {
          serviceName: this.serviceName,
          status: "mock_active",
          isConnected: false,
        };
      },
      async cleanup() {
        return true;
      },
      async healthCheck() {
        return { healthy: false, message: "Mock 서비스" };
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
