// src/services/TimerService.js - 뽀모도로 타이머 데이터 서비스

const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

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
 *
 * 📌 임시: 기존 더미 모델 사용, 나중에 완전한 모델로 마이그레이션
 */
class TimerService {
  constructor(options = {}) {
    this.serviceName = "TimerService";
    this.config = {
      ...options.config,
    };

    this.isInitialized = false;

    // 메모리 기반 임시 저장소 (개발 중)
    this.sessions = new Map();
    this.stats = new Map();
    this.settings = new Map();
  }

  /**
   * 🎯 서비스 초기화
   */
  async initialize() {
    try {
      // TODO: 나중에 Mongoose 모델 연결
      this.isInitialized = true;
      logger.info("🍅 TimerService 초기화 완료 (임시 메모리 저장소 사용)");
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
      const session = {
        _id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        userName: options.userName || "Unknown",
        type: options.type || "focus",
        duration: options.duration || 25,
        status: "active",
        tags: options.tags || [],
        note: options.note || null,
        cycleNumber: await this.getCurrentCycleNumber(userId),
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.sessions.set(session._id, session);

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
      return this.sessions.get(sessionId);
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
      const session = this.sessions.get(sessionId);
      if (!session) return false;

      Object.assign(session, updates, { updatedAt: new Date() });
      this.sessions.set(sessionId, session);

      return true;
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
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error("세션을 찾을 수 없습니다.");
      }

      session.status = "paused";
      session.pausedAt = new Date();
      this.sessions.set(sessionId, session);

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
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error("세션을 찾을 수 없습니다.");
      }

      if (session.status !== "paused") {
        throw new Error("일시정지된 세션만 재개할 수 있습니다.");
      }

      const pausedTime = Date.now() - new Date(session.pausedAt).getTime();
      session.pausedDuration = (session.pausedDuration || 0) + pausedTime;
      session.status = "active";
      session.resumedAt = new Date();
      this.sessions.set(sessionId, session);

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
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error("세션을 찾을 수 없습니다.");
      }

      session.status = "completed";
      session.completedAt = new Date();
      session.wasCompleted = true;
      this.sessions.set(sessionId, session);

      // 일일 통계 업데이트
      await this.updateDailyStats(
        session.userId,
        "sessionCompleted",
        session.type
      );

      // 오늘 완료한 세션 수 반환
      const todayCount = await this.getTodayCompletedCount(session.userId);

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
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error("세션을 찾을 수 없습니다.");
      }

      session.status = "stopped";
      session.completedAt = new Date();
      session.completedDuration = details.completedDuration || 0;
      session.wasCompleted = false;
      this.sessions.set(sessionId, session);

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
      const session = this.sessions.get(sessionId);
      if (!session) return null;

      session.lastProgress = {
        remainingTime: progress.remainingTime,
        updatedAt: new Date(),
      };
      this.sessions.set(sessionId, session);

      return session;
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
      const statsKey = `${userId}_${dateKey}`;

      let stats = this.stats.get(statsKey) || {
        userId,
        date: dateKey,
        focusStarted: 0,
        focusCompleted: 0,
        focusStopped: 0,
        totalStarted: 0,
        totalCompleted: 0,
        totalStopped: 0,
        totalMinutes: 0,
      };

      // 액션별 업데이트
      switch (action) {
        case "sessionStarted":
          stats[`${sessionType}Started`] =
            (stats[`${sessionType}Started`] || 0) + 1;
          stats.totalStarted++;
          break;
        case "sessionCompleted":
          stats[`${sessionType}Completed`] =
            (stats[`${sessionType}Completed`] || 0) + 1;
          stats.totalCompleted++;
          stats.totalMinutes +=
            sessionType === "focus"
              ? 25
              : sessionType === "shortBreak"
              ? 5
              : 15;
          break;
        case "sessionStopped":
          stats[`${sessionType}Stopped`] =
            (stats[`${sessionType}Stopped`] || 0) + 1;
          stats.totalStopped++;
          break;
      }

      this.stats.set(statsKey, stats);
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
      const statsKey = `${userId}_${dateKey}`;

      const stats = this.stats.get(statsKey);

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

      // 메모리에서 해당 기간의 통계 수집
      const allStats = [];
      for (const [key, stats] of this.stats) {
        if (
          stats.userId === userId &&
          stats.date >= TimeHelper.format(startDate, "YYYY-MM-DD") &&
          stats.date <= TimeHelper.format(endDate, "YYYY-MM-DD")
        ) {
          allStats.push(stats);
        }
      }

      allStats.sort((a, b) => b.date.localeCompare(a.date));

      // 집계
      const summary = {
        period,
        startDate: TimeHelper.format(startDate, "YYYY-MM-DD"),
        endDate: TimeHelper.format(endDate, "YYYY-MM-DD"),
        totalDays: allStats.length,
        totalSessions: 0,
        totalMinutes: 0,
        avgSessionsPerDay: 0,
        avgMinutesPerDay: 0,
        bestDay: null,
        dailyStats: allStats,
      };

      // 합계 계산
      allStats.forEach((day) => {
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

      const userSessions = Array.from(this.sessions.values())
        .filter(
          (s) =>
            s.userId === userId &&
            (s.status === "completed" || s.status === "stopped")
        )
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

      const sessions = userSessions.slice(skip, skip + limit);
      const total = userSessions.length;

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
      let settings = this.settings.get(userId);

      if (!settings) {
        // 기본 설정
        settings = {
          userId,
          focusDuration: 25,
          shortBreakDuration: 5,
          longBreakDuration: 15,
          sessionsBeforeLongBreak: 4,
          enableNotifications: true,
          enableStats: true,
          autoStartBreak: false,
          dailyGoal: 8,
          preferredTags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.settings.set(userId, settings);
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
      const settings = await this.getUserSettings(userId);
      Object.assign(settings, updates, { updatedAt: new Date() });
      this.settings.set(userId, settings);

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
      return Array.from(this.sessions.values()).filter(
        (s) => s.status === "active" || s.status === "paused"
      );
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
      const today = TimeHelper.now();
      const startOfDay = TimeHelper.setTime(today, 0, 0, 0);

      return Array.from(this.sessions.values()).filter(
        (s) =>
          s.userId === userId &&
          s.status === "completed" &&
          new Date(s.completedAt) >= startOfDay
      ).length;
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
    const endDate = TimeHelper.now();
    let startDate;

    switch (period) {
      case "today":
        startDate = TimeHelper.setTime(endDate, 0, 0, 0);
        break;
      case "week":
        startDate = TimeHelper.addDays(endDate, -6);
        break;
      case "month":
        startDate = TimeHelper.addDays(endDate, -30);
        break;
      case "year":
        startDate = TimeHelper.addDays(endDate, -365);
        break;
      default:
        startDate = TimeHelper.addDays(endDate, -6);
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
      date: TimeHelper.format(null, "date"), // YYYY-MM-DD
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

      let deletedCount = 0;
      for (const [sessionId, session] of this.sessions) {
        if (session.completedAt && new Date(session.completedAt) < cutoffDate) {
          this.sessions.delete(sessionId);
          deletedCount++;
        }
      }

      logger.info(`🧹 ${deletedCount}개의 오래된 세션 정리 완료`);
      return deletedCount;
    } catch (error) {
      logger.error("오래된 세션 정리 실패:", error);
      return 0;
    }
  }

  /**
   * 📊 서비스 상태 조회
   */
  getStatus() {
    return {
      serviceName: this.serviceName,
      isInitialized: this.isInitialized,
      message: "Timer service is running (memory storage)",
      stats: {
        totalSessions: this.sessions.size,
        activeSessions: Array.from(this.sessions.values()).filter(
          (s) => s.status === "active"
        ).length,
        totalStats: this.stats.size,
        totalSettings: this.settings.size,
      },
    };
  }

  /**
   * 🧹 서비스 정리
   */
  async cleanup() {
    try {
      // 메모리 정리
      this.sessions.clear();
      this.stats.clear();
      this.settings.clear();

      logger.info("✅ TimerService 정리 완료");
    } catch (error) {
      logger.error("❌ TimerService 정리 실패:", error);
    }
  }
}

module.exports = TimerService;
