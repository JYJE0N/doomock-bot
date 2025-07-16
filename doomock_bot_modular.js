require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// 환경변수 디버깅
console.log("=== 환경변수 확인 ===");
console.log("BOT_TOKEN 존재:", !!process.env.BOT_TOKEN);
console.log(
  "BOT_TOKEN 길이:",
  process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0
);
console.log(
  "BOT_TOKEN 앞부분:",
  process.env.BOT_TOKEN
    ? process.env.BOT_TOKEN.substring(0, 10) + "..."
    : "없음"
);
console.log(
  "🔍 All MONGO env vars:",
  Object.keys(process.env).filter((k) => k.includes("MONGO"))
);
console.log("========================");

if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN이 설정되지 않았습니다!");
  process.exit(1);
}

bot.on("polling_error", (err) =>
  console.error("polling error:", JSON.stringify(err, null, 2))
);

console.log("🤖 두목봇 시작됨...");

// 모듈 불러오기
const fortune = require("./fortune");
const timer = require("./timer");
const todoFunctions = require("./todos");
const utils = require("./utils");
const worktime = require("./worktime");
const remind = require("./remind");
const MonthlyLeave = require("./monthly_leave");
const weather = require("./weather");
const dustInsights = require("./dust_marketing_insights");
const { getUserName, formatUserInfo } = require("./username_helper");

// 연차 관리 인스턴스 생성
const leaveManager = new MonthlyLeave();

// 사용자 상태 관리 (메모리 기반)
const userStates = new Map();

// 명령어 설정
bot
  .setMyCommands([
    { command: "start", description: "📱 메인 메뉴 보기" },
    { command: "help", description: "❓ 도움말 보기" },
    { command: "fortune", description: "🔮 오늘의 운세" },
    { command: "worktime", description: "🕐 근무시간 보기" },
    { command: "timer", description: "⏰ 타이머 시작/종료" },
    { command: "add", description: "➕ 할일 추가하기 (/add 할일내용)" },
    {
      command: "tts",
      description: "🔊 텍스트를 음성으로 변환 (/tts 안녕하세요)",
    },
    {
      command: "remind",
      description: "🔔 리마인더 설정하기 (/remind 30 독서하기)",
    },
    { command: "weather", description: "🌤️ 날씨 정보 확인" },
    { command: "insight", description: "📊 마케팅 인사이트 확인" },
    { command: "cancel", description: "❌ 진행중인 작업 취소" },
  ])
  .then(() => {
    console.log("✅ 명령어가 Telegram에 등록되었습니다.");
  })
  .catch(console.error);

// Bot Menu 설정
try {
  if (typeof bot.setMyMenuButton === "function") {
    bot
      .setMyMenuButton({
        menu_button: {
          type: "commands",
        },
      })
      .then(() => {
        console.log("✅ Bot Menu가 활성화되었습니다.");
      })
      .catch((err) => {
        console.log("⚠️ Bot Menu 설정 실패 (버전 미지원):", err.message);
      });
  } else {
    console.log(
      "⚠️ setMyMenuButton 메서드가 지원되지 않습니다. 명령어 목록만 사용됩니다."
    );
  }
} catch (error) {
  console.log("⚠️ Bot Menu 설정을 건너뜁니다:", error.message);
}

// 키보드 정의
const mainMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "📝 할일 관리", callback_data: "todo_menu" },
      { text: "📅 휴가 관리", callback_data: "leave_menu" },
    ],
    [
      { text: "⏰ 타이머", callback_data: "timer_menu" },
      { text: "🎯 운세", callback_data: "fortune_menu" },
    ],
    [
      { text: "🕐 근무시간", callback_data: "worktime_menu" },
      { text: "🌤️ 날씨", callback_data: "weather_menu" },
    ],
    [
      { text: "📊 마케팅 인사이트", callback_data: "insight_menu" },
      { text: "🔔 리마인더", callback_data: "reminder_menu" },
    ],
    [
      { text: "🛠️ 유틸리티", callback_data: "utils_menu" },
      { text: "❓ 도움말", callback_data: "help_menu" },
    ],
  ],
};

const leaveMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "📊 연차 현황", callback_data: "leave_status" },
      { text: "📋 사용 내역", callback_data: "leave_history" },
    ],
    [
      { text: "🏖️ 연차 사용", callback_data: "use_leave" },
      { text: "⚙️ 연차 설정", callback_data: "set_leave" },
    ],
    [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
  ],
};

const todoMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "📋 할일 목록", callback_data: "todo_list" },
      { text: "➕ 할일 추가", callback_data: "todo_add" },
    ],
    [
      { text: "📊 할일 통계", callback_data: "todo_stats" },
      { text: "🗑️ 완료된 항목 삭제", callback_data: "todo_clear_completed" },
    ],
    [{ text: "⚠️ 모든 할일 삭제", callback_data: "todo_clear_all" }],
    [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
  ],
};

const fortuneMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "🌟 일반운세", callback_data: "fortune_general" },
      { text: "💼 업무운", callback_data: "fortune_work" },
    ],
    [
      { text: "💕 연애운", callback_data: "fortune_love" },
      { text: "💰 재물운", callback_data: "fortune_money" },
    ],
    [
      { text: "🌿 건강운", callback_data: "fortune_health" },
      { text: "🍻 회식운", callback_data: "fortune_meeting" },
    ],
    [
      { text: "🃏 타로카드", callback_data: "fortune_tarot" },
      { text: "🍀 행운정보", callback_data: "fortune_lucky" },
    ],
    [{ text: "📋 종합운세", callback_data: "fortune_all" }],
    [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
  ],
};

const reminderMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "⏰ 분 단위 설정", callback_data: "remind_minutes" },
      { text: "🕐 시간 설정", callback_data: "remind_time" },
    ],
    [{ text: "❓ 사용법", callback_data: "remind_help" }],
    [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
  ],
};

const timerMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "▶️ 타이머 시작", callback_data: "timer_start_prompt" },
      { text: "⏹️ 타이머 정지", callback_data: "timer_stop" },
    ],
    [
      { text: "⏱️ 현재 상태", callback_data: "timer_status" },
      { text: "📋 타이머 기록", callback_data: "timer_history" },
    ],
    [
      { text: "📊 타이머 통계", callback_data: "timer_stats" },
      { text: "❓ 사용법", callback_data: "timer_help" },
    ],
    [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
  ],
};

const insightMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "📊 종합 인사이트", callback_data: "insight_full" },
      { text: "⚡ 빠른 인사이트", callback_data: "insight_quick" },
    ],
    [
      { text: "📱 실시간 대시보드", callback_data: "insight_dashboard" },
      { text: "📦 재고 전략", callback_data: "insight_inventory" },
    ],
    [
      { text: "🎯 마케팅 전략", callback_data: "insight_marketing" },
      { text: "📝 콘텐츠 전략", callback_data: "insight_content" },
    ],
    [
      { text: "⚠️ 리스크 분석", callback_data: "insight_risk" },
      { text: "🔄 새로고침", callback_data: "insight_refresh" },
    ],
    [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
  ],
};

// 인사이트 콜백 핸들러
async function handleInsightCallback(bot, callbackQuery, data) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userName = getUserName(callbackQuery.from);

  console.log(`📊 인사이트 콜백 처리: ${data} (사용자: ${userName})`);

  try {
    switch (data) {
      case "insight_menu":
        await bot.editMessageText(
          `📊 **${userName}님의 마케팅 인사이트**\n\n` +
            `미세먼지 기반 마케팅 전략을 확인해보세요:`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: insightMenuKeyboard,
          }
        );
        break;

      case "insight_full":
        await bot.editMessageText("🔍 종합 인사이트 생성 중...", {
          chat_id: chatId,
          message_id: messageId,
        });

        setTimeout(() => {
          try {
            dustInsights(bot, {
              chat: { id: chatId },
              from: callbackQuery.from,
              text: "/insight",
            });
          } catch (error) {
            console.error("인사이트 생성 실패:", error);
            bot.sendMessage(chatId, `❌ 인사이트 생성 실패: ${error.message}`);
          }
        }, 1000);
        break;

      case "insight_dashboard":
        await bot.editMessageText("📱 실시간 대시보드 로딩 중...", {
          chat_id: chatId,
          message_id: messageId,
        });

        setTimeout(async () => {
          try {
            if (dustInsights && dustInsights.showRealtimeDashboard) {
              await dustInsights.showRealtimeDashboard(bot, chatId, userName);
            } else {
              bot.sendMessage(chatId, "📱 대시보드 기능을 준비 중입니다...");
            }
          } catch (error) {
            console.error("대시보드 로딩 실패:", error);
            bot.sendMessage(chatId, `❌ 대시보드 로딩 실패: ${error.message}`);
          }
        }, 1000);
        break;

      case "insight_quick":
        await bot.editMessageText("⚡ 빠른 인사이트 생성 중...", {
          chat_id: chatId,
          message_id: messageId,
        });

        setTimeout(() => {
          dustInsights(bot, {
            chat: { id: chatId },
            from: callbackQuery.from,
            text: "/insight quick",
          });
        }, 1000);
        break;

      case "insight_refresh":
        await bot.editMessageText("🔄 데이터 새로고침 중...", {
          chat_id: chatId,
          message_id: messageId,
        });

        setTimeout(() => {
          dustInsights(bot, {
            chat: { id: chatId },
            from: callbackQuery.from,
            text: "/insight",
          });
        }, 1500);
        break;

      case "insight_inventory":
        await bot.sendMessage(chatId, "📦 재고 전략 기능을 준비 중입니다...");
        break;

      case "insight_marketing":
        await bot.sendMessage(chatId, "🎯 마케팅 전략 기능을 준비 중입니다...");
        break;

      case "insight_content":
        await bot.sendMessage(chatId, "📝 콘텐츠 전략 기능을 준비 중입니다...");
        break;

      case "insight_risk":
        await bot.sendMessage(chatId, "⚠️ 리스크 분석 기능을 준비 중입니다...");
        break;

      default:
        console.log(`❓ 알 수 없는 인사이트 콜백: ${data}`);
        await bot.sendMessage(
          chatId,
          `❌ **알 수 없는 명령어**\n\n` +
            `"${data}" 명령어를 처리할 수 없습니다.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 인사이트 메뉴", callback_data: "insight_menu" }],
              ],
            },
          }
        );
        break;
    }
  } catch (error) {
    console.error(`❌ 인사이트 콜백 처리 실패 (${data}):`, error);

    await bot.sendMessage(
      chatId,
      `❌ **처리 중 오류 발생**\n\n` +
        `기능: ${data}\n` +
        `오류: ${error.message}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 인사이트 메뉴", callback_data: "insight_menu" }],
          ],
        },
      }
    );
  }
}

// 메시지 핸들러
bot.on("message", async (msg) => {
  const text = msg.text;
  if (!text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userState = userStates.get(userId);

  try {
    // 취소 명령어 처리
    if (text === "/cancel") {
      userStates.delete(userId);
      bot.sendMessage(
        chatId,
        `❌ ${getUserName(msg.from)}님, 작업이 취소되었습니다.`
      );
      return;
    }

    // 상태별 처리
    if (userState && userState.action === "adding_todo") {
      try {
        const success = await todoFunctions.addTodo(userId, text);
        if (success) {
          bot.sendMessage(
            chatId,
            `✅ ${getUserName(
              msg.from
            )}님, 할일이 추가되었습니다!\n\n📝 "${text}"`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📋 할일 목록 보기", callback_data: "todo_list" }],
                ],
              },
            }
          );
        } else {
          bot.sendMessage(
            chatId,
            `❌ ${getUserName(msg.from)}님, 할일 추가 중 오류가 발생했습니다.`
          );
        }
        userStates.delete(userId);
      } catch (error) {
        console.error("할일 추가 오류:", error);
        bot.sendMessage(chatId, "❌ 할일 추가 중 오류가 발생했습니다.");
        userStates.delete(userId);
      }
      return;
    }

    // 일반 명령어 처리
    if (text.startsWith("/start")) {
      userStates.delete(userId);
      bot.sendMessage(
        chatId,
        `🤖 안녕하세요 ${getUserName(
          msg.from
        )}님!\n\n두목봇 메인 메뉴에서 원하는 기능을 선택해주세요:`,
        {
          reply_markup: mainMenuKeyboard,
        }
      );
    } else if (text === "/help") {
      userStates.delete(userId);
      utils(bot, msg);
    } else if (text === "/worktime") {
      userStates.delete(userId);
      worktime(bot, msg);
    } else if (text === "/fortune") {
      userStates.delete(userId);
      fortune(bot, msg);
    } else if (text.startsWith("/tts")) {
      userStates.delete(userId);
      utils(bot, msg);
    } else if (text.startsWith("/remind")) {
      userStates.delete(userId);
      remind(bot, msg);
    } else if (text.startsWith("/timer")) {
      userStates.delete(userId);
      timer(bot, msg);
    } else if (text.startsWith("/weather") || text.startsWith("/날씨")) {
      userStates.delete(userId);
      weather(bot, msg);
    } else if (text.startsWith("/insight") || text.startsWith("/인사이트")) {
      userStates.delete(userId);
      dustInsights(bot, msg);
    } else if (text.startsWith("/add ")) {
      userStates.delete(userId);
      const taskText = text.replace("/add ", "");
      if (taskText.trim()) {
        try {
          const success = await todoFunctions.addTodo(userId, taskText);
          if (success) {
            bot.sendMessage(
              chatId,
              `✅ ${getUserName(
                msg.from
              )}님, 할일이 추가되었습니다!\n\n📝 "${taskText}"`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "📋 할일 목록 보기", callback_data: "todo_list" }],
                  ],
                },
              }
            );
          } else {
            bot.sendMessage(
              chatId,
              `❌ ${getUserName(msg.from)}님, 할일 추가 중 오류가 발생했습니다.`
            );
          }
        } catch (error) {
          console.error("할일 추가 오류:", error);
          bot.sendMessage(chatId, "❌ 할일 추가 중 오류가 발생했습니다.");
        }
      } else {
        bot.sendMessage(
          chatId,
          `📝 ${getUserName(
            msg.from
          )}님, 할일 내용을 입력해주세요.\n예: /add 회의 준비하기`
        );
      }
    } else {
      // 일반 텍스트 처리
      if (userState) {
        console.log(`알 수 없는 사용자 상태: ${userState.action}`);
        userStates.delete(userId);
        bot.sendMessage(
          chatId,
          `❌ ${getUserName(
            msg.from
          )}님, 진행 중이던 작업이 취소되었습니다. /start 를 입력해서 다시 시작해주세요.`
        );
      } else if (text.startsWith("/")) {
        bot.sendMessage(
          chatId,
          `😅 ${getUserName(
            msg.from
          )}님, 알 수 없는 명령어입니다. /start 를 입력해서 메뉴를 확인하세요.`
        );
      }
    }
  } catch (error) {
    console.error("메시지 처리 오류:", error);
    userStates.delete(userId);
    bot.sendMessage(
      chatId,
      "❌ 처리 중 오류가 발생했습니다. /start 를 입력해서 다시 시작해주세요."
    );
  }
});

// 콜백 쿼리 핸들러 (수정된 버전)
bot.on("callback_query", async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = message.chat.id;
  const userId = callbackQuery.from.id;

  console.log(`📞 콜백 쿼리 받음: "${data}" (사용자: ${userId})`);

  // 🔥 중요: 콜백 쿼리 응답을 먼저 처리
  try {
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error("콜백 쿼리 응답 실패:", error);
  }

  try {
    // 인사이트 관련 콜백은 별도 함수로 처리
    if (data.startsWith("insight_")) {
      await handleInsightCallback(bot, callbackQuery, data);
      return;
    }

    // 메인 switch 문
    switch (data) {
      case "main_menu":
        await bot.editMessageText(
          `🤖 안녕하세요 ${getUserName(
            callbackQuery.from
          )}님!\n\n두목봇 메인 메뉴에서 원하는 기능을 선택해주세요:`,
          {
            chat_id: chatId,
            message_id: message.message_id,
            reply_markup: mainMenuKeyboard,
          }
        );
        break;

      case "todo_menu":
        await bot.editMessageText(
          `📝 ${getUserName(
            callbackQuery.from
          )}님의 할일 관리 메뉴\n\n원하는 기능을 선택해주세요:`,
          {
            chat_id: chatId,
            message_id: message.message_id,
            reply_markup: todoMenuKeyboard,
          }
        );
        break;

      case "todo_list":
        try {
          const todos = await todoFunctions.getTodos(userId);
          if (todos.length === 0) {
            await bot.sendMessage(
              chatId,
              `📝 ${getUserName(
                callbackQuery.from
              )}님의 할일이 없습니다.\n\n새로운 할일을 추가해보세요!`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "➕ 할일 추가", callback_data: "todo_add" }],
                    [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }],
                  ],
                },
              }
            );
          } else {
            // 할일 목록 표시
            const pendingTodos = todos.filter((todo) => !todo.done);
            const completedTodos = todos.filter((todo) => todo.done);

            let todoText = `📋 **${getUserName(
              callbackQuery.from
            )}님의 할일 관리**\n\n`;

            if (pendingTodos.length > 0) {
              todoText += `🟢 **진행 중** (${pendingTodos.length}개)\n`;
              pendingTodos.forEach((todo) => {
                todoText += `☐ ${todo.task}\n`;
              });
              todoText += "\n";
            }

            if (completedTodos.length > 0) {
              todoText += `📌 **완료** (${completedTodos.length}개)\n`;
              completedTodos.forEach((todo) => {
                todoText += `📌 ~~${todo.task}~~\n`;
              });
              todoText += "\n";
            }

            const todoButtons = [];
            todos.forEach((todo, index) => {
              todoButtons.push([
                {
                  text: `${todo.done ? "↩️" : "✅"} ${index + 1}`,
                  callback_data: `todo_toggle_${index}`,
                },
                {
                  text: `🗑️ ${index + 1}`,
                  callback_data: `todo_delete_${index}`,
                },
              ]);
            });

            todoButtons.push([
              { text: "🔙 할일 메뉴", callback_data: "todo_menu" },
            ]);

            await bot.sendMessage(chatId, todoText, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: todoButtons },
            });
          }
        } catch (error) {
          console.error("할일 목록 조회 오류:", error);
          await bot.sendMessage(
            chatId,
            "❌ 할일 목록을 불러오는 중 오류가 발생했습니다."
          );
        }
        break;

      case "todo_add":
        userStates.set(userId, { action: "adding_todo" });
        await bot.sendMessage(
          chatId,
          "📝 **할일 추가하기**\n\n추가할 할일을 입력해주세요.",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ 취소", callback_data: "cancel_action" }],
              ],
            },
          }
        );
        break;

      case "fortune_menu":
        await bot.editMessageText(
          "🔮 운세 메뉴\n\n원하는 운세를 선택해주세요:",
          {
            chat_id: chatId,
            message_id: message.message_id,
            reply_markup: fortuneMenuKeyboard,
          }
        );
        break;

      case "fortune_general":
        fortune(bot, {
          chat: { id: chatId },
          from: { id: userId },
          text: "/fortune",
        });
        break;

      case "weather_menu":
        const weatherMenuKeyboard = {
          inline_keyboard: [
            [
              { text: "🏡 현재날씨(화성)", callback_data: "weather_current" },
              { text: "⏰ 시간별 예보", callback_data: "weather_forecast" },
            ],
            [
              { text: "🏡 동탄", callback_data: "weather_hwaseong" },
              { text: "🏙️ 서울", callback_data: "weather_seoul" },
            ],
            [
              { text: "🌊 부산", callback_data: "weather_busan" },
              { text: "📍 더 많은 지역", callback_data: "weather_more_cities" },
            ],
            [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
          ],
        };

        await bot.editMessageText(
          "🌤️ **날씨 정보 메뉴**\n\n원하는 지역을 선택해주세요:",
          {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: "Markdown",
            reply_markup: weatherMenuKeyboard,
          }
        );
        break;

      case "weather_current":
        weather(bot, { chat: { id: chatId }, text: "/weather" });
        break;

      case "weather_hwaseong":
        weather(bot, { chat: { id: chatId }, text: "/weather 화성" });
        break;

      case "weather_seoul":
        weather(bot, { chat: { id: chatId }, text: "/weather 서울" });
        break;

      case "weather_busan":
        weather(bot, { chat: { id: chatId }, text: "/weather 부산" });
        break;

      case "weather_more_cities":
        const moreCitiesKeyboard = {
          inline_keyboard: [
            [
              { text: "🌆 인천", callback_data: "weather_incheon" },
              { text: "🌄 광주", callback_data: "weather_gwangju" },
            ],
            [
              { text: "🏛️ 대전", callback_data: "weather_daejeon" },
              { text: "🏝️ 제주", callback_data: "weather_jeju" },
            ],
            [{ text: "🔙 날씨 메뉴", callback_data: "weather_menu" }],
          ],
        };

        await bot.sendMessage(
          chatId,
          "🗺️ **전체 지역**\n\n원하는 지역을 선택해주세요:",
          {
            parse_mode: "Markdown",
            reply_markup: moreCitiesKeyboard,
          }
        );
        break;

      case "weather_incheon":
        weather(bot, { chat: { id: chatId }, text: "/weather 인천" });
        break;

      case "weather_gwangju":
        weather(bot, { chat: { id: chatId }, text: "/weather 광주" });
        break;

      case "weather_daejeon":
        weather(bot, { chat: { id: chatId }, text: "/weather 대전" });
        break;

      case "weather_jeju":
        weather(bot, { chat: { id: chatId }, text: "/weather 제주" });
        break;

      case "worktime_menu":
        worktime(bot, {
          chat: { id: chatId },
          from: callbackQuery.from,
          text: undefined,
        });
        break;

      case "cancel_action":
        userStates.delete(userId);
        await bot.sendMessage(
          chatId,
          `❌ ${getUserName(callbackQuery.from)}님, 작업이 취소되었습니다.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }],
              ],
            },
          }
        );
        break;

      default:
        // 할일 토글/삭제 처리
        if (data.startsWith("todo_toggle_")) {
          const todoIndex = parseInt(data.replace("todo_toggle_", ""));
          try {
            const newStatus = await todoFunctions.toggleTodo(userId, todoIndex);
            if (newStatus !== null) {
              const statusText = newStatus ? "완료" : "미완료";
              await bot.sendMessage(
                chatId,
                `✅ 할일 ${todoIndex + 1}번이 ${statusText}로 변경되었습니다!`
              );
            }
          } catch (error) {
            console.error("할일 토글 오류:", error);
            await bot.sendMessage(
              chatId,
              "❌ 할일 상태 변경 중 오류가 발생했습니다."
            );
          }
        } else if (data.startsWith("todo_delete_")) {
          const todoIndex = parseInt(data.replace("todo_delete_", ""));
          try {
            const success = await todoFunctions.deleteTodo(userId, todoIndex);
            if (success) {
              await bot.sendMessage(
                chatId,
                `🗑️ 할일 ${todoIndex + 1}번이 삭제되었습니다!`
              );
            }
          } catch (error) {
            console.error("할일 삭제 오류:", error);
            await bot.sendMessage(
              chatId,
              "❌ 할일 삭제 중 오류가 발생했습니다."
            );
          }
        } else {
          // 알 수 없는 콜백
          console.log("❓ 알 수 없는 콜백 데이터:", data);
          await bot.sendMessage(
            chatId,
            `❌ 알 수 없는 명령입니다. /start 를 입력해서 메뉴를 다시 확인해주세요.`
          );
        }
        break;
    }
  } catch (error) {
    console.error("콜백 처리 오류:", error);
    await bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.");
  }
});

// 봇 시작 시 상태 초기화
console.log("🔄 봇 시작 시 사용자 상태 초기화...");
userStates.clear();

// 프로세스 종료 시 정리
process.on("SIGINT", async () => {
  console.log("봇 종료 중...");

  if (typeof utils.cleanupAllTTSFiles === "function") {
    utils.cleanupAllTTSFiles();
  }

  await leaveManager.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("봇 종료 중...");

  if (typeof utils.cleanupAllTTSFiles === "function") {
    utils.cleanupAllTTSFiles();
  }

  await leaveManager.close();
  process.exit(0);
});

console.log("✅ 두목봇이 성공적으로 시작되었습니다!");
