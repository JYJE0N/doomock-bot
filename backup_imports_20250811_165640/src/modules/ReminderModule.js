// src/modules/ReminderModule.js - ⏰ 리마인더 모듈 (순수 비즈니스 로직)
const BaseModule = require("../core/BaseModule");
const logger = require("../utils/Logger");
const { getUserId, getUserName } = require("../utils/UserHelper");

/**
 * ⏰ ReminderModule - 리마인더/알림 모듈
 *
 * ✅ SoC 준수: 순수 비즈니스 로직만 담당
 * ✅ 표준 콜백: reminder:action:params
 * ✅ 렌더링은 Renderer가 담당
 *
 * 📌 현재 비활성화 상태 (enabled: false)
 */
class ReminderModule extends BaseModule {
  constructor(moduleName, options = {}) {
    super(moduleName, options);

    this.serviceBuilder = options.serviceBuilder || null;
    this.reminderService = null;

    // 모듈 설정
    this.config = {
      maxRemindersPerUser: parseInt(process.env.MAX_REMINDERS_PER_USER) || 20,
      defaultReminderMinutes:
        parseInt(process.env.DEFAULT_REMINDER_MINUTES) || 30,
      maxReminderDays: parseInt(process.env.MAX_REMINDER_DAYS) || 365,
      enableRecurring: process.env.REMINDER_ENABLE_RECURRING !== "false",
      enableSnooze: process.env.REMINDER_ENABLE_SNOOZE !== "false",

      // 지원하는 리마인더 타입
      supportedTypes: ["general", "todo_reminder", "work_reminder", "personal"],

      // 반복 옵션
      recurringOptions: ["daily", "weekly", "monthly"],

      ...options.config
    };

    // 사용자 입력 상태 관리
    this.userInputStates = new Map();

    logger.info(`⏰ ReminderModule 생성 완료 (v4.1) - 비활성화 상태`);
  }

  /**
   * 🎯 모듈 초기화
   */
  async onInitialize() {
    try {
      if (this.serviceBuilder) {
        this.reminderService = await this.serviceBuilder.getOrCreate(
          "reminder",
          {
            config: this.config
          }
        );
      }

      if (!this.reminderService) {
        logger.warn("ReminderService 없음 - 기본 모드로 작동");
      }

      logger.success("✅ ReminderModule 초기화 완료 (비활성화)");
    } catch (error) {
      logger.error("❌ ReminderModule 초기화 실패:", error);
      // 비활성화 모듈이므로 에러로 중단하지 않음
    }
  }

  /**
   * 🎯 액션 등록
   */
  setupActions() {
    this.registerActions({
      // 기본 액션
      menu: this.showMenu,

      // 리마인더 관리
      add: this.showAddReminder,
      list: this.showReminderList,
      delete: this.deleteReminder,

      // 리마인더 제어
      snooze: this.snoozeReminder,
      disable: this.disableReminder,
      enable: this.enableReminder,

      // 조회 기능
      today: this.showTodayReminders,
      upcoming: this.showUpcomingReminders,

      // 기타
      stats: this.showStats,
      help: this.showHelp
    });

    logger.info(`✅ ReminderModule 액션 등록 완료 (${this.actionMap.size}개)`);
  }

  /**
   * 🎯 메시지 처리
   */
  async onHandleMessage(bot, msg) {
    const {
      text,
      chat: { id: chatId },
      from: { id: userId }
    } = msg;

    if (!text) return false;

    // 사용자 입력 상태 처리
    const inputState = this.getUserInputState(userId);
    if (inputState?.awaitingInput) {
      return await this.handleUserInput(bot, msg, text, inputState);
    }

    // 모듈 키워드 확인
    const keywords = ["알림", "리마인더", "reminder", "알려줘", "상기", "기억"];
    if (this.isModuleMessage(text, keywords)) {
      return {
        type: "render_request",
        module: "reminder",
        action: "menu",
        chatId: chatId,
        data: await this.getMenuData(userId)
      };
    }

    return false;
  }

  // ===== 🎯 핵심 액션 메서드들 (순수 비즈니스 로직) =====

  /**
   * 🏠 메인 메뉴 데이터 반환
   */
  async showMenu(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const menuData = await this.getMenuData(userId);

      return {
        type: "menu",
        module: "reminder",
        data: {
          ...menuData,
          userName
        }
      };
    } catch (error) {
      logger.error("리마인더 메뉴 데이터 조회 실패:", error);
      return {
        type: "error",
        message: "메뉴를 불러올 수 없습니다."
      };
    }
  }

  /**
   * ➕ 리마인더 추가
   */
  async showAddReminder(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      // 현재 리마인더 개수 확인
      const stats = await this.getUserStats(userId);

      if (stats.activeReminders >= this.config.maxRemindersPerUser) {
        return {
          type: "limit_exceeded",
          module: "reminder",
          data: {
            current: stats.activeReminders,
            max: this.config.maxRemindersPerUser
          }
        };
      }

      // 사용자 입력 상태 설정
      this.setUserInputState(userId, {
        awaitingInput: true,
        action: "add_reminder",
        step: "content",
        timestamp: Date.now()
      });

      return {
        type: "add_input_request",
        module: "reminder",
        data: {
          supportedTypes: this.config.supportedTypes,
          maxDays: this.config.maxReminderDays
        }
      };
    } catch (error) {
      logger.error("리마인더 추가 요청 실패:", error);
      return {
        type: "error",
        message: "리마인더 추가를 시작할 수 없습니다."
      };
    }
  }

  /**
   * 📋 리마인더 목록 표시
   */
  async showReminderList(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);

    try {
      const filterType = params[0] || "active"; // active, all, completed
      const reminders = await this.getUserReminders(userId, filterType);

      return {
        type: "list",
        module: "reminder",
        data: {
          reminders,
          filterType,
          config: this.config
        }
      };
    } catch (error) {
      logger.error("리마인더 목록 조회 실패:", error);
      return {
        type: "error",
        message: "리마인더 목록을 불러올 수 없습니다."
      };
    }
  }

  /**
   * 🗑️ 리마인더 삭제
   */
  async deleteReminder(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const reminderId = params[0];

    if (!reminderId) {
      return {
        type: "error",
        message: "삭제할 리마인더 ID가 필요합니다."
      };
    }

    try {
      const result = await this.reminderService.deleteReminder(
        userId,
        reminderId
      );

      if (result.success) {
        logger.info(`🗑️ 리마인더 삭제 성공`, { userId, reminderId });

        return {
          type: "delete_success",
          module: "reminder",
          data: {
            deletedId: reminderId,
            message: "리마인더가 삭제되었습니다."
          }
        };
      } else {
        return {
          type: "error",
          message: result.message || "리마인더 삭제에 실패했습니다."
        };
      }
    } catch (error) {
      logger.error("리마인더 삭제 실패:", error);
      return {
        type: "error",
        message: "리마인더 삭제 중 오류가 발생했습니다."
      };
    }
  }

  /**
   * ⏰ 리마인더 스누즈
   */
  async snoozeReminder(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const reminderId = params[0];
    const snoozeMinutes = parseInt(params[1]) || 30;

    if (!reminderId) {
      return {
        type: "error",
        message: "스누즈할 리마인더 ID가 필요합니다."
      };
    }

    try {
      const result = await this.reminderService.snoozeReminder(
        userId,
        reminderId,
        snoozeMinutes
      );

      if (result.success) {
        logger.info(`⏰ 리마인더 스누즈 성공`, {
          userId,
          reminderId,
          minutes: snoozeMinutes
        });

        return {
          type: "snooze_success",
          module: "reminder",
          data: {
            reminderId,
            snoozeMinutes,
            newTime: result.newTime,
            message: `${snoozeMinutes}분 후에 다시 알려드리겠습니다.`
          }
        };
      } else {
        return {
          type: "error",
          message: result.message || "스누즈 설정에 실패했습니다."
        };
      }
    } catch (error) {
      logger.error("리마인더 스누즈 실패:", error);
      return {
        type: "error",
        message: "스누즈 설정 중 오류가 발생했습니다."
      };
    }
  }

  /**
   * 📊 통계 표시
   */
  async showStats(bot, callbackQuery, params, moduleManager) {
    const { from } = callbackQuery;
    const userId = getUserId(from);
    const userName = getUserName(from);

    try {
      const stats = await this.getDetailedStats(userId);

      return {
        type: "stats",
        module: "reminder",
        data: {
          userName,
          stats,
          config: this.config
        }
      };
    } catch (error) {
      logger.error("리마인더 통계 조회 실패:", error);
      return {
        type: "error",
        message: "통계를 불러올 수 없습니다."
      };
    }
  }

  /**
   * ❓ 도움말 표시
   */
  async showHelp(bot, callbackQuery, params, moduleManager) {
    return {
      type: "help",
      module: "reminder",
      data: {
        config: this.config,
        features: {
          add: "리마인더 추가",
          list: "리마인더 목록 확인",
          snooze: "리마인더 연기",
          recurring: "반복 리마인더",
          types: "다양한 리마인더 타입"
        }
      }
    };
  }

  // ===== 🛠️ 헬퍼 메서드들 (순수 로직) =====

  /**
   * 📝 사용자 입력 처리
   */
  async handleUserInput(bot, msg, text, inputState) {
    const { action, step } = inputState;
    const {
      from: { id: userId }
    } = msg;

    if (action !== "add_reminder") return false;

    try {
      switch (step) {
        case "content":
          return await this.handleReminderContentInput(userId, text);

        case "time":
          return await this.handleReminderTimeInput(userId, text);

        default:
          this.clearUserInputState(userId);
          return {
            type: "error",
            message: "알 수 없는 입력 단계입니다."
          };
      }
    } catch (error) {
      logger.error("사용자 입력 처리 실패:", error);
      this.clearUserInputState(userId);
      return {
        type: "error",
        message: "입력 처리 중 오류가 발생했습니다."
      };
    }
  }

  /**
   * 🏠 메뉴 데이터 조회
   */
  async getMenuData(userId) {
    const stats = await this.getUserStats(userId);
    const todayReminders = await this.getTodayReminders(userId);

    return {
      stats,
      todayReminders,
      config: this.config
    };
  }

  /**
   * 📊 사용자 통계 조회
   */
  async getUserStats(userId) {
    try {
      if (
        this.reminderService &&
        typeof this.reminderService.getUserStats === "function"
      ) {
        return await this.reminderService.getUserStats(userId);
      }

      // 폴백: 기본 통계
      return {
        totalReminders: 0,
        activeReminders: 0,
        completedReminders: 0,
        todayReminders: 0
      };
    } catch (error) {
      logger.error("사용자 통계 조회 실패:", error);
      return {
        totalReminders: 0,
        activeReminders: 0,
        completedReminders: 0,
        todayReminders: 0
      };
    }
  }

  /**
   * 📋 사용자 리마인더 조회
   */
  async getUserReminders(userId, filterType = "active") {
    try {
      if (
        this.reminderService &&
        typeof this.reminderService.getUserReminders === "function"
      ) {
        return await this.reminderService.getUserReminders(userId, {
          filter: filterType
        });
      }

      // 폴백: 빈 배열
      return [];
    } catch (error) {
      logger.error("사용자 리마인더 조회 실패:", error);
      return [];
    }
  }

  /**
   * 📅 오늘 리마인더 조회
   */
  async getTodayReminders(userId) {
    try {
      if (
        this.reminderService &&
        typeof this.reminderService.getTodayReminders === "function"
      ) {
        return await this.reminderService.getTodayReminders(userId);
      }

      return [];
    } catch (error) {
      logger.error("오늘 리마인더 조회 실패:", error);
      return [];
    }
  }

  /**
   * 🏷️ 사용자 입력 상태 설정
   */
  setUserInputState(userId, state) {
    this.userInputStates.set(userId.toString(), {
      ...state,
      timestamp: Date.now()
    });
    logger.debug(`사용자 입력 상태 설정: ${userId}`, state);
  }

  /**
   * 🔍 사용자 입력 상태 조회
   */
  getUserInputState(userId) {
    const state = this.userInputStates.get(userId.toString());

    // 30분 이상 오래된 상태는 자동 삭제
    if (state && Date.now() - state.timestamp > 30 * 60 * 1000) {
      this.clearUserInputState(userId);
      return null;
    }

    return state;
  }

  /**
   * 🧹 사용자 입력 상태 초기화
   */
  clearUserInputState(userId) {
    const deleted = this.userInputStates.delete(userId.toString());
    if (deleted) {
      logger.debug(`사용자 입력 상태 초기화: ${userId}`);
    }
    return deleted;
  }

  /**
   * 🔍 모듈 키워드 확인
   */
  isModuleMessage(text, keywords) {
    const lowerText = text.trim().toLowerCase();
    return keywords.some(
      (keyword) =>
        lowerText === keyword ||
        lowerText.startsWith(keyword + " ") ||
        lowerText.includes(keyword)
    );
  }

  /**
   * 📊 모듈 상태 조회
   */
  getStatus() {
    return {
      ...super.getStatus(),
      serviceConnected: !!this.reminderService,
      activeInputStates: this.userInputStates.size,
      isEnabled: false, // 현재 비활성화
      config: {
        maxRemindersPerUser: this.config.maxRemindersPerUser,
        defaultReminderMinutes: this.config.defaultReminderMinutes,
        enableRecurring: this.config.enableRecurring,
        enableSnooze: this.config.enableSnooze
      }
    };
  }

  /**
   * 🧹 모듈 정리
   */
  async onCleanup() {
    try {
      // 사용자 상태 정리
      this.userInputStates.clear();

      if (this.reminderService && this.reminderService.cleanup) {
        await this.reminderService.cleanup();
      }
      logger.info("✅ ReminderModule 정리 완료");
    } catch (error) {
      logger.error("❌ ReminderModule 정리 실패:", error);
    }
  }
}

module.exports = ReminderModule;
