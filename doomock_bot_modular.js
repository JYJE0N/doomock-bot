require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("BOT_TOKEN:", process.env.BOT_TOKEN);

bot.on("polling_error", (err) => console.error("polling error:", JSON.stringify(err, null, 2)));

console.log('🤖 두목봇 시작됨...');

// 모듈 불러오기
const fortune = require('./fortune');
const timer = require('./timer');
const todo = require('./todo');
const utils = require('./utils');
const worktime = require('./worktime');
const MonthlyLeave = require('./monthly_leave'); // 이 줄 추가

// 연차 관리 인스턴스 생성
const leaveManager = new MonthlyLeave(); // 이 줄 추가

// 메인 메뉴 키보드
const mainMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '📝 할일 관리', callback_data: 'todo_menu' },
            { text: '📅 휴가 관리', callback_data: 'leave_menu' }
        ],
        [
            { text: '⏰ 타이머', callback_data: 'timer_menu' },
            { text: '🎯 온세', callback_data: 'fortune_menu' }
        ],
        [
            { text: '🕐 근무시간', callback_data: 'worktime_menu' },
            { text: '🔔 리마인더', callback_data: 'reminder_menu' }
        ],
        [
            { text: '❓ 도움말', callback_data: 'help_menu' }
        ]
    ]
};

// 휴가 관리 메뉴
const leaveMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '📊 연차 현황', callback_data: 'leave_status' },
            { text: '📋 사용 내역', callback_data: 'leave_history' }
        ],
        [
            { text: '🏖️ 연차 사용', callback_data: 'use_leave' },
            { text: '⚙️ 연차 설정', callback_data: 'set_leave' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};

// 메인 메시지 핸들러
bot.on('message', (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;

    switch (true) {
        case text === '/start':
            bot.sendMessage(chatId, '🤖 두목봇 메인 메뉴\n\n원하는 기능을 선택해주세요:', {
                reply_markup: mainMenuKeyboard
            });
            break;
        case text === '/help':
            utils(bot, msg);
            break;
        case text === '/worktime':
            worktime(bot, msg);
            break;
        case text === '/fortune':
            fortune(bot, msg);
            break;
        case text.startsWith('/add '):
            todo(bot, msg);
            break;
        default:
            bot.sendMessage(chatId, '😅 알 수 없는 명령어입니다. /start 를 입력해서 메뉴를 확인하세요.');
    }
});

// 콜백 쿼리 핸들러 (이 전체 부분이 새로 추가됨)
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;

    // 콜백 쿼리 응답 (로딩 표시 제거)
    bot.answerCallbackQuery(callbackQuery.id);

    try {
        switch (data) {
            case 'main_menu':
                bot.editMessageText('🤖 두목봇 메인 메뉴\n\n원하는 기능을 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: mainMenuKeyboard
                });
                break;

            case 'leave_menu':
                bot.editMessageText('📅 휴가 관리 메뉴\n\n원하는 기능을 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    reply_markup: leaveMenuKeyboard
                });
                break;

            case 'leave_status':
                const user = await leaveManager.getUserLeaves(userId);
                const status = leaveManager.formatLeaveStatus(user);
                bot.sendMessage(chatId, status, { 
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]] }
                });
                break;

            case 'leave_history':
                const history = await leaveManager.getLeaveHistory(userId);
                const historyText = leaveManager.formatLeaveHistory(history);
                bot.sendMessage(chatId, historyText, { 
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: '🔙 휴가 메뉴', callback_data: 'leave_menu' }]] }
                });
                break;

            case 'use_leave':
                bot.sendMessage(chatId, '🏖️ 연차 사용하기\n\n사용할 연차 일수를 입력해주세요.\n예: 1 (하루), 0.5 (반차)\n\n취소하려면 /cancel 을 입력하세요.');
                // 여기서 사용자 입력을 받는 상태 관리가 필요 (추후 구현)
                break;

            case 'set_leave':
                bot.sendMessage(chatId, '⚙️ 연차 설정하기\n\n총 연차 일수를 입력해주세요.\n예: 15\n\n취소하려면 /cancel 을 입력하세요.');
                // 여기서 사용자 입력을 받는 상태 관리가 필요 (추후 구현)
                break;

            case 'help_menu':
                utils(bot, { chat: { id: chatId } });
                break;

            case 'todo_menu':
                bot.sendMessage(chatId, '📝 할일 관리\n\n할일을 추가하려면:\n/add 할일내용\n\n예: /add 회의 준비하기');
                break;

            case 'timer_menu':
                bot.sendMessage(chatId, '⏰ 타이머 기능\n\n타이머를 사용하려면:\n/timer 분\n\n예: /timer 25');
                break;

            case 'fortune_menu':
                fortune(bot, { chat: { id: chatId } });
                break;

            case 'worktime_menu':
                worktime(bot, { chat: { id: chatId } });
                break;

            case 'reminder_menu':
                bot.sendMessage(chatId, '🔔 리마인더 기능은 곧 추가될 예정입니다.');
                break;

            default:
                bot.sendMessage(chatId, '❌ 알 수 없는 명령입니다.');
        }
    } catch (error) {
        console.error('콜백 처리 오류:', error);
        bot.sendMessage(chatId, '❌ 연차 정보를 불러오는 중 오류가 발생했습니다.');
    }
});

// 프로세스 종료 시 정리
process.on('SIGINT', async () => {
    console.log('봇 종료 중...');
    await leaveManager.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('봇 종료 중...');
    await leaveManager.close();
    process.exit(0);
});
