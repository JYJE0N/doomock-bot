require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// polling 방식
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

console.log("BOT_TOKEN:", process.env.BOT_TOKEN);

bot.on('polling_error', (err) => {
  console.log('Polling error:', err);
});

console.log('doomock modular bot started!');

// 모듈 불러오기
const fortune = require('./fortune');
const timer = require('./timer');
const todo = require('./todo');
const utils = require('./utils');
const worktime = require('./worktime');

// 메인 메시지 핸들러
bot.on('message', (msg) => {
  let text = msg.text;
  const chatId = msg.chat.id;

  if (!text || !text.startsWith('/')) {
    return;
  }

  // @봇이름 제거
  if (text.includes('@')) {
    text = text.split('@')[0];
  }

  const modifiedMsg = { ...msg, text: text };

  console.log(`받은 명령어: ${text} (원본: ${msg.text}) (사용자: ${msg.from.first_name})`);

  if (text === '/start') {
    const welcomeMessage = '🤖 반가워요! 두목봇입니다!\n\n아래 버튼을 눌러서 기능을 사용해보세요 👇';
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📝 할 일 관리', callback_data: 'todo_menu' },
          { text: '⏰ 타이머', callback_data: 'timer_menu' }
        ],
        [
          { text: '🔮 운세', callback_data: 'fortune_menu' },
          { text: '💼 근무시간', callback_data: 'worktime' }
        ],
        [
          { text: '❓ 도움말', callback_data: 'help' }
        ]
      ]
    };
    bot.sendMessage(chatId, welcomeMessage, { reply_markup: keyboard });

  } else if (text === '/help') {
    utils(bot, modifiedMsg);

  } else if (text.startsWith('/worktime')) {
    worktime(bot, modifiedMsg);

  } else if (text.startsWith('/fortune')) {
    fortune(bot, modifiedMsg);

  } else if (text.startsWith('/timer')) {
    timer(bot, modifiedMsg);

  } else if (text.startsWith('/add ') ||
             text === '/todo' ||
             text === '/list' ||
             text.startsWith('/done ') ||
             text.startsWith('/delete ') ||
             text === '/clear') {
    todo(bot, modifiedMsg);

  } else {
    bot.sendMessage(chatId, '😅 알 수 없는 명령어입니다. /help 를 입력해보세요.');
  }
});

// 인라인 콜백 핸들러
bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = message.chat.id;

  bot.answerCallbackQuery(callbackQuery.id);

  if (data === 'help') {
    utils(bot, { ...callbackQuery.message, from: callbackQuery.from, text: '/help' });

  } else if (data === 'worktime') {
    worktime(bot, { ...callbackQuery.message, from: callbackQuery.from, text: '/worktime' });

  } else if (data === 'todo_menu') {
    const todoKeyboard = {
      inline_keyboard: [
        [
          { text: '➕ 할 일 추가', callback_data: 'add_todo' },
          { text: '📋 목록 보기', callback_data: 'todo_list' }
        ],
        [
          { text: '🗑️ 전체 삭제', callback_data: 'clear_todos' },
          { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
      ]
    };
    bot.editMessageText('📝 할 일 관리 메뉴입니다:', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: todoKeyboard
    });

  } else if (data === 'timer_menu') {
    const timerKeyboard = {
      inline_keyboard: [
        [
          { text: '⏰ 타이머 상태', callback_data: 'timer_status' },
          { text: '⏹️ 타이머 정지', callback_data: 'timer_stop' }
        ],
        [
          { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
      ]
    };
    bot.editMessageText('⏰ 타이머 메뉴입니다:\n\n타이머 시작은 /timer start [작업명] 으로 해주세요!', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: timerKeyboard
    });

  } else if (data === 'fortune_menu') {
    const fortuneKeyboard = {
      inline_keyboard: [
        [
          { text: '🔮 일반 운세', callback_data: 'fortune_general' },
          { text: '💼 업무운', callback_data: 'fortune_work' }
        ],
        [
          { text: '💕 연애운', callback_data: 'fortune_love' },
          { text: '💰 재물운', callback_data: 'fortune_money' }
        ],
        [
          { text: '🌿 건강운', callback_data: 'fortune_health' },
          { text: '🍻 회식운', callback_data: 'fortune_meeting' }
        ],
        [
          { text: '🃏 타로카드', callback_data: 'fortune_tarot' },
          { text: '🍀 행운정보', callback_data: 'fortune_lucky' }
        ],
        [
          { text: '🌟 종합운세', callback_data: 'fortune_all' },
          { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
      ]
    };
    bot.editMessageText('🔮 운세 메뉴입니다:', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: fortuneKeyboard
    });

  } else if (data === 'main_menu') {
    const mainKeyboard = {
      inline_keyboard: [
        [
          { text: '📝 할 일 관리', callback_data: 'todo_menu' },
          { text: '⏰ 타이머', callback_data: 'timer_menu' }
        ],
        [
          { text: '🔮 운세', callback_data: 'fortune_menu' },
          { text: '💼 근무시간', callback_data: 'worktime' }
        ],
        [
          { text: '❓ 도움말', callback_data: 'help' }
        ]
      ]
    };
    bot.editMessageText('🤖 두목봇 메인 메뉴입니다:', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: mainKeyboard
    });

  } else if (data.startsWith('todo_')) {
    if (data === 'todo_list') {
      todo(bot, { ...callbackQuery.message, from: callbackQuery.from, text: '/todo' });
    } else if (data === 'clear_todos') {
      todo(bot, { ...callbackQuery.message, from: callbackQuery.from, text: '/clear' });
    } else if (data === 'add_todo') {
      bot.sendMessage(chatId, '할 일을 추가하려면 다음과 같이 입력해주세요:\n\n/add 할일내용\n\n예: /add 장보기');
    }

  } else if (data.startsWith('timer_')) {
    if (data === 'timer_status') {
      timer(bot, { ...callbackQuery.message, from: callbackQuery.from, text: '/timer status' });
    } else if (data === 'timer_stop') {
      timer(bot, { ...callbackQuery.message, from: callbackQuery.from, text: '/timer stop' });
    }

  } else if (data.startsWith('fortune_')) {
    const fortuneType = data.replace('fortune_', '');
    let commandText = '/fortune';
    if (fortuneType !== 'general') commandText += ` ${fortuneType}`;
    fortune(bot, { ...callbackQuery.message, from: callbackQuery.from, text: commandText });
  }
});
