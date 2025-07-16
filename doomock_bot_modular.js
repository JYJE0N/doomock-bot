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

// 핸들러 함수들
const handlers = {
  // 인사이트 핸들러
  async handleInsightMenu(bot, chatId, from) {
    await sendNewMessage(bot, chatId,
      `📊 **${getUserName(from)}님의 마케팅 인사이트**\n\n원하는 기능을 선택해주세요:`,
      { parse_mode: 'Markdown', reply_markup: insightMenuKeyboard }
    );
  },

  async handleInsightFull(bot, chatId, from) {
    if (!dustInsights) {
      await sendNewMessage(bot, chatId, "❌ 인사이트 기능을 사용할 수 없습니다.");
      return;
    }
    await safeModuleCall(dustInsights, bot, { chat: { id: chatId }, from: from, text: '/insight' }, 'Insight');
  },

  async handleInsightQuick(bot, chatId, from) {
    if (!dustInsights) {
      await sendNewMessage(bot, chatId, "❌ 인사이트 기능을 사용할 수 없습니다.");
      return;
    }
    await safeModuleCall(dustInsights, bot, { chat: { id: chatId }, from: from, text: '/insight quick' }, 'Insight');
  },

  async handleInsightDashboard(bot, chatId, from) {
    if (!dustInsights || !dustInsights.showRealtimeDashboard) {
      await sendNewMessage(bot, chatId, "❌ 대시보드 기능을 사용할 수 없습니다.");
      return;
    }
    try {
      await dustInsights.showRealtimeDashboard(bot, chatId, getUserName(from));
    } catch (error) {
      rLog(`대시보드 표시 오류: ${error.message}`, 'ERROR');
      await sendNewMessage(bot, chatId, "❌ 대시보드 표시 중 오류가 발생했습니다.");
    }
  },

  // 할일 핸들러
  async handleTodoMenu(bot, chatId, from) {
    await sendNewMessage(bot, chatId,
      `📝 ${getUserName(from)}님의 할일 관리 메뉴\n\n원하는 기능을 선택해주세요:`,
      { reply_markup: todoMenuKeyboard }
    );
  },

  async handleTodoList(bot, chatId, userId, from) {
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
  },

  async handleTodoAdd(bot, chatId, userId) {
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
  },

  async handleHelpMenu(bot, chatId) {
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
      await handlers.handleHelpMenu(bot, chatId);
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
    // 인사이트 관련 콜백 우선 처리
    if (data.startsWith('insight_')) {
      if (!dustInsights) {
        await sendNewMessage(bot, chatId, "❌ 인사이트 기능을 사용할 수 없습니다.");
        return;
      }

      if (dustInsights.handleCallback) {
        try {
          await dustInsights.handleCallback(bot, callbackQuery);
          return;
        } catch (error) {
          rLog(`dustInsights.handleCallback 오류: ${error.message}`, 'ERROR');
        }
      }

      // 폴백 처리
      switch (data) {
        case "insight_menu":
          await handlers.handleInsightMenu(bot, chatId, callbackQuery.from);
          break;
        case "insight_full":
          await handlers.handleInsightFull(bot, chatId, callbackQuery.from);
          break;
        case "insight_quick":
          await handlers.handleInsightQuick(bot, chatId, callbackQuery.from);
          break;
        case "insight_dashboard":
          await handlers.handleInsightDashboard(bot, chatId, callbackQuery.from);
          break;
        default:
          await sendNewMessage(bot, chatId, "❌ 해당 인사이트 기능을 사용할 수 없습니다.");
      }
      return;
    }

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

      case "todo_menu":
        await handlers.handleTodoMenu(bot, chatId, callbackQuery.from);
        break;
      case "todo_list":
        await handlers.handleTodoList(bot, chatId, userId, callbackQuery.from);
        break;
      case "todo_add":
        await handlers.handleTodoAdd(bot, chatId, userId);
        break;

      case "help_menu":
        await handlers.handleHelpMenu(bot, chatId);
        break;

      case "cancel_action":
        userStates.delete(userId);
        await sendNewMessage(bot, chatId, 
          `❌ ${getUserName(callbackQuery.from)}님, 작업이 취소되었습니다.`,
          { reply_markup: { inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]] } }
        );
        break;

      default:
        if (data.startsWith("todo_toggle_")) {
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
        } else if (data.startsWith("todo_delete_")) {
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
