require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const todo = require('./todos');
const fortune = require('./fortune');
const remind = require('./remind');
const timer = require('./timer');
const worktime = require('./worktime');
const utils = require('./utils');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("✅ 두목봇 started!");

// 봇 명령어 메뉴 설정 (그룹채팅 왼쪽 삼선메뉴)
bot.setMyCommands([
  { command: 'start', description: '🏠 메인 메뉴' },
  { command: 'add', description: '📝 할 일 추가' },
  { command: 'list', description: '📋 할 일 목록' },
  { command: 'done', description: '✅ 할 일 완료' },
  { command: 'delete', description: '🗑️ 할 일 삭제' },
  { command: 'stats', description: '📊 할 일 통계' },
  { command: 'say', description: '🗣️ TTS 음성읽기' },
  { command: 'fortune', description: '🔮 오늘의 운세' },
  { command: 'tarot', description: '🃏 타로카드' },
  { command: 'timer', description: '⏰ 타이머' },
  { command: 'worktime', description: '⏱️ 근무시간' },
  { command: 'remind', description: '🔔 리마인드' }
]);

const lastAudio = {};

// /start 명령어
bot.onText(/\/start/, (msg) => {
  sendMainMenu(msg.chat.id);
});

// /say 명령어 - TTS 기능
bot.onText(/\/say (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];
  const ttsUrl = utils.Utils.getTTSUrl(text);

  if (lastAudio[chatId]) {
    bot.deleteMessage(chatId, lastAudio[chatId]).catch(console.error);
  }

  bot.sendAudio(chatId, ttsUrl, {
    caption: `🗣 "${text}" 를 읽어드릴게요.`
  }).then(sentMsg => {
    lastAudio[chatId] = sentMsg.message_id;
  });
});

bot.onText(/\/say$/, (msg) => {
  bot.sendMessage(msg.chat.id, "😅 읽을 문장을 입력해주세요.\n예: `/say 안녕하세요`", { parse_mode: "Markdown" });
});

// 할 일 관리 명령어들
bot.onText(/\/add (.+)/, async (msg, match) => {
  await todo.addTodo(msg.from.id, match[1]);
  bot.sendMessage(msg.chat.id, `✅ 할 일을 추가했습니다: ${match[1]}`);
});

bot.onText(/\/list/, async (msg) => {
  const todosList = await todo.getTodos(msg.from.id) || [];
  if (!todosList.length) {
    return bot.sendMessage(msg.chat.id, "📭 아직 등록된 할 일이 없습니다.");
  }
  
  let text = "📝 **할 일 목록:**\n";
  todosList.forEach((t, i) => text += `${i + 1}. ${t.done ? "✅" : "🔲"} ${t.task}\n`);
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

bot.onText(/\/done (\d+)/, async (msg, match) => {
  const status = await todo.toggleTodo(msg.from.id, parseInt(match[1], 10) - 1);
  if (status === null) {
    return bot.sendMessage(msg.chat.id, "😅 올바른 번호를 입력해주세요.");
  }
  bot.sendMessage(msg.chat.id, `✅ ${match[1]}번 할 일 상태를 ${status ? "완료" : "미완료"}로 변경했습니다.`);
});

bot.onText(/\/delete (\d+)/, async (msg, match) => {
  const result = await todo.deleteTodo(msg.from.id, parseInt(match[1], 10) - 1);
  if (!result) {
    return bot.sendMessage(msg.chat.id, "😅 올바른 번호를 입력해주세요.");
  }
  bot.sendMessage(msg.chat.id, `🗑️ ${match[1]}번 할 일을 삭제했습니다.`);
});

bot.onText(/\/clear_completed/, async (msg) => {
  await todo.clearCompletedTodos(msg.from.id);
  bot.sendMessage(msg.chat.id, "🧹 완료된 할 일을 모두 삭제했습니다.");
});

// 추가 명령어들
bot.onText(/\/fortune$/, (msg) => {
  fortune(bot, { chat: { id: msg.chat.id }, from: msg.from, text: '/fortune' });
});

bot.onText(/\/tarot$/, (msg) => {
  fortune(bot, { chat: { id: msg.chat.id }, from: msg.from, text: '/fortune tarot' });
});

bot.onText(/\/timer$/, (msg) => {
  timer(bot, { chat: { id: msg.chat.id }, from: msg.from, text: '/timer' });
});

bot.onText(/\/worktime$/, (msg) => {
  worktime(bot, { chat: { id: msg.chat.id }, from: msg.from, text: '/worktime' });
});

bot.onText(/\/remind$/, (msg) => {
  remind(bot, { chat: { id: msg.chat.id }, from: msg.from, text: '/remind' });
});

// 콜백 쿼리 처리
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  bot.answerCallbackQuery(query.id);

  try {
    switch (data) {
      case 'todo_menu':
        sendTodoMenu(chatId);
        break;
        
      case 'list_todos':
        await handleListTodos(chatId, userId);
        break;
        
      case 'clear_completed':
        await handleClearCompleted(chatId, userId);
        break;
        
      case 'stats':
        await handleStats(chatId, userId);
        break;
        
      case 'fortune_menu':
        sendFortuneMenu(chatId);
        break;
        
      case 'fortune_general':
        fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune' });
        break;
        
      case 'fortune_work':
        fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune work' });
        break;
        
      case 'fortune_love':
        fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune love' });
        break;
        
      case 'fortune_money':
        fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune money' });
        break;
        
      case 'fortune_health':
        fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune health' });
        break;
        
      case 'fortune_meeting':
        fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune meeting' });
        break;
        
      case 'fortune_tarot':
        fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune tarot' });
        break;
        
      case 'fortune_lucky':
        fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune lucky' });
        break;
        
      case 'fortune_all':
        fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune all' });
        break;
        
      case 'remind_menu':
        remind(bot, { chat: { id: chatId }, from: query.from, text: '/remind' });
        break;
        
      case 'timer':
        timer(bot, { chat: { id: chatId }, from: query.from, text: '/timer' });
        break;
        
      case 'worktime':
        worktime(bot, { chat: { id: chatId }, from: query.from, text: '/worktime' });
        break;
        
      case 'say_test':
        handleSayTest(chatId);
        break;
        
      case 'say_help':
        handleSayHelp(chatId);
        break;
        
      case 'say_usage':
        handleSayUsage(chatId);
        break;
        
      case 'help':
        sendHelp(chatId);
        break;
        
      case 'main_menu':
      default:
        sendMainMenu(chatId);
        break;
    }
  } catch (error) {
    console.error('콜백 처리 에러:', error);
    bot.sendMessage(chatId, "⚠️ 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
  }
});

// 메인 메뉴 함수
function sendMainMenu(chatId) {
  bot.sendMessage(chatId, '🏠 **두목봇 메인 메뉴**\n\n원하는 기능을 선택하세요 👇', {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: '📝 할 일', callback_data: 'todo_menu' }, { text: '🔔 리마인드', callback_data: 'remind_menu' }],
        [{ text: '🔮 운세', callback_data: 'fortune_menu' }, { text: '🎴 타로', callback_data: 'fortune_tarot' }],
        [{ text: '⏰ 타이머', callback_data: 'timer' }, { text: '⏱️ 근무시간', callback_data: 'worktime' }],
        [{ text: '🗣️ TTS', callback_data: 'say_help' }, { text: '❓ 도움말', callback_data: 'help' }]
      ]
    }
  });
}

// 할 일 관리 메뉴
function sendTodoMenu(chatId) {
  bot.sendMessage(chatId, '📝 **할 일 관리**\n\n원하는 작업을 선택하세요:', {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 목록 보기', callback_data: 'list_todos' }],
        [{ text: '🧹 완료항목 삭제', callback_data: 'clear_completed' }],
        [{ text: '📊 통계 보기', callback_data: 'stats' }],
        [{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]
      ]
    }
  });
}

// 운세 메뉴
function sendFortuneMenu(chatId) {
  bot.sendMessage(chatId, '🔮 **운세 메뉴**\n\n원하는 운세를 선택하세요:', {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌟 오늘의 운세', callback_data: 'fortune_general' }, { text: '💼 업무운', callback_data: 'fortune_work' }],
        [{ text: '💕 연애운', callback_data: 'fortune_love' }, { text: '💰 재물운', callback_data: 'fortune_money' }],
        [{ text: '🌿 건강운', callback_data: 'fortune_health' }, { text: '🍻 회식운', callback_data: 'fortune_meeting' }],
        [{ text: '🃏 타로카드', callback_data: 'fortune_tarot' }, { text: '🍀 행운정보', callback_data: 'fortune_lucky' }],
        [{ text: '📊 종합운세', callback_data: 'fortune_all' }],
        [{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]
      ]
    }
  });
}

// 할 일 목록 처리
async function handleListTodos(chatId, userId) {
  const todosList = await todo.getTodos(userId) || [];
  if (!todosList.length) {
    return bot.sendMessage(chatId, "📭 아직 등록된 할 일이 없습니다.");
  }
  
  let text = "📝 **할 일 목록:**\n\n";
  todosList.forEach((t, i) => {
    text += `${i + 1}. ${t.done ? "✅" : "🔲"} ${t.task}\n`;
  });
  
  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

// 완료된 할 일 삭제 처리
async function handleClearCompleted(chatId, userId) {
  await todo.clearCompletedTodos(userId);
  bot.sendMessage(chatId, "🧹 완료된 할 일을 모두 삭제했습니다.");
}

// 통계 처리
async function handleStats(chatId, userId) {
  const s = await todo.getTodoStats(userId);
  bot.sendMessage(chatId, 
    `📊 **할 일 통계**\n\n` +
    `총 할 일: ${s.total}개\n` +
    `✅ 완료: ${s.completed}개\n` +
    `🔲 미완료: ${s.pending}개\n` +
    `📈 완료율: ${s.completionRate}%`, 
    { parse_mode: "Markdown" }
  );
}

// TTS 테스트 처리
function handleSayTest(chatId) {
  const content = "안녕하세요! 두목봇 TTS 테스트입니다.";
  const ttsUrl = utils.Utils.getTTSUrl(content);
  
  if (lastAudio[chatId]) {
    bot.deleteMessage(chatId, lastAudio[chatId]).catch(console.error);
  }
  
  bot.sendAudio(chatId, ttsUrl, { 
    caption: `🗣 "${content}"` 
  }).then(sentMsg => {
    lastAudio[chatId] = sentMsg.message_id;
  });
}

// TTS 사용법 안내
function handleSayHelp(chatId) {
  bot.sendMessage(chatId, '🗣️ **TTS (음성 읽기) 사용법**\n\n원하는 기능을 선택하세요:', {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎤 테스트 음성 듣기', callback_data: 'say_test' }],
        [{ text: '📝 사용법 보기', callback_data: 'say_usage' }],
        [{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]
      ]
    }
  });
}

// TTS 상세 사용법
function handleSayUsage(chatId) {
  const usageText = `🗣️ **TTS 사용법 가이드**\n\n` +
    `**기본 사용법:**\n` +
    `\`/say 읽을 문장\`\n\n` +
    `**사용 예시:**\n` +
    `• \`/say 안녕하세요\`\n` +
    `• \`/say 오늘 날씨가 좋네요\`\n` +
    `• \`/say 두목봇 최고야\`\n\n` +
    `**주의사항:**\n` +
    `• 한글, 영어 모두 지원\n` +
    `• 너무 긴 문장은 잘릴 수 있어요\n` +
    `• 이전 음성은 자동으로 삭제됩니다\n\n` +
    `**팁:**\n` +
    `• 띄어쓰기를 정확히 하면 더 자연스러워요\n` +
    `• 문장부호(. , ! ?)를 사용하면 억양이 살아요\n\n` +
    `지금 바로 시도해보세요! 🎯`;
    
  bot.sendMessage(chatId, usageText, { 
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎤 테스트 해보기', callback_data: 'say_test' }],
        [{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]
      ]
    }
  });
}

// 도움말
function sendHelp(chatId) {
  const helpText = `❓ **두목봇 도움말**\n\n` +
    `**할 일 관리:**\n` +
    `• 할 일 추가: "할일 [내용]"\n` +
    `• 할 일 완료: "완료 [번호]"\n` +
    `• 할 일 삭제: "삭제 [번호]"\n\n` +
    `**기타 기능:**\n` +
    `• TTS: "말해줘 [문장]"\n` +
    `• 메뉴 보기: "메뉴"\n\n` +
    `또는 아래 버튼을 이용하세요! 🎯`;
    
  bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
}
