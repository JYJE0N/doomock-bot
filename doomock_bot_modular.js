require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const todo = require('./todos');
const utils = require('./utils');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("✅ 두목봇 started!");

const lastAudio = {};

// /start
bot.onText(/\/start/, (msg) => {
  sendMainMenu(msg.chat.id);
});

// /say
bot.onText(/\/say (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const text = match[1];
  const ttsUrl = utils.Utils.getTTSUrl(text);

  bot.sendAudio(chatId, ttsUrl, {
    caption: `🗣 "${text}" 를 읽어드릴게요.`
  });
});

bot.onText(/\/say$/, (msg) => {
  bot.sendMessage(msg.chat.id, "😅 읽을 문장을 입력해주세요.\n예: `/say 안녕하세요`", { parse_mode: "Markdown" });
});

// /add
bot.onText(/\/add (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  await todo.addTodo(userId, match[1]);
  bot.sendMessage(msg.chat.id, `✅ 할 일을 추가했습니다: ${match[1]}`);
});

// /list
bot.onText(/\/list/, async (msg) => {
  const userId = msg.from.id;
  const todosList = await todo.getTodos(userId) || [];
  if (!todosList.length) {
    bot.sendMessage(msg.chat.id, "📭 아직 등록된 할 일이 없습니다.");
    return;
  }
  let text = "📝 *당신의 할 일 목록:*\n";
  todosList.forEach((t, i) => {
    text += `${i + 1}. ${t.done ? "✅" : "🔲"} ${t.task}\n`;
  });
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// /done
bot.onText(/\/done (\d+)/, async (msg, match) => {
  const userId = msg.from.id;
  const index = parseInt(match[1], 10) - 1;
  const status = await todo.toggleTodo(userId, index);
  if (status === null) {
    bot.sendMessage(msg.chat.id, "😅 올바른 번호를 입력해주세요.");
    return;
  }
  bot.sendMessage(msg.chat.id, `✅ ${index + 1}번 할 일 상태를 ${status ? "완료" : "미완료"}로 변경했습니다.`);
});

// /delete
bot.onText(/\/delete (\d+)/, async (msg, match) => {
  const userId = msg.from.id;
  const index = parseInt(match[1], 10) - 1;
  const result = await todo.deleteTodo(userId, index);
  if (!result) {
    bot.sendMessage(msg.chat.id, "😅 올바른 번호를 입력해주세요.");
    return;
  }
  bot.sendMessage(msg.chat.id, `🗑️ ${index + 1}번 할 일을 삭제했습니다.`);
});

// /clear_completed
bot.onText(/\/clear_completed/, async (msg) => {
  await todo.clearCompletedTodos(msg.from.id);
  bot.sendMessage(msg.chat.id, "🧹 완료된 할 일을 모두 삭제했습니다.");
});

// /stats
bot.onText(/\/stats/, async (msg) => {
  const stats = await todo.getTodoStats(msg.from.id);
  const text = `📊 *할 일 통계*\n\n`
    + `총 할 일: ${stats.total}\n`
    + `✅ 완료: ${stats.completed}\n`
    + `🔲 미완료: ${stats.pending}\n`
    + `📈 완료율: ${stats.completionRate}%`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// 메인 메뉴
function sendMainMenu(chatId) {
  bot.sendMessage(chatId, '🏠 메인 메뉴입니다. 원하는 기능을 선택하세요 👇', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📝 할 일 관리', callback_data: 'todo_menu' }],
        [{ text: '🎲 유틸리티', callback_data: 'utils_menu' }],
        [{ text: '❓ 도움말', callback_data: 'help' }]
      ]
    }
  });
}

// callback_query
bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  bot.answerCallbackQuery(query.id);

  switch (data) {
    case 'todo_menu':
      bot.sendMessage(chatId, '📝 할 일 관리 메뉴입니다.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 할 일 목록', callback_data: 'list_todos' }],
            [{ text: '🧹 완료된 할 일 삭제', callback_data: 'clear_completed' }],
            [{ text: '📊 통계 보기', callback_data: 'stats' }],
            [{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]
          ]
        }
      });
      break;
    case 'list_todos': {
      const todosList = await todo.getTodos(userId) || [];
      if (!todosList.length) {
        bot.sendMessage(chatId, "📭 아직 등록된 할 일이 없습니다.");
        return;
      }
      let text = "📝 *당신의 할 일 목록:*\n";
      todosList.forEach((t, i) => {
        text += `${i + 1}. ${t.done ? "✅" : "🔲"} ${t.task}\n`;
      });
      bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      break;
    }
    case 'clear_completed':
      await todo.clearCompletedTodos(userId);
      bot.sendMessage(chatId, "🧹 완료된 할 일을 모두 삭제했습니다.");
      break;
    case 'stats': {
      const stats = await todo.getTodoStats(userId);
      const text = `📊 *할 일 통계*\n\n`
        + `총 할 일: ${stats.total}\n`
        + `✅ 완료: ${stats.completed}\n`
        + `🔲 미완료: ${stats.pending}\n`
        + `📈 완료율: ${stats.completionRate}%`;
      bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
      break;
    }
    case 'utils_menu':
      bot.sendMessage(chatId, '🎲 유틸리티 메뉴입니다.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗣️ 말하기 테스트', callback_data: 'say_test' }],
            [{ text: '🏠 메인 메뉴', callback_data: 'main_menu' }]
          ]
        }
      });
      break;
    case 'say_test': {
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
    }
    case 'help':
      bot.sendMessage(chatId, "❓ 도움말\n\n"
        + "/add, /list, /done, /delete, /clear_completed, /stats\n"
        + "또는 메뉴 버튼을 눌러주세요.");
      break;
    case 'main_menu':
    default:
      sendMainMenu(chatId);
      break;
  }
});
