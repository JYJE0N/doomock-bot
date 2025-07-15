require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fortune = require('./fortune');
const remind = require('./remind');
const timer = require('./timer');
const worktime = require('./worktime');
const utils = require('./utils');
const todo = require('./todo');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("✅ 두목봇 started!");

const lastAudio = {};

// /start 명령어
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sendMainMenu(chatId);
});

// 메인 메뉴 인라인 버튼
function sendMainMenu(chatId) {
  bot.sendMessage(chatId, '🏠 메인 메뉴입니다. 원하는 기능을 선택하세요 👇', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📝 할 일 관리', callback_data: 'todo_menu' }, { text: '🔔 리마인드', callback_data: 'remind_menu' }],
        [{ text: '🔮 운세', callback_data: 'fortune_menu' }, { text: '🎴 타로카드', callback_data: 'fortune_tarot' }],
        [{ text: '⏰ 타이머', callback_data: 'timer' }, { text: '⏱️ 근무시간', callback_data: 'worktime' }],
        [{ text: '🎲 유틸리티', callback_data: 'utils' }],
        [{ text: '❓ 도움말', callback_data: 'help' }]
      ]
    }
  });
}

// callback_query 핸들러
bot.on('callback_query', (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  console.log(`🔥 callback_query: data=${data}`);

  bot.answerCallbackQuery(query.id);

  switch (data) {
    case 'todo_menu':
      bot.sendMessage(chatId, '📝 할 일 메뉴입니다.\n\n- /add 로 할 일 추가\n- /list 로 목록 보기\n- /done 으로 완료 표시', {
        reply_markup: { inline_keyboard: [[{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]] }
      });
      break;

    case 'remind_menu':
      remind(bot, { chat: { id: chatId }, from: query.from, message_id: messageId });
      break;

    case 'fortune_menu':
      bot.sendMessage(chatId, '🔮 원하는 운세를 선택하세요:', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔮 일반 운세', callback_data: 'fortune_general' }],
            [{ text: '💼 업무 운세', callback_data: 'fortune_work' }],
            [{ text: '❤️ 연애 운세', callback_data: 'fortune_love' }],
            [{ text: '🌈 종합 운세', callback_data: 'fortune_all' }],
            [{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]
          ]
        }
      });
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
    case 'fortune_all':
      fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune all' });
      break;

    case 'fortune_tarot':
      fortune(bot, { chat: { id: chatId }, from: query.from, text: '/fortune tarot' });
      break;

    case 'timer':
      timer(bot, { chat: { id: chatId }, from: query.from, message_id: messageId });
      break;

    case 'worktime':
      worktime(bot, { chat: { id: chatId }, from: query.from, message_id: messageId });
      break;

    case 'utils':
      bot.sendMessage(chatId, '🎲 유틸리티 메뉴입니다.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗣️ 말하기 테스트', callback_data: 'say_test' }],
            [{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]
          ]
        }
      });
      break;

    case 'say_test':
      const content = "안녕하세요! 두목봇 테스트 음성입니다.";
      const ttsUrl = utils.Utils.getTTSUrl(content);

      if (lastAudio[chatId]) {
        bot.deleteMessage(chatId, lastAudio[chatId]).catch(console.error);
      }

      bot.sendAudio(chatId, ttsUrl, {
        caption: `🗣 "${content}" 를 읽어드릴게요.`
      }).then(sentMsg => {
        lastAudio[chatId] = sentMsg.message_id;
      });
      break;

    case 'help':
      bot.sendMessage(chatId, '❓ 도움말입니다.\n\n'
        + '/add, /list, /done 등으로 할 일 관리\n'
        + '/fortune 으로 운세 보기\n'
        + '/fortune_tarot 으로 타로 뽑기\n'
        + '/timer 로 타이머 시작\n'
        + '/say 로 TTS 테스트\n\n'
        + '필요시 언제든 물어보세요!', {
        reply_markup: {
          inline_keyboard: [[{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]]
        }
      });
      break;

    case 'main_menu':
    default:
      sendMainMenu(chatId);
      break;
  }
});
