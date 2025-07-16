require("dotenv").config();

// Railway 환경 확인 및 로그 함수
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

rLog(`환경변수 확인 - BOT_TOKEN: ${!!ENV_CHECK.BOT_TOKEN}, MONGO_URL: ${!!ENV_CHECK.MONGO_URL}`);

if (!ENV_CHECK.BOT_TOKEN) {
  rLog("❌ BOT_TOKEN이 없습니다!", 'ERROR');
  process.exit(1);
}

// TelegramBot 초기화
let bot;
try {
  const TelegramBot = require("node-telegram-bot-api");
  bot = new TelegramBot(ENV_CHECK.BOT_TOKEN, { polling: true });
  rLog("✅ 텔레그램 봇 초기화 성공");
} catch (error) {
  rLog(`❌ 텔레그램 봇 초기화 실패: ${error.message}`, 'ERROR');
  process.exit(1);
}

// 안전한 모듈 로드 함수
const safeLoadModule = (modulePath, isRequired = false) => {
  try {
    const module = require(modulePath);
    rLog(`✅ ${modulePath} 모듈 로드 성공`);
    return module;
  } catch (error) {
    rLog(`❌ ${modulePath} 모듈 로드 실패: ${error.message}`, 'ERROR');
    if (isRequired) {
      rLog(`필수 모듈 ${modulePath} 로드 실패로 종료`, 'ERROR');
      process.exit(1);
    }
    return null;
  }
};

// 모듈 로드 (필수 모듈)
rLog("필수 모듈 로드 중...");
const todoFunctions = safeLoadModule('./todos', true);
const { getUserName } = safeLoadModule('./username_helper', true);

// 모듈 로드 (선택적 모듈)
rLog("선택적 모듈 로드 중...");
const fortune = safeLoadModule('./fortune');
const timer = safeLoadModule('./timer');
const utils = safeLoadModule('./utils');
let ttsUtils = null;

// TTS 유틸리티 별도 로드
try {
    ttsUtils = require('./utils');
    if (ttsUtils && ttsUtils.handleTTSMenu) {
        rLog("✅ TTS 유틸리티 로드 성공");
    } else {
        rLog("❌ TTS 유틸리티 함수 없음", 'WARN');
    }
} catch (error) {
    rLog(`❌ TTS 유틸리티 로드 실패: ${error.message}`, 'ERROR');
}

const worktime = safeLoadModule('./worktime');
const remind = safeLoadModule('./remind');
const weather = safeLoadModule('./weather');
const dustInsights = safeLoadModule('./dust_marketing_insights');

// 연차 관리 모듈 (특별 처리)
let leaveManager = null;
let MonthlyLeave = null;
try {
  MonthlyLeave = require('./monthly_leave');
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

// 폴링 에러 핸들링
bot.on("polling_error", (err) => {
  rLog(`폴링 오류: ${err.message}`, 'ERROR');
});

// 명령어 설정 (로드된 모듈만)
const setupCommands = async () => {
  try {
    const commands = [
      { command: 'start', description: '📱 메인 메뉴 보기' },
      { command: 'help', description: '❓ 도움말 보기' },
      { command: 'add', description: '➕ 할일 추가하기' }
    ];

    // 선택적 명령어 추가
    if (fortune) commands.push({ command: 'fortune', description: '🔮 오늘의 운세' });
    if (worktime) commands.push({ command: 'worktime', description: '🕐 근무시간 보기' });
    if (timer) commands.push({ command: 'timer', description: '⏰ 타이머 시작/종료' });
    if (utils) commands.push({ command: 'tts', description: '🔊 텍스트 음성변환' });
    if (remind) commands.push({ command: 'remind', description: '🔔 리마인더 설정' });
    if (weather) commands.push({ command: 'weather', description: '🌤️ 날씨 정보' });
    if (dustInsights) commands.push({ command: 'insight', description: '📊 마케팅 인사이트' });

    await bot.setMyCommands(commands);
    rLog(`✅ ${commands.length}개 명령어 등록 완료`);
  } catch (error) {
    rLog(`❌ 명령어 등록 실패: ${error.message}`, 'ERROR');
  }
};

setupCommands();

// 동적 키보드 생성
const createMainMenuKeyboard = () => {
  const keyboard = [];
  
  // 첫 번째 줄: 할일 관리는 항상 포함, 연차 관리는 선택적
  const firstRow = [{ text: '📝 할일 관리', callback_data: 'todo_menu' }];
  if (leaveManager) firstRow.push({ text: '📅 휴가 관리', callback_data: 'leave_menu' });
  keyboard.push(firstRow);
  
  // 두 번째 줄: 타이머, 운세
  const secondRow = [];
  if (timer) secondRow.push({ text: '⏰ 타이머', callback_data: 'timer_menu' });
  if (fortune) secondRow.push({ text: '🎯 운세', callback_data: 'fortune_menu' });
  if (secondRow.length > 0) keyboard.push(secondRow);
  
  // 세 번째 줄: 근무시간, 날씨
  const thirdRow = [];
  if (worktime) thirdRow.push({ text: '🕐 근무시간', callback_data: 'worktime_menu' });
  if (weather) thirdRow.push({ text: '🌤️ 날씨', callback_data: 'weather_menu' });
  if (thirdRow.length > 0) keyboard.push(thirdRow);
  
  // 네 번째 줄: 인사이트, 리마인더
  const fourthRow = [];
  if (dustInsights) fourthRow.push({ text: '📊 인사이트', callback_data: 'insight_menu' });
  if (remind) fourthRow.push({ text: '🔔 리마인더', callback_data: 'reminder_menu' });
  if (fourthRow.length > 0) keyboard.push(fourthRow);
  
  // 마지막 줄: 유틸리티, 도움말
  const lastRow = [];
  if (utils) lastRow.push({ text: '🛠️ 유틸리티', callback_data: 'utils_menu' });
  lastRow.push({ text: '❓ 도움말', callback_data: 'help_menu' });
  keyboard.push(lastRow);
  
  return { inline_keyboard: keyboard };
};

// 키보드 정의
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
      { text: "🔊 TTS 사용법", callback_data: "utils_tts_help" },
      { text: "🛠️ 유틸리티 도움말", callback_data: "utils_help" }
    ],
    [
      { text: "🔙 메인 메뉴", callback_data: "main_menu" }
    ]
  ]
};

// 안전한 모듈 함수 호출
const safeModuleCall = async (moduleFn, bot, msg, context = '') => {
  if (!moduleFn) {
    rLog(`${context} 모듈을 사용할 수 없습니다`, 'WARN');
    await bot.sendMessage(msg.chat.id, `❌ ${context} 기능을 일시적으로 사용할 수 없습니다.`);
    return false;
  }

  try {
    await moduleFn(bot, msg);
    return true;
  } catch (error) {
    rLog(`${context} 모듈 실행 오류: ${error.message}`, 'ERROR');
    await bot.sendMessage(msg.chat.id, `❌ ${context} 처리 중 오류가 발생했습니다.`);
    return false;
  }
};

// 새로운 메시지 전송 함수 (스크롤 문제 해결)
const sendNewMessage = async (bot, chatId, text, options = {}) => {
  try {
    await bot.sendMessage(chatId, text, options);
  } catch (error) {
    rLog(`메시지 전송 오류: ${error.message}`, 'ERROR');
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
    // 취소 명령어 처리
    if (text === "/cancel") {
      userStates.delete(userId);
      await sendNewMessage(bot, chatId, `❌ ${getUserName(msg.from)}님, 작업이 취소되었습니다.`);
      return;
    }

    // 자동 TTS 처리 (사용자 상태가 없을 때만)
    if (!userState && ttsUtils && ttsUtils.handleAutoTTS) {
      const ttsProcessed = await ttsUtils.handleAutoTTS(bot, chatId, userId, text);
      if (ttsProcessed) {
        return; // TTS로 처리되었으면 다른 처리 건너뛰기
      }
    }

    // 사용자 상태별 처리
    if (userState) {
      switch (userState.action) {
        case "adding_todo":
          await handleTodoInput(bot, chatId, userId, text);
          break;
        case "waiting_leave_input":
          await handleLeaveInput(bot, chatId, userId, text, userState);
          break;
        case "waiting_leave_setting":
          await handleLeaveSettingInput(bot, chatId, userId, text, userState);
          break;
        case "waiting_timer_input":
          await handleTimerInput(bot, chatId, userId, text);
          break;
        default:
          rLog(`알 수 없는 사용자 상태: ${userState.action}`, 'WARN');
          userStates.delete(userId);
          await sendNewMessage(bot, chatId, `❌ 작업이 취소되었습니다. /start 를 입력해서 다시 시작해주세요.`);
      }
      return;
    }

    // 일반 명령어 처리
    if (text.startsWith("/start")) {
      userStates.delete(userId);
      await sendNewMessage(bot, chatId, 
        `🤖 안녕하세요 ${getUserName(msg.from)}님!\n\n두목봇 메인 메뉴에서 원하는 기능을 선택해주세요:`,
        { reply_markup: createMainMenuKeyboard() }
      );
    } else if (text === "/help") {
      await safeModuleCall(utils, bot, msg, 'Utils');
    } else if (text === "/worktime") {
      await safeModuleCall(worktime, bot, msg, 'Worktime');
    } else if (text === "/fortune") {
      await safeModuleCall(fortune, bot, msg, 'Fortune');
    } else if (text.startsWith("/tts")) {
      if (ttsUtils && ttsUtils.handleTTSCommand) {
        await ttsUtils.handleTTSCommand(bot, chatId, userId, text);
      } else {
        await sendNewMessage(bot, chatId, "❌ TTS 기능을 사용할 수 없습니다.");
      }
    } else if (text.startsWith("/remind")) {
      await safeModuleCall(remind, bot, msg, 'Remind');
    } else if (text.startsWith("/timer")) {
      await safeModuleCall(timer, bot, msg, 'Timer');
    } else if (text.startsWith("/weather") || text.startsWith("/날씨")) {
      await safeModuleCall(weather, bot, msg, 'Weather');
    } else if (text.startsWith("/insight") || text.startsWith("/인사이트")) {
      await safeModuleCall(dustInsights, bot, msg, 'Insight');
    } else if (text.startsWith("/add ")) {
      await handleQuickAddTodo(bot, chatId, userId, text);
    } else {
      // 일반 텍스트 처리
      if (text.startsWith("/")) {
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

  // 콜백 쿼리 응답
  try {
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    rLog(`콜백 응답 실패: ${error.message}`, 'ERROR');
  }

  try {
    // 인사이트 관련 콜백 처리 (맨 앞으로 이동)
    if (data.startsWith('insight_')) {
      if (!dustInsights) {
        await sendNewMessage(bot, chatId, "❌ 인사이트 기능을 사용할 수 없습니다.");
        return;
      }

      if (dustInsights.handleCallback) {
        try {
          await dustInsights.handleCallback(bot, callbackQuery);
        } catch (error) {
          rLog(`인사이트 콜백 처리 오류: ${error.message}`, 'ERROR');
          await sendNewMessage(bot, chatId, "❌ 인사이트 처리 중 오류가 발생했습니다.");
        }
      } else {
        switch (data) {
          case "insight_menu":
            await handleInsightMenu(bot, chatId, callbackQuery.from);
            break;
          case "insight_full":
            await handleInsightFull(bot, chatId, callbackQuery.from);
            break;
          case "insight_quick":
            await handleInsightQuick(bot, chatId, callbackQuery.from);
            break;
          case "insight_dashboard":
            await handleInsightDashboard(bot, chatId, callbackQuery.from);
            break;
          default:
            await sendNewMessage(bot, chatId, "❌ 인사이트 기능을 완전히 사용할 수 없습니다.");
        }
      }
      return;
    }

    // TTS 관련 콜백 처리
    if (data.startsWith('tts_')) {
      if (ttsUtils && ttsUtils.handleTTSCallback) {
        try {
          await ttsUtils.handleTTSCallback(bot, callbackQuery);
        } catch (error) {
          rLog(`TTS 콜백 처리 오류: ${error.message}`, 'ERROR');
          await sendNewMessage(bot, chatId, "❌ TTS 처리 중 오류가 발생했습니다.");
        }
      } else {
        await sendNewMessage(bot, chatId, "❌ TTS 기능을 사용할 수 없습니다.");
      }
      return;
    }

    // 메인 메뉴 처리
    if (data === "main_menu") {
      await sendNewMessage(bot, chatId,
        `🤖 안녕하세요 ${getUserName(callbackQuery.from)}님!\n\n두목봇 메인 메뉴에서 원하는 기능을 선택해주세요:`,
        { reply_markup: createMainMenuKeyboard() }
      );
      return;
    }

    // 각 모듈별 콜백 처리
    switch (data) {
      // 할일 관리
      case "todo_menu":
        await handleTodoMenu(bot, chatId, callbackQuery.from);
        break;
      case "todo_list":
        await handleTodoList(bot, chatId, userId, callbackQuery.from);
        break;
      case "todo_add":
        await handleTodoAdd(bot, chatId, userId);
        break;
      case "todo_stats":
        await handleTodoStats(bot, chatId, userId);
        break;
      case "todo_clear_completed":
        await handleTodoClearCompleted(bot, chatId, userId);
        break;
      case "todo_clear_all":
        await handleTodoClearAll(bot, chatId, userId);
        break;

      // 휴가 관리
      case "leave_menu":
        await handleLeaveMenu(bot, chatId, userId);
        break;
      case "leave_status":
        await handleLeaveStatus(bot, chatId, userId);
        break;
      case "leave_use":
        await handleLeaveUse(bot, chatId);
        break;
      case "leave_history":
        await handleLeaveHistory(bot, chatId, userId);
        break;
      case "leave_setting":
        await handleLeaveSetting(bot, chatId, userId);
        break;
      case "use_leave_1":
        await processLeaveUsage(bot, chatId, userId, 1);
        break;
      case "use_leave_0.5":
        await processLeaveUsage(bot, chatId, userId, 0.5);
        break;
      case "use_leave_custom":
        await handleLeaveCustom(bot, chatId, userId);
        break;

      // 운세 관리
      case "fortune_menu":
        await handleFortuneMenu(bot, chatId);
        break;
      case "fortune_general":
        await handleFortuneGeneral(bot, chatId, userId);
        break;
      case "fortune_work":
        await handleFortuneWork(bot, chatId, userId);
        break;
      case "fortune_love":
        await handleFortuneLove(bot, chatId, userId);
        break;
      case "fortune_money":
        await handleFortuneMoney(bot, chatId, userId);
        break;
      case "fortune_health":
        await handleFortuneHealth(bot, chatId, userId);
        break;
      case "fortune_meeting":
        await handleFortuneMeeting(bot, chatId, userId);
        break;
      case "fortune_tarot":
        await handleFortuneTarot(bot, chatId, userId);
        break;
      case "fortune_lucky":
        await handleFortuneLucky(bot, chatId, userId);
        break;
      case "fortune_all":
        await handleFortuneAll(bot, chatId, userId, callbackQuery.from);
        break;

      // 타이머 관리
      case "timer_menu":
        await handleTimerMenu(bot, chatId);
        break;
      case "timer_start_prompt":
        await handleTimerStartPrompt(bot, chatId, userId);
        break;
      case "timer_stop":
        await handleTimerStop(bot, chatId, userId);
        break;
      case "timer_status":
        await handleTimerStatus(bot, chatId, userId);
        break;

      // 리마인더 관리
      case "reminder_menu":
        await handleReminderMenu(bot, chatId);
        break;
      case "remind_minutes":
        await handleRemindMinutes(bot, chatId);
        break;
      case "remind_time":
        await handleRemindTime(bot, chatId);
        break;
      case "remind_help":
        await handleRemindHelp(bot, chatId);
        break;

      // 날씨 관리
      case "weather_menu":
        await handleWeatherMenu(bot, chatId);
        break;
      case "weather_current":
        await handleWeatherCurrent(bot, chatId);
        break;
      case "weather_forecast":
        await handleWeatherForecast(bot, chatId);
        break;
      case "weather_seoul":
        await handleWeatherSeoul(bot, chatId);
        break;
      case "weather_busan":
        await handleWeatherBusan(bot, chatId);
        break;
      case "weather_more_cities":
        await handleWeatherMoreCities(bot, chatId);
        break;
      case "weather_incheon":
        await handleWeatherCity(bot, chatId, "인천");
        break;
      case "weather_gwangju":
        await handleWeatherCity(bot, chatId, "광주");
        break;
      case "weather_daejeon":
        await handleWeatherCity(bot, chatId, "대전");
        break;
      case "weather_jeju":
        await handleWeatherCity(bot, chatId, "제주");
        break;
      case "weather_suwon":
        await handleWeatherCity(bot, chatId, "수원");
        break;
      case "weather_ulsan":
        await handleWeatherCity(bot, chatId, "울산");
        break;

      // 근무시간 관리
      case "worktime_menu":
        await handleWorktimeMenu(bot, chatId, callbackQuery.from);
        break;

      // 유틸리티 관리
      case "utils_menu":
        await handleUtilsMenu(bot, chatId, userId);
        break;
      case "utils_tts_menu":
        if (ttsUtils && ttsUtils.handleTTSMenu) {
          await ttsUtils.handleTTSMenu(bot, chatId, userId);
        } else {
          await sendNewMessage(bot, chatId, "❌ TTS 기능을 사용할 수 없습니다.");
        }
        break;
      case "utils_tts_help":
        await handleUtilsTTSHelp(bot, chatId);
        break;
      case "utils_help":
        await handleUtilsHelp(bot, chatId);
        break;

      // 도움말 메뉴
      case "help_menu":
        await handleHelpMenu(bot, chatId);
        break;

      // 취소 액션
      case "cancel_action":
        userStates.delete(userId);
        await sendNewMessage(bot, chatId, 
          `❌ ${getUserName(callbackQuery.from)}님, 작업이 취소되었습니다.`,
          { reply_markup: { inline_keyboard: [[{ text: "🔙 메인 메뉴", callback_data: "main_menu" }]] } }
        );
        break;

      // 동적 할일 토글/삭제 처리
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

// ========================================
// 할일 관리 핸들러들
// ========================================

async function handleTodoMenu(bot, chatId, from) {
  await sendNewMessage(bot, chatId,
    `📝 ${getUserName(from)}님의 할일 관리 메뉴\n\n원하는 기능을 선택해주세요:`,
    { reply_markup: todoMenuKeyboard }
  );
}

async function handleTodoList(bot, chatId, userId, from) {
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

async function handleTodoAdd(bot, chatId, userId) {
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

async function handleTodoInput(bot, chatId, userId, text) {
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

async function handleQuickAddTodo(bot, chatId, userId, text) {
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
}

async function handleTodoStats(bot, chatId, userId) {
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

async function handleTodoClearCompleted(bot, chatId, userId) {
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

async function handleTodoClearAll(bot, chatId, userId) {
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

// ========================================
// 휴가 관리 핸들러들
// ========================================

async function handleLeaveMenu(bot, chatId, userId) {
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

async function handleLeaveStatus(bot, chatId, userId) {
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
    rLog(`휴가 상태 조회 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 휴가 상태를 불러오는 중 오류가 발생했습니다.");
  }
}

async function handleLeaveUse(bot, chatId) {
  await sendNewMessage(bot, chatId,
    '🏖️ **연차 사용하기**\n\n사용할 연차를 선택하세요:',
    {
      parse_mode: 'Markdown',
      reply_markup: useLeaveKeyboard
    }
  );
}

async function handleLeaveHistory(bot, chatId, userId) {
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

async function handleLeaveSetting(bot, chatId, userId) {
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

async function handleLeaveCustom(bot, chatId, userId) {
  await sendNewMessage(bot, chatId,
    '📝 **직접 입력**\n\n사용할 연차 일수를 입력하세요.\n예: 1, 0.5, 2.5',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ 취소', callback_data: 'cancel_action' }]
        ]
      }
    }
  );
  
  userStates.set(userId, { action: 'waiting_leave_input' });
}

async function handleLeaveInput(bot, chatId, userId, text, userState) {
  const days = parseFloat(text);
  
  if (isNaN(days) || days <= 0) {
    await sendNewMessage(bot, chatId, '❌ 올바른 숫자를 입력하세요. (예: 1, 0.5, 2.5)');
    return;
  }
  
  await processLeaveUsage(bot, chatId, userId, days);
  userStates.delete(userId);
}

async function handleLeaveSettingInput(bot, chatId, userId, text, userState) {
  const totalLeaves = parseInt(text);
  
  if (isNaN(totalLeaves) || totalLeaves <= 0) {
    await sendNewMessage(bot, chatId, '❌ 올바른 숫자를 입력하세요. (예: 15, 20, 25)');
    return;
  }
  
  try {
    const result = await leaveManager.setTotalLeaves(userId, totalLeaves);
    
    await sendNewMessage(bot, chatId,
      `✅ **연차 설정 완료**\n\n` +
      `📅 총 연차: ${result.totalLeaves}일\n` +
      `⏳ 남은 연차: ${result.remainingLeaves}일\n\n` +
      `연차 설정이 업데이트되었습니다!`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]
          ]
        }
      }
    );
  } catch (error) {
    rLog(`휴가 설정 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, '❌ 연차 설정 중 오류가 발생했습니다.');
  }
  
  userStates.delete(userId);
}

async function processLeaveUsage(bot, chatId, userId, days) {
  if (!leaveManager) {
    await sendNewMessage(bot, chatId, "❌ 휴가 관리 기능을 사용할 수 없습니다.");
    return;
  }

  try {
    const result = await leaveManager.useLeave(userId, days);
    
    await sendNewMessage(bot, chatId,
      `✅ **연차 사용 완료**\n\n` +
      `📅 사용한 연차: ${days}일\n` +
      `✅ 총 사용: ${result.usedLeaves}일\n` +
      `⏳ 남은 연차: ${result.remainingLeaves}일\n\n` +
      `${result.remainingLeaves <= 3 ? '⚠️ 연차가 얼마 남지 않았습니다!' : '✨ 연차 사용이 기록되었습니다!'}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]
          ]
        }
      }
    );
  } catch (error) {
    rLog(`연차 사용 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, `❌ ${error.message}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]
        ]
      }
    });
  }
}

// ========================================
// 운세 관리 핸들러들
// ========================================

async function handleFortuneMenu(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "🔮 **운세 메뉴**\n\n원하는 운세를 선택해주세요:",
    {
      parse_mode: 'Markdown',
      reply_markup: fortuneMenuKeyboard
    }
  );
}

async function handleFortuneGeneral(bot, chatId, userId) {
  if (!fortune) {
    await sendNewMessage(bot, chatId, "❌ 운세 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(fortune, bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune' }, 'Fortune');
}

async function handleFortuneWork(bot, chatId, userId) {
  if (!fortune) {
    await sendNewMessage(bot, chatId, "❌ 운세 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(fortune, bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune work' }, 'Fortune');
}

async function handleFortuneLove(bot, chatId, userId) {
  if (!fortune) {
    await sendNewMessage(bot, chatId, "❌ 운세 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(fortune, bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune love' }, 'Fortune');
}

async function handleFortuneMoney(bot, chatId, userId) {
  if (!fortune) {
    await sendNewMessage(bot, chatId, "❌ 운세 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(fortune, bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune money' }, 'Fortune');
}

async function handleFortuneHealth(bot, chatId, userId) {
  if (!fortune) {
    await sendNewMessage(bot, chatId, "❌ 운세 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(fortune, bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune health' }, 'Fortune');
}

async function handleFortuneMeeting(bot, chatId, userId) {
  if (!fortune) {
    await sendNewMessage(bot, chatId, "❌ 운세 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(fortune, bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune meeting' }, 'Fortune');
}

async function handleFortuneTarot(bot, chatId, userId) {
  if (!fortune) {
    await sendNewMessage(bot, chatId, "❌ 운세 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(fortune, bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune tarot' }, 'Fortune');
}

async function handleFortuneLucky(bot, chatId, userId) {
  if (!fortune) {
    await sendNewMessage(bot, chatId, "❌ 운세 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(fortune, bot, { chat: { id: chatId }, from: { id: userId }, text: '/fortune lucky' }, 'Fortune');
}

async function handleFortuneAll(bot, chatId, userId, from) {
  if (!fortune) {
    await sendNewMessage(bot, chatId, "❌ 운세 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(fortune, bot, { chat: { id: chatId }, from: from, text: '/fortune all' }, 'Fortune');
}

// ========================================
// 타이머 관리 핸들러들
// ========================================

async function handleTimerMenu(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "⏰ **타이머 메뉴**\n\n원하는 기능을 선택해주세요:",
    {
      parse_mode: 'Markdown',
      reply_markup: timerMenuKeyboard
    }
  );
}

async function handleTimerStartPrompt(bot, chatId, userId) {
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

async function handleTimerInput(bot, chatId, userId, text) {
  if (!timer) {
    await sendNewMessage(bot, chatId, "❌ 타이머 기능을 사용할 수 없습니다.");
    userStates.delete(userId);
    return;
  }

  await safeModuleCall(timer, bot, { chat: { id: chatId }, text: `/timer start ${text}` }, 'Timer');
  userStates.delete(userId);
}

async function handleTimerStop(bot, chatId, userId) {
  if (!timer) {
    await sendNewMessage(bot, chatId, "❌ 타이머 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(timer, bot, { chat: { id: chatId }, text: '/timer stop' }, 'Timer');
}

async function handleTimerStatus(bot, chatId, userId) {
  if (!timer) {
    await sendNewMessage(bot, chatId, "❌ 타이머 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(timer, bot, { chat: { id: chatId }, text: '/timer status' }, 'Timer');
}

// ========================================
// 리마인더 관리 핸들러들
// ========================================

async function handleReminderMenu(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "🔔 **리마인더 메뉴**\n\n원하는 기능을 선택해주세요:",
    {
      parse_mode: 'Markdown',
      reply_markup: reminderMenuKeyboard
    }
  );
}

async function handleRemindMinutes(bot, chatId) {
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

async function handleRemindTime(bot, chatId) {
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

async function handleRemindHelp(bot, chatId) {
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

// ========================================
// 날씨 관리 핸들러들
// ========================================

async function handleWeatherMenu(bot, chatId) {
  await sendNewMessage(bot, chatId,
    "🌤️ **날씨 정보 메뉴**\n\n원하는 지역을 선택해주세요:",
    {
      parse_mode: 'Markdown',
      reply_markup: weatherMenuKeyboard
    }
  );
}

async function handleWeatherCurrent(bot, chatId) {
  if (!weather) {
    await sendNewMessage(bot, chatId, "❌ 날씨 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(weather, bot, { chat: { id: chatId }, text: '/weather' }, 'Weather');
}

async function handleWeatherForecast(bot, chatId) {
  if (!weather) {
    await sendNewMessage(bot, chatId, "❌ 날씨 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(weather, bot, { chat: { id: chatId }, text: '/weather 예보' }, 'Weather');
}

async function handleWeatherSeoul(bot, chatId) {
  if (!weather) {
    await sendNewMessage(bot, chatId, "❌ 날씨 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(weather, bot, { chat: { id: chatId }, text: '/weather 서울' }, 'Weather');
}

async function handleWeatherBusan(bot, chatId) {
  if (!weather) {
    await sendNewMessage(bot, chatId, "❌ 날씨 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(weather, bot, { chat: { id: chatId }, text: '/weather 부산' }, 'Weather');
}

async function handleWeatherMoreCities(bot, chatId) {
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

async function handleWeatherCity(bot, chatId, city) {
  if (!weather) {
    await sendNewMessage(bot, chatId, "❌ 날씨 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(weather, bot, { chat: { id: chatId }, text: `/weather ${city}` }, 'Weather');
}

// ========================================
// 근무시간 관리 핸들러들
// ========================================

async function handleWorktimeMenu(bot, chatId, from) {
  if (!worktime) {
    await sendNewMessage(bot, chatId, "❌ 근무시간 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(worktime, bot, { chat: { id: chatId }, from: from, text: '/worktime' }, 'Worktime');
}

// ========================================
// 인사이트 관리 핸들러들
// ========================================

async function handleInsightMenu(bot, chatId, from) {
  await sendNewMessage(bot, chatId,
    `📊 **${getUserName(from)}님의 마케팅 인사이트**\n\n원하는 기능을 선택해주세요:`,
    {
      parse_mode: 'Markdown',
      reply_markup: insightMenuKeyboard
    }
  );
}

async function handleInsightFull(bot, chatId, from) {
  if (!dustInsights) {
    await sendNewMessage(bot, chatId, "❌ 인사이트 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(dustInsights, bot, { chat: { id: chatId }, from: from, text: '/insight' }, 'Insight');
}

async function handleInsightQuick(bot, chatId, from) {
  if (!dustInsights) {
    await sendNewMessage(bot, chatId, "❌ 인사이트 기능을 사용할 수 없습니다.");
    return;
  }

  await safeModuleCall(dustInsights, bot, { chat: { id: chatId }, from: from, text: '/insight quick' }, 'Insight');
}

async function handleInsightDashboard(bot, chatId, from) {
  if (!dustInsights) {
    await sendNewMessage(bot, chatId, "❌ 인사이트 기능을 사용할 수 없습니다.");
    return;
  }

  try {
    if (dustInsights.showRealtimeDashboard) {
      await dustInsights.showRealtimeDashboard(bot, chatId, getUserName(from));
    } else {
      await safeModuleCall(dustInsights, bot, { chat: { id: chatId }, from: from, text: '/insight dashboard' }, 'Insight');
    }
  } catch (error) {
    rLog(`인사이트 대시보드 오류: ${error.message}`, 'ERROR');
    await sendNewMessage(bot, chatId, "❌ 대시보드 로딩 중 오류가 발생했습니다.");
  }
}

// ========================================
// 유틸리티 관리 핸들러들
// ========================================

async function handleUtilsMenu(bot, chatId, userId) {
  const ttsMode = ttsUtils && ttsUtils.getTTSMode ? ttsUtils.getTTSMode(userId) : { active: false, language: 'ko' };
  
  const utilsText = `🛠️ **유틸리티 메뉴**\n\n` +
                   `**🔊 TTS (음성 변환)**\n` +
                   `• 현재 상태: ${ttsMode.active ? '🔊 ON' : '🔇 OFF'}\n` +
                   `• 언어: ${getLanguageName(ttsMode.language)}\n\n` +
                   `**📱 사용 방법**\n` +
                   `• TTS 모드 ON → 채팅창에 텍스트 입력\n` +
                   `• 자동으로 음성 변환됨\n\n` +
                   `원하는 기능을 선택해주세요:`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔊 TTS 설정', callback_data: 'utils_tts_menu' },
        { text: '❓ TTS 도움말', callback_data: 'utils_tts_help' }
      ],
      [
        { text: '🛠️ 전체 도움말', callback_data: 'utils_help' },
        { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
      ]
    ]
  };
  
  await sendNewMessage(bot, chatId, utilsText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function handleUtilsTTSHelp(bot, chatId) {
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
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔊 TTS 설정하기', callback_data: 'utils_tts_menu' },
        { text: '🔙 유틸리티 메뉴', callback_data: 'utils_menu' }
      ]
    ]
  };
  
  await sendNewMessage(bot, chatId, helpText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function handleUtilsHelp(bot, chatId) {
  const helpText = `🛠️ **유틸리티 도움말**\n\n` +
                  `**🔊 TTS (Text-to-Speech)**\n` +
                  `• 텍스트를 음성으로 변환\n` +
                  `• 자동 모드와 수동 모드 지원\n` +
                  `• 다국어 지원 (한/영/일/중/불/스페인어)\n\n` +
                  `**📱 사용 방법**\n` +
                  `• /tts [텍스트] - 수동 변환\n` +
                  `• TTS 모드 ON - 자동 변환\n\n` +
                  `**💡 특징**\n` +
                  `• 최대 500자 지원\n` +
                  `• 고품질 음성 합성\n` +
                  `• 메모리 효율적 관리\n\n` +
                  `더 자세한 사용법은 TTS 도움말을 참고하세요!`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔊 TTS 도움말', callback_data: 'utils_tts_help' },
        { text: '🔙 유틸리티 메뉴', callback_data: 'utils_menu' }
      ]
    ]
  };
  
  await sendNewMessage(bot, chatId, helpText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
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

// ========================================
// 도움말 핸들러
// ========================================

async function handleHelpMenu(bot, chatId) {
  const helpText = `❓ **두목봇 도움말**

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

💡 **팁:**
• 각 메뉴에서 버튼을 눌러 쉽게 사용하세요
• /cancel 로 언제든 작업을 취소할 수 있습니다
• 문제가 있으면 /start 로 초기화하세요

🚀 **Railway 클라우드에서 24/7 운영 중!**`;

  await sendNewMessage(bot, chatId, helpText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
      ]
    }
  });
}

// ========================================
// 프로세스 종료 핸들러
// ========================================

process.on('SIGINT', () => {
  rLog("🛑 SIGINT 신호 받음, 봇을 종료합니다...", 'INFO');
  
  if (ttsUtils && ttsUtils.cleanupAllTTSFiles) {
    ttsUtils.cleanupAllTTSFiles();
  }
  
  if (bot) {
    bot.stopPolling();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  rLog("🛑 SIGTERM 신호 받음, 봇을 종료합니다...", 'INFO');
  
  if (ttsUtils && ttsUtils.cleanupAllTTSFiles) {
    ttsUtils.cleanupAllTTSFiles();
  }
  
  if (bot) {
    bot.stopPolling();
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  rLog(`💥 처리되지 않은 예외: ${error.message}`, 'ERROR');
  rLog(error.stack, 'ERROR');
});

process.on('unhandledRejection', (reason, promise) => {
  rLog(`🚫 처리되지 않은 Promise 거부: ${reason}`, 'ERROR');
  rLog(`Promise: ${promise}`, 'ERROR');
});

// ========================================
// 시작 로그
// ========================================

rLog("🎉 두목봇이 성공적으로 시작되었습니다!", 'SUCCESS');
rLog(`📱 봇 정보: ${bot.getMe ? '연결됨' : '대기중'}`, 'INFO');
rLog(`🌍 환경: ${ENV_CHECK.NODE_ENV}`, 'INFO');

if (process.env.RAILWAY_DEPLOYMENT_ID) {
  rLog(`🚂 Railway 배포 ID: ${process.env.RAILWAY_DEPLOYMENT_ID}`, 'INFO');
}

rLog("✅ 모든 핸들러가 등록되었습니다. 메시지를 기다리는 중...", 'INFO');
