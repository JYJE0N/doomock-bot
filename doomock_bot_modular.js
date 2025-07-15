require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const todoDB = require('./todos');
const fortune = require('./fortune');
const timer = require('./timer');
const worktime = require('./worktime');
const utils = require('./utils');
const remind = require('./remind');

const lastAudio = {};  // 🔥 추가

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
      const list = tasks.map((t, i) => `${i + 1}. ${t.task} ${t.done ? '✅' : '⏳'}`).join('\n');
      bot.sendMessage(chatId, `📋 할 일 목록:\n${list}\n\n💡 완료: /done 번호\n💡 삭제: /del 번호`);
    }

  } else if (text === '/clear') {
    await todoDB.clearTodos(msg.from.id);
    bot.sendMessage(chatId, `🗑️ 모든 할 일을 삭제했어요.`);

  } else if (text.startsWith('/done ')) {
    const index = parseInt(text.substring(6)) - 1;
    const result = await todoDB.toggleTodo(msg.from.id, index);
    if (result !== null) {
      bot.sendMessage(chatId, result ?
        `✅ ${index + 1}번 할 일을 완료했어요!` :
        `📝 ${index + 1}번 할 일을 미완료로 변경했어요!`);
    } else {
      bot.sendMessage(chatId, '❌ 잘못된 번호입니다.');
    }

  } else if (text.startsWith('/del ')) {
    const index = parseInt(text.substring(5)) - 1;
    const result = await todoDB.deleteTodo(msg.from.id, index);
    if (result) {
      bot.sendMessage(chatId, `🗑️ ${index + 1}번 할 일을 삭제했어요!`);
    } else {
      bot.sendMessage(chatId, '❌ 잘못된 번호입니다.');
    }

  } else if (text === '/fortune' || text.startsWith('/fortune ')) {
    fortune(bot, msg);

  } else if (text === '/worktime') {
    worktime(bot, msg);

  } else if (text.startsWith('/timer ')) {
    timer(bot, msg);

  } else if (text.startsWith('/remind ')) {
    remind(bot, msg);

  } else if (text.startsWith('/say')) {
  const content = text.length > 4 ? text.substring(5).trim() : "읽을 내용이 없습니다.";
  const ttsUrl = utils.Utils.getTTSUrl(content);

  if (lastAudio[chatId]) {
    bot.deleteMessage(chatId, lastAudio[chatId]).catch(console.error);
  }

  bot.sendAudio(chatId, ttsUrl, {
    caption: `🗣 "${content}" 를 읽어드릴게요.`
  }).then(sentMsg => {
    lastAudio[chatId] = sentMsg.message_id;
  }).catch(err => {
    console.error("TTS sendAudio error:", err);
    bot.sendMessage(chatId, '❌ 음성파일을 전송하는데 실패했어요.');
  });

bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;

  bot.answerCallbackQuery(callbackQuery.id);

  if (data === 'todo_menu') {
    bot.editMessageText('📝 **할 일 관리 메뉴**\n\n' +
      '**✏️ 추가:** /add 장보기\n' +
      '**📋 목록:** /list\n' +
      '**✅ 완료:** /done 1\n' +
      '**🗑️ 삭제:** /del 1\n' +
      '**🗑️ 전체삭제:** /clear', {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📋 할 일 보기', callback_data: 'show_todos' },
            { text: '🗑️ 전체 삭제', callback_data: 'clear_todos' }
          ],
          [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
        ]
      }
    });

  } else if (data === 'show_todos') {
    const tasks = await todoDB.getTodos(userId);
    if (tasks.length === 0) {
      bot.editMessageText('📂 등록된 할 일이 없어요.', {
        chat_id: chatId,
        message_id: message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 할 일 메뉴', callback_data: 'todo_menu' }]
          ]
        }
      });
    } else {
      const list = tasks.map((t, i) =>
        `${i + 1}. ${t.task} ${t.done ? '✅' : '⏳'}`
      ).join('\n');
      bot.editMessageText(`📋 **할 일 목록**\n\n${list}\n\n💡 완료: /done 번호\n💡 삭제: /del 번호`, {
        chat_id: chatId,
        message_id: message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 새로고침', callback_data: 'show_todos' },
              { text: '🔙 할 일 메뉴', callback_data: 'todo_menu' }
            ]
          ]
        }
      });
    }

  } else if (data === 'clear_todos') {
    await todoDB.clearTodos(userId);
    bot.editMessageText('🗑️ 모든 할 일을 삭제했어요!', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 할 일 메뉴', callback_data: 'todo_menu' }]
        ]
      }
    });

  } else if (data === 'remind_menu') {
    bot.editMessageText('🔔 리마인드 사용법:\n\n/remind 30 공부하기\n/remind 14:30 미팅', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
        ]
      }
    });

  } else if (data === 'fortune') {
    bot.editMessageText('🔮 **운세 메뉴**\n\n원하는 운세를 선택해주세요:', {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🌟 일반운세', callback_data: 'fortune_general' },
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
            { text: '📊 종합운세', callback_data: 'fortune_all' }
          ],
          [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
          ]
        ]
      }
    });

  } else if (data.startsWith('fortune_')) {
    const fortuneType = data.replace('fortune_', '');
    const fakeMsg = {
      text: `/fortune ${fortuneType === 'general' ? '' : fortuneType}`,
      chat: { id: chatId },
      from: { id: userId, first_name: callbackQuery.from.first_name }
    };
    fortune(bot, fakeMsg);
    setTimeout(() => {
      bot.sendMessage(chatId, '🎯 **다른 운세도 확인해보세요!**', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔮 운세 메뉴', callback_data: 'fortune' },
              { text: '🏠 메인 메뉴', callback_data: 'main_menu' }
            ]
          ]
        }
      });
    }, 1000);

  } else if (data === 'timer') {
    bot.editMessageText('⏰ 타이머 사용법:\n\n/timer 5\n/timer 30\n/timer 60', {
      chat_id: chatId,
      message_id: message.message_id,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏰ 5분', callback_data: 'timer_5' },
            { text: '⏰ 15분', callback_data: 'timer_15' },
            { text: '⏰ 30분', callback_data: 'timer_30' }
          ],
          [
            { text: '⏰ 1시간', callback_data: 'timer_60' },
            { text: '⏰ 2시간', callback_data: 'timer_120' }
          ],
          [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
          ]
        ]
      }
    });

  } else if (data.startsWith('timer_')) {
    const minutes = data.replace('timer_', '');
    const fakeMsg = {
      text: `/timer ${minutes}`,
      chat: { id: chatId },
      from: { id: userId }
    };
    timer(bot, fakeMsg);
    setTimeout(() => {
      bot.sendMessage(chatId, '⏰ 타이머가 설정되었습니다!', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⏰ 타이머 메뉴', callback_data: 'timer' },
              { text: '🏠 메인 메뉴', callback_data: 'main_menu' }
            ]
          ]
        }
      });
    }, 1000);

  } else if (data === 'worktime') {
    worktime(bot, {
      chat: { id: chatId },
      from: { id: userId }
    });

  } else if (data === 'utils') {
    bot.editMessageText('🎲 **유틸리티 메뉴**\n\n필요한 기능을 선택하세요:', {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗣️ 말하기 테스트', callback_data: 'say_test' }],
          [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
        ]
      }
    });

  } else if (data === 'say_test') {
    const content = "안녕하세요! 두목봇 테스트 음성입니다.";
    const ttsUrl = utils.Utils.getTTSUrl(content);
    bot.sendAudio(chatId, ttsUrl, {
      caption: `🗣 "${content}" 를 읽어드릴게요.`
    });
    setTimeout(() => {
      bot.sendMessage(chatId, '🎲 **유틸리티 메뉴로 돌아갑니다**', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎲 유틸리티', callback_data: 'utils' }],
            [{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]
          ]
        }
      });
    }, 1000);

  } else if (data === 'help') {
    bot.editMessageText('❓ **두목봇 사용법**\n\n📝 할 일 / 🔮 운세 / ⏰ 타이머 / ⏱️ 근무시간 등은 /start 메뉴에서 사용할 수 있어요!', {
      chat_id: chatId,
      message_id: message.message_id,
      parse_mode: 'Markdown',
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
