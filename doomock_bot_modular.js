require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const todoDB = require('./todos');
const fortune = require('./fortune');
const timer = require('./timer');
const worktime = require('./worktime');
const utils = require('./utils');
const remind = require('./remind');
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
            { text: '🔮 운세', callback_data: 'fortune' },
            { text: '⏰ 타이머', callback_data: 'timer' }
          ],
          [
            { text: '⏱️ 근무시간', callback_data: 'worktime' },
            { text: '🎲 유틸리티', callback_data: 'utils' }
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
  } else if (text === '/fortune') {
    fortune(bot, msg);
  } else if (text === '/worktime') {
    worktime(bot, msg);
  } else if (text.startsWith('/timer ')) {
    timer(bot, msg);
  } else if (text.startsWith('/remind ')) {
    remind(bot, msg);
  } else if (text === '/utils' || text === '/help') {
    utils(bot, msg);
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
    bot.editMessageText('📝 할 일 관리 메뉴입니다:\n\n/add 장보기 - 할 일 추가\n/list - 할 일 목록 보기\n/clear - 모든 할 일 삭제', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
        ]
      }
    });
  } else if (data === 'remind_menu') {
    bot.editMessageText('🔔 리마인드 사용법:\n\n/remind 30 공부하기\n/remind 14:30 미팅\n\n시간 뒤 또는 특정 시각에 알림을 드려요.', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
        ]
      }
    });
  } else if (data === 'fortune') {
    // fortune 모듈 호출
    const fakeMsg = { chat: { id: chatId }, from: { id: chatId } };
    fortune(bot, fakeMsg);
    bot.editMessageReplyMarkup({
      inline_keyboard: [
        [
          { text: '🎲 다시 뽑기', callback_data: 'fortune' },
          { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
      ]
    }, { chat_id: chatId, message_id: message.message_id });
  } else if (data === 'timer') {
    bot.editMessageText('⏰ 타이머 사용법:\n\n/timer 5 - 5분 타이머\n/timer 30 - 30분 타이머\n/timer 60 - 1시간 타이머\n\n직접 명령어를 입력해주세요!', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
        ]
      }
    });
  } else if (data === 'worktime') {
  // worktime 기능을 직접 구현
  const now = new Date();
  const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
  const timeString = koreaTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  
  bot.editMessageText(`⏱️ 근무시간 체크\n\n🕐 현재 시간: ${timeString}\n\n📋 회사 근무시간: 08:30 - 17:30`, {
    chat_id: chatId,
    message_id: message.message_id,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
      ]
    }
  });
}
  } else if (data === 'utils') {
    // utils 모듈 호출
    const fakeMsg = { chat: { id: chatId }, from: { id: chatId } };
    utils(bot, fakeMsg);
    bot.editMessageReplyMarkup({
      inline_keyboard: [
        [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
      ]
    }, { chat_id: chatId, message_id: message.message_id });
  } else if (data === 'help') {
    bot.editMessageText('❓ 두목봇 사용법:\n\n📝 할 일 관리: /add, /list, /clear\n🔮 운세: 오늘의 운세 확인\n⏰ 타이머: 시간 알림 설정\n⏱️ 근무시간: 출퇴근 기록\n🎲 유틸리티: 재미있는 기능들\n\n모든 기능은 /start 메뉴에서 사용할 수 있어요!', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
        ]
      }
    });
  } else if (data === 'main_menu') {
    bot.editMessageText('🤖 두목봇 메인 메뉴입니다:\n\n아래 버튼을 눌러서 기능을 사용해보세요 👇', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📝 할 일 관리', callback_data: 'todo_menu' },
            { text: '🔔 리마인드', callback_data: 'remind_menu' }
          ],
          [
            { text: '🔮 운세', callback_data: 'fortune' },
            { text: '⏰ 타이머', callback_data: 'timer' }
          ],
          [
            { text: '⏱️ 근무시간', callback_data: 'worktime' },
            { text: '🎲 유틸리티', callback_data: 'utils' }
          ],
          [
            { text: '❓ 도움말', callback_data: 'help' }
          ]
        ]
      }
    });
  }
});
