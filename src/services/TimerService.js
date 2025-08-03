// src/services/TimerService.js - 🍅 완전 리팩토링 v2.0

const BaseService = require("./BaseService");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/Logger");

/**
 * 🍅 TimerService - 뽀모도로 타이머 데이터 서비스 (완전 표준 준수)
 *
 * ✅ 표준 준수:
 * - BaseService 상속 ✅
 * - onInitialize() 구현 ✅
 * - createSuccessResponse() / createErrorResponse() 사용 ✅
 * - getRequiredModels() 구현 ✅
 *
 * ✨ 새로운 기능:
 * - Timer + TimerStats 모델 활용
 * - 통계 자동 집계
 * - 세션 복구 기능
 * - 성능 최적화된 쿼리
 */
class TimerService extends BaseService {
  constructor(options = {}) {
    super("TimerService", options);

    // 🔧 설정
    this.config = {
      maxActiveSessions: parseInt(process.env.TIMER_MAX_ACTIVE_SESSIONS) || 3,
      sessionTimeout: parseInt(process.env.TIMER_SESSION_TIMEOUT) || 7200000, // 2시간
      enableStats: process.env.TIMER_ENABLE_STATS !== "false",
      enableRecovery: process.env.TIMER_ENABLE_RECOVERY !== "false",
      ...options.config
    };

    // 📊 통계 캐시
    this.statsCache = new Map();
    this.statsCacheTimeout = 300000; // 5분

    logger.info("🍅 TimerService 생성됨 (표준 준수)");
  }

  /**
   * 🎯 필수 모델 정의 (표준)
   */
  getRequiredModels() {
    return ["Timer", "TimerStats"];
  }

  /**
   * 🎯 서비스 초기화 (표준 onInitialize 패턴)
   */
  async onInitialize() {
    try {
      // 모델 검증
      if (!this.models.Timer) {
        throw new Error("Timer 모델을 찾을 수 없습니다");
      }

      if (!this.models.TimerStats) {
        throw new Error("TimerStats 모델을 찾을 수 없습니다");
      }

      // 복구 기능 활성화시 기존 세션 정리
      if (this.config.enableRecovery) {
        await this.recoverAbandonedSessions();
      }

      // 통계 캐시 정리 스케줄
      this.startStatsCacheCleanup();

      logger.success("🍅 TimerService 초기화 완료 - 표준 준수");
    } catch (error) {
      logger.error("❌ TimerService 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 🎯 핵심 비즈니스 로직 =====

  /**
   * ▶️ 타이머 세션 시작
   */
  async startSession(userId, sessionData) {
    try {
      const { type, duration, userName } = sessionData;

      // 입력 검증
      if (!type || !duration) {
        return this.createErrorResponse(
          new Error("INVALID_INPUT"),
          "타이머 타입과 지속시간이 필요합니다."
        );
      }

      // 활성 세션 수 확인
      const activeCount = await this.getActiveSessionCount(userId);
      if (activeCount >= this.config.maxActiveSessions) {
        return this.createErrorResponse(
          new Error("TOO_MANY_SESSIONS"),
          `최대 ${this.config.maxActiveSessions}개의 타이머만 동시에 실행할 수 있습니다.`
        );
      }

      // Timer 세션 생성
      const timerSession = new this.models.Timer({
        userId: userId.toString(),
        userName: userName || "Unknown User",
        type: this.normalizeTimerType(type),
        duration: parseInt(duration),
        status: "active",
        startedAt: new Date(),
        isActive: true,

        // 진행 상황 초기화
        lastProgress: {
          remainingTime: duration * 60, // 초로 변환
          updatedAt: new Date()
        }
      });

      const savedSession = await timerSession.save();

      // 통계 업데이트 (비동기)
      if (this.config.enableStats) {
        this.updateDailyStats(userId, type, "started").catch((error) => {
          logger.warn("통계 업데이트 실패:", error);
        });
      }

      logger.info(`▶️ 타이머 세션 시작: ${userId} - ${type} (${duration}분)`);

      return this.createSuccessResponse(
        this.transformSessionData(savedSession),
        "타이머 세션이 시작되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.startSession 오류:", error);
      return this.createErrorResponse(error, "타이머 시작에 실패했습니다.");
    }
  }

  /**
   * ⏸️ 타이머 세션 일시정지
   */
  async pauseSession(sessionId) {
    try {
      const session = await this.findActiveSession(sessionId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      if (session.status === "paused") {
        return this.createErrorResponse(
          new Error("ALREADY_PAUSED"),
          "이미 일시정지된 세션입니다."
        );
      }

      // 일시정지 처리
      await session.pause();

      logger.info(`⏸️ 타이머 일시정지: ${session.userId} - ${sessionId}`);

      return this.createSuccessResponse(
        this.transformSessionData(session),
        "타이머가 일시정지되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.pauseSession 오류:", error);
      return this.createErrorResponse(error, "일시정지에 실패했습니다.");
    }
  }

  /**
   * ▶️ 타이머 세션 재개
   */
  async resumeSession(sessionId) {
    try {
      const session = await this.findActiveSession(sessionId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      if (session.status !== "paused") {
        return this.createErrorResponse(
          new Error("NOT_PAUSED"),
          "일시정지 상태가 아닙니다."
        );
      }

      // 재개 처리
      await session.resume();

      logger.info(`▶️ 타이머 재개: ${session.userId} - ${sessionId}`);

      return this.createSuccessResponse(
        this.transformSessionData(session),
        "타이머가 재개되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.resumeSession 오류:", error);
      return this.createErrorResponse(error, "재개에 실패했습니다.");
    }
  }

  /**
   * ⏹️ 타이머 세션 중지
   */
  async stopSession(sessionId) {
    try {
      const session = await this.findActiveSession(sessionId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      // 중지 처리
      await session.stop();

      // 통계 업데이트 (비동기)
      if (this.config.enableStats) {
        this.updateDailyStats(session.userId, session.type, "stopped").catch(
          (error) => {
            logger.warn("통계 업데이트 실패:", error);
          }
        );
      }

      logger.info(`⏹️ 타이머 중지: ${session.userId} - ${sessionId}`);

      return this.createSuccessResponse(
        this.transformSessionData(session),
        "타이머가 중지되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.stopSession 오류:", error);
      return this.createErrorResponse(error, "중지에 실패했습니다.");
    }
  }

  /**
   * ✅ 타이머 세션 완료
   */
  async completeSession(sessionId) {
    try {
      const session = await this.findActiveSession(sessionId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      // 완료 처리
      await session.complete();

      // 통계 업데이트 (비동기)
      if (this.config.enableStats) {
        this.updateDailyStats(session.userId, session.type, "completed").catch(
          (error) => {
            logger.warn("통계 업데이트 실패:", error);
          }
        );
      }

      logger.info(`✅ 타이머 완료: ${session.userId} - ${sessionId}`);

      return this.createSuccessResponse(
        this.transformSessionData(session),
        "타이머가 완료되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.completeSession 오류:", error);
      return this.createErrorResponse(error, "완료 처리에 실패했습니다.");
    }
  }

  /**
   * 📊 사용자 통계 조회
   */
  async getUserStats(userId, options = {}) {
    try {
      const {
        startDate = TimeHelper.getDateString(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ), // 30일 전
        endDate = TimeHelper.getTodayDateString(),
        useCache = true
      } = options;

      // 캐시 확인
      const cacheKey = `stats_${userId}_${startDate}_${endDate}`;
      if (useCache && this.statsCache.has(cacheKey)) {
        const cached = this.statsCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.statsCacheTimeout) {
          return this.createSuccessResponse(
            cached.data,
            "통계 조회 완료 (캐시)"
          );
        }
      }

      // DB에서 통계 조회
      const stats = await this.models.TimerStats.getStatsByDateRange(
        userId,
        startDate,
        endDate
      );

      // 집계 계산
      const aggregated = this.aggregateStats(stats);

      // 캐시 저장
      if (useCache) {
        this.statsCache.set(cacheKey, {
          data: aggregated,
          timestamp: Date.now()
        });
      }

      return this.createSuccessResponse(aggregated, "통계 조회 완료");
    } catch (error) {
      logger.error("TimerService.getUserStats 오류:", error);
      return this.createErrorResponse(error, "통계 조회에 실패했습니다.");
    }
  }

  /**
   * 📝 세션 진행률 업데이트
   */
  async updateSessionProgress(sessionId, remainingTime) {
    try {
      const session = await this.findActiveSession(sessionId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      // 진행률 업데이트
      session.lastProgress = {
        remainingTime: Math.max(0, parseInt(remainingTime)),
        updatedAt: new Date()
      };

      await session.save();

      return this.createSuccessResponse(
        this.transformSessionData(session),
        "진행률이 업데이트되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.updateSessionProgress 오류:", error);
      return this.createErrorResponse(error, "진행률 업데이트에 실패했습니다.");
    }
  }

  // ===== 🛠️ 헬퍼 메서드들 =====

  /**
   * 🔍 활성 세션 조회
   */
  async findActiveSession(sessionId) {
    try {
      return await this.models.Timer.findOne({
        _id: sessionId,
        status: { $in: ["active", "paused"] },
        isActive: true
      });
    } catch (error) {
      logger.error("활성 세션 조회 실패:", error);
      return null;
    }
  }

  /**
   * 📊 활성 세션 수 조회
   */
  async getActiveSessionCount(userId) {
    try {
      return await this.models.Timer.countDocuments({
        userId: userId.toString(),
        status: { $in: ["active", "paused"] },
        isActive: true
      });
    } catch (error) {
      logger.error("활성 세션 수 조회 실패:", error);
      return 0;
    }
  }

  /**
   * 🏷️ 타이머 타입 정규화
   */
  normalizeTimerType(type) {
    const typeMap = {
      focus: "focus",
      short: "shortBreak",
      long: "longBreak",
      shortBreak: "shortBreak",
      longBreak: "longBreak"
    };

    return typeMap[type] || "focus";
  }

  /**
   * 🔄 세션 데이터 변환 (UI용)
   */
  transformSessionData(session) {
    if (!session) return null;

    const sessionObj = session.toObject ? session.toObject() : session;

    return {
      ...sessionObj,

      // 시간 정보 안전 변환
      startedAt: TimeHelper.safeDisplayTime(sessionObj.startedAt),
      completedAt: TimeHelper.safeDisplayTime(sessionObj.completedAt),
      pausedAt: TimeHelper.safeDisplayTime(sessionObj.pausedAt),
      resumedAt: TimeHelper.safeDisplayTime(sessionObj.resumedAt),

      // 표시용 필드
      durationDisplay: `${sessionObj.duration}분`,
      statusDisplay: this.getStatusDisplay(sessionObj.status),
      typeDisplay: this.getTypeDisplay(sessionObj.type),

      // 진행률 정보
      progress: sessionObj.lastProgress
        ? {
            ...sessionObj.lastProgress,
            updatedAtDisplay: TimeHelper.safeDisplayTime(
              sessionObj.lastProgress.updatedAt
            )
          }
        : null
    };
  }

  /**
   * 🏷️ 상태 표시명
   */
  getStatusDisplay(status) {
    const statusMap = {
      active: "실행중",
      paused: "일시정지",
      completed: "완료",
      stopped: "중지"
    };

    return statusMap[status] || "알 수 없음";
  }

  /**
   * 🏷️ 타입 표시명
   */
  getTypeDisplay(type) {
    const typeMap = {
      focus: "집중 시간",
      shortBreak: "짧은 휴식",
      longBreak: "긴 휴식"
    };

    return typeMap[type] || "커스텀";
  }

  /**
   * 📊 일일 통계 업데이트
   */
  async updateDailyStats(userId, type, action) {
    try {
      const today = TimeHelper.getTodayDateString();
      const updates = {};

      // 타입별 액션 카운트
      const actionKey = `${this.normalizeTimerType(type)}${action.charAt(0).toUpperCase() + action.slice(1)}`;
      updates[actionKey] = 1;
      updates[`total${action.charAt(0).toUpperCase() + action.slice(1)}`] = 1;

      await this.models.TimerStats.updateDaily(userId, today, updates);

      // 통계 캐시 무효화
      this.invalidateStatsCache(userId);
    } catch (error) {
      logger.error("일일 통계 업데이트 실패:", error);
    }
  }

  /**
   * 📈 통계 집계
   */
  aggregateStats(statsArray) {
    if (!statsArray.length) {
      return {
        totalDays: 0,
        totalSessions: 0,
        totalMinutes: 0,
        averageSessionsPerDay: 0,
        averageMinutesPerDay: 0,
        completionRate: 0,
        favoriteType: "focus",
        streak: {
          current: 0,
          longest: 0
        }
      };
    }

    const totals = statsArray.reduce(
      (acc, stat) => {
        acc.totalDays += 1;
        acc.totalCompleted += stat.totalCompleted || 0;
        acc.totalStarted += stat.totalStarted || 0;
        acc.totalMinutes += stat.totalMinutes || 0;
        acc.focusCompleted += stat.focusCompleted || 0;
        acc.shortBreakCompleted += stat.shortBreakCompleted || 0;
        acc.longBreakCompleted += stat.longBreakCompleted || 0;
        return acc;
      },
      {
        totalDays: 0,
        totalCompleted: 0,
        totalStarted: 0,
        totalMinutes: 0,
        focusCompleted: 0,
        shortBreakCompleted: 0,
        longBreakCompleted: 0
      }
    );

    // 선호 타입 계산
    const typeCounts = {
      focus: totals.focusCompleted,
      shortBreak: totals.shortBreakCompleted,
      longBreak: totals.longBreakCompleted
    };

    const favoriteType = Object.keys(typeCounts).reduce((a, b) =>
      typeCounts[a] > typeCounts[b] ? a : b
    );

    return {
      totalDays: totals.totalDays,
      totalSessions: totals.totalCompleted,
      totalMinutes: totals.totalMinutes,
      averageSessionsPerDay:
        Math.round((totals.totalCompleted / totals.totalDays) * 10) / 10,
      averageMinutesPerDay:
        Math.round((totals.totalMinutes / totals.totalDays) * 10) / 10,
      completionRate:
        totals.totalStarted > 0
          ? Math.round((totals.totalCompleted / totals.totalStarted) * 100)
          : 0,
      favoriteType: favoriteType,
      typeCounts: typeCounts,
      streak: this.calculateStreak(statsArray)
    };
  }

  /**
   * 🔥 연속 기록 계산
   */
  calculateStreak(statsArray) {
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // 최신 날짜부터 역순으로 확인
    const sorted = statsArray.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    for (const stat of sorted) {
      if (stat.totalCompleted > 0) {
        tempStreak++;
        if (tempStreak === 1) currentStreak = tempStreak;
      } else {
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        tempStreak = 0;
      }
    }

    if (tempStreak > longestStreak) longestStreak = tempStreak;

    return {
      current: currentStreak,
      longest: longestStreak
    };
  }

  /**
   * 🔄 버려진 세션 복구
   */
  async recoverAbandonedSessions() {
    try {
      const cutoffTime = new Date(Date.now() - this.config.sessionTimeout);

      const abandonedSessions = await this.models.Timer.find({
        status: { $in: ["active", "paused"] },
        updatedAt: { $lt: cutoffTime },
        isActive: true
      });

      for (const session of abandonedSessions) {
        session.status = "stopped";
        session.stoppedAt = new Date();
        await session.save();

        logger.info(`🔄 버려진 세션 복구: ${session.userId} - ${session._id}`);
      }

      if (abandonedSessions.length > 0) {
        logger.info(
          `🔄 총 ${abandonedSessions.length}개의 버려진 세션을 복구했습니다.`
        );
      }
    } catch (error) {
      logger.error("버려진 세션 복구 실패:", error);
    }
  }

  /**
   * 🧹 통계 캐시 정리
   */
  startStatsCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      const toDelete = [];

      for (const [key, value] of this.statsCache.entries()) {
        if (now - value.timestamp > this.statsCacheTimeout) {
          toDelete.push(key);
        }
      }

      toDelete.forEach((key) => this.statsCache.delete(key));

      if (toDelete.length > 0) {
        logger.debug(`🧹 통계 캐시 ${toDelete.length}개 항목 정리됨`);
      }
    }, this.statsCacheTimeout);
  }

  /**
   * 🗑️ 통계 캐시 무효화
   */
  invalidateStatsCache(userId) {
    const toDelete = [];

    for (const key of this.statsCache.keys()) {
      if (key.includes(`stats_${userId}_`)) {
        toDelete.push(key);
      }
    }

    toDelete.forEach((key) => this.statsCache.delete(key));
  }

  /**
   * 🧹 서비스 정리
   */
  async cleanup() {
    this.statsCache.clear();
    await super.cleanup();
  }
}

module.exports = TimerService;
