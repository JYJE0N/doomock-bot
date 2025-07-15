require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const todoDB = require('./todos');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("BOT_TOKEN:", process.env.BOT_TOKEN);
console.log('doomock modular bot started!');

bot.on('polling_error', (err) => {
  console.log('Polling error:', err);
});

bot.on('message', async (msg) => {
  let text = msg.text;
  const chatId = msg.chat.id;

  if (!text || !text.startsWith('/')) return;
  if (text.includes('@')) text = text.split('@')[0];

  console.log(`받은 명령어: ${text} (사용자: ${msg.from.first_name})`);

  if (text === '/start') {
    bot.sendMessage(chatId, '🤖 반가워요! 두목봇입니다.\n\n아래 버튼을 눌러서 기능을 사용해보세요 👇', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📝 할 일 관리', callback_data: 'todo_menu' },
            { text: '🔔 리마인드', callback_data: 'remind_menu' }
          ],
          [
            { text: '❓ 도움말', callback_data: 'help' }
          ]
        ]
      }
    });

  } else if (text.startsWith('/add ')) {
    const task = text.substring(5);
    await todoDB.addTodo(msg.from.id, task);
    bot.sendMessage(chatId, `✅ "${task}" 할 일을 추가했어요.`);

  } else if (text === '/list') {
    const tasks = await todoDB.getTodos(msg.from.id);
    if (tasks.length === 0) {
      bot.sendMessage(chatId, `📂 등록된 할 일이 없어요.`);
    } else {
      const list = tasks.map((t, i) => `${i+1}. ${t.task} ${t.done ? '✅' : ''}`).join('\n');
      bot.sendMessage(chatId, `📋 할 일 목록:\n${list}`);
    }

  } else if (text === '/clear') {
    await todoDB.clearTodos(msg.from.id);
    bot.sendMessage(chatId, `🗑️ 모든 할 일을 삭제했어요.`);

  } else {
    bot.sendMessage(chatId, '😅 알 수 없는 명령어입니다. /start 로 메뉴를 열어보세요.');
  }
});

bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const data = callbackQuery.data;

  bot.answerCallbackQuery(callbackQuery.id);

  if (data === 'todo_menu') {
    bot.editMessageText('📝 할 일 관리 메뉴입니다:\n\n/add 장보기\n/list\n/clear 로 사용하세요.', {
      chat_id: chatId,
      message_id: message.message_id
    });

  } else if (data === 'remind_menu') {
    bot.editMessageText('🔔 리마인드 사용법:\n\n/remind 30 공부하기\n/remind 14:30 미팅\n\n시간 뒤 또는 특정 시각에 알림을 드려요.', {
      chat_id: chatId,
      message_id: message.message_id
    });

  } else if (data === 'help') {
    bot.editMessageText('❓ 사용법:\n\n/add 할일내용\n/list\n/clear\n/remind', {
      chat_id: chatId,
      message_id: message.message_id
    });

  } else if (data === 'main_menu') {
    bot.editMessageText('🤖 두목봇 메인 메뉴입니다:', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📝 할 일 관리', callback_data: 'todo_menu' },
            { text: '🔔 리마인드', callback_data: 'remind_menu' }
          ],
          [
            { text: '❓ 도움말', callback_data: 'help' }
          ]
        ]
      }
    });
  }
});
