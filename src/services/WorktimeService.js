// src/services/WorktimeService.js - 🏢 근무시간 관리 서비스 (Mongoose 연동)
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 🏢 WorktimeService - 근무시간 관리 서비스
 *
 * ✅ 특징:
 * - Mongoose 모델 사용
 * - 출퇴근 시간 추적
 * - 일/주/월 통계 제공
 * - 초과근무 계산
 * - 캐싱으로 성능 최적화
 */
class WorktimeService extends BaseService {
  constructor(options = {}) {
    super("WorktimeService", options);

    // 서비스 설정
    this.config = {
      workStartTime: "09:00",
      workEndTime: "18:00",
      lunchDuration: 60, // 점심시간 (분)
      overtimeThreshold: 480, // 8시간 (분)
      trackingMode: "simple", // simple | detailed
      autoBreakEnabled: false,
      dailyGoalHours: 8,
      enableCache: true,
      cacheTimeout: 5 * 60 * 1000, // 5분
      ...options.config,
    };

    // 활성 세션 관리 (현재 근무 중인 사람들)
    this.activeSessions = new Map();

    // 오늘 통계 캐시
    this.todayStats = null;
    this.lastStatsUpdate = null;

    logger.info("🏢 WorktimeService 생성됨");
  }

  /**
   * 🎯 필요한 모델들 정의
   */
  getRequiredModels() {
    return ["Worktime"];
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    // 활성 세션 복구 (서버 재시작 시)
    await this.recoverActiveSessions();

    // 오늘 통계 초기화
    await this.updateTodayStats();

    // logger.success("✅ WorktimeService 초기화 완료");
  }

  // ===== 🎯 핵심 비즈니스 메서드들 =====

  /**
   * 💼 출근 처리
   */
  async checkIn(userId, checkInTime = null) {
    try {
      const now = checkInTime || new Date();
      const today = TimeHelper.format(null, "YYYY-MM-DD");

      // 이미 출근했는지 확인
      const existingRecord = await this.models.Worktime.findOne({
        userId: userId,
        date: today,
        isActive: true,
      });

      if (existingRecord && existingRecord.checkInTime) {
        return this.createErrorResponse(
          new Error("이미 출근하셨습니다"),
          "출근 처리 실패"
        );
      }

      // 새 출근 기록 생성 또는 업데이트
      let worktimeRecord;

      if (existingRecord) {
        // 기존 기록 업데이트
        existingRecord.checkInTime = now;
        existingRecord.updatedAt = now;
        existingRecord.version += 1;
        worktimeRecord = await existingRecord.save();
      } else {
        // 새 기록 생성
        worktimeRecord = new this.models.Worktime({
          userId: userId,
          date: today,
          checkInTime: now,
          workType: "normal", // normal | overtime | holiday
          status: "working",
          createdAt: now,
          updatedAt: now,
          version: 1,
          isActive: true,
        });
        await worktimeRecord.save();
      }

      // 활성 세션에 추가
      this.activeSessions.set(userId, {
        checkInTime: now,
        userId: userId,
        recordId: worktimeRecord._id,
      });

      // 통계 업데이트
      await this.updateTodayStats();

      logger.info(
        `💼 출근 처리 완료: ${userId} at ${TimeHelper.format(now, "HH:mm")}`
      );

      return this.createSuccessResponse(
        {
          record: worktimeRecord,
          checkInTime: now,
          currentStatus: "working",
          recommendations: this.generateCheckInRecommendations(now),
        },
        "출근 처리되었습니다"
      );
    } catch (error) {
      logger.error("출근 처리 실패:", error);
      return this.createErrorResponse(
        error,
        "출근 처리 중 오류가 발생했습니다"
      );
    }
  }

  /**
   * 🏠 퇴근 처리
   */
  async checkOut(userId, checkOutTime = null) {
    try {
      const now = checkOutTime || new Date();
      const today = TimeHelper.format(null, "YYYY-MM-DD");

      // 출근 기록 확인
      const worktimeRecord = await this.models.Worktime.findOne({
        userId: userId,
        date: today,
        isActive: true,
        checkInTime: { $exists: true },
      });

      if (!worktimeRecord) {
        return this.createErrorResponse(
          new Error("출근 기록이 없습니다"),
          "퇴근 처리 실패"
        );
      }

      if (worktimeRecord.checkOutTime) {
        return this.createErrorResponse(
          new Error("이미 퇴근하셨습니다"),
          "퇴근 처리 실패"
        );
      }

      // 근무시간 계산
      const workDuration = this.calculateWorkDuration(
        worktimeRecord.checkInTime,
        now
      );

      // 퇴근 처리
      worktimeRecord.checkOutTime = now;
      worktimeRecord.workDuration = workDuration.totalMinutes;
      worktimeRecord.regularHours = workDuration.regularHours;
      worktimeRecord.overtimeHours = workDuration.overtimeHours;
      worktimeRecord.status = "completed";
      worktimeRecord.updatedAt = now;
      worktimeRecord.version += 1;

      await worktimeRecord.save();

      // 활성 세션에서 제거
      this.activeSessions.delete(userId);

      // 통계 업데이트
      await this.updateTodayStats();

      logger.info(
        `🏠 퇴근 처리 완료: ${userId} (${workDuration.totalMinutes}분 근무)`
      );

      return this.createSuccessResponse(
        {
          record: worktimeRecord,
          checkOutTime: now,
          workDuration: workDuration,
          currentStatus: "completed",
          recommendations: this.generateCheckOutRecommendations(workDuration),
        },
        "퇴근 처리되었습니다"
      );
    } catch (error) {
      logger.error("퇴근 처리 실패:", error);
      return this.createErrorResponse(
        error,
        "퇴근 처리 중 오류가 발생했습니다"
      );
    }
  }

  /**
   * 📅 오늘 근무 기록 조회
   */
  async getTodayRecord(userId) {
    try {
      const today = TimeHelper.format(null, "YYYY-MM-DD");

      const record = await this.models.Worktime.findOne({
        userId: userId,
        date: today,
        isActive: true,
      });

      if (!record) {
        return null;
      }

      // 현재 근무 중이면 실시간 계산
      if (record.checkInTime && !record.checkOutTime) {
        const currentDuration = this.calculateCurrentWorkDuration(
          record.checkInTime,
          new Date() // ✅ Date 객체 사용
        );

        return {
          ...record.toObject(),
          currentWorkDuration: currentDuration,
          isWorking: true,
        };
      }

      return {
        ...record.toObject(),
        isWorking: false,
      };
    } catch (error) {
      logger.error("오늘 기록 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 주간 통계 조회 (완성된 버전)
   */
  async getWeekStats(userId) {
    try {
      const weekStart = TimeHelper.getWeekStart();
      const weekEnd = TimeHelper.getWeekEnd();

      // 👇 누락되었던 데이터베이스 조회 로직
      const records = await this.models.Worktime.find({
        userId: userId,
        date: {
          $gte: TimeHelper.format(weekStart, "YYYY-MM-DD"),
          $lte: TimeHelper.format(weekEnd, "YYYY-MM-DD"),
        },
        isActive: true,
        checkOutTime: { $exists: true },
      }).sort({ date: 1 });

      const stats = this.calculateWeeklyStats(records);

      return {
        weekStart: TimeHelper.format(weekStart, "YYYY-MM-DD"),
        weekEnd: TimeHelper.format(weekEnd, "YYYY-MM-DD"),
        workDays: records.length,
        totalHours: Math.round((stats.totalMinutes / 60) * 10) / 10,
        overtimeHours: Math.round((stats.overtimeMinutes / 60) * 10) / 10,
        avgDailyHours:
          records.length > 0
            ? Math.round((stats.totalMinutes / records.length / 60) * 10) / 10
            : 0,
        records: records,
        analysis: this.analyzeWeeklyPattern(records),
      };
    } catch (error) {
      logger.error("주간 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📈 월간 통계 조회 (완성된 버전)
   */
  async getMonthStats(userId) {
    try {
      const monthStart = TimeHelper.getMonthStart();
      const monthEnd = TimeHelper.getMonthEnd();

      // 👇 누락되었던 데이터베이스 조회 로직
      const records = await this.models.Worktime.find({
        userId: userId,
        date: {
          $gte: TimeHelper.format(monthStart, "YYYY-MM-DD"),
          $lte: TimeHelper.format(monthEnd, "YYYY-MM-DD"),
        },
        isActive: true,
        checkOutTime: { $exists: true },
      }).sort({ date: 1 });

      const stats = this.calculateMonthlyStats(records);

      return {
        month: TimeHelper.format(monthStart, "MM"),
        year: TimeHelper.format(monthStart, "YYYY"),
        workDays: records.length,
        totalHours: Math.round((stats.totalMinutes / 60) * 10) / 10,
        overtimeHours: Math.round((stats.overtimeMinutes / 60) * 10) / 10,
        avgDailyHours:
          records.length > 0
            ? Math.round((stats.totalMinutes / records.length / 60) * 10) / 10
            : 0,
        records: records,
        analysis: this.analyzeMonthlyPattern(records),
      };
    } catch (error) {
      logger.error("월간 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📈 월간 패턴 분석 (누락된 메서드 추가)
   */
  analyzeMonthlyPattern(records) {
    return this.analyzeWeeklyPattern(records);
  }

  /**
   * 📋 근무 이력 조회
   */
  async getWorkHistory(userId, days = 7) {
    try {
      const endDate = TimeHelper.now();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      const records = await this.models.Worktime.find({
        userId: userId,
        date: {
          $gte: TimeHelper.format(startDate, "YYYY-MM-DD"),
          $lte: TimeHelper.format(endDate, "YYYY-MM-DD"),
        },
        isActive: true,
      }).sort({ date: -1 });

      return records.map((record) => ({
        ...record.toObject(),
        workDurationDisplay: this.formatDuration(record.workDuration || 0),
        checkInDisplay: record.checkInTime
          ? TimeHelper.format(record.checkInTime, "HH:mm")
          : null,
        checkOutDisplay: record.checkOutTime
          ? TimeHelper.format(record.checkOutTime, "HH:mm")
          : null,
      }));
    } catch (error) {
      logger.error("근무 이력 조회 실패:", error);
      throw error;
    }
  }

  // ===== 🧮 계산 및 분석 메서드들 =====

  /**
   * ⏱️ 근무시간 계산
   */
  calculateWorkDuration(checkInTime, checkOutTime) {
    const totalMinutes = TimeHelper.diffMinutes(checkInTime, checkOutTime);
    const regularMinutes = Math.min(
      totalMinutes,
      this.config.overtimeThreshold
    );
    const overtimeMinutes = Math.max(
      0,
      totalMinutes - this.config.overtimeThreshold
    );

    return {
      totalMinutes: totalMinutes,
      regularHours: Math.round((regularMinutes / 60) * 10) / 10,
      overtimeHours: Math.round((overtimeMinutes / 60) * 10) / 10,
      displayTime: this.formatDuration(totalMinutes),
      isOvertime: overtimeMinutes > 0,
    };
  }

  /**
   * ⏰ 현재 근무시간 계산 (진행 중)
   */
  calculateCurrentWorkDuration(checkInTime, currentTime) {
    const minutes = TimeHelper.diffMinutes(checkInTime, currentTime);
    return {
      totalMinutes: minutes,
      displayTime: this.formatDuration(minutes),
      hours: Math.round((minutes / 60) * 10) / 10,
      isOvertime: minutes > this.config.overtimeThreshold,
    };
  }

  /**
   * 📊 주간 패턴 분석
   */
  analyzeWeeklyPattern(records) {
    if (records.length === 0) {
      return { trend: "데이터 없음", recommendation: "근무를 시작해보세요" };
    }

    const avgHours =
      records.reduce((sum, r) => sum + (r.workDuration || 0), 0) /
      records.length /
      60;

    let trend = "안정적";
    let recommendation = "좋은 근무 패턴입니다";

    if (avgHours > 9) {
      trend = "고강도";
      recommendation = "적절한 휴식을 취하세요";
    } else if (avgHours < 6) {
      trend = "저강도";
      recommendation = "근무시간을 늘려보세요";
    }

    return { trend, recommendation, avgHours: Math.round(avgHours * 10) / 10 };
  }

  // ===== 💡 추천사항 생성 =====

  /**
   * 💼 출근 시 추천사항
   */
  generateCheckInRecommendations(checkInTime) {
    const recommendations = [];
    const hour = checkInTime.getHours();

    if (hour < 8) {
      recommendations.push("일찍 오셨네요! 오늘도 화이팅! 💪");
    } else if (hour >= 9) {
      recommendations.push("오늘 하루도 열심히 해보세요! 📈");
    } else {
      recommendations.push("정시 출근! 좋은 하루 되세요! ☀️");
    }

    recommendations.push("정기적으로 휴식을 취하세요 ☕");

    return recommendations;
  }

  /**
   * 🏠 퇴근 시 추천사항
   */
  generateCheckOutRecommendations(workDuration) {
    const recommendations = [];

    if (workDuration.isOvertime) {
      recommendations.push("오늘 정말 고생 많으셨습니다! 🌟");
      recommendations.push("충분한 휴식을 취하세요 😴");
    } else if (workDuration.totalMinutes >= 420) {
      // 7시간 이상
      recommendations.push("적절한 근무시간이네요! 👍");
    } else {
      recommendations.push("오늘도 수고하셨습니다! 🎉");
    }

    recommendations.push("내일도 화이팅! 💪");

    return recommendations;
  }

  // ===== 🛠️ 유틸리티 메서드들 =====

  /**
   * ⏱️ 시간 포맷팅
   */
  formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * 🔄 활성 세션 복구
   */
  async recoverActiveSessions() {
    try {
      const today = TimeHelper.format(null, "YYYY-MM-DD");

      const activeRecords = await this.models.Worktime.find({
        date: today,
        checkInTime: { $exists: true },
        checkOutTime: { $exists: false },
        isActive: true,
      });

      for (const record of activeRecords) {
        this.activeSessions.set(record.userId, {
          checkInTime: record.checkInTime,
          userId: record.userId,
          recordId: record._id,
        });
      }

      logger.info(`🔄 ${activeRecords.length}개 활성 세션 복구됨`);
    } catch (error) {
      logger.error("활성 세션 복구 실패:", error);
    }
  }

  /**
   * 📊 오늘 통계 업데이트
   */
  async updateTodayStats() {
    try {
      const now = new Date();

      // 5분마다만 업데이트
      if (
        this.lastStatsUpdate &&
        now - this.lastStatsUpdate < this.config.cacheTimeout
      ) {
        return;
      }

      const today = TimeHelper.format(null, "YYYY-MM-DD");

      const todayRecords = await this.models.Worktime.find({
        date: today,
        isActive: true,
      });

      this.todayStats = {
        totalUsers: todayRecords.length,
        activeUsers: this.activeSessions.size,
        completedSessions: todayRecords.filter((r) => r.checkOutTime).length,
        sessions: todayRecords.length,
        lastUpdate: now,
      };

      this.lastStatsUpdate = now;
    } catch (error) {
      logger.error("오늘 통계 업데이트 실패:", error);
    }
  }

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      activeSessions: this.activeSessions.size,
      cacheEnabled: this.config.enableCache,
      trackingMode: this.config.trackingMode,
      autoBreakEnabled: this.config.autoBreakEnabled,
      dailyGoalHours: this.config.dailyGoalHours,
      totalSessionsToday: this.todayStats?.sessions || 0,
      config: {
        overtimeThreshold: this.config.overtimeThreshold,
        workStartTime: this.config.workStartTime,
        workEndTime: this.config.workEndTime,
      },
    };
  }

  /**
   * 🧹 서비스 정리
   */
  async cleanup() {
    this.activeSessions.clear();
    this.todayStats = null;
    await super.cleanup();
    logger.info("✅ WorktimeService 정리 완료");
  }
}

module.exports = WorktimeService;
