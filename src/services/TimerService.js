// src/services/TimerService.js - 🍅 SoC 완전 준수 리팩토링 v4.0

const BaseService = require("./BaseService");
const TimeHelper = require("../utils/TimeHelper");
const logger = require("../utils/core/Logger");

/**
 * 🍅 TimerService - 타이머 데이터 서비스 (SoC 완전 준수)
 *
 * ✅ SoC 원칙 준수:
 * - 데이터베이스 작업만 전담
 * - 비즈니스 로직 없음 (모듈에 위임)
 * - UI 생성 없음 (렌더러에 위임)
 * - 순수 데이터 CRUD 작업
 *
 * ✅ 표준 준수:
 * - BaseService 상속 ✅
 * - onInitialize() 구현 ✅
 * - createSuccessResponse() / createErrorResponse() 사용 ✅
 * - getRequiredModels() 구현 ✅
 *
 * ✅ 새로운 기능:
 * - 뽀모도로 세트 관리
 * - 주간 통계 집계
 * - 뱃지 계산용 데이터
 * - 사용자별 설정 관리
 */
class TimerService extends BaseService {
  constructor(options = {}) {
    super("TimerService", options);

    // 🔧 설정
    this.config = {
      maxActiveSessions: parseInt(process.env.TIMER_MAX_ACTIVE_SESSIONS) || 1,
      sessionTimeout: parseInt(process.env.TIMER_SESSION_TIMEOUT) || 7200000, // 2시간
      enableStats: process.env.TIMER_ENABLE_STATS !== "false",
      ...options.config
    };

    // 📊 캐시 설정
    this.statsCache = new Map();
    this.statsCacheTimeout = 300000; // 5분

    logger.info("🍅 TimerService 생성됨 (최적화 v4.1)");
  }

  /**
   * 🎯 필수 모델 정의 (표준)
   */
  getRequiredModels() {
    return ["Timer", "TimerStats", "TimerSettings"];
  }

  /**
   * 🎯 서비스 초기화 (표준 onInitialize)
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
      if (!this.models.TimerSettings) {
        logger.warn("TimerSettings 모델이 없습니다. 기본 설정 사용");
      }

      // 인덱스 생성
      await this.createIndexes();

      // 오래된 세션 정리
      await this.cleanupOldSessions();

      // 통계 캐시 정리 스케줄
      this.startCacheCleanup();

      logger.success("🍅 TimerService 초기화 완료");
    } catch (error) {
      logger.error("❌ TimerService 초기화 실패:", error);
      throw error;
    }
  }

  // ===== 📊 세션 관리 (CRUD) =====

  /**
   * 헬퍼: 사용자 ID로 활성 세션을 찾는 핵심 함수
   */
  async findActiveSessionByUserId(userId) {
    return this.models.Timer.findOne({
      userId: userId.toString(),
      status: { $in: ["active", "paused"] },
      isActive: true
    }).sort({ startedAt: -1 });
  }

  /**
   * 헬퍼: 세션 상태를 업데이트하는 통합 함수
   */
  async updateSessionStatus(userId, newStatus, updates = {}) {
    try {
      const session = await this.findActiveSessionByUserId(userId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "활성 타이머 세션을 찾을 수 없습니다."
        );
      }

      session.status = newStatus;
      Object.assign(session, updates); // 추가 데이터 업데이트

      await session.save();
      logger.info(`🔄 세션 상태 변경: ${userId} -> ${newStatus}`);
      return this.createSuccessResponse(
        this.transformSessionData(session),
        "세션 상태가 업데이트되었습니다."
      );
    } catch (error) {
      logger.error(`세션 상태 변경 실패 (${newStatus}):`, error);
      return this.createErrorResponse(error, "세션 상태 변경에 실패했습니다.");
    }
  }

  /**
   * ▶️ 세션 시작
   */
  async startSession(userId, sessionData) {
    try {
      const { type, duration, userName } = sessionData;
      if (!type || !duration) {
        return this.createErrorResponse(
          new Error("INVALID_INPUT"),
          "타이머 타입과 시간이 필요합니다."
        );
      }

      // 먼저 기존 활성 세션이 있는지 확인
      const existingSession = await this.findActiveSessionByUserId(userId);
      if (existingSession) {
        logger.warn(
          `사용자 ${userId}에게 이미 활성 세션이 있습니다: ${existingSession._id}`
        );
        return this.createErrorResponse(
          new Error("MAX_SESSIONS"),
          "이미 실행 중인 타이머가 있습니다."
        );
      }

      const session = new this.models.Timer({
        userId: userId.toString(),
        userName,
        type,
        duration,
        remainingTime: duration * 60,
        status: "active",
        isActive: true, // ✅ 추가됨
        startedAt: new Date(),
        lastProgress: { remainingTime: duration * 60, updatedAt: new Date() }
      });

      await session.save();
      logger.info(`▶️ 세션 시작: ${userId} - ${type} (${duration}분)`);
      return this.createSuccessResponse(
        this.transformSessionData(session),
        "세션이 시작되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.startSession 오류:", error);
      return this.createErrorResponse(error, "세션 시작에 실패했습니다.");
    }
  }

  /**
   * ⏸️ 세션 일시정지
   */
  async pauseSession(userId) {
    return this.updateSessionStatus(userId, "paused", { pausedAt: new Date() });
  }

  /**
   * ▶️ 세션 재개
   */
  async resumeSession(userId) {
    const session = await this.findActiveSessionByUserId(userId);
    if (!session)
      return this.createErrorResponse(
        new Error("SESSION_NOT_FOUND"),
        "세션을 찾을 수 없습니다."
      );

    // 🚀 추가: 일시정지 상태가 아니면 재개할 수 없습니다.
    if (session.status !== "paused") {
      return this.createErrorResponse(
        new Error("NOT_PAUSED"),
        "일시정지 상태인 타이머만 재개할 수 있습니다."
      );
    }

    const pauseDuration = session.pausedAt
      ? Date.now() - session.pausedAt.getTime()
      : 0;

    const totalPausedDuration =
      (session.totalPausedDuration || 0) + pauseDuration;

    return this.updateSessionStatus(userId, "active", {
      resumedAt: new Date(),
      pausedAt: null,
      totalPausedDuration // 🚀 totalPausedTime -> totalPausedDuration
    });
  }

  /**
   * ⏹️ 세션 중지 - isActive를 false로 설정
   */
  async stopSession(userId) {
    try {
      const session = await this.findActiveSessionByUserId(userId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      const elapsedTime =
        Date.now() -
        session.startedAt.getTime() -
        (session.totalPausedDuration || 0); // 🚀 오타 수정: totalPausedTime -> totalPausedDuration

      const completionRate = Math.round(
        (elapsedTime / (session.duration * 60 * 1000)) * 100
      );

      session.status = "stopped";
      session.isActive = false;
      session.stoppedAt = new Date();
      session.completionRate = Math.min(100, completionRate);
      session.actualDuration = Math.round(elapsedTime / 60000); // 분 단위로 저장

      await session.save();

      logger.info(
        `⏹️ 세션 중지: ${userId} - 완료율: ${session.completionRate}%`
      );

      await this.updateUserStats(userId, session);

      return this.createSuccessResponse(
        this.transformSessionData(session),
        "세션이 중지되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.stopSession 오류:", error);
      return this.createErrorResponse(error, "세션 중지에 실패했습니다.");
    }
  }

  /**
   * ✅ 세션 완료 - isActive를 false로 설정
   */
  async completeSession(userId) {
    try {
      const session = await this.findActiveSessionByUserId(userId);
      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "세션을 찾을 수 없습니다."
        );
      }

      // ✅ isActive를 false로 설정
      session.status = "completed";
      session.isActive = false;
      session.completedAt = new Date();
      session.completionRate = 100;

      await session.save();

      logger.info(`✅ 세션 완료: ${userId}`);

      // 통계 업데이트
      await this.updateUserStats(userId, session);

      return this.createSuccessResponse(
        this.transformSessionData(session),
        "세션이 완료되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.completeSession 오류:", error);
      return this.createErrorResponse(error, "세션 완료 처리에 실패했습니다.");
    }
  }

  /**
   * 🍅 뽀모도로 세트 시작
   */
  async startPomodoroSet(userId, pomodoroData) {
    try {
      const { preset, focusDuration, shortBreak, longBreak, cycles, userName } =
        pomodoroData;

      // ✅ userName 검증 및 기본값 설정
      const validUserName =
        userName && userName !== "알 수 없는 사용자"
          ? userName
          : `User#${userId}`;

      console.log("🔍 TimerService 디버깅:");
      console.log("  원본 userName:", userName);
      console.log("  검증된 userName:", validUserName);

      // 뽀모도로 세트 생성
      const setId = `pomodoro_${userId}_${Date.now()}`;

      // 첫 번째 집중 세션 생성
      const session = new this.models.Timer({
        userId: userId.toString(),
        userName: validUserName, // ✅ 검증된 사용자 이름 사용
        type: "focus",
        duration: focusDuration,
        remainingTime: focusDuration * 60,
        status: "active",
        isActive: true,
        startedAt: new Date(),
        pomodoroSet: {
          setId,
          preset,
          currentCycle: 1,
          totalCycles: cycles,
          focusDuration,
          shortBreak,
          longBreak
        }
      });

      await session.save();

      logger.info(
        `🍅 뽀모도로 세트 시작: ${userId} (${validUserName}) - ${preset}`
      );

      return this.createSuccessResponse(
        {
          ...this.transformSessionData(session),
          setId
        },
        "뽀모도로 세트가 시작되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.startPomodoroSet 오류:", error);
      return this.createErrorResponse(error, "뽀모도로 시작에 실패했습니다.");
    }
  }

  /**
   * 📊 타이머 진행률 업데이트 (누락된 메서드)
   * @param {string} userId - 사용자 ID
   * @param {number} remainingTime - 남은 시간 (초)
   * @returns {Promise<Object>} 업데이트 결과
   */
  async updateProgress(userId, remainingTime) {
    try {
      // 활성 세션 찾기
      const session = await this.findActiveSessionByUserId(userId);

      if (!session) {
        return this.createErrorResponse(
          new Error("SESSION_NOT_FOUND"),
          "활성 타이머 세션을 찾을 수 없습니다."
        );
      }

      // Timer 모델의 updateProgress 메서드 호출
      await session.updateProgress(remainingTime);

      return this.createSuccessResponse(
        this.transformSessionData(session),
        "진행률이 업데이트되었습니다."
      );
    } catch (error) {
      logger.error(`❌ 진행률 업데이트 실패 (${userId}):`, error);
      return this.createErrorResponse(error, "진행률 업데이트에 실패했습니다.");
    }
  }

  // ===== 📊 조회 메서드 =====

  /**
   * 📜 최근 세션 조회
   */
  async getRecentSessions(userId, limit = 5) {
    try {
      const sessions = await this.models.Timer.find({
        userId: userId.toString(),
        status: { $in: ["completed", "stopped"] }
      })
        .sort({ completedAt: -1, stoppedAt: -1 })
        .limit(limit);

      const transformedSessions = sessions.map((s) =>
        this.transformSessionData(s)
      );

      return this.createSuccessResponse(
        transformedSessions,
        "최근 세션을 조회했습니다."
      );
    } catch (error) {
      logger.error("TimerService.getRecentSessions 오류:", error);
      return this.createErrorResponse(error, "세션 조회에 실패했습니다.");
    }
  }

  /**
   * 📈 주간 통계 조회
   */
  async getWeeklyStats(userId) {
    try {
      // 캐시 확인
      const cacheKey = `weekly_${userId}`;
      if (this.statsCache.has(cacheKey)) {
        const cached = this.statsCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.statsCacheTimeout) {
          return this.createSuccessResponse(cached.data, "캐시된 주간 통계");
        }
      }

      // 주간 시작/종료 시간
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      // 주간 세션 조회
      const sessions = await this.models.Timer.find({
        userId: userId.toString(),
        status: { $in: ["completed", "stopped"] },
        startedAt: { $gte: weekStart, $lt: weekEnd }
      });

      // 통계 계산
      const stats = this.calculateWeeklyStats(sessions, weekStart);

      // 캐시 저장
      this.statsCache.set(cacheKey, {
        data: stats,
        timestamp: Date.now()
      });

      return this.createSuccessResponse(stats, "주간 통계를 조회했습니다.");
    } catch (error) {
      logger.error("TimerService.getWeeklyStats 오류:", error);
      return this.createErrorResponse(error, "주간 통계 조회에 실패했습니다.");
    }
  }

  /**
   * ⚙️ 사용자 설정 조회
   */
  async getUserSettings(userId) {
    try {
      if (!this.models.TimerSettings) {
        return this.createSuccessResponse(null, "설정 모델이 없습니다.");
      }

      let settings = await this.models.TimerSettings.findOne({
        userId: userId.toString()
      });

      if (!settings) {
        // 기본 설정 생성
        settings = new this.models.TimerSettings({
          userId: userId.toString(),
          focusDuration: 25,
          shortBreak: 5,
          longBreak: 15,
          enableNotifications: true,
          enableBadges: true
        });
        await settings.save();
      }

      return this.createSuccessResponse(
        settings.toObject(),
        "설정을 조회했습니다."
      );
    } catch (error) {
      logger.error("TimerService.getUserSettings 오류:", error);
      return this.createErrorResponse(error, "설정 조회에 실패했습니다.");
    }
  }

  /**
   * 🔔 알림 설정 토글
   */
  async toggleNotifications(userId) {
    try {
      if (!this.models.TimerSettings) {
        return this.createErrorResponse(
          new Error("NO_SETTINGS_MODEL"),
          "설정 기능을 사용할 수 없습니다."
        );
      }

      let settings = await this.models.TimerSettings.findOne({
        userId: userId.toString()
      });

      if (!settings) {
        settings = new this.models.TimerSettings({
          userId: userId.toString(),
          enableNotifications: false
        });
      } else {
        settings.enableNotifications = !settings.enableNotifications;
      }

      await settings.save();

      return this.createSuccessResponse(
        { enabled: settings.enableNotifications },
        "알림 설정이 변경되었습니다."
      );
    } catch (error) {
      logger.error("TimerService.toggleNotifications 오류:", error);
      return this.createErrorResponse(error, "알림 설정 변경에 실패했습니다.");
    }
  }

  // ===== 🛠️ 헬퍼 메서드 =====

  /**
   * 🔍 활성 세션 조회
   */
  async findActiveSession(userId) {
    try {
      return await this.models.Timer.findOne({
        userId: userId.toString(), // ✅ userId 필드로 검색해야 함!
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
   * 📊 통계 업데이트
   */
  async updateUserStats(userId, session) {
    try {
      if (!this.models.TimerStats) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let stats = await this.models.TimerStats.findOne({
        userId: userId.toString(),
        date: today
      });

      if (!stats) {
        stats = new this.models.TimerStats({
          userId: userId.toString(),
          date: today,
          totalSessions: 0,
          completedSessions: 0,
          totalFocusTime: 0,
          totalBreakTime: 0
        });
      }

      stats.totalSessions++;

      if (session.status === "completed") {
        stats.completedSessions++;
      }

      if (session.type === "focus") {
        stats.totalFocusTime += session.duration;
      } else {
        stats.totalBreakTime += session.duration;
      }

      await stats.save();
    } catch (error) {
      logger.error("통계 업데이트 실패:", error);
    }
  }

  /**
   * 📊 주간 통계 계산
   */
  calculateWeeklyStats(sessions, weekStart) {
    const stats = {
      totalSessions: sessions.length,
      completedSessions: 0,
      totalFocusTime: 0,
      totalBreakTime: 0,
      completionRate: 0,
      dailyActivity: []
    };

    // 일별 활동 초기화
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);

      stats.dailyActivity.push({
        date: date.toISOString().split("T")[0],
        name: ["일", "월", "화", "수", "목", "금", "토"][i],
        sessions: 0
      });
    }

    // 세션 집계
    sessions.forEach((session) => {
      if (session.status === "completed") {
        stats.completedSessions++;
      }

      if (session.type === "focus") {
        stats.totalFocusTime += session.duration;
      } else {
        stats.totalBreakTime += session.duration;
      }

      // 일별 활동 계산
      const dayIndex = new Date(session.startedAt).getDay();
      stats.dailyActivity[dayIndex].sessions++;
    });

    // 완료율 계산
    if (stats.totalSessions > 0) {
      stats.completionRate = Math.round(
        (stats.completedSessions / stats.totalSessions) * 100
      );
    }

    return stats;
  }

  /**
   * 🍅 뽀모도로 완료 처리
   */
  async handlePomodoroCompletion(session) {
    try {
      const { pomodoroSet } = session;
      if (!pomodoroSet) return;

      // 다음 세션 타입 결정
      let nextType, nextDuration;

      if (session.type === "focus") {
        // 집중 후 → 휴식
        if (pomodoroSet.currentCycle < pomodoroSet.totalCycles) {
          nextType = "shortBreak";
          nextDuration = pomodoroSet.shortBreak;
        } else {
          nextType = "longBreak";
          nextDuration = pomodoroSet.longBreak;
        }
      } else {
        // 휴식 후 → 다음 집중
        if (pomodoroSet.currentCycle < pomodoroSet.totalCycles) {
          nextType = "focus";
          nextDuration = pomodoroSet.focusDuration;
          pomodoroSet.currentCycle++;
        }
      }

      // 다음 세션이 있으면 알림용 데이터 저장
      if (nextType) {
        session.nextSession = {
          type: nextType,
          duration: nextDuration,
          cycle: pomodoroSet.currentCycle
        };
        await session.save();
      }
    } catch (error) {
      logger.error("뽀모도로 완료 처리 실패:", error);
    }
  }

  /**
   * 🔄 세션 데이터 변환
   */
  transformSessionData(session) {
    if (!session) return null;

    const obj = session.toObject ? session.toObject() : session;

    return {
      ...obj,
      _id: obj._id?.toString() || obj._id,
      // 원본 날짜 필드는 그대로 유지
      userId: obj.userId,
      userName: obj.userName || "Unknown",
      type: obj.type,
      duration: obj.duration,
      status: obj.status,
      completionRate: obj.completionRate || 0,
      wasCompleted: obj.wasCompleted || false,
      actualDuration: obj.actualDuration || obj.totalDurationMinutes || 0,
      // 날짜 원본 유지
      startedAt: obj.startedAt,
      completedAt: obj.completedAt,
      stoppedAt: obj.stoppedAt,
      // 표시용 필드 추가
      durationDisplay: `${obj.duration}분`,
      statusDisplay: this.getStatusDisplay(obj.status)
    };
  }

  /**
   * 🏷️ 타입 표시명
   */
  getTypeDisplay(type) {
    return TimeHelper.getTimerTypeDisplay(type, false); // 이모지 없이
  }

  /**
   * 🏷️ 상태 표시명
   */
  getStatusDisplay(status) {
    const displays = {
      active: "실행중",
      paused: "일시정지",
      stopped: "중지됨",
      completed: "완료"
    };
    return displays[status] || status;
  }

  /**
   * 🧹 오래된 세션 정리
   */
  async cleanupOldSessions() {
    try {
      const timeout = new Date(Date.now() - this.config.sessionTimeout);

      const result = await this.models.Timer.updateMany(
        {
          status: "active",
          // ✅ 수정된 부분: 'lastProgress.updatedAt'으로 변경
          "lastProgress.updatedAt": { $lt: timeout }
        },
        {
          $set: {
            status: "abandoned",
            isActive: false,
            abandonedAt: new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(`🧹 ${result.modifiedCount}개의 오래된 세션 정리됨`);
      }
    } catch (error) {
      logger.error("오래된 세션 정리 실패:", error);
    }
  }

  /**
   * 🧹 봇 시작 시 모든 활성 세션 정리 (추가 메서드)
   */
  async cleanupAllActiveSessions() {
    try {
      const result = await this.models.Timer.updateMany(
        {
          status: { $in: ["active", "paused"] },
          isActive: true
        },
        {
          $set: {
            status: "abandoned", // '중단됨' 상태로 변경
            isActive: false,
            stoppedAt: new Date() // 중지 시간 기록
          }
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(
          `🧹 봇 시작 시 ${result.modifiedCount}개의 활성 세션을 정리했습니다.`
        );
      }
    } catch (error) {
      logger.error("활성 세션 정리 실패:", error);
    }
  }

  /**
   * 📊 인덱스 생성
   */
  async createIndexes() {
    try {
      // Timer 인덱스
      await this.models.Timer.collection.createIndex(
        { userId: 1, status: 1, isActive: 1 },
        { background: true }
      );
      await this.models.Timer.collection.createIndex(
        { startedAt: -1 },
        { background: true }
      );

      // TimerStats 인덱스
      if (this.models.TimerStats) {
        await this.models.TimerStats.collection.createIndex(
          { userId: 1, date: 1 },
          { unique: true, background: true }
        );
      }

      logger.debug("📊 타이머 인덱스 생성 완료");
    } catch (error) {
      logger.error("인덱스 생성 실패:", error);
    }
  }

  /**
   * 🧹 캐시 정리 시작
   */
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.statsCache.entries()) {
        if (now - value.timestamp > this.statsCacheTimeout) {
          this.statsCache.delete(key);
        }
      }
    }, this.statsCacheTimeout);
  }
}

module.exports = TimerService;
