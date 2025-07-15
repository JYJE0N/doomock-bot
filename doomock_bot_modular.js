require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const utils = require('./utils');
const MonthlyLeaveManager = require('./monthly_leave');

// 기존 모듈들 (필요한 것들만 주석 해제해서 사용)
// const TodoManager = require('./todo');
// const TimerManager = require('./timer');
// const FortuneManager = require('./fortune');
// const WorktimeManager = require('./worktime');
// const RemindManager = require('./remind');

// 봇 초기화
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 모듈 매니저들 초기화
const leaveManager = new MonthlyLeaveManager();
// const todoManager = new TodoManager();
// const timerManager = new TimerManager();
// const fortuneManager = new FortuneManager();

// 사용자 상태 관리
const userStates = {};

// 키보드 정의
const mainKeyboard = {
    inline_keyboard: [
        [
            { text: '📝 할일 관리', callback_data: 'todo_menu' },
            { text: '📅 월차 관리', callback_data: 'leave_menu' }
        ],
        [
            { text: '⏰ 타이머', callback_data: 'timer_menu' },
            { text: '🎯 운세', callback_data: 'fortune_menu' }
        ],
        [
            { text: '⏱️ 근무시간', callback_data: 'worktime_menu' },
            { text: '🔔 리마인더', callback_data: 'remind_menu' }
        ],
        [
            { text: '❓ 도움말', callback_data: 'help_menu' }
        ]
    ]
};

// 월차 관련 키보드들
const leaveKeyboard = {
    inline_keyboard: [
        [
            { text: '📊 연차 현황', callback_data: 'leave_status' },
            { text: '📝 연차 사용', callback_data: 'leave_use' }
        ],
        [
            { text: '📋 사용 내역', callback_data: 'leave_history' },
            { text: '⚙️ 연차 설정', callback_data: 'leave_setting' }
        ],
        [
            { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
        ]
    ]
};

const useLeaveKeyboard = {
    inline_keyboard: [
        [
            { text: '🏖️ 연차 1일', callback_data: 'use_leave_1' },
            { text: '🌅 반차 0.5일', callback_data: 'use_leave_0.5' }
        ],
        [
            { text: '✏️ 직접 입력', callback_data: 'use_leave_custom' },
            { text: '🔙 뒤로가기', callback_data: 'leave_menu' }
        ]
    ]
};

// 기타 키보드들 (준비 중)
const comingSoonKeyboard = {
    inline_keyboard: [
        [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
    ]
};

// 봇 시작
console.log('🤖 두목봇 시작됨...');
utils.logSuccess('두목봇이 시작되었습니다', 'BOT');

// 메인 명령어들
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || '사용자';
    
    const welcomeText = `🤖 *안녕하세요 ${userName}님!*\n\n` +
                       `두목봇에 오신걸 환영합니다!\n` +
                       `원하는 기능을 선택해주세요:`;
    
    try {
        await bot.sendMessage(chatId, welcomeText, {
            parse_mode: 'Markdown',
            reply_markup: mainKeyboard
        });
    } catch (error) {
        utils.logError(error, 'START_COMMAND');
    }
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `🤖 *두목봇 도움말*\n\n` +
                    `📅 *월차 관리*\n` +
                    `/leave - 연차 현황 및 관리\n\n` +
                    `📝 *할일 관리*\n` +
                    `/todo - 할일 목록 관리\n\n` +
                    `⏰ *타이머*\n` +
                    `/timer - 타이머 시작\n\n` +
                    `🎯 *운세*\n` +
                    `/fortune - 오늘의 운세\n\n` +
                    `🔧 *기본 명령어*\n` +
                    `/start - 봇 시작\n` +
                    `/help - 도움말`;
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// 월차 명령어
bot.onText(/\/leave/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const user = await leaveManager.getUserLeaves(userId);
        const statusText = leaveManager.formatLeaveStatus(user);
        
        await bot.sendMessage(chatId, statusText, {
            parse_mode: 'Markdown',
            reply_markup: leaveKeyboard
        });
    } catch (error) {
        utils.logError(error, 'LEAVE_COMMAND');
        bot.sendMessage(chatId, '❌ 연차 정보를 불러오는 중 오류가 발생했습니다.');
    }
});

// 기타 명령어들 (준비 중)
bot.onText(/\/todo/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🚧 할일 관리 기능 준비 중입니다!');
});

bot.onText(/\/timer/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🚧 타이머 기능 준비 중입니다!');
});

bot.onText(/\/fortune/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🚧 운세 기능 준비 중입니다!');
});

// 콜백 쿼리 처리
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    try {
        switch (data) {
            // 메인 메뉴
            case 'main_menu':
                await bot.editMessageText('🤖 *두목봇 메인 메뉴*\n\n원하는 기능을 선택해주세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: mainKeyboard
                });
                break;

            case 'help_menu':
                const helpText = `🤖 *두목봇 도움말*\n\n` +
                               `📅 월차 관리 - 연차 현황 및 사용 관리\n` +
                               `📝 할일 관리 - 할일 목록 작성 및 관리\n` +
                               `⏰ 타이머 - 포모도로 타이머\n` +
                               `🎯 운세 - 오늘의 운세 확인\n` +
                               `⏱️ 근무시간 - 출퇴근 시간 기록\n` +
                               `🔔 리마인더 - 중요한 일정 알림`;
                
                await bot.editMessageText(helpText, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]]
                    }
                });
                break;

            // === 월차 관리 === //
            case 'leave_menu':
                const user = await leaveManager.getUserLeaves(userId);
                const statusText = leaveManager.formatLeaveStatus(user);
                
                await bot.editMessageText(statusText, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: leaveKeyboard
                });
                break;

            case 'leave_status':
                const statusUser = await leaveManager.getUserLeaves(userId);
                const status = leaveManager.formatLeaveStatus(statusUser);
                
                await bot.editMessageText(status, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: leaveKeyboard
                });
                break;

            case 'leave_use':
                await bot.editMessageText('🏖️ *연차 사용하기*\n\n사용할 연차를 선택하세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: useLeaveKeyboard
                });
                break;

            case 'use_leave_1':
                await processLeaveUsage(chatId, userId, message.message_id, 1);
                break;

            case 'use_leave_0.5':
                await processLeaveUsage(chatId, userId, message.message_id, 0.5);
                break;

            case 'use_leave_custom':
                await bot.editMessageText('📝 *직접 입력*\n\n사용할 연차 일수를 입력하세요.\n예: 1, 0.5, 2.5', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 뒤로가기', callback_data: 'leave_use' }]]
                    }
                });
                
                userStates[userId] = { 
                    state: 'waiting_leave_input',
                    messageId: message.message_id,
                    chatId: chatId
                };
                break;

            case 'leave_history':
                const historyUser = await leaveManager.getUserLeaves(userId);
                const historyText = leaveManager.formatLeaveHistory(historyUser.leaveHistory || []);
                
                await bot.editMessageText(historyText, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 뒤로가기', callback_data: 'leave_menu' }]]
                    }
                });
                break;

            case 'leave_setting':
                await bot.editMessageText('⚙️ *연차 설정*\n\n총 연차 일수를 입력하세요.\n예: 15, 20, 25', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 뒤로가기', callback_data: 'leave_menu' }]]
                    }
                });
                
                userStates[userId] = { 
                    state: 'waiting_leave_setting',
                    messageId: message.message_id,
                    chatId: chatId
                };
                break;

            // === 기타 메뉴들 (준비 중) === //
            case 'todo_menu':
            case 'timer_menu':
            case 'fortune_menu':
            case 'worktime_menu':
            case 'remind_menu':
                await bot.editMessageText('🚧 *준비 중인 기능입니다*\n\n곧 업데이트될 예정입니다!', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: comingSoonKeyboard
                });
                break;

            default:
                await bot.editMessageText('❓ *알 수 없는 명령입니다*\n\n메인 메뉴로 돌아가겠습니다.', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: mainKeyboard
                });
                break;
        }
    } catch (error) {
        utils.logError(error, 'CALLBACK_QUERY');
        bot.sendMessage(chatId, '❌ 처리 중 오류가 발생했습니다.');
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

// 텍스트 메시지 처리
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // 명령어는 이미 처리됨
    if (text && text.startsWith('/')) {
        return;
    }

    // 월차 관련 입력 처리
    if (userStates[userId]) {
        const state = userStates[userId];
        
        if (state.state === 'waiting_leave_input') {
            const days = parseFloat(text);
            
            if (isNaN(days) || days <= 0) {
                bot.sendMessage(chatId, '❌ 올바른 숫자를 입력하세요. (예: 1, 0.5, 2.5)');
                return;
            }
            
            await processLeaveUsage(chatId, userId, state.messageId, days);
            delete userStates[userId];
            
        } else if (state.state === 'waiting_leave_setting') {
            const totalLeaves = parseInt(text);
            
            if (isNaN(totalLeaves) || totalLeaves <= 0) {
                bot.sendMessage(chatId, '❌ 올바른 숫자를 입력하세요. (예: 15, 20, 25)');
                return;
            }
            
            try {
                const result = await leaveManager.setTotalLeaves(userId, totalLeaves);
                
                const settingText = `✅ *연차 설정 완료*\n\n` +
                                   `📅 총 연차: ${result.totalLeaves}일\n` +
                                   `⏳ 남은 연차: ${result.remainingLeaves}일\n\n` +
                                   `연차 설정이 업데이트되었습니다!`;
                
                await bot.editMessageText(settingText, {
                    chat_id: chatId,
                    message_id: state.messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 연차 메뉴', callback_data: 'leave_menu' }]]
                    }
                });
            } catch (error) {
                utils.logError(error, 'LEAVE_SETTING');
                bot.sendMessage(chatId, '❌ 연차 설정 중 오류가 발생했습니다.');
            }
            
            delete userStates[userId];
        }
        
        return; // 상태 처리 중이면 다른 처리 방지
    }

    // 일반 텍스트 메시지에 대한 응답
    if (text && !text.startsWith('/')) {
        // 간단한 인사나 질문에 대한 응답
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('안녕') || lowerText.includes('hi') || lowerText.includes('hello')) {
            bot.sendMessage(chatId, '안녕하세요! 👋\n두목봇입니다. /start 명령어로 메뉴를 확인해보세요!');
        } else if (lowerText.includes('도움') || lowerText.includes('help')) {
            bot.sendMessage(chatId, '도움이 필요하시군요! /help 명령어로 도움말을 확인해보세요! 📚');
        } else {
            // 기본 응답
            bot.sendMessage(chatId, '💡 명령어를 사용해주세요!\n/start - 메뉴 보기\n/help - 도움말');
        }
    }
});

// 월차 사용 처리 함수
async function processLeaveUsage(chatId, userId, messageId, days) {
    try {
        const result = await leaveManager.useLeave(userId, days);
        
        const successText = `✅ *연차 사용 완료*\n\n` +
                           `📅 사용한 연차: ${days}일\n` +
                           `✅ 총 사용: ${result.usedLeaves}일\n` +
                           `⏳ 남은 연차: ${result.remainingLeaves}일\n\n` +
                           `${result.remainingLeaves <= 3 ? '⚠️ 연차가 얼마 남지 않았습니다!' : '✨ 연차 사용이 기록되었습니다!'}`;
        
        await bot.editMessageText(successText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 연차 메뉴', callback_data: 'leave_menu' }]]
            }
        });
        
        utils.logSuccess(`사용자 ${userId}가 ${days}일 연차를 사용했습니다`, 'LEAVE_USAGE');
    } catch (error) {
        utils.logError(error, 'LEAVE_USAGE');
        await bot.editMessageText(`❌ ${error.message}`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 뒤로가기', callback_data: 'leave_use' }]]
            }
        });
    }
}

// 에러 처리
bot.on('polling_error', (error) => {
    utils.logError(error, 'POLLING');
});

process.on('uncaughtException', (error) => {
    utils.logError(error, 'UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    utils.logError(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'UNHANDLED_REJECTION');
});

// 정상 종료 처리
process.on('SIGINT', () => {
    console.log('\n🛑 두목봇을 종료합니다...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 두목봇을 종료합니다...');
    process.exit(0);
});
