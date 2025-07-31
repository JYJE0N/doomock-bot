// src/services/LeaveService.js - 🏖️ Mongoose 기반 연차 관리 서비스 v3.0.1
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏖️ LeaveService - Mongoose 기반 연차 관리 서비스
 *
 * 🎯 핵심 기능:
 * - 연차/반차/반반차 사용 관리 (1일, 0.5일, 0.25일)
 * - 연간 연차 자동 리셋 (1월 1일 생성, 12월 31일 소멸)
 * - 사용 이력 및 통계 제공
 * - 잔여 연차 실시간 계산
 *
 * ✅ Mongoose 완전 기반:
 * - Leave 모델 사용
 * - UserLeaveSetting 모델 사용
 * - Mongoose 쿼리 및 집계 활용
 * - 스키마 검증 및 미들웨어 활용
 */
class LeaveService {
  constructor(options = {}) {
    // Mongoose 모델들 (동적 로드)
    this.LeaveModel = null;
    this.UserLeaveSettingModel = null;

    // 서비스 설정
    this.config = {
      // 기본 연차 설정
      defaultAnnualLeave: parseInt(process.env.DEFAULT_ANNUAL_LEAVE) || 15,
      maxAnnualLeave: 50,
      minAnnualLeave: 1,

      // 연차 단위 (0.25일 단위)
      leaveUnits: {
        quarter: { value: 0.25, label: "반반차", icon: "⏰" },
        half: { value: 0.5, label: "반차", icon: "🕐" },
        full: { value: 1.0, label: "연차", icon: "📅" },
      },

      // 년도 관리 (1월 1일 ~ 12월 31일)
      yearStartMonth: 1,
      yearStartDay: 1,

      // 캐시 설정
      enableCache: true,
      cacheTimeout: 5 * 60 * 1000, // 5분

      ...options.config,
    };

    // 메모리 캐시 (성능 최적화)
    this.cache = new Map();

    // 통계
    this.stats = {
      operationsCount: 0,
      successCount: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    logger.info("🔧 LeaveService", "서비스 생성 (Mongoose 기반)");
  }

  /**
   * 🎯 서비스 초기화 (Mongoose 모델 로드)
   */
  async initialize() {
    try {
      // Mongoose 모델 동적 로드
      this.LeaveModel = require("../database/models/Leave");

      // UserLeaveSetting 모델도 생성 필요 (별도 구현)
      try {
        this.UserLeaveSettingModel = require("../database/models/UserLeaveSetting");
      } catch (error) {
        logger.warn("UserLeaveSetting 모델 없음 - 기본 설정 사용");
      }

      // 캐시 정리 스케줄러 시작
      this.startCacheCleanup();

      logger.success("LeaveService 초기화 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ LeaveService 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 🏖️ 연차 사용 관련 메서드들 =====

  /**
   * 🏖️ 연차 사용 처리
   */
  async useLeave(userId, days, options = {}) {
    this.stats.operationsCount++;

    try {
      const userIdStr = userId.toString();
      const currentYear = options.year || new Date().getFullYear();

      // 1. 입력 검증
      if (!this.isValidLeaveUnit(days)) {
        throw new Error(
          `유효하지 않은 연차 단위입니다. 사용 가능: ${Object.values(
            this.config.leaveUnits
          )
            .map((u) => u.value)
            .join(", ")}`
        );
      }

      // 2. 잔여 연차 확인
      const status = await this.getLeaveStatus(userIdStr, currentYear);
      if (status.remaining < days) {
        throw new Error(
          `잔여 연차가 부족합니다. (필요: ${days}일, 잔여: ${status.remaining}일)`
        );
      }

      // 3. 연차 사용 기록 생성
      const leaveData = {
        userId: userIdStr,
        year: currentYear,
        days: parseFloat(days),
        reason: options.reason || "",
        leaveType: this.getLeaveTypeByDays(days),
        usedDate: options.usedDate || new Date(),
        status: "approved", // 간단한 기능이므로 자동 승인
        metadata: {
          requestedAt: new Date(),
          requestedBy: options.requestedBy || "사용자",
          source: "bot",
        },
      };

      const leave = new this.LeaveModel(leaveData);
      const savedLeave = await leave.save();

      // 4. 캐시 무효화
      this.invalidateUserCache(userIdStr);

      this.stats.successCount++;

      logger.info(`✅ 연차 사용 성공: ${userIdStr} - ${days}일`);

      return {
        success: true,
        data: savedLeave,
        message: `${this.getLeaveTypeByDays(days)} ${days}일이 사용되었습니다.`,
        remaining: status.remaining - days,
      };
    } catch (error) {
      this.stats.errorCount++;
      logger.error(`❌ 연차 사용 실패 (${userId}):`, error);

      return {
        success: false,
        error: error.message,
        code: "LEAVE_USE_FAILED",
      };
    }
  }

  /**
   * 📊 연차 현황 조회 (메인 기능)
   */
  async getLeaveStatus(userId, year) {
    const userIdStr = userId.toString();
    const currentYear = year || new Date().getFullYear();
    const cacheKey = `status:${userIdStr}:${currentYear}`;

    // 캐시 확인
    if (this.isValidCache(cacheKey)) {
      this.stats.cacheHits++;
      return this.cache.get(cacheKey).data;
    }

    this.stats.cacheMisses++;

    try {
      // 1. 사용자 연차 설정 조회
      const annualLeave = await this.getUserAnnualLeave(userIdStr);

      // 2. 올해 사용한 연차 집계 (Mongoose 집계 사용)
      const usageStats = await this.LeaveModel.aggregate([
        {
          $match: {
            userId: userIdStr,
            year: currentYear,
            isActive: true,
            status: "approved",
          },
        },
        {
          $group: {
            _id: "$leaveType",
            totalDays: { $sum: "$days" },
            count: { $sum: 1 },
          },
        },
      ]);

      // 3. 결과 구성
      const stats = {
        quarter: { days: 0, count: 0 },
        half: { days: 0, count: 0 },
        full: { days: 0, count: 0 },
        total: { days: 0, count: 0 },
      };

      usageStats.forEach((stat) => {
        const type = this.getLeaveTypeKeyByLabel(stat._id);
        if (stats[type]) {
          stats[type] = { days: stat.totalDays, count: stat.count };
        }
        stats.total.days += stat.totalDays;
        stats.total.count += stat.count;
      });

      const result = {
        year: currentYear,
        annualLeave: annualLeave,
        used: stats.total.days,
        remaining: Math.max(0, annualLeave - stats.total.days),
        usageRate: Math.round((stats.total.days / annualLeave) * 100),
        breakdown: stats,
        lastUpdated: new Date(),
      };

      // 캐시 저장
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      logger.error(`❌ 연차 현황 조회 실패 (${userId}):`, error);
      throw error;
    }
  }

  /**
   * 📋 연차 사용 이력 조회
   */
  async getLeaveHistory(userId, options = {}) {
    const userIdStr = userId.toString();

    try {
      const {
        year = new Date().getFullYear(),
        limit = 50,
        offset = 0,
        sortBy = "usedDate",
        sortOrder = -1, // 최신순
      } = options;

      const query = {
        userId: userIdStr,
        year: year,
        isActive: true,
      };

      const history = await this.LeaveModel.find(query)
        .sort({ [sortBy]: sortOrder })
        .limit(limit)
        .skip(offset)
        .lean(); // 성능 최적화

      // 각 기록에 잔여 연차 계산 (해당 시점 기준)
      const enrichedHistory = await Promise.all(
        history.map(async (record) => {
          // 해당 날짜까지의 누적 사용량 계산
          const cumulativeUsed = await this.LeaveModel.aggregate([
            {
              $match: {
                userId: userIdStr,
                year: year,
                usedDate: { $lte: record.usedDate },
                isActive: true,
                status: "approved",
              },
            },
            {
              $group: {
                _id: null,
                totalUsed: { $sum: "$days" },
              },
            },
          ]);

          const usedAtTime = cumulativeUsed[0]?.totalUsed || 0;
          const annualLeave = await this.getUserAnnualLeave(userIdStr);

          return {
            ...record,
            remainingAtTime: Math.max(0, annualLeave - usedAtTime),
            formattedDate: TimeHelper.format(record.usedDate, "YYYY-MM-DD"),
            formattedCreatedAt: TimeHelper.format(
              record.createdAt,
              "YYYY-MM-DD HH:mm"
            ),
          };
        })
      );

      const totalCount = await this.LeaveModel.countDocuments(query);

      return {
        success: true,
        data: enrichedHistory,
        total: totalCount,
        hasMore: offset + limit < totalCount,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      logger.error(`❌ 연차 이력 조회 실패 (${userId}):`, error);
      throw error;
    }
  }

  /**
   * 📈 월별 연차 사용 현황
   */
  async getMonthlyUsage(userId, year) {
    const userIdStr = userId.toString();
    const currentYear = year || new Date().getFullYear();

    try {
      const monthlyStats = await this.LeaveModel.aggregate([
        {
          $match: {
            userId: userIdStr,
            year: currentYear,
            isActive: true,
            status: "approved",
          },
        },
        {
          $group: {
            _id: { $month: "$usedDate" },
            totalDays: { $sum: "$days" },
            count: { $sum: 1 },
            records: {
              $push: {
                days: "$days",
                leaveType: "$leaveType",
                usedDate: "$usedDate",
                reason: "$reason",
              },
            },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      // 12개월 배열로 변환 (빈 달은 0으로)
      const monthlyUsage = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const monthData = monthlyStats.find((stat) => stat._id === month);

        return {
          month: month,
          monthName: TimeHelper.getMonthName(month),
          totalDays: monthData?.totalDays || 0,
          count: monthData?.count || 0,
          records: monthData?.records || [],
        };
      });

      return monthlyUsage;
    } catch (error) {
      logger.error(`❌ 월별 사용 현황 조회 실패 (${userId}):`, error);
      throw error;
    }
  }

  /**
   * 📊 연간 통계
   */
  async getYearlyStats(userId, year) {
    const userIdStr = userId.toString();
    const currentYear = year || new Date().getFullYear();

    try {
      // Mongoose의 정적 메서드 활용 (이미 구현된 것 사용)
      const stats = await this.LeaveModel.getYearlyStats(
        userIdStr,
        currentYear
      );
      const monthlyUsage = await this.getMonthlyUsage(userIdStr, currentYear);

      // 추가 통계 계산
      const totalWorkingDays = 365 - 104; // 대략적인 연간 근무일 (주말 제외)
      const annualLeave = await this.getUserAnnualLeave(userIdStr);

      return {
        ...stats,
        annualLeave: annualLeave,
        utilizationRate: Math.round((stats.total.days / annualLeave) * 100),
        averagePerMonth: Math.round((stats.total.days / 12) * 10) / 10,
        projectedYearEnd: this.projectYearEndUsage(
          stats.total.days,
          currentYear
        ),
        monthlyBreakdown: monthlyUsage,
        workingDaysImpact:
          Math.round((stats.total.days / totalWorkingDays) * 100 * 10) / 10,
      };
    } catch (error) {
      logger.error(`❌ 연간 통계 조회 실패 (${userId}):`, error);
      throw error;
    }
  }

  // ===== ⚙️ 사용자 설정 관리 =====

  /**
   * 👤 사용자 연간 연차 조회
   */
  async getUserAnnualLeave(userId) {
    const userIdStr = userId.toString();

    try {
      if (this.UserLeaveSettingModel) {
        const setting = await this.UserLeaveSettingModel.findOne({
          userId: userIdStr,
        });
        return setting?.annualLeave || this.config.defaultAnnualLeave;
      }

      // UserLeaveSetting 모델이 없으면 기본값 사용
      return this.config.defaultAnnualLeave;
    } catch (error) {
      logger.warn(`사용자 연차 설정 조회 실패, 기본값 사용: ${error.message}`);
      return this.config.defaultAnnualLeave;
    }
  }

  /**
   * ⚙️ 사용자 연간 연차 설정
   */
  async setUserAnnualLeave(userId, annualLeave) {
    const userIdStr = userId.toString();

    try {
      // 입력 검증
      if (
        annualLeave < this.config.minAnnualLeave ||
        annualLeave > this.config.maxAnnualLeave
      ) {
        throw new Error(
          `연차는 ${this.config.minAnnualLeave}-${this.config.maxAnnualLeave}일 사이여야 합니다.`
        );
      }

      if (this.UserLeaveSettingModel) {
        await this.UserLeaveSettingModel.findOneAndUpdate(
          { userId: userIdStr },
          {
            userId: userIdStr,
            annualLeave: parseInt(annualLeave),
            updatedAt: new Date(),
          },
          { upsert: true, new: true }
        );
      }

      // 캐시 무효화
      this.invalidateUserCache(userIdStr);

      return {
        success: true,
        message: `연간 연차가 ${annualLeave}일로 설정되었습니다.`,
      };
    } catch (error) {
      logger.error(`❌ 연차 설정 실패 (${userId}):`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 🔄 연차 리셋 (새해)
   */
  async resetYearlyLeave(userId) {
    const userIdStr = userId.toString();

    try {
      // 이전 연도 데이터는 그대로 유지 (이력 보존)
      // 새해 연차는 자동으로 시작됨

      const annualLeave = await this.getUserAnnualLeave(userIdStr);

      // 캐시 전체 무효화
      this.invalidateUserCache(userIdStr);

      return {
        success: true,
        annualLeave: annualLeave,
        message: "새해 연차가 리셋되었습니다.",
      };
    } catch (error) {
      logger.error(`❌ 연차 리셋 실패 (${userId}):`, error);
      throw error;
    }
  }

  /**
   * 📅 오늘 사용한 연차 조회
   */
  async getTodayUsage(userId) {
    const userIdStr = userId.toString();
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    try {
      const todayLeaves = await this.LeaveModel.find({
        userId: userIdStr,
        usedDate: { $gte: startOfDay, $lt: endOfDay },
        isActive: true,
      }).lean();

      const totalUsed = todayLeaves.reduce((sum, leave) => sum + leave.days, 0);

      return {
        hasUsage: todayLeaves.length > 0,
        totalDays: totalUsed,
        records: todayLeaves,
        date: TimeHelper.format(today, "YYYY-MM-DD"),
      };
    } catch (error) {
      logger.error(`❌ 오늘 연차 사용 조회 실패 (${userId}):`, error);
      return {
        hasUsage: false,
        totalDays: 0,
        records: [],
        date: TimeHelper.format(today, "YYYY-MM-DD"),
      };
    }
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * ✅ 유효한 연차 단위인지 확인
   */
  isValidLeaveUnit(days) {
    const allowedValues = Object.values(this.config.leaveUnits).map(
      (unit) => unit.value
    );
    return allowedValues.includes(parseFloat(days));
  }

  /**
   * 🏷️ 연차 일수로 타입 결정
   */
  getLeaveTypeByDays(days) {
    const dayValue = parseFloat(days);

    if (dayValue === 0.25) return this.config.leaveUnits.quarter.label;
    if (dayValue === 0.5) return this.config.leaveUnits.half.label;
    if (dayValue === 1.0) return this.config.leaveUnits.full.label;
    return `${dayValue}일`;
  }

  /**
   * 🔑 라벨로 타입 키 찾기
   */
  getLeaveTypeKeyByLabel(label) {
    for (const [key, config] of Object.entries(this.config.leaveUnits)) {
      if (config.label === label) return key;
    }
    return "full"; // 기본값
  }

  /**
   * 📈 연말 사용량 예측
   */
  projectYearEndUsage(currentUsed, year) {
    const now = new Date();
    const currentYear = now.getFullYear();

    if (year !== currentYear) return null;

    const dayOfYear = Math.floor(
      (now - new Date(currentYear, 0, 0)) / (1000 * 60 * 60 * 24)
    );
    const daysInYear = 365 + (currentYear % 4 === 0 ? 1 : 0);
    const progressRate = dayOfYear / daysInYear;

    if (progressRate === 0) return currentUsed;

    const projectedTotal = Math.round((currentUsed / progressRate) * 10) / 10;

    return {
      projected: projectedTotal,
      current: currentUsed,
      progressRate: Math.round(progressRate * 100),
      remainingDays: daysInYear - dayOfYear,
    };
  }

  // ===== 🧹 캐시 관리 =====

  /**
   * 🔍 캐시 유효성 확인
   */
  isValidCache(key) {
    if (!this.config.enableCache) return false;

    const cached = this.cache.get(key);
    if (!cached) return false;

    return Date.now() - cached.timestamp < this.config.cacheTimeout;
  }

  /**
   * 🗑️ 사용자 캐시 무효화
   */
  invalidateUserCache(userId) {
    const userIdStr = userId.toString();
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      if (key.includes(userIdStr)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      logger.debug(
        `🧹 캐시 무효화: ${keysToDelete.length}개 항목 (${userIdStr})`
      );
    }
  }

  /**
   * 🔄 캐시 정리 스케줄러
   */
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete = [];

      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.config.cacheTimeout) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => this.cache.delete(key));

      if (keysToDelete.length > 0) {
        logger.debug(
          `🧹 자동 캐시 정리: ${keysToDelete.length}개 만료 항목 삭제`
        );
      }
    }, this.config.cacheTimeout);
  }

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: "LeaveService",
      version: "3.0.1",
      isInitialized: !!this.LeaveModel,
      useMongoose: true,
      hasLeaveModel: !!this.LeaveModel,
      hasUserSettingModel: !!this.UserLeaveSettingModel,
      cacheEnabled: this.config.enableCache,
      cacheSize: this.cache.size,
      stats: { ...this.stats },
      config: {
        defaultAnnualLeave: this.config.defaultAnnualLeave,
        leaveUnits: this.config.leaveUnits,
        cacheTimeout: this.config.cacheTimeout,
      },
    };
  }

  /**
   * 🧹 정리 작업
   */
  async cleanup() {
    try {
      // 캐시 정리
      this.cache.clear();

      // 대기 중인 작업들 정리
      if (this.pendingOperations) {
        this.pendingOperations.clear();
      }

      logger.info("✅ LeaveService 정리 완료 (Mongoose)");
    } catch (error) {
      logger.error("❌ LeaveService 정리 실패:", error);
    }
  }
}

module.exports = LeaveService;
