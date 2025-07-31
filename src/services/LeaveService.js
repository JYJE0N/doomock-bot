// src/services/LeaveService.js - 🏖️ Mongoose 기반 연차 데이터 서비스

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏖️ LeaveService - Mongoose 기반 연차 관리
 *
 * 🎯 핵심 기능:
 * - 연차 사용 CRUD (생성/조회/업데이트/삭제)
 * - 사용자별/연도별 연차 추적
 * - 연차 현황 통계
 * - 연차 기록 관리
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
    // Mongoose 모델 (나중에 주입받음)
    this.Leave = null;

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

      // MongooseManager에서 Leave 모델 가져오기
      const { getInstance } = require("../database/MongooseManager");
      const mongooseManager = getInstance();

      this.Leave = mongooseManager.getModel("Leave");

      if (!this.Leave) {
        throw new Error("Leave 모델을 찾을 수 없습니다");
      }

      logger.success("✅ LeaveService 초기화 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ LeaveService 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 📊 Mongoose 기반 CRUD 메서드들 =====

  /**
   * 🏖️ 연차 현황 조회 (기본)
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
  async getDetailedStatus(userId) {
    this.stats.operationsCount++;

    try {
      // 캐시 확인
      const cacheKey = `detailed:${userId}:${new Date().getFullYear()}`;
      if (this.config.enableCache && this.isValidCache(cacheKey)) {
        this.stats.cacheHits++;
        return this.cache.get(cacheKey);
      }

      this.stats.cacheMisses++;

      // 🎯 Mongoose 정적 메서드 사용
      const detailedStatus = await this.Leave.getDetailedStatus(userId);

      // 캐시에 저장 (짧은 시간)
      if (this.config.enableCache) {
        this.cache.set(cacheKey, detailedStatus);
        this.cacheTimestamps.set(cacheKey, Date.now());
      }

      this.stats.successCount++;
      logger.debug(`🏖️ 상세 연차 현황 조회됨 (사용자: ${userId}) - Mongoose`);

      return detailedStatus;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("상세 연차 현황 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🏖️ 연차 사용 기록
   */
  async useLeave(userId, days, reason = "개인 사유", options = {}) {
    this.stats.operationsCount++;

    try {
      // 입력 검증
      if (!userId) {
        throw new Error("사용자 ID가 필요합니다");
      }

      const parsedDays = parseFloat(days);
      if (isNaN(parsedDays) || parsedDays <= 0) {
        throw new Error("올바른 연차 일수를 입력해주세요");
      }

      if (parsedDays > this.config.maxLeaveDaysPerRequest) {
        throw new Error(
          `한 번에 최대 ${this.config.maxLeaveDaysPerRequest}일까지만 사용 가능합니다`
        );
      }

      // 0.5 단위 검증
      if ((parsedDays * 2) % 1 !== 0) {
        throw new Error("연차는 0.5일 단위로만 사용 가능합니다");
      }

      // 🎯 Mongoose 정적 메서드 사용
      const leaveData = {
        days: parsedDays,
        reason: reason.trim() || "개인 사유",
        type: options.type || "annual",
        startDate: options.startDate,
        endDate: options.endDate,
      };

      const savedLeave = await this.Leave.useLeave(userId, leaveData);

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(
        `🏖️ 연차 사용 완료: ${parsedDays}일 (사용자: ${userId}) - Mongoose`
      );

      return {
        id: savedLeave._id.toString(),
        userId: savedLeave.userId,
        days: savedLeave.days,
        reason: savedLeave.reason,
        year: savedLeave.year,
        usedDate: savedLeave.usedDate,
        type: savedLeave.type,
        status: savedLeave.status,
      };
    } catch (error) {
      this.stats.errorCount++;

      // Mongoose 검증 에러 처리
      if (error.name === "ValidationError") {
        this.stats.validationErrors++;
        const firstError = Object.values(error.errors)[0];
        throw new Error(firstError.message);
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
        type: leave.type,
        status: leave.status,
        usedDate: leave.usedDate,
        startDate: leave.startDate,
        endDate: leave.endDate,
        createdAt: leave.createdAt,

        // 가상 속성들
        formattedPeriod:
          leave.startDate && leave.endDate
            ? `${TimeHelper.format(
                leave.startDate,
                "MM.DD"
              )} ~ ${TimeHelper.format(leave.endDate, "MM.DD")}`
            : TimeHelper.format(leave.usedDate, "YYYY.MM.DD"),
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

      return processedHistory;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("연차 기록 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 📊 연차 통계 조회
   */
  async getLeaveStats(userId, options = {}) {
    this.stats.operationsCount++;

    try {
      const { type = "yearly", year = null } = options;

      let stats;
      if (type === "yearly") {
        stats = await this.Leave.getYearlyStats(userId, year);
      } else if (type === "monthly") {
        stats = await this.Leave.getMonthlyStats(userId, year);
      } else {
        throw new Error("지원하지 않는 통계 타입입니다");
      }

      this.stats.successCount++;
      logger.debug(
        `🏖️ 연차 통계 조회됨 (사용자: ${userId}, 타입: ${type}) - Mongoose`
      );

      return stats;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("연차 통계 조회 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🏖️ 연차 기록 수정
   */
  async updateLeave(userId, leaveId, updateData) {
    this.stats.operationsCount++;

    try {
      const leave = await this.Leave.findOneAndUpdate(
        {
          _id: leaveId,
          userId: String(userId),
          isActive: true,
        },
        {
          ...updateData,
          version: { $inc: 1 },
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!leave) {
        throw new Error("연차 기록을 찾을 수 없습니다");
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.debug(`🏖️ 연차 기록 수정됨: ${leaveId} - Mongoose`);

      return leave;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("연차 기록 수정 실패 (Mongoose):", error);
      throw error;
    }
  }

  /**
   * 🗑️ 연차 기록 삭제 (소프트 삭제)
   */
  async deleteLeave(userId, leaveId) {
    this.stats.operationsCount++;

    try {
      const leave = await this.Leave.findOneAndUpdate(
        {
          _id: leaveId,
          userId: String(userId),
          isActive: true,
        },
        {
          isActive: false,
          version: { $inc: 1 },
        },
        { new: true }
      );

      if (!leave) {
        throw new Error("연차 기록을 찾을 수 없습니다");
      }

      // 캐시 무효화
      this.invalidateUserCache(userId);

      this.stats.successCount++;
      logger.info(`🏖️ 연차 기록 삭제됨: ${leaveId} - Mongoose`);

      return true;
    } catch (error) {
      this.stats.errorCount++;
      logger.error("연차 기록 삭제 실패 (Mongoose):", error);
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
      isConnected: !!this.Leave,
      modelName: this.Leave?.modelName || null,
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
