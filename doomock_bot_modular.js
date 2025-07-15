require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { MongoClient } = require("mongodb");

// =============================
// MongoDB 연결
// =============================
const client = new MongoClient(process.env.MONGO_URL);
let todos;

(async () => {
  await client.connect();
  console.log("✅ MongoDB Connected");
  const db = client.db("doomock");
  todos = db.collection("todos");
})();

// =============================
// Telegram Bot 설정
// =============================
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("BOT_TOKEN:", process.env.BOT_TOKEN);
console.log('doomock modular bot with MongoDB started!');

bot.on('polling_error', (err) => {
  console.log('Polling error:', err);
});

// =============================
// 메인 명령어 핸들러
// =============================
bot.on('message', async (msg) => {
  let text = msg.text;
  const chatId = msg.chat.id;

  if (!text || !text.startsWith('/')) return;

  if (text.includes('@')) {
    text = text.split('@')[0];
  }

  console.log(`받은 명령어: ${text} (사용자: ${msg.from.first_name})`);

  if (text === '/start') {
    const welcomeMessage = '🤖 반가워요! 두목봇입니다!\n\n아래 버튼을 눌러서 기능을 사용해보세요 👇';
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📝 할 일 관리', callback_data: 'todo_menu' },
          { text: '🔔 리마인드', callback_data: 'remind_menu' }
        ],
        [
          { text: '❓ 도움말', callback_data: 'help' }
        ]
      ]
    };
    bot.sendMessage(chatId, welcomeMessage, { reply_markup: keyboard });

  } else if (text.startsWith('/add ')) {
    const task = text.substring(5);
    await todos.insertOne({ userId: msg.from.id, task, done: false, createdAt: new Date() });
    bot.sendMessage(chatId, `✅ "${task}" 할 일을 추가했어요.`);

  } else if (text === '/list') {
    const userTodos = await todos.find({ userId: msg.from.id }).toArray();
    if (userTodos.length === 0) {
      bot.sendMessage(chatId, `📂 등록된 할 일이 없어요.`);
    } else {
      const list = userTodos.map((t, i) => `${i+1}. ${t.task} ${t.done ? '✅' : ''}`).join('\n');
      bot.sendMessage(chatId, `📋 할 일 목록:\n${list}`);
    }

  } else if (text === '/clear') {
    await todos.deleteMany({ userId: msg.from.id });
    bot.sendMessage(chatId, `🗑️ 모든 할 일을 삭제했어요.`);

  } else if (text.match(/\/remind \d+\s.+/)) {
    const [_, minStr, task] = text.match(/\/remind (\d+)\s(.+)/);
    const minutes = parseInt(minStr);
    bot.sendMessage(chatId, `⏳ ${minutes}분 뒤에 "${task}" 리마인드 할게요.`);
    setTimeout(() => {
      bot.sendMessage(chatId, `🔔 리마인드: ${task}`);
    }, minutes * 60 * 1000);

  } else if (text.match(/\/remind \d{1,2}:\d{2}\s.+/)) {
    const [_, time, task] = text.match(/\/remind (\d{1,2}:\d{2})\s(.+)/);
    const [hour, minute] = time.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target < now) target.setDate(target.getDate() + 1);
    const delay = target - now;

    bot.sendMessage(chatId, `⏰ ${time}에 "${task}" 리마인드 할게요.`);
    setTimeout(() => {
      bot.sendMessage(chatId, `🔔 지금은 ${time}! 리마인드: ${task}`);
    }, delay);

  } else {
    bot.sendMessage(chatId, '😅 알 수 없는 명령어입니다. /start 로 메뉴를 열어보세요.');
  }
});

// =============================
// 인라인 버튼 핸들러
// =============================
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const data = callbackQuery.data;

  bot.answerCallbackQuery(callbackQuery.id);

  if (data === 'help') {
    bot.editMessageText('❓ 사용법\n\n' +
      '/add 할일내용\n/add 장보기\n\n' +
      '/list 등록된 할일 보기\n' +
      '/clear 모든 할일 삭제\n\n' +
      '/remind 30 공부하기\n/remind 14:30 회의\n시간 뒤 또는 특정 시각에 리마인드', {
      chat_id: chatId,
      message_id: message.message_id
    });

  } else if (data === 'todo_menu') {
    const todoKeyboard = {
      inline_keyboard: [
        [
          { text: '➕ 할 일 추가', callback_data: 'add_todo_info' },
          { text: '📋 목록 보기', callback_data: 'list_todo' }
        ],
        [
          { text: '🗑️ 전체 삭제', callback_data: 'clear_todo' },
          { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
      ]
    };
    bot.editMessageText('📝 할 일 관리 메뉴입니다:', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: todoKeyboard
    });

  } else if (data === 'remind_menu') {
    bot.editMessageText('🔔 리마인드 사용법:\n\n' +
      '/remind 30 독서하기\n/remind 14:30 점심약속\n\n' +
      '시간 뒤 또는 특정 시각에 알림을 드려요.', {
      chat_id: chatId,
      message_id: message.message_id
    });

  } else if (data === 'add_todo_info') {
    bot.sendMessage(chatId, '할 일을 추가하려면 이렇게 입력해주세요:\n\n/add 장보기');

  } else if (data === 'list_todo') {
    const userTodos = await todos.find({ userId: callbackQuery.from.id }).toArray();
    if (userTodos.length === 0) {
      bot.sendMessage(chatId, `📂 등록된 할 일이 없어요.`);
    } else {
      const list = userTodos.map((t, i) => `${i+1}. ${t.task} ${t.done ? '✅' : ''}`).join('\n');
      bot.sendMessage(chatId, `📋 할 일 목록:\n${list}`);
    }

  } else if (data === 'clear_todo') {
    await todos.deleteMany({ userId: callbackQuery.from.id });
    bot.sendMessage(chatId, `🗑️ 모든 할 일을 삭제했어요.`);

  } else if (data === 'main_menu') {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📝 할 일 관리', callback_data: 'todo_menu' },
          { text: '🔔 리마인드', callback_data: 'remind_menu' }
        ],
        [
          { text: '❓ 도움말', callback_data: 'help' }
        ]
      ]
    };
    bot.editMessageText('🤖 두목봇 메인 메뉴입니다:', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: keyboard
    });
  }
});
