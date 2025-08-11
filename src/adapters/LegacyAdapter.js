// ================================================
// src/adapters/LegacyAdapter.js
// ================================================

const { EVENTS } = require("../events/catalog");

/**
 * 🔌 Legacy 어댑터
 * 기존 모듈을 이벤트버스와 연결하는 브릿지
 *
 * 비유: 구형 플러그를 신형 콘센트에 연결하는 어댑터
 */
class LegacyAdapter {
  constructor(eventBus, legacyModule, bot) {
    this.eventBus = eventBus;
    this.legacyModule = legacyModule;
    this.bot = bot;
    this.moduleName = legacyModule.moduleName || "unknown";

    console.log(`🔌 Legacy 어댑터 연결: ${this.moduleName}`);

    this.setupBridge();
  }

  /**
   * 이벤트 브릿지 설정
   */
  setupBridge() {
    // 콜백 이벤트 브릿지
    if (this.legacyModule.handleCallback) {
      this.bridgeCallbackEvents();
    }

    // 명령어 이벤트 브릿지
    if (this.legacyModule.handleCommand) {
      this.bridgeCommandEvents();
    }

    // 메시지 이벤트 브릿지
    if (this.legacyModule.handleMessage) {
      this.bridgeMessageEvents();
    }

    // 모듈별 커스텀 이벤트
    this.bridgeCustomEvents();
  }

  /**
   * 콜백 이벤트 브릿지
   */
  bridgeCallbackEvents() {
    this.eventBus.subscribe(EVENTS.USER.CALLBACK, async (event) => {
      const { _callbackId, data, userId } = event.payload;

      // 이 모듈이 처리해야 할 콜백인지 확인
      const [module, action, ...params] = data.split(":");

      if (module !== this.moduleName) {
        return; // 다른 모듈의 콜백
      }

      console.log(`🔄 Legacy 콜백 처리: ${this.moduleName}:${action}`);

      // 기존 모듈의 콜백 메서드 호출
      try {
        const result = await this.legacyModule.handleCallback(
          this.bot,
          { data, from: { id: userId } }, // 콜백 쿼리 객체 시뮬레이션
          action,
          params.join(":")
        );

        // 결과를 이벤트로 발행
        this.eventBus.publish(EVENTS.MODULE.RESPONSE, {
          module: this.moduleName,
          action: "callback",
          result,
          userId
        });
      } catch (error) {
        console.error(`❌ Legacy 콜백 에러: ${this.moduleName}`, error);

        this.eventBus.publish(EVENTS.MODULE.ERROR, {
          module: this.moduleName,
          action: "callback",
          error: error.message,
          userId
        });
      }
    });
  }

  /**
   * 명령어 이벤트 브릿지
   */
  bridgeCommandEvents() {
    this.eventBus.subscribe(EVENTS.USER.COMMAND, async (event) => {
      const { command, args, userId, chat } = event.payload;

      // 이 모듈이 처리하는 명령어인지 확인
      const moduleCommands = this.legacyModule.commands || [];

      if (!moduleCommands.includes(command)) {
        return; // 다른 모듈의 명령어
      }

      console.log(`🔄 Legacy 명령어 처리: ${command}`);

      try {
        const result = await this.legacyModule.handleCommand(
          this.bot,
          {
            message: {
              text: `${command} ${args ? args.join(" ") : ""}`,
              from: { id: userId },
              chat
            }
          },
          command,
          args
        );

        this.eventBus.publish(EVENTS.MODULE.RESPONSE, {
          module: this.moduleName,
          action: "command",
          command,
          result,
          userId
        });
      } catch (error) {
        console.error(`❌ Legacy 명령어 에러: ${command}`, error);

        this.eventBus.publish(EVENTS.MODULE.ERROR, {
          module: this.moduleName,
          action: "command",
          command,
          error: error.message,
          userId
        });
      }
    });
  }

  /**
   * 메시지 이벤트 브릿지
   */
  bridgeMessageEvents() {
    this.eventBus.subscribe(EVENTS.USER.MESSAGE, async (event) => {
      const { text, userId, chat, messageId } = event.payload;

      console.log(`🔄 Legacy 메시지 처리: ${this.moduleName}`);

      try {
        const result = await this.legacyModule.handleMessage(this.bot, {
          message: {
            message_id: messageId,
            text,
            from: { id: userId },
            chat
          }
        });

        if (result) {
          this.eventBus.publish(EVENTS.MODULE.RESPONSE, {
            module: this.moduleName,
            action: "message",
            result,
            userId
          });
        }
      } catch (error) {
        console.error(`❌ Legacy 메시지 에러: ${this.moduleName}`, error);

        this.eventBus.publish(EVENTS.MODULE.ERROR, {
          module: this.moduleName,
          action: "message",
          error: error.message,
          userId
        });
      }
    });
  }

  /**
   * 모듈별 커스텀 이벤트 브릿지
   */
  bridgeCustomEvents() {
    // TodoModule 특별 처리
    if (this.moduleName === "todo") {
      this.bridgeTodoEvents();
    }

    // ScheduleModule 특별 처리
    if (this.moduleName === "schedule") {
      this.bridgeScheduleEvents();
    }

    // SystemModule 특별 처리
    if (this.moduleName === "system") {
      this.bridgeSystemEvents();
    }
  }

  /**
   * Todo 모듈 이벤트 브릿지
   */
  bridgeTodoEvents() {
    // 할일 생성 요청을 기존 모듈로 전달
    this.eventBus.subscribe(EVENTS.TODO.CREATE, async (event) => {
      const { text, userId } = event.payload;

      console.log(`🔄 Legacy Todo 생성: ${text}`);

      if (this.legacyModule.createTodo) {
        const todo = await this.legacyModule.createTodo(userId, text);

        // 생성 완료 이벤트 발행
        this.eventBus.publish(EVENTS.TODO.CREATED, {
          id: todo.id,
          userId,
          text: todo.text,
          createdAt: todo.createdAt
        });
      }
    });

    // 할일 완료 요청
    this.eventBus.subscribe(EVENTS.TODO.COMPLETE, async (event) => {
      const { todoId, userId } = event.payload;

      if (this.legacyModule.completeTodo) {
        await this.legacyModule.completeTodo(todoId, userId);

        this.eventBus.publish(EVENTS.TODO.COMPLETED, {
          id: todoId,
          userId,
          completedAt: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Schedule 모듈 이벤트 브릿지
   */
  bridgeScheduleEvents() {
    // 일정 생성
    this.eventBus.subscribe(EVENTS.SCHEDULE.CREATE, async (event) => {
      const { title, date, userId } = event.payload;

      if (this.legacyModule.createSchedule) {
        const schedule = await this.legacyModule.createSchedule(
          userId,
          title,
          date
        );

        this.eventBus.publish(EVENTS.SCHEDULE.CREATED, {
          id: schedule.id,
          userId,
          title,
          date,
          createdAt: new Date().toISOString()
        });
      }
    });
  }

  /**
   * System 모듈 이벤트 브릿지
   */
  bridgeSystemEvents() {
    // 헬스체크
    this.eventBus.subscribe(EVENTS.SYSTEM.HEALTH_CHECK, async (event) => {
      console.log(`🔄 Legacy 헬스체크`);

      if (this.legacyModule.healthCheck) {
        const status = await this.legacyModule.healthCheck();

        const eventName = status.healthy
          ? EVENTS.SYSTEM.HEALTH_CHECK_PASSED
          : EVENTS.SYSTEM.HEALTH_CHECK_FAILED;

        this.eventBus.publish(eventName, status);
      }
    });
  }

  /**
   * 어댑터 해제
   */
  disconnect() {
    console.log(`🔌 Legacy 어댑터 해제: ${this.moduleName}`);
    // 필요시 구독 해제 로직 추가
  }
}

module.exports = LegacyAdapter;
