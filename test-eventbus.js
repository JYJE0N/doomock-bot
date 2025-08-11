const EventBus = require("./src/core/EventBus");
const { EVENTS, EVENT_SCHEMAS } = require("./src/events/index");

// 🧪 EventBus 테스트 스크립트
async function testEventBus() {
  console.log("🚇 EventBus 테스트 시작!");

  const eventBus = new EventBus();

  // 1. 기본 이벤트 발행/구독 테스트
  console.log("\n📍 테스트 1: 기본 이벤트 발행/구독");

  let receivedEvent = null;
  eventBus.subscribe(EVENTS.USER.COMMAND, (event) => {
    receivedEvent = event;
    console.log("✅ 이벤트 수신:", event.name, event.payload);
  });

  await eventBus.publish(EVENTS.USER.COMMAND, {
    command: "start",
    userId: 12345,
    chatId: 67890,
    messageId: 999
  });

  console.log("이벤트 수신 여부:", receivedEvent ? "✅ 성공" : "❌ 실패");

  // 2. 미들웨어 테스트
  console.log("\n📍 테스트 2: 미들웨어");

  eventBus.use(async (event, next) => {
    console.log(`🎫 미들웨어: ${event.name} 처리 중...`);
    await next();
    console.log(`🎫 미들웨어: ${event.name} 처리 완료!`);
  });

  await eventBus.publish(EVENTS.TODO.CREATE_REQUEST, {
    text: "테스트 할일",
    userId: 12345,
    priority: "high",
    dueDate: new Date().toISOString()
  });

  // 3. 스키마 검증 테스트
  console.log("\n📍 테스트 3: 스키마 검증");

  eventBus.registerSchema(
    EVENTS.USER.COMMAND,
    EVENT_SCHEMAS[EVENTS.USER.COMMAND]
  );

  try {
    await eventBus.publish(EVENTS.USER.COMMAND, {
      command: "test",
      userId: "wrong_type", // 숫자여야 하는데 문자열
      chatId: 123,
      messageId: 456
    });
    console.log("❌ 스키마 검증이 실패해야 하는데 통과됨");
  } catch (error) {
    console.log("✅ 스키마 검증 오류 정상 감지:", error.message);
  }

  // 에러 리스너를 제거하여 프로세스 종료 방지
  process.removeAllListeners("uncaughtException");

  // 4. 통계 확인
  console.log("\n📍 테스트 4: 통계");

  const stats = eventBus.getStats();
  console.log("📊 EventBus 통계:", stats);

  // 5. 모든 이벤트 모니터링
  console.log("\n📍 테스트 5: 모든 이벤트 모니터링");

  const allEvents = [];
  eventBus.subscribe("*", (event) => {
    allEvents.push(event.name);
  });

  await eventBus.publish(EVENTS.TIMER.START_REQUEST, {
    type: "focus",
    duration: 25,
    userId: 12345
  });

  await eventBus.publish(EVENTS.WEATHER.CURRENT_REQUEST, {
    location: "Seoul",
    userId: 12345
  });

  console.log("모니터링된 이벤트들:", allEvents);

  // 6. 에러 처리 테스트
  console.log("\n📍 테스트 6: 에러 처리");

  eventBus.subscribe(EVENTS.SYSTEM.ERROR, (event) => {
    throw new Error("의도적 에러 테스트");
  });

  try {
    await eventBus.publish(EVENTS.SYSTEM.ERROR, { message: "테스트 에러" });
  } catch (error) {
    console.log("✅ 에러 처리 정상:", error.message);
  }

  console.log("\n🎉 모든 테스트 완료!");
  console.log("📊 최종 통계:", eventBus.getStats());
}

// 테스트 실행
if (require.main === module) {
  testEventBus().catch(console.error);
}

module.exports = testEventBus;
