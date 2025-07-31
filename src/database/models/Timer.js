// src/services/TimerService.js - 뽀모도로 타이머 데이터 서비스

const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");
const {
  TimerSession,
  TimerStats,
  TimerSettings,
  TimerTag,
} = require("../database/models/Timer");

/**
 * 🍅 TimerService - 뽀모도로 타이머 데이터 관리 서비스
 *
 * 🎯 책임:
 * - 세션 데이터 관리 (생성, 조회, 수정, 삭제)
 * - 통계 집계 및 분석
 * - 타이머 상태 지속성 관리
 * - 사용자 설정 관리
 *
 * ✅ SoC: 데이터 로직만 담당, UI나 타이머 동작은 다루지 않음
 */
class TimerService extends BaseService {
  constructor(options = {}) {
    super("TimerService", options);

    this.config = {
      ...options.config,
    };
  }

  /**
   * 🎯 서비스 초기화
   */
  async onInitialize() {
    try {
      // Mongoose는 자동으로 연결 관리하므로 특별한 초기화 불필요
      logger.info("🍅 TimerService 초기화 완료");
    } catch (error) {
      logger.error("TimerService 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 📝 세션 관리 =====

  /**
   * 🆕 새 세션 시작
   */
  async startSession(userId, options = {}) {
    try {
      const session = new TimerSession({
        userId,
        userName: options.userName || "Unknown",
        type: options.type || "focus",
        duration: options.duration || 25,
        status: "active",
        tags: options.tags || [],
        note: options.note || null,
        cycleNumber: await this.getCurrentCycleNumber(userId),
      });

      await session.save();

      // 일일 통계 업데이트
      await this.updateDailyStats(userId, "sessionStarted", session.type);

      logger.info(`🍅 세션 시작: ${userId} - ${session.type}`);
      return session;
    } catch (error) {
      logger.error("세션 시작 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 세션 조회
   */
  async getSession(sessionId) {
    try {
      return await TimerSession.findById(sessionId);
    } catch (error) {
      logger.error("세션 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 🔄 세션 업데이트
   */
  async updateSession(sessionId, updates) {
    try {
      const session = await TimerSession.findByIdAndUpdate(
        sessionId,
        { $set: updates },
        { new: true }
      );

      return !!session;
    } catch (error) {
      logger.error("세션 업데이트 실패:", error);
      throw error;
    }
  }

  /**
   * ⏸️ 세션 일시정지
   */
  async pauseSession(sessionId) {
    try {
      const session = await TimerSession.findById(sessionId);
      if (!session) {
        throw new Error("세션을 찾을 수 없습니다.");
      }

      await session.pause();
      return true;
    } catch (error) {
      logger.error("세션 일시정지 실패:", error);
      throw error;
    }
  }

  /**
   * ▶️ 세션 재개
   */
  async resumeSession(sessionId) {
    try {
      const session = await TimerSession.findById(sessionId);
      if (!session) {
        throw new Error("세션을 찾을 수 없습니다.");
      }

      await session.resume();
      return true;
    } catch (error) {
      logger.error("세션 재개 실패:", error);
      throw error;
    }
  }

  /**
   * ✅ 세션 완료
   */
  async completeSession(sessionId) {
    try {
      const session = await TimerSession.findById(sessionId);
      if (!session) {
        throw new Error("세션을 찾을 수 없습니다.");
      }

      await session.complete();

      // 일일 통계 업데이트
      await this.updateDailyStats(
        session.userId,
        "sessionCompleted",
        session.type
      );

      // 오늘 완료한 세션 수 반환
      const todayCount = await TimerSession.countTodayCompleted(session.userId);

      return {
        session,
        todayCount,
        shouldTakeLongBreak: todayCount % 4 === 0,
      };
    } catch (error) {
      logger.error("세션 완료 실패:", error);
      throw error;
    }
  }

  /**
   * ⏹️ 세션 종료 (미완료)
   */
  async endSession(sessionId, details = {}) {
    try {
      const session = await TimerSession.findById(sessionId);
      if (!session) {
        throw new Error("세션을 찾을 수 없습니다.");
      }

      session.status = "stopped";
      session.completedAt = new Date();
      session.completedDuration = details.completedDuration || 0;
      session.wasCompleted = false;
      await session.save();

      // 일일 통계 업데이트
      await this.updateDailyStats(
        session.userId,
        "sessionStopped",
        session.type
      );

      return {
        session,
        completedPercentage: Math.round(
          (details.completedDuration / (session.duration * 60)) * 100
        ),
      };
    } catch (error) {
      logger.error("세션 종료 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 진행 상황 업데이트
   */
  async updateProgress(sessionId, progress) {
    try {
      return await TimerSession.findByIdAndUpdate(sessionId, {
        $set: {
          lastProgress: {
            remainingTime: progress.remainingTime,
            updatedAt: new Date(),
          },
        },
      });
    } catch (error) {
      logger.error("진행 상황 업데이트 실패:", error);
      throw error;
    }
  }

  // ===== 📊 통계 관리 =====

  /**
   * 📊 일일 통계 업데이트
   */
  async updateDailyStats(userId, action, sessionType) {
    try {
      const today = TimeHelper.getKoreanDate();
      const dateKey = TimeHelper.format(today, "YYYY-MM-DD");

      const updates = { $inc: {} };

      // 액션별 업데이트
      switch (action) {
        case "sessionStarted":
          updates.$inc[`${sessionType}Started`] = 1;
          updates.$inc.totalStarted = 1;
          break;
        case "sessionCompleted":
          updates.$inc[`${sessionType}Completed`] = 1;
          updates.$inc.totalCompleted = 1;
          updates.$inc.totalMinutes =
            sessionType === "focus"
              ? 25
              : sessionType === "shortBreak"
              ? 5
              : 15;
          break;
        case "sessionStopped":
          updates.$inc[`${sessionType}Stopped`] = 1;
          updates.$inc.totalStopped = 1;
          break;
      }

      await TimerStats.findOneAndUpdate({ userId, date: dateKey }, updates, {
        upsert: true,
        new: true,
      });
    } catch (error) {
      logger.error("일일 통계 업데이트 실패:", error);
    }
  }

  /**
   * 📊 오늘 통계 조회
   */
  async getTodayStats(userId) {
    try {
      const today = TimeHelper.getKoreanDate();
      const dateKey = TimeHelper.format(today, "YYYY-MM-DD");

      const stats = await TimerStats.findOne({ userId, date: dateKey });

      if (!stats) {
        return this.getEmptyStats();
      }

      return {
        date: dateKey,
        focusCompleted: stats.focusCompleted || 0,
        totalCompleted: stats.totalCompleted || 0,
        totalMinutes: stats.totalMinutes || 0,
        totalStarted: stats.totalStarted || 0,
        totalStopped: stats.totalStopped || 0,
        productivityRate: this.calculateProductivityRate(stats),
      };
    } catch (error) {
      logger.error("오늘 통계 조회 실패:", error);
      return this.getEmptyStats();
    }
  }

  /**
   * 📊 기간별 통계 조회
   */
  async getStats(userId, period = "week") {
    try {
      const { startDate, endDate } = this.getDateRange(period);

      const stats = await TimerStats.find({
        userId,
        date: {
          $gte: TimeHelper.format(startDate, "YYYY-MM-DD"),
          $lte: TimeHelper.format(endDate, "YYYY-MM-DD"),
        },
      }).sort({ date: -1 });

      // 집계
      const summary = {
        period,
        startDate: TimeHelper.format(startDate, "YYYY-MM-DD"),
        endDate: TimeHelper.format(endDate, "YYYY-MM-DD"),
        totalDays: stats.length,
        totalSessions: 0,
        totalMinutes: 0,
        avgSessionsPerDay: 0,
        avgMinutesPerDay: 0,
        bestDay: null,
        dailyStats: stats,
      };

      // 합계 계산
      stats.forEach((day) => {
        summary.totalSessions += day.totalCompleted || 0;
        summary.totalMinutes += day.totalMinutes || 0;

        if (
          !summary.bestDay ||
          day.totalCompleted > summary.bestDay.totalCompleted
        ) {
          summary.bestDay = day;
        }
      });

      // 평균 계산
      if (summary.totalDays > 0) {
        summary.avgSessionsPerDay =
          Math.round((summary.totalSessions / summary.totalDays) * 10) / 10;
        summary.avgMinutesPerDay = Math.round(
          summary.totalMinutes / summary.totalDays
        );
      }

      return summary;
    } catch (error) {
      logger.error("기간별 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 세션 히스토리 조회
   */
  async getHistory(userId, options = {}) {
    try {
      const limit = options.limit || 20;
      const skip = options.skip || 0;

      const sessions = await TimerSession.find({
        userId,
        status: { $in: ["completed", "stopped"] },
      })
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await TimerSession.countDocuments({
        userId,
        status: { $in: ["completed", "stopped"] },
      });

      return {
        sessions,
        total,
        hasMore: total > skip + limit,
      };
    } catch (error) {
      logger.error("세션 히스토리 조회 실패:", error);
      throw error;
    }
  }

  // ===== 🔧 사용자 설정 =====

  /**
   * ⚙️ 사용자 설정 조회
   */
  async getUserSettings(userId) {
    try {
      let settings = await TimerSettings.findOne({ userId });

      if (!settings) {
        // 기본 설정으로 생성
        settings = new TimerSettings({ userId });
        await settings.save();
      }

      return settings;
    } catch (error) {
      logger.error("사용자 설정 조회 실패:", error);
      throw error;
    }
  }

  /**
   * ⚙️ 사용자 설정 업데이트
   */
  async updateUserSettings(userId, updates) {
    try {
      const settings = await TimerSettings.findOneAndUpdate(
        { userId },
        { $set: updates },
        { upsert: true, new: true }
      );

      return settings;
    } catch (error) {
      logger.error("사용자 설정 업데이트 실패:", error);
      throw error;
    }
  }

  // ===== 🔍 조회 헬퍼 =====

  /**
   * 🔍 활성 세션 조회
   */
  async getActiveSessions() {
    try {
      return await TimerSession.findActiveSessions();
    } catch (error) {
      logger.error("활성 세션 조회 실패:", error);
      return [];
    }
  }

  /**
   * 🔍 오늘 완료한 세션 수
   */
  async getTodayCompletedCount(userId) {
    try {
      return await TimerSession.countTodayCompleted(userId);
    } catch (error) {
      logger.error("오늘 완료 세션 수 조회 실패:", error);
      return 0;
    }
  }

  /**
   * 🔍 현재 사이클 번호
   */
  async getCurrentCycleNumber(userId) {
    try {
      const todayCount = await this.getTodayCompletedCount(userId);
      return Math.floor(todayCount / 4) + 1;
    } catch (error) {
      return 1;
    }
  }

  // ===== 🛠️ 유틸리티 =====

  /**
   * 📅 기간 계산
   */
  getDateRange(period) {
    const endDate = TimeHelper.getKoreanDate();
    let startDate;

    switch (period) {
      case "today":
        startDate = new Date(endDate);
        break;
      case "week":
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        break;
      case "month":
        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "year":
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
    }

    return { startDate, endDate };
  }

  /**
   * 📊 생산성 비율 계산
   */
  calculateProductivityRate(stats) {
    if (!stats || !stats.totalStarted) return 0;
    return Math.round((stats.totalCompleted / stats.totalStarted) * 100);
  }

  /**
   * 📊 빈 통계 객체
   */
  getEmptyStats() {
    return {
      date: TimeHelper.format(new Date(), "YYYY-MM-DD"),
      focusCompleted: 0,
      totalCompleted: 0,
      totalMinutes: 0,
      totalStarted: 0,
      totalStopped: 0,
      productivityRate: 0,
    };
  }

  /**
   * 🧹 오래된 세션 정리
   */
  async cleanupOldSessions(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await TimerSession.deleteMany({
        completedAt: { $lt: cutoffDate },
      });

      logger.info(`🧹 ${result.deletedCount}개의 오래된 세션 정리 완료`);
      return result.deletedCount;
    } catch (error) {
      logger.error("오래된 세션 정리 실패:", error);
      return 0;
    }
  }
}

module.exports = TimerService;
