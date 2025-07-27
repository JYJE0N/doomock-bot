// ===== 💾 Enhanced TimerService - 화려한 타이머 데이터 서비스 =====
// src/services/TimerService.js
const BaseService = require("./BaseService");
const logger = require("../utils/Logger");
const TimeHelper = require("../utils/TimeHelper");

/**
 * 💾 Enhanced TimerService v3.0.1 - 화려한 타이머 데이터 서비스
 *
 * 🎯 Enhanced 특징:
 * - MongoDB 네이티브 드라이버
 * - 고급 집계 및 분석
 * - 포모도로 세션 추적
 * - 실시간 통계
 * - Enhanced Logger 통합
 */
class TimerService extends BaseService {
  constructor(options = {}) {
    super("timers", options);

    // 🎨 Enhanced Logger - 서비스 시작
    logger.moduleStart("TimerService", "3.0.1");

    // 📋 비즈니스 규칙 (Enhanced)
    this.rules = {
      maxTimersPerUser: 50,
      minDurationMinutes: 1,
      maxDurationMinutes: 480, // 8시간
      allowedTypes: ["focus", "break", "meeting", "pomodoro", "custom"],
      allowedStatuses: [
        "pending",
        "running",
        "paused",
        "completed",
        "cancelled",
      ],
    };

    // 📊 Enhanced 인덱스 설정
    this.indexes = [
      { userId: 1, createdAt: -1 },
      { userId: 1, status: 1 },
      { userId: 1, type: 1 },
      { userId: 1, startTime: -1 },
      { userId: 1, completedAt: -1 },
      { userId: 1, status: 1, endTime: 1 }, // 활성 타이머 조회용
      { userId: 1, type: 1, createdAt: -1 }, // 타입별 조회
      { name: "text" }, // 타이머 이름 검색
    ];

    logger.success("💾 Enhanced TimerService 생성됨");
  }

  /**
   * ⏰ Enhanced 타이머 생성
   */
  async createTimer(userId, timerData) {
    try {
      logger.info("⏰ Enhanced Timer 생성 시작", {
        service: "TimerService",
        userId,
        name: timerData.name,
        duration: timerData.duration,
      });

      // 검증
      this.validateTimerData(userId, timerData);

      // 사용자 타이머 수 체크
      const currentCount = await this.getUserTimerCount(userId);
      if (currentCount >= this.rules.maxTimersPerUser) {
        const error = new Error(
          `최대 ${this.rules.maxTimersPerUser}개까지만 생성 가능합니다`
        );
        logger.warn("⚠️ 타이머 한도 초과", {
          userId,
          currentCount,
          maxAllowed: this.rules.maxTimersPerUser,
        });
        throw error;
      }

      // Enhanced 문서 준비
      const document = {
        userId,
        name: timerData.name.trim(),
        duration: timerData.duration, // 분 단위
        type: timerData.type || "focus",
        status: "pending",
        description: timerData.description || "",

        // 시간 관련 필드들
        startTime: null,
        endTime: null,
        pausedAt: null,
        completedAt: null,
        elapsedTime: 0,

        // 메타데이터
        metadata: {
          source: "telegram",
          version: "3.0.1",
          enhanced: true,
          ...timerData.metadata,
        },

        // 통계용 필드들
        pauseCount: 0,
        resumeCount: 0,
        actualDuration: null,
        efficiency: null, // 실제 시간 / 계획 시간

        ...this.getStandardFields(),
      };

      // 저장
      const result = await this.create(document);

      logger.success("✅ Enhanced Timer 생성 완료", {
        service: "TimerService",
        timerId: result.insertedId,
        name: document.name,
        duration: document.duration,
        type: document.type,
      });

      return {
        id: result.insertedId,
        ...document,
      };
    } catch (error) {
      logger.error("❌ Enhanced Timer 생성 실패:", error);
      throw error;
    }
  }

  /**
   * 📊 Enhanced 상세 통계
   */
  async getDetailedStats(userId) {
    try {
      logger.debug("📊 Enhanced Timer 상세 통계 조회", {
        service: "TimerService",
        userId,
      });

      const pipeline = [
        { $match: { userId, isActive: true } },
        {
          $group: {
            _id: null,
            totalTimers: { $sum: 1 },
            completedTimers: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            totalPlannedTime: { $sum: "$duration" },
            totalActualTime: { $sum: "$actualDuration" },
            totalFocusTime: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "focus"] },
                      { $eq: ["$status", "completed"] },
                    ],
                  },
                  "$actualDuration",
                  0,
                ],
              },
            },
            totalBreakTime: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "break"] },
                      { $eq: ["$status", "completed"] },
                    ],
                  },
                  "$actualDuration",
                  0,
                ],
              },
            },
            avgEfficiency: { $avg: "$efficiency" },
            maxDuration: { $max: "$duration" },
            minDuration: { $min: "$duration" },

            // 타입별 분류
            focusTimers: {
              $sum: { $cond: [{ $eq: ["$type", "focus"] }, 1, 0] },
            },
            pomodoroTimers: {
              $sum: { $cond: [{ $eq: ["$type", "pomodoro"] }, 1, 0] },
            },
            breakTimers: {
              $sum: { $cond: [{ $eq: ["$type", "break"] }, 1, 0] },
            },
          },
        },
      ];

      const [stats] = await this.aggregate(pipeline);

      if (!stats) {
        return {
          totalTimers: 0,
          completedTimers: 0,
          completionRate: 0,
          totalPlannedTime: 0,
          totalActualTime: 0,
          totalFocusTime: 0,
          totalBreakTime: 0,
          avgEfficiency: 0,
          maxDuration: 0,
          minDuration: 0,
          categoryBreakdown: {
            focus: 0,
            pomodoro: 0,
            break: 0,
            other: 0,
          },
        };
      }

      // 완료율 계산
      stats.completionRate =
        stats.totalTimers > 0
          ? Math.round((stats.completedTimers / stats.totalTimers) * 100)
          : 0;

      // 카테고리 분류
      stats.categoryBreakdown = {
        focus: stats.focusTimers || 0,
        pomodoro: stats.pomodoroTimers || 0,
        break: stats.breakTimers || 0,
        other:
          (stats.totalTimers || 0) -
          (stats.focusTimers || 0) -
          (stats.pomodoroTimers || 0) -
          (stats.breakTimers || 0),
      };

      logger.debug("📈 상세 통계 조회 완료", {
        totalTimers: stats.totalTimers,
        completionRate: stats.completionRate,
        totalFocusTime: stats.totalFocusTime,
      });

      return stats;
    } catch (error) {
      logger.error("❌ Enhanced Timer 상세 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 📅 주간 트렌드 분석
   */
  async getWeeklyTrends(userId) {
    try {
      logger.debug("📅 Timer 주간 트렌드 분석", {
        service: "TimerService",
        userId,
      });

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const pipeline = [
        {
          $match: {
            userId,
            isActive: true,
            completedAt: { $gte: weekAgo },
            status: "completed",
          },
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$completedAt",
                },
              },
              type: "$type",
            },
            count: { $sum: 1 },
            totalMinutes: { $sum: "$actualDuration" },
            avgDuration: { $avg: "$actualDuration" },
          },
        },
        { $sort: { "_id.date": 1 } },
      ];

      const rawData = await this.aggregate(pipeline);

      // 일별 데이터 정리
      const dailyFocus = {};
      const dailyData = {};

      rawData.forEach((item) => {
        const date = item._id.date;
        const type = item._id.type;

        if (!dailyData[date]) {
          dailyData[date] = { date, focus: 0, break: 0, pomodoro: 0, total: 0 };
        }

        dailyData[date][type] = item.totalMinutes;
        dailyData[date].total += item.totalMinutes;

        if (type === "focus" || type === "pomodoro") {
          if (!dailyFocus[date]) {
            dailyFocus[date] = { date, minutes: 0, sessions: 0 };
          }
          dailyFocus[date].minutes += item.totalMinutes;
          dailyFocus[date].sessions += item.count;
        }
      });

      return {
        dailyFocus: Object.values(dailyFocus),
        dailyBreakdown: Object.values(dailyData),
        weeklyCompleted: rawData.reduce((sum, item) => sum + item.count, 0),
        weeklyFocusTime: Object.values(dailyFocus).reduce(
          (sum, day) => sum + day.minutes,
          0
        ),
      };
    } catch (error) {
      logger.error("❌ Timer 주간 트렌드 분석 실패:", error);
      throw error;
    }
  }

  /**
   * 🍅 포모도로 통계
   */
  async getPomodoroStats(userId) {
    try {
      logger.debug("🍅 포모도로 통계 조회", {
        service: "TimerService",
        userId,
      });

      const pipeline = [
        {
          $match: {
            userId,
            isActive: true,
            type: "pomodoro",
          },
        },
        {
          $group: {
            _id: null,
            totalPomodoros: { $sum: 1 },
            completedPomodoros: {
              $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
            },
            totalPomodoroTime: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "completed"] },
                  "$actualDuration",
                  0,
                ],
              },
            },
            avgPomodoroLength: {
              $avg: {
                $cond: [
                  { $eq: ["$status", "completed"] },
                  "$actualDuration",
                  null,
                ],
              },
            },
          },
        },
      ];

      const [stats] = await this.aggregate(pipeline);

      if (!stats) {
        return {
          totalPomodoros: 0,
          completedPomodoros: 0,
          completedCycles: 0,
          totalPomodoroTime: 0,
          avgPomodoroLength: 0,
          completionRate: 0,
        };
      }

      // 완료된 사이클 수 (포모도로 4개 = 1사이클)
      stats.completedCycles = Math.floor(stats.completedPomodoros / 4);

      // 완료율
      stats.completionRate =
        stats.totalPomodoros > 0
          ? Math.round((stats.completedPomodoros / stats.totalPomodoros) * 100)
          : 0;

      return stats;
    } catch (error) {
      logger.error("❌ 포모도로 통계 조회 실패:", error);
      throw error;
    }
  }

  /**
   * 🔍 데이터 검증 (Enhanced)
   */
  validateTimerData(userId, data) {
    if (!userId) {
      throw new Error("사용자 ID가 필요합니다");
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new Error("타이머 이름을 입력해주세요");
    }

    if (!data.duration || data.duration < this.rules.minDurationMinutes) {
      throw new Error(
        `최소 ${this.rules.minDurationMinutes}분 이상이어야 합니다`
      );
    }

    if (data.duration > this.rules.maxDurationMinutes) {
      throw new Error(
        `최대 ${this.rules.maxDurationMinutes}분까지만 설정 가능합니다`
      );
    }

    if (data.type && !this.rules.allowedTypes.includes(data.type)) {
      throw new Error(`허용되지 않은 타이머 타입입니다: ${data.type}`);
    }
  }

  /**
   * 🔢 사용자 타이머 수 조회
   */
  async getUserTimerCount(userId) {
    return await this.count({ userId, isActive: true });
  }

  /**
   * 🔄 활성 타이머들 조회
   */
  async getActiveTimers() {
    try {
      const activeTimers = await this.find({
        status: { $in: ["running", "paused"] },
        isActive: true,
      });

      return activeTimers;
    } catch (error) {
      logger.error("❌ 활성 타이머 조회 실패:", error);
      throw error;
    }
  }
}

module.exports = TimerService;
