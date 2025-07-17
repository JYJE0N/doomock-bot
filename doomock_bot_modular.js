require("dotenv").config();

// Railway 환경 로그 함수
const rLog = (message, type = 'INFO') => {
  const time = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`[${time}] [${type}] ${message}`);
};

rLog("🚂 Railway에서 두목봇 시작...");

// 환경변수 확인
const ENV_CHECK = {
  BOT_TOKEN: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
  MONGO_URL: process.env.MONGO_URL || process.env.MONGODB_URI,
  NODE_ENV: process.env.NODE_ENV || 'production'
};

if (!ENV_CHECK.BOT_TOKEN) {
  rLog("❌ BOT_TOKEN이 없습니다!", 'ERROR');
  process.exit(1);
}

// TelegramBot 초기화
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(ENV_CHECK.BOT_TOKEN, { polling: true });

// 안전한 모듈 로드
const safeLoadModule = (modulePath, isRequired = false) => {
  try {
    const module = require(modulePath);
    rLog(`✅ ${modulePath} 모듈 로드 성공`);
    return module;
  } catch (error) {
    rLog(`❌ ${modulePath} 모듈 로드 실패: ${error.message}`, 'ERROR');
    if (isRequired) process.exit(1);
    return null;
  }
};

// 모듈 로드
const todoFunctions = safeLoadModule('./todos', true);
const { getUserName } = safeLoadModule('./username_helper', true);
const fortune = safeLoadModule('./fortune');
const timer = safeLoadModule('./timer');
const utils = safeLoadModule('./utils');
const worktime = safeLoadModule('./worktime');
const remind = safeLoadModule('./remind');
const weather = safeLoadModule('./weather');
const dustInsights = safeLoadModule('./dust_marketing_insights');

// 연차 관리 모듈
let leaveManager = null;
try {
  const MonthlyLeave = require('./monthly_leave');
  leaveManager = new MonthlyLeave();
  rLog("✅ 연차 관리 모듈 초기화 성공");
} catch (error) {
  rLog(`❌ 연차 관리 모듈 초기화 실패: ${error.message}`, 'ERROR');
}

// 사용자 상태 관리
const userStates = new Map();

// Railway 헬스체크
if (ENV_CHECK.NODE_ENV === 'production') {
  const http = require('http');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Doomock Bot is running!');
  });
  
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    rLog(`헬스체크 서버 실행: 포트 ${port}`, 'SERVER');
  });
}

// 키보드 정의
const createMainMenuKeyboard = () => {
  const keyboard = [];
  
  const firstRow = [{ text: '📝 할일 관리', callback_data: 'todo_menu' }];
  if (leaveManager) firstRow.push({ text: '📅 휴가 관리', callback_data: 'leave_menu' });
  keyboard.push(firstRow);
  
  const secondRow = [];
  if (timer) secondRow.push({ text: '⏰ 타이머', callback_data: 'timer_menu' });
  if (fortune) secondRow.push({ text: '🎯 운세', callback_data: 'fortune_menu' });
  if (secondRow.length > 0) keyboard.push(secondRow);
  
  const thirdRow = [];
  if (worktime) thirdRow.push({ text: '🕐 근무시간', callback_data: 'worktime_menu' });
  if (weather) thirdRow.push({ text: '🌤️ 날씨', callback_data: 'weather_menu' });
  if (thirdRow.length > 0) keyboard.push(thirdRow);
  
  const fourthRow = [];
  if (dustInsights) fourthRow.push({ text: '📊 인사이트', callback_data: 'insight_menu' });
  if (remind) fourthRow.push({ text: '🔔 리마인더', callback_data: 'reminder_menu' });
  if (fourthRow.length > 0) keyboard.push(fourthRow);
  
  const lastRow = [];
  if (utils) lastRow.push({ text: '🛠️ 유틸리티', callback_data: 'utils_menu' });
  lastRow.push({ text: '❓ 도움말', callback_data: 'help_menu' });
  keyboard.push(lastRow);
  
  return { inline_keyboard: keyboard };
};

const todoMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "📋 할일 목록", callback_data: "todo_list" },
      { text: "➕ 할일 추가", callback_data: "todo_add" }
    ],
    [
      { text: "📊 할일 통계", callback_data: "todo_stats" },
      { text: "🗑️ 완료된 항목 삭제", callback_data: "todo_clear_completed" }
    ],
    [
      { text: "⚠️ 모든 할일 삭제", callback_data: "todo_clear_all" },
      { text: "🔙 메인 메뉴", callback_data: "main_menu" }
    ]
  ]
};

const leaveMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "📊 연차 현황", callback_data: "leave_status" },
      { text: "📝 연차 사용", callback_data: "leave_use" }
    ],
    [
      { text: "📋 사용 내역", callback_data: "leave_history" },
      { text: "⚙️ 연차 설정", callback_data: "leave_setting" }
    ],
    [
      { text: "🔙 메인 메뉴", callback_data: "main_menu" }
    ]
  ]
};

const fortuneMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "🌟 일반운세", callback_data: "fortune_general" },
      { text: "💼 업무운", callback_data: "fortune_work" }
    ],
    [
      { text: "💕 연애운", callback_data: "fortune_love" },
      { text: "💰 재물운", callback_data: "fortune_money" }
    ],
    [
      { text: "🌿 건강운", callback_data: "fortune_health" },
      { text: "🍻 회식운", callback_data: "fortune_meeting" }
    ],
    [
      { text: "🃏 타로카드", callback_data: "fortune_tarot" },
      { text: "🍀 행운정보", callback_data: "fortune_lucky" }
    ],
    [
      { text: "📋 종합운세", callback_data: "fortune_all" },
      { text: "🔙 메인 메뉴", callback_data: "main_menu" }
    ]
  ]
};

const timerMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "▶️ 타이머 시작", callback_data: "timer_start_prompt" },
      { text: "⏹️ 타이머 정지", callback_data: "timer_stop" }
    ],
    [
      { text: "⏱️ 현재 상태", callback_data: "timer_status" },
      { text: "🔙 메인 메뉴", callback_data: "main_menu" }
    ]
  ]
};

const weatherMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "🏡 현재날씨(화성)", callback_data: "weather_current" },
      { text: "⏰ 시간별 예보", callback_data: "weather_forecast" }
    ],
    [
      { text: "🏙️ 서울", callback_data: "weather_seoul" },
      { text: "🌊 부산", callback_data: "weather_busan" }
    ],
    [
      { text: "📍 더 많은 지역", callback_data: "weather_more_cities" },
      { text: "🔙 메인 메뉴", callback_data: "main_menu" }
    ]
  ]
};

const insightMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "📊 종합 인사이트", callback_data: "insight_full" },
      { text: "⚡ 빠른 인사이트", callback_data: "insight_quick" }
    ],
    [
      { text: "📱 실시간 대시보드", callback_data: "insight_dashboard" },
      { text: "🔙 메인 메뉴", callback_data: "main_menu" }
    ]
  ]
};

const utilsMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "🔊 TTS 설정", callback_data: "utils_tts_menu" },
      { text: "❓ TTS 도움말", callback_data: "utils_tts_help" }
    ],
    [
      { text: "🛠️ 전체 도움말", callback_data: "utils_help" },
      { text: "🔙 메인 메뉴", callback_data: "main_menu" }
    ]
  ]
};

const reminderMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "⏰ 분 단위 설정", callback_data: "remind_minutes" },
      { text: "🕐 시간 설정", callback_data: "remind_time" }
    ],
    [
      { text: "❓ 사용법", callback_data: "remind_help" },
      { text: "🔙 메인 메뉴", callback_data: "main_menu" }
    ]
  ]
};

// 안전한 메시지 전송
const sendNewMessage = async (bot, chatId, text, options = {}) => {
  try {
    await bot.sendMessage(chatId, text, options);
  } catch (error) {
    rLog(`메시지 전송 오류: ${error.message}`, 'ERROR');
  }
};

// 안전한 모듈 호출
const safeModuleCall = async (moduleFn, bot, msg, context = '') => {
  if (!moduleFn) {
    await sendNewMessage(bot, msg.chat.id, `❌ ${context} 기능을 일시적으로 사용할 수 없습니다.`);
    return false;
  }

  try {
    await moduleFn(bot, msg);
    return true;
  } catch (error) {
    rLog(`${context} 모듈 실행 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, msg.chat.id, `❌ ${context} 처리 중 오류가 발생했습니다.`);
    return false;
  }
};

// 메시지 핸들러
bot.on("message", async (msg) => {
  const text = msg.text;
  if (!text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const userState = userStates.get(userId);

  try {
    if (text === "/cancel") {
      userStates.delete(userId);
      await sendNewMessage(bot, chatId, `❌ ${getUserName(msg.from)}님, 작업이 취소되었습니다.`);
      return;
    }

    // 자동 TTS 처리
    if (!userState && utils && utils.handleAutoTTS) {
      const ttsProcessed = await utils.handleAutoTTS(bot, chatId, userId, text);
      if (ttsProcessed) return;
    }

    // 사용자 상태별 처리
    if (userState) {
      if (userState.action === "adding_todo") {
        try {
          const success = await todoFunctions.addTodo(userId, text);
          if (success) {
            await sendNewMessage(bot, chatId,
              `✅ 할일이 추가되었습니다!\n\n📝 "${text}"`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "📋 할일 목록 보기", callback_data: "todo_list" }],
                    [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }]
                  ]
                }
              }
            );
          } else {
            await sendNewMessage(bot, chatId, "❌ 할일 추가 중 오류가 발생했습니다.");
          }
          userStates.delete(userId);
        } catch (error) {
          rLog(`할일 추가 오류: ${error.message}`, 'ERROR');
          await sendNewMessage(bot, chatId, "❌ 할일 추가 중 오류가 발생했습니다.");
          userStates.delete(userId);
        }
      }
      return;
    }

    // 명령어 처리
    if (text.startsWith("/start")) {
      userStates.delete(userId);
      await sendNewMessage(bot, chatId, 
        `🤖 안녕하세요 ${getUserName(msg.from)}님!\n\n두목봇 메인 메뉴에서 원하는 기능을 선택해주세요:`,
        { reply_markup: createMainMenuKeyboard() }
      );
    } else if (text === "/help") {
      await sendHelpMenu(bot, chatId);
    } else if (text.startsWith("/add ")) {
      const taskText = text.replace("/add ", "");
      if (taskText.trim()) {
        try {
          const success = await todoFunctions.addTodo(userId, taskText);
          if (success) {
            await sendNewMessage(bot, chatId,
              `✅ 할일이 추가되었습니다!\n\n📝 "${taskText}"`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "📋 할일 목록 보기", callback_data: "todo_list" }],
                    [{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]
                  ]
                }
              }
            );
          } else {
            await sendNewMessage(bot, chatId, "❌ 할일 추가 중 오류가 발생했습니다.");
          }
        } catch (error) {
          rLog(`할일 추가 오류: ${error.message}`, 'ERROR');
          await sendNewMessage(bot, chatId, "❌ 할일 추가 중 오류가 발생했습니다.");
        }
      } else {
        await sendNewMessage(bot, chatId, "📝 할일 내용을 입력해주세요.\n예: /add 회의 준비하기");
      }
    } else if (text.startsWith("/insight")) {
      await safeModuleCall(dustInsights, bot, msg, 'Insight');
    } else if (text.startsWith("/")) {
      // 기타 명령어들
      const commandMap = {
        '/worktime': worktime,
        '/fortune': fortune,
        '/timer': timer,
        '/remind': remind,
        '/weather': weather,
        '/날씨': weather
      };

      const command = text.split(' ')[0];
      const module = commandMap[command];
      
      if (module) {
        await safeModuleCall(module, bot, msg, command.replace('/', ''));
      } else if (text.startsWith('/tts')) {
        if (utils && utils.handleTTSCommand) {
          await utils.handleTTSCommand(bot, chatId, userId, text);
        } else {
          await sendNewMessage(bot, chatId, "❌ TTS 기능을 사용할 수 없습니다.");
        }
      } else {
        await sendNewMessage(bot, chatId, 
          `😅 ${getUserName(msg.from)}님, 알 수 없는 명령어입니다. /start 를 입력해서 메뉴를 확인하세요.`
        );
      }
    }
  } catch (error) {
    rLog(`메시지 처리 오류: ${error.message}`, 'ERROR');
    userStates.delete(userId);
    await sendNewMessage(bot, chatId, 
      "❌ 처리 중 오류가 발생했습니다. /start 를 입력해서 다시 시작해주세요."
    );
  }
});

// 콜백 쿼리 핸들러
bot.on("callback_query", async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = message.chat.id;
  const userId = callbackQuery.from.id;

  rLog(`📞 콜백 처리: ${data} (사용자: ${userId})`);

  try {
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    rLog(`콜백 응답 실패: ${error.message}`, 'ERROR');
  }

  try {
    // TTS 관련 콜백
    if (data.startsWith('tts_')) {
      if (utils && utils.handleTTSCallback) {
        await utils.handleTTSCallback(bot, callbackQuery);
      } else {
        await sendNewMessage(bot, chatId, "❌ TTS 기능을 사용할 수 없습니다.");
      }
      return;
    }

    // 메인 콜백 처리
    switch (data) {
      case "main_menu":
        await sendNewMessage(bot, chatId,
          `🤖 안녕하세요 ${getUserName(callbackQuery.from)}님!\n\n두목봇 메인 메뉴에서 원하는 기능을 선택해주세요:`,
          { reply_markup: createMainMenuKeyboard() }
        );
        break;

      // 할일 관리
      case "todo_menu":
        await sendTodoMenu(bot, chatId, callbackQuery.from);
        break;
      case "todo_list":
        await sendTodoList(bot, chatId, userId, callbackQuery.from);
        break;
      case "todo_add":
        await startTodoAdd(bot, chatId, userId);
        break;
      case "todo_stats":
        await sendTodoStats(bot, chatId, userId);
        break;
      case "todo_clear_completed":
        await clearCompletedTodos(bot, chatId, userId);
        break;
      case "todo_clear_all":
        await clearAllTodos(bot, chatId, userId);
        break;

      // 휴가 관리
      case "leave_menu":
        await sendLeaveMenu(bot, chatId, userId);
        break;
      case "leave_status":
        await sendLeaveStatus(bot, chatId, userId);
        break;
      case "leave_use":
        await sendLeaveUseMenu(bot, chatId);
        break;
      case "leave_history":
        await sendLeaveHistory(bot, chatId, userId);
        break;
      case "leave_setting":
        await startLeaveSetting(bot, chatId, userId);
        break;

      // 운세 관리
      case "fortune_menu":
        await sendFortuneMenu(bot, chatId);
        break;
      case "fortune_general":
        await handleFortune(bot, chatId, userId, '/fortune');
        break;
      case "fortune_work":
        await handleFortune(bot, chatId, userId, '/fortune work');
        break;
      case "fortune_love":
        await handleFortune(bot, chatId, userId, '/fortune love');
        break;
      case "fortune_money":
        await handleFortune(bot, chatId, userId, '/fortune money');
        break;
      case "fortune_health":
        await handleFortune(bot, chatId, userId, '/fortune health');
        break;
      case "fortune_meeting":
        await handleFortune(bot, chatId, userId, '/fortune meeting');
        break;
      case "fortune_tarot":
        await handleFortune(bot, chatId, userId, '/fortune tarot');
        break;
      case "fortune_lucky":
        await handleFortune(bot, chatId, userId, '/fortune lucky');
        break;
      case "fortune_all":
        await handleFortune(bot, chatId, callbackQuery.from, '/fortune all');
        break;

      // 타이머 관리
      case "timer_menu":
        await sendTimerMenu(bot, chatId);
        break;
      case "timer_start_prompt":
        await startTimerPrompt(bot, chatId, userId);
        break;
      case "timer_stop":
        await handleTimer(bot, chatId, '/timer stop');
        break;
      case "timer_status":
        await handleTimer(bot, chatId, '/timer status');
        break;

      // 날씨 관리
      case "weather_menu":
        await sendWeatherMenu(bot, chatId);
        break;
      case "weather_current":
        await handleWeather(bot, chatId, '/weather');
        break;
      case "weather_forecast":
        await handleWeather(bot, chatId, '/weather 예보');
        break;
      case "weather_seoul":
        await handleWeather(bot, chatId, '/weather 서울');
        break;
      case "weather_busan":
        await handleWeather(bot, chatId, '/weather 부산');
        break;
      case "weather_more_cities":
        await sendWeatherMoreCities(bot, chatId);
        break;

      // 인사이트 관리
      case "insight_menu":
        await sendInsightMenu(bot, chatId, callbackQuery.from);
        break;
      case "insight_full":
        await handleInsight(bot, chatId, callbackQuery.from, '/insight');
        break;
      case "insight_quick":
        await handleInsight(bot, chatId, callbackQuery.from, '/insight quick');
        break;
      case "insight_dashboard":
        await handleInsightDashboard(bot, chatId, callbackQuery.from);
        break;

      // 유틸리티 관리
      case "utils_menu":
        await sendUtilsMenu(bot, chatId, userId);
        break;
      case "utils_tts_menu":
        await handleTTSMenu(bot, chatId, userId);
        break;
      case "utils_tts_help":
        await sendTTSHelp(bot, chatId);
        break;
      case "utils_help":
        await sendUtilsHelp(bot, chatId);
        break;

      // 리마인더 관리
      case "reminder_menu":
        await sendReminderMenu(bot, chatId);
        break;
      case "remind_minutes":
        await sendRemindMinutes(bot, chatId);
        break;
      case "remind_time":
        await sendRemindTime(bot, chatId);
        break;
      case "remind_help":
        await sendRemindHelp(bot, chatId);
        break;

      // 근무시간 관리
      case "worktime_menu":
        await handleWorktime(bot, chatId, callbackQuery.from);
        break;

      // 도움말
      case "help_menu":
        await sendHelpMenu(bot, chatId);
        break;

      // 취소
      case "cancel_action":
        userStates.delete(userId);
        await sendNewMessage(bot, chatId, 
          `❌ ${getUserName(callbackQuery.from)}님, 작업이 취소되었습니다.`,
          { reply_markup: { inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]] } }
        );
        break;

      // 동적 콜백 처리
      default:
        if (data.startsWith("todo_toggle_")) {
          await handleTodoToggle(bot, chatId, userId, data);
        } else if (data.startsWith("todo_delete_")) {
          await handleTodoDelete(bot, chatId, userId, data);
        } else {
          rLog(`❓ 알 수 없는 콜백: ${data}`, 'WARN');
          await sendNewMessage(bot, chatId, 
            `❌ 알 수 없는 명령입니다. 메인 메뉴로 돌아갑니다.`,
            { reply_markup: { inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]] } }
          );
        }
        break;
    }
  } catch (error) {
    rLog(`콜백 처리 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 처리 중 오류가 발생했습니다.");
  }
});

// 핸들러 함수들
async function sendTodoMenu(bot, chatId, from) {
  await sendNewMessage(bot, chatId,
    `📝 ${getUserName(from)}님의 할일 관리 메뉴\n\n원하는 기능을 선택해주세요:`,
    { reply_markup: todoMenuKeyboard }
  );
}

async function sendTodoList(bot, chatId, userId, from) {
  try {
    const todos = await todoFunctions.getTodos(userId);
    if (todos.length === 0) {
      await sendNewMessage(bot, chatId,
        `📝 ${getUserName(from)}님의 할일이 없습니다.\n\n새로운 할일을 추가해보세요!`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ 할일 추가", callback_data: "todo_add" }],
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }]
            ]
          }
        }
      );
      return;
    }

    const pendingTodos = todos.filter(todo => !todo.done);
    const completedTodos = todos.filter(todo => todo.done);

    let todoText = `📋 **${getUserName(from)}님의 할일 관리**\n\n`;

    if (pendingTodos.length > 0) {
      todoText += `🟢 **진행 중** (${pendingTodos.length}개)\n`;
      pendingTodos.forEach(todo => {
        todoText += `☐ ${todo.task}\n`;
      });
      todoText += "\n";
    }

    if (completedTodos.length > 0) {
      todoText += `📌 **완료** (${completedTodos.length}개)\n`;
      completedTodos.forEach(todo => {
        todoText += `📌 ~~${todo.task}~~\n`;
      });
      todoText += "\n";
    }

    const todoButtons = [];
    todos.forEach((todo, index) => {
      todoButtons.push([
        {
          text: `${todo.done ? "↩️" : "✅"} ${index + 1}번`,
          callback_data: `todo_toggle_${index}`
        },
        {
          text: `🗑️ ${index + 1}번`,
          callback_data: `todo_delete_${index}`
        }
      ]);
    });

    todoButtons.push([
      { text: "🔙 할일 메뉴", callback_data: "todo_menu" }
    ]);

    await sendNewMessage(bot, chatId, todoText, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: todoButtons }
    });
  } catch (error) {
    rLog(`할일 목록 조회 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 할일 목록을 불러오는 중 오류가 발생했습니다.");
  }
}

async function startTodoAdd(bot, chatId, userId) {
  userStates.set(userId, { action: "adding_todo" });
  await sendNewMessage(bot, chatId,
    "📝 **할일 추가하기**\n\n추가할 할일을 입력해주세요.",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ 취소", callback_data: "cancel_action" }]
        ]
      }
    }
  );
}

async function sendTodoStats(bot, chatId, userId) {
  try {
    const stats = await todoFunctions.getTodoStats(userId);
    await sendNewMessage(bot, chatId,
      `📊 **할일 통계**\n\n` +
      `📝 전체 할일: ${stats.total}개\n` +
      `✅ 완료: ${stats.completed}개\n` +
      `⏳ 진행중: ${stats.pending}개\n` +
      `📈 완료율: ${stats.completionRate}%\n\n` +
      `${stats.completionRate >= 80 ? '🎉 훌륭해요!' : 
        stats.completionRate >= 50 ? '💪 잘하고 있어요!' : '📚 화이팅!'}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }]
          ]
        }
      }
    );
  } catch (error) {
    rLog(`할일 통계 조회 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 할일 통계를 불러오는 중 오류가 발생했습니다.");
  }
}

async function clearCompletedTodos(bot, chatId, userId) {
  try {
    const success = await todoFunctions.clearCompletedTodos(userId);
    if (success) {
      await sendNewMessage(bot, chatId,
        "✅ 완료된 할일이 모두 삭제되었습니다!",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📋 할일 목록 보기", callback_data: "todo_list" }],
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }]
            ]
          }
        }
      );
    } else {
      await sendNewMessage(bot, chatId, "❌ 할일 삭제 중 오류가 발생했습니다.");
    }
  } catch (error) {
    rLog(`완료된 할일 삭제 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 할일 삭제 중 오류가 발생했습니다.");
  }
}

async function clearAllTodos(bot, chatId, userId) {
  try {
    const success = await todoFunctions.clearTodos(userId);
    if (success) {
      await sendNewMessage(bot, chatId,
        "⚠️ 모든 할일이 삭제되었습니다!",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ 새 할일 추가", callback_data: "todo_add" }],
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }]
            ]
          }
        }
      );
    } else {
      await sendNewMessage(bot, chatId, "❌ 할일 삭제 중 오류가 발생했습니다.");
    }
  } catch (error) {
    rLog(`모든 할일 삭제 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 할일 삭제 중 오류가 발생했습니다.");
  }
}

async function handleTodoToggle(bot, chatId, userId, data) {
  const todoIndex = parseInt(data.replace("todo_toggle_", ""));
  try {
    const newStatus = await todoFunctions.toggleTodo(userId, todoIndex);
    if (newStatus !== null) {
      const statusText = newStatus ? "완료" : "미완료";
      await sendNewMessage(bot, chatId,
        `✅ 할일 ${todoIndex + 1}번이 ${statusText}로 변경되었습니다!`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📋 할일 목록 보기", callback_data: "todo_list" }],
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }]
            ]
          }
        }
      );
    }
  } catch (error) {
    rLog(`할일 토글 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 할일 상태 변경 중 오류가 발생했습니다.");
  }
}

async function handleTodoDelete(bot, chatId, userId, data) {
  const todoIndex = parseInt(data.replace("todo_delete_", ""));
  try {
    const success = await todoFunctions.deleteTodo(userId, todoIndex);
    if (success) {
      await sendNewMessage(bot, chatId,
        `🗑️ 할일 ${todoIndex + 1}번이 삭제되었습니다!`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📋 할일 목록 보기", callback_data: "todo_list" }],
              [{ text: "🔙 할일 메뉴", callback_data: "todo_menu" }]
            ]
          }
        }
      );
    }
  } catch (error) {
    rLog(`할일 삭제 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 할일 삭제 중 오류가 발생했습니다.");
  }
}

// 휴가 관리 함수들
async function sendLeaveMenu(bot, chatId, userId) {
  if (!leaveManager) {
    await sendNewMessage(bot, chatId, "❌ 휴가 관리 기능을 사용할 수 없습니다.");
    return;
  }

  try {
    const user = await leaveManager.getUserLeaves(userId);
    const statusText = leaveManager.formatLeaveStatus(user);
    
    await sendNewMessage(bot, chatId, statusText, {
      parse_mode: 'Markdown',
      reply_markup: leaveMenuKeyboard
    });
  } catch (error) {
    rLog(`휴가 메뉴 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 휴가 정보를 불러오는 중 오류가 발생했습니다.");
  }
}

async function sendLeaveStatus(bot, chatId, userId) {
  await sendLeaveMenu(bot, chatId, userId);
}

async function sendLeaveUseMenu(bot, chatId) {
  const useLeaveKeyboard = {
    inline_keyboard: [
      [
        { text: "🏖️ 연차 1일", callback_data: "use_leave_1" },
        { text: "🌅 반차 0.5일", callback_data: "use_leave_0.5" }
      ],
      [
        { text: "✏️ 직접 입력", callback_data: "use_leave_custom" },
        { text: "🔙 뒤로가기", callback_data: "leave_menu" }
      ]
    ]
  };

  await sendNewMessage(bot, chatId,
    '🏖️ **연차 사용하기**\n\n사용할 연차를 선택하세요:',
    {
      parse_mode: 'Markdown',
      reply_markup: useLeaveKeyboard
    }
  );
}

async function sendLeaveHistory(bot, chatId, userId) {
  if (!leaveManager) {
    await sendNewMessage(bot, chatId, "❌ 휴가 관리 기능을 사용할 수 없습니다.");
    return;
  }

  try {
    const history = await leaveManager.getLeaveHistory(userId);
    const historyText = leaveManager.formatLeaveHistory(history);
    
    await sendNewMessage(bot, chatId, historyText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]
        ]
      }
    });
  } catch (error) {
    rLog(`휴가 내역 조회 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 휴가 내역을 불러오는 중 오류가 발생했습니다.");
  }
}

async function startLeaveSetting(bot, chatId, userId) {
  await sendNewMessage(bot, chatId,
    '⚙️ **연차 설정**\n\n총 연차 일수를 입력하세요.\n예: 15, 20, 25',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ 취소', callback_data: 'cancel_action' }]
        ]
      }
    }
  );
  
  userStates.set(userId, { action: 'waiting_leave_setting' });
}

// 운세 관리 함수들
async function sendFortuneMenu(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "🔮 **운세 메뉴**\n\n원하는 운세를 선택해주세요:",
    {
      parse_mode: 'Markdown',
      reply_markup: fortuneMenuKeyboard
    }
  );
}

async function handleFortune(bot, chatId, from, command) {
  if (!fortune) {
    await sendNewMessage(bot, chatId, "❌ 운세 기능을 사용할 수 없습니다.");
    return;
  }

  const msg = { 
    chat: { id: chatId }, 
    from: typeof from === 'object' ? from : { id: from }, 
    text: command 
  };
  await safeModuleCall(fortune, bot, msg, 'Fortune');
}

// 타이머 관리 함수들
async function sendTimerMenu(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "⏰ **타이머 메뉴**\n\n원하는 기능을 선택해주세요:",
    {
      parse_mode: 'Markdown',
      reply_markup: timerMenuKeyboard
    }
  );
}

async function startTimerPrompt(bot, chatId, userId) {
  await sendNewMessage(bot, chatId,
    "⏰ **타이머 시작**\n\n작업명을 입력해주세요.\n예: 독서하기, 운동하기",
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ 취소', callback_data: 'cancel_action' }]
        ]
      }
    }
  );
  
  userStates.set(userId, { action: 'waiting_timer_input' });
}

async function handleTimer(bot, chatId, command) {
  if (!timer) {
    await sendNewMessage(bot, chatId, "❌ 타이머 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(timer, bot, { chat: { id: chatId }, text: command }, 'Timer');
}

// 날씨 관리 함수들
async function sendWeatherMenu(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "🌤️ **날씨 정보 메뉴**\n\n원하는 지역을 선택해주세요:",
    {
      parse_mode: 'Markdown',
      reply_markup: weatherMenuKeyboard
    }
  );
}

async function handleWeather(bot, chatId, command) {
  if (!weather) {
    await sendNewMessage(bot, chatId, "❌ 날씨 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(weather, bot, { chat: { id: chatId }, text: command }, 'Weather');
}

async function sendWeatherMoreCities(bot, chatId) {
  const moreCitiesKeyboard = {
    inline_keyboard: [
      [
        { text: "🌆 인천", callback_data: "weather_incheon" },
        { text: "🌄 광주", callback_data: "weather_gwangju" }
      ],
      [
        { text: "🏛️ 대전", callback_data: "weather_daejeon" },
        { text: "🏝️ 제주", callback_data: "weather_jeju" }
      ],
      [
        { text: "🌄 수원", callback_data: "weather_suwon" },
        { text: "🌊 울산", callback_data: "weather_ulsan" }
      ],
      [
        { text: "🔙 날씨 메뉴", callback_data: "weather_menu" }
      ]
    ]
  };

  await sendNewMessage(bot, chatId,
    "🌍 **더 많은 지역**\n\n원하는 지역을 선택해주세요:",
    {
      parse_mode: 'Markdown',
      reply_markup: moreCitiesKeyboard
    }
  );
}

// 인사이트 관리 함수들
async function sendInsightMenu(bot, chatId, from) {
  await sendNewMessage(bot, chatId,
    `📊 **${getUserName(from)}님의 마케팅 인사이트**\n\n원하는 기능을 선택해주세요:`,
    {
      parse_mode: 'Markdown',
      reply_markup: insightMenuKeyboard
    }
  );
}

async function handleInsight(bot, chatId, from, command) {
  if (!dustInsights) {
    await sendNewMessage(bot, chatId, "❌ 인사이트 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(dustInsights, bot, { chat: { id: chatId }, from: from, text: command }, 'Insight');
}

//수정 위치
async function handleInsightDashboard(bot, chatId, from) {
  // 1차: dustInsights.showRealtimeDashboard 시도
  if (dustInsights && dustInsights.showRealtimeDashboard) {
    try {
      rLog(`📱 대시보드 호출 시도: ${getUserName(from)}`, 'INFO');
      await dustInsights.showRealtimeDashboard(bot, chatId, getUserName(from));
      return;
    } catch (error) {
      rLog(`❌ 대시보드 1차 시도 실패: ${error.message}`, 'ERROR');
    }
  }

  // 2차: 일반 인사이트로 폴백
  if (dustInsights) {
    try {
      rLog(`📊 인사이트 폴백 시도`, 'INFO');
      await safeModuleCall(dustInsights, bot, { 
        chat: { id: chatId }, 
        from: from, 
        text: '/insight' 
      }, 'Insight');
      return;
    } catch (error) {
      rLog(`❌ 인사이트 폴백 실패: ${error.message}`, 'ERROR');
    }
  }

  // 3차: 수동 대시보드 생성
  try {
    rLog(`🔧 수동 대시보드 생성`, 'INFO');
    
    const now = new Date();
    const koreaTime = now.toLocaleTimeString('ko-KR', { 
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const dashboardText = `📱 **실시간 마케팅 대시보드**\n\n` +
                         `⏰ **현재 시간** (${koreaTime})\n` +
                         `• 시스템 상태: 🟢 정상 운영\n` +
                         `• 사용자: ${getUserName(from)}님\n\n` +
                         `📊 **기본 정보**\n` +
                         `• 인사이트 모듈: ${dustInsights ? '✅ 로드됨' : '❌ 오류'}\n` +
                         `• 대시보드 상태: 🔧 수동 모드\n\n` +
                         `⚡ **빠른 액션**\n` +
                         `• 종합 인사이트로 상세 분석 가능\n` +
                         `• 전체 마케팅 데이터 조회 가능\n\n` +
                         `💡 **안내**\n` +
                         `고급 대시보드 기능이 일시적으로 제한됩니다.\n` +
                         `종합 인사이트를 이용해주세요.`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 종합 인사이트", callback_data: "insight_full" },
          { text: "⚡ 빠른 인사이트", callback_data: "insight_quick" }
        ],
        [
          { text: "🔄 다시 시도", callback_data: "insight_dashboard" },
          { text: "🔙 인사이트 메뉴", callback_data: "insight_menu" }
        ]
      ]
    };

    await sendNewMessage(bot, chatId, dashboardText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    rLog(`✅ 수동 대시보드 생성 성공`, 'SUCCESS');
    
  } catch (error) {
    rLog(`❌ 수동 대시보드 생성 실패: ${error.message}`, 'ERROR');
    
    // 최종 폴백
    await sendNewMessage(bot, chatId, 
      "❌ 실시간 대시보드를 표시할 수 없습니다.\n\n" +
      "📊 종합 인사이트를 이용해주세요.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📊 종합 인사이트", callback_data: "insight_full" },
              { text: "🔙 인사이트 메뉴", callback_data: "insight_menu" }
            ]
          ]
        }
      }
    );
  }
}

// 유틸리티 관리 함수들
async function sendUtilsMenu(bot, chatId, userId) {
  const ttsMode = utils && utils.getTTSMode ? utils.getTTSMode(userId) : { active: false, language: 'ko' };
  
  const utilsText = `🛠️ **유틸리티 메뉴**\n\n` +
                   `**🔊 TTS (음성 변환)**\n` +
                   `• 현재 상태: ${ttsMode.active ? '🔊 ON' : '🔇 OFF'}\n` +
                   `• 언어: ${getLanguageName(ttsMode.language)}\n\n` +
                   `**📱 사용 방법**\n` +
                   `• TTS 모드 ON → 채팅창에 텍스트 입력\n` +
                   `• 자동으로 음성 변환됨\n\n` +
                   `원하는 기능을 선택해주세요:`;
  
  await sendNewMessage(bot, chatId, utilsText, {
    parse_mode: 'Markdown',
    reply_markup: utilsMenuKeyboard
  });
}

async function handleTTSMenu(bot, chatId, userId) {
  if (utils && utils.handleTTSMenu) {
    await utils.handleTTSMenu(bot, chatId, userId);
  } else {
    await sendNewMessage(bot, chatId, "❌ TTS 기능을 사용할 수 없습니다.");
  }
}

async function sendTTSHelp(bot, chatId) {
  const helpText = `🔊 **TTS 도움말**\n\n` +
                  `**🎯 두 가지 사용 방법**\n\n` +
                  `**1️⃣ 자동 모드 (추천)**\n` +
                  `• 🛠️ 유틸리티 → 🔊 TTS 설정\n` +
                  `• TTS 모드를 ON으로 설정\n` +
                  `• 채팅창에 텍스트 입력\n` +
                  `• 자동으로 음성 변환! 🎵\n\n` +
                  `**2️⃣ 수동 모드**\n` +
                  `• /tts [텍스트] 명령어 사용\n` +
                  `• 예: /tts 안녕하세요\n\n` +
                  `**🌍 지원 언어**\n` +
                  `• 한국어, English, 日本語\n` +
                  `• 中文, Español, Français\n\n` +
                  `**💡 특징**\n` +
                  `• 최대 500자까지 지원\n` +
                  `• 이전 음성 파일 자동 삭제\n` +
                  `• 자연스러운 음성 합성\n` +
                  `• 실시간 언어 변경 가능\n\n` +
                  `지금 바로 TTS 설정을 해보세요! 🚀`;
  
  await sendNewMessage(bot, chatId, helpText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔊 TTS 설정하기', callback_data: 'utils_tts_menu' },
          { text: '🔙 유틸리티 메뉴', callback_data: 'utils_menu' }
        ]
      ]
    }
  });
}

async function sendUtilsHelp(bot, chatId) {
  await sendNewMessage(bot, chatId, "🛠️ 유틸리티 전체 도움말은 준비 중입니다.");
}

function getLanguageName(langCode) {
  const languages = {
    'ko': '🇰🇷 한국어',
    'en': '🇺🇸 English',
    'ja': '🇯🇵 日本語',
    'zh': '🇨🇳 中文',
    'es': '🇪🇸 Español',
    'fr': '🇫🇷 Français'
  };
  return languages[langCode] || langCode;
}

// 리마인더 관리 함수들
async function sendReminderMenu(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "🔔 **리마인더 메뉴**\n\n원하는 기능을 선택해주세요:",
    {
      parse_mode: 'Markdown',
      reply_markup: reminderMenuKeyboard
    }
  );
}

async function sendRemindMinutes(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "⏰ **분 단위 리마인더**\n\n사용법: /remind [분] [내용]\n\n예시:\n• /remind 30 독서하기\n• /remind 60 운동하기",
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 리마인더 메뉴', callback_data: 'reminder_menu' }]
        ]
      }
    }
  );
}

async function sendRemindTime(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "🕐 **시간 설정 리마인더**\n\n사용법: /remind [시간] [내용]\n\n예시:\n• /remind 14:30 점심약속\n• /remind 18:00 퇴근 준비",
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 리마인더 메뉴', callback_data: 'reminder_menu' }]
        ]
      }
    }
  );
}

async function sendRemindHelp(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "❓ **리마인더 사용법**\n\n" +
    "**📱 두 가지 방법:**\n" +
    "• /remind [분] [내용]\n" +
    "• /remind [시간] [내용]\n\n" +
    "**⏰ 분 단위 예시:**\n" +
    "• /remind 30 독서하기\n" +
    "• /remind 60 운동하기\n\n" +
    "**🕐 시간 설정 예시:**\n" +
    "• /remind 14:30 점심약속\n" +
    "• /remind 18:00 퇴근 준비\n\n" +
    "설정한 시간이 되면 알림을 보내드립니다! 🔔",
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 리마인더 메뉴', callback_data: 'reminder_menu' }]
        ]
      }
    }
  );
}

// 근무시간 관리 함수
async function handleWorktime(bot, chatId, from) {
  if (!worktime) {
    await sendNewMessage(bot, chatId, "❌ 근무시간 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(worktime, bot, { chat: { id: chatId }, from: from, text: '/worktime' }, 'Worktime');
}

// 도움말 함수
async function sendHelpMenu(bot, chatId) {
  const helpText = `
❓ **두목봇 도움말**

🤖 **주요 기능:**
• 📝 할일 관리 - 할일 추가/완료/삭제
• 📅 휴가 관리 - 연차 사용/관리
• 🔮 운세 - 다양한 운세 정보
• ⏰ 타이머 - 작업 시간 관리
• 🔔 리마인더 - 알림 설정
• 🌤️ 날씨 - 날씨 정보
• 📊 인사이트 - 마케팅 인사이트
• 🛠️ 유틸리티 - TTS 등

🎯 **빠른 명령어:**
• /start - 메인 메뉴
• /add [할일] - 할일 빠른 추가
• /help - 도움말

🚀 **Railway 클라우드에서 24/7 운영 중!**
  `;

  await sendNewMessage(bot, chatId, helpText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
      ]
    }
  });
}

// 에러 핸들러
bot.on('polling_error', (error) => {
  rLog(`폴링 오류: ${error.message}`, 'ERROR');
});

process.on('uncaughtException', (error) => {
  rLog(`💥 처리되지 않은 예외: ${error.message}`, 'ERROR');
});

process.on('unhandledRejection', (reason, promise) => {
  rLog(`🚫 처리되지 않은 Promise 거부: ${reason}`, 'ERROR');
});

process.on('SIGINT', () => {
  rLog("🛑 봇을 종료합니다...", 'INFO');
  if (utils && utils.cleanupAllTTSFiles) utils.cleanupAllTTSFiles();
  if (bot) bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  rLog("🛑 봇을 종료합니다...", 'INFO');
  if (utils && utils.cleanupAllTTSFiles) utils.cleanupAllTTSFiles();
  if (bot) bot.stopPolling();
  process.exit(0);
});

// 봇 시작 로그
rLog("🎉 두목봇이 성공적으로 시작되었습니다!", 'SUCCESS');
rLog(`📱 봇 정보: 연결됨`, 'INFO');
rLog(`🌍 환경: ${ENV_CHECK.NODE_ENV}`, 'INFO');

if (process.env.RAILWAY_DEPLOYMENT_ID) {
  rLog(`🚂 Railway 배포 ID: ${process.env.RAILWAY_DEPLOYMENT_ID}`, 'INFO');
}

rLog("✅ 모든 핸들러가 등록되었습니다. 메시지를 기다리는 중...", 'INFO');
