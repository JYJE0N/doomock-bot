// src/services/LeaveService.js - 🏖️ Mongoose 기반 연차 데이터 서비스 (완전 버전)

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏖️ LeaveService - Mongoose 기반 연차 관리 (완전 버전)
 *
 * 🎯 핵심 기능:
 * - 연차 사용 CRUD (생성/조회/업데이트/삭제)
 * - 사용자별/연도별 연차 추적
 * - 연차 현황 통계
 * - 연차 기록 관리
 * - 사용자 설정 관리
 *
 * ✅ 표준 준수:
 * - Mongoose 라이브러리 사용 ✨
 * - 모델 기반 스키마 검증
 * - 메모리 캐싱 시스템
 * - Railway 환경 최적화
 * - 표준 필드 활용
 */
class LeaveService {
  constructor(options = {}) {
    // Mongoose 모델들 (나중에 주입받음)
    this.Leave = null;
    this.UserLeaveSetting = null;

    // Railway 환경변수 기반 설정
    this.config = {
      enableCache: process.env.ENABLE_LEAVE_CACHE !== "false",
      cacheTimeout: parseInt(process.env.LEAVE_CACHE_TIMEOUT) || 300000, // 5분
      annualLeaveDays: parseInt(process.env.ANNUAL_LEAVE_DAYS) || 15,
      maxLeaveDaysPerRequest:
        parseInt(process.env.MAX_LEAVE_DAYS_PER_REQUEST) || 10,
      enableValidation: process.env.LEAVE_VALIDATION_ENABLED !== "false",
      ...options.config,
    };

    // 메모리 캐시 (간단한 Map 기반)
    this.cache = new Map();
    this.cacheTimestamps = new Map();

    // Railway 환경 감지
    this.isRailway = !!process.env.RAILWAY_ENVIRONMENT;

    // 서비스 통계
    this.stats = {
      operationsCount: 0,
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
      validationErrors: 0,
    };

    logger.info("🏖️ LeaveService 생성됨 - Mongoose 버전! 🎉");
  }

  /**
   * 🎯 서비스 초기화 (Mongoose 모델 연결)
   */
  async initialize() {
    try {
      logger.info("🔧 LeaveService 초기화 시작 (Mongoose)...");

      // MongooseManager에서 모델들 가져오기
      const { getInstance } = require("../database/MongooseManager");
      const mongooseManager = getInstance();

      this.Leave = mongooseManager.getModel("Leave");
      this.UserLeaveSetting = mongooseManager.getModel("UserLeaveSetting");

      if (!this.Leave) {
        throw new Error("Leave 모델을 찾을 수 없습니다");
      }

      if (!this.UserLeaveSetting) {
        throw new Error("UserLeaveSetting 모델을 찾을 수 없습니다");
      }

      logger.success("✅ LeaveService 초기화 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ LeaveService 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 📊 Mongoose 기반 CRUD 메서드들 =====

  /**
   * 🏖️ 연차 현황 조회 (기본) - 핵심 메서드!
   */
  async getLeaveStatus(userId, year = null) {
    this.stats.operationsCount++;

    try {
      // 캐시 확인
      const cacheKey = `status:${userId}:${year || new Date().getFullYear()}`;
      if (this.config.enableCache && this.isValidCache(cacheKey)) {
        this.stats.cacheHits++;
        return this.cache.get(cacheKey);
      }

      this.stats.cacheMisses++;

      // 🎯 Mongoose 정적 메서드 사용
      const status = await this.Leave.getLeaveStatus(userId, year);

      // 캐시에 저장 (짧은 시간)
      if (this.config.enableCache) {
        this.cache.set(cacheKey, status);
        this.cacheTimestamps.set(cacheKey, Date.now());
      }

      this.stats.successCount++;
      logger.debug(
        `🏖️ 연차 현황 조회됨 (사용자: ${userId}, 연도: ${status.year}) - Mongoose`
      );

      return status;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("연차 현황 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🏖️ 연차 상세 현황 조회 (이번 달 포함)
   */
  async getDetailedStatus(userId, year = null) {
    this.stats.operationsCount++;

    try {
      // 캐시 확인
      const cacheKey = `detailed:${userId}:${year || new Date().getFullYear()}`;
      if (this.config.enableCache && this.isValidCache(cacheKey)) {
        this.stats.cacheHits++;
        return this.cache.get(cacheKey);
      }

      this.stats.cacheMisses++;

      // 기본 현황 조회
      const basicStatus = await this.getLeaveStatus(userId, year);

      // 오늘 사용 현황
      const todayUsage = await this.getTodayUsage(userId);

      // 이번 달 사용 현황
      const currentMonth = new Date().getMonth() + 1;
      const monthlyUsage = await this.getMonthlyUsage(userId, year);
      const thisMonthUsage = monthlyUsage.find(
        (m) => m.month === currentMonth
      ) || { days: 0, count: 0 };

      const detailedStatus = {
        ...basicStatus,
        todayUsage,
        thisMonth: {
          used: thisMonthUsage.days,
          count: thisMonthUsage.count,
        },
      };

      // 캐시에 저장
      if (this.config.enableCache) {
        this.cache.set(cacheKey, detailedStatus);
        this.cacheTimestamps.set(cacheKey, Date.now());
      }

      this.stats.successCount++;
      return detailedStatus;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("연차 상세 현황 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🏖️ 오늘 사용한 연차 조회
   */
  async getTodayUsage(userId) {
    this.stats.operationsCount++;

    try {
      const todayUsage = await this.Leave.getTodayUsage(userId);
      this.stats.successCount++;
      return todayUsage;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("오늘 연차 사용 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 📊 월별 사용량 조회
   */
  async getMonthlyUsage(userId, year = null) {
    this.stats.operationsCount++;

    try {
      const monthlyUsage = await this.Leave.getMonthlyUsage(userId, year);
      this.stats.successCount++;
      return monthlyUsage;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("월별 연차 사용량 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 📊 연도별 통계 조회
   */
  async getYearlyStats(userId, year = null) {
    this.stats.operationsCount++;

    try {
      const yearlyStats = await this.Leave.getYearlyStats(userId, year);
      this.stats.successCount++;
      return yearlyStats;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("연도별 통계 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🏖️ 연차 사용 처리
   */
  async useLeave(userId, days, options = {}) {
    this.stats.operationsCount++;

    try {
      const {
        leaveType = "연차",
        usedDate = new Date(),
        reason = "",
        requestedBy = "사용자",
      } = options;

      // 잔여 연차 확인
      const status = await this.getLeaveStatus(userId);
      if (status.remaining < days) {
        return {
          success: false,
          error: `잔여 연차가 부족합니다. (필요: ${days}일, 잔여: ${status.remaining}일)`,
        };
      }

      // 연차 사용 기록 생성
      const leaveRecord = new this.Leave({
        userId: userId.toString(),
        days: days,
        leaveType: leaveType,
        usedDate: usedDate,
        reason: reason,
        metadata: {
          requestedBy: requestedBy,
          requestedAt: new Date(),
          source: "bot",
        },
      });

      const savedLeave = await leaveRecord.save();

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(
        `🏖️ 연차 사용 처리됨: ${userId} - ${days}일 (${leaveType}) - Mongoose`
      );

      return {
        success: true,
        id: savedLeave._id.toString(),
        userId: savedLeave.userId,
        days: savedLeave.days,
        leaveType: savedLeave.leaveType,
        usedDate: savedLeave.usedDate,
        status: savedLeave.status,
      };
    } catch (error) {
      this.stats.errorCount++;

      // Mongoose 검증 에러 처리
      if (error.name === "ValidationError") {
        this.stats.validationErrors++;
        const firstError = Object.values(error.errors)[0];
        return {
          success: false,
          error: firstError.message,
        };
      }

      logger.error("연차 사용 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🏖️ 연차 사용 기록 조회
   */
  async getLeaveHistory(userId, options = {}) {
    this.stats.operationsCount++;

    try {
      // 캐시 확인
      const cacheKey = `history:${userId}:${JSON.stringify(options)}`;
      if (this.config.enableCache && this.isValidCache(cacheKey)) {
        this.stats.cacheHits++;
        return this.cache.get(cacheKey);
      }

      this.stats.cacheMisses++;

      // 🎯 Mongoose 정적 메서드 사용
      const history = await this.Leave.getLeaveHistory(userId, {
        limit: options.limit || 20,
        skip: options.skip || 0,
        year: options.year,
        type: options.type,
        status: options.status,
      });

      // 데이터 정규화
      const processedHistory = history.map((leave) => ({
        id: leave._id.toString(),
        userId: leave.userId,
        year: leave.year,
        days: leave.days,
        reason: leave.reason,
        leaveType: leave.leaveType,
        status: leave.status,
        usedDate: leave.usedDate,
        createdAt: leave.createdAt,
        formattedUsedDate: TimeHelper.format(leave.usedDate, "YYYY.MM.DD"),
      }));

      // 캐시에 저장
      if (this.config.enableCache) {
        this.cache.set(cacheKey, processedHistory);
        this.cacheTimestamps.set(cacheKey, Date.now());
      }

      this.stats.successCount++;
      logger.debug(
        `🏖️ 연차 기록 ${processedHistory.length}개 조회됨 (사용자: ${userId}) - Mongoose`
      );

      return {
        data: processedHistory,
        total: processedHistory.length,
        hasMore: processedHistory.length === (options.limit || 20),
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("연차 기록 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  // ===== 🛠️ 사용자 설정 관련 메서드들 =====

  /**
   * 👤 사용자 연차 설정 조회
   */
  async getUserSettings(userId, year = null) {
    this.stats.operationsCount++;

    try {
      const setting = await this.UserLeaveSetting.getOrCreate(userId, year);
      this.stats.successCount++;

      return {
        userId: setting.userId,
        annualLeave: setting.annualLeave,
        applicableYear: setting.applicableYear,
        policy: setting.policy,
        position: setting.position,
        yearsOfService: setting.yearsOfService,
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("사용자 설정 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 📝 사용자 연간 연차 설정
   */
  async setUserAnnualLeave(userId, annualDays, year = null) {
    this.stats.operationsCount++;

    try {
      const setting = await this.UserLeaveSetting.getOrCreate(userId, year);
      setting.annualLeave = annualDays;
      setting.metadata.lastModified = new Date();
      setting.metadata.modifiedBy = "user";

      await setting.save();

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(`📝 사용자 연차 설정 업데이트: ${userId} - ${annualDays}일`);

      return {
        success: true,
        annualLeave: annualDays,
        userId: userId,
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("사용자 연차 설정 실패 (Mongoose):", error);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 🔄 연차 리셋 (새해)
   */
  async resetYearlyLeave(userId, year = null) {
    this.stats.operationsCount++;

    try {
      const targetYear = year || new Date().getFullYear();

      // 사용자 설정 조회
      const setting = await this.UserLeaveSetting.getOrCreate(
        userId,
        targetYear
      );

      // 기존 연차 기록들을 비활성화 (소프트 삭제)
      await this.Leave.updateMany(
        {
          userId: userId.toString(),
          year: targetYear,
          isActive: true,
        },
        {
          isActive: false,
          $inc: { version: 1 },
        }
      );

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(`🔄 연차 리셋 완료: ${userId} - ${targetYear}년`);

      return {
        success: true,
        annualLeave: setting.annualLeave,
        year: targetYear,
        resetDate: new Date(),
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error("연차 리셋 실패 (Mongoose):", error);
      throw error;
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 캐시 유효성 검사
   */
  isValidCache(key) {
    if (!this.cache.has(key) || !this.cacheTimestamps.has(key)) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(key);
    const now = Date.now();
    const isValid = now - timestamp < this.config.cacheTimeout;

    if (!isValid) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    }

    return isValid;
  }

  /**
   * 사용자별 캐시 무효화
   */
  invalidateUserCache(userId) {
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      if (key.includes(`:${userId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });

    logger.debug(
      `🗑️ 사용자 캐시 무효화됨: ${userId} (${keysToDelete.length}개)`
    );
  }

  /**
   * 전체 캐시 정리
   */
  clearCache() {
    const cacheSize = this.cache.size;
    this.cache.clear();
    this.cacheTimestamps.clear();

    logger.debug(`🗑️ LeaveService 캐시 정리됨 (${cacheSize}개)`);
  }

  // ===== 📊 서비스 상태 및 정리 =====

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "LeaveService",
      isConnected: !!this.Leave && !!this.UserLeaveSetting,
      modelName: this.Leave?.modelName || null,
      settingModelName: this.UserLeaveSetting?.modelName || null,
      cacheEnabled: this.config.enableCache,
      cacheSize: this.cache.size,
      stats: { ...this.stats },
      config: {
        annualLeaveDays: this.config.annualLeaveDays,
        maxLeaveDaysPerRequest: this.config.maxLeaveDaysPerRequest,
        enableValidation: this.config.enableValidation,
      },
      isRailway: this.isRailway,
    };
  }

  /**
   * 정리 작업
   */
  async cleanup() {
    try {
      this.clearCache();

      // 통계 초기화
      this.stats = {
        operationsCount: 0,
        successCount: 0,
        errorCount: 0,
        cacheHits: 0,
        cacheMisses: 0,
        validationErrors: 0,
      };

      logger.info("✅ LeaveService 정리 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ LeaveService 정리 실패:", error);
    }
  }
}

module.exports = LeaveService;
