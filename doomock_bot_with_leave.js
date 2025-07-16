require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const MonthlyLeaveManager = require('./monthly_leave');

// 봇 초기화
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 월차 매니저 초기화
const leaveManager = new MonthlyLeaveManager();

// 사용자 상태 관리
const userStates = {};

// 키보드 정의
const mainKeyboard = {
    inline_keyboard: [
        [
            { text: '📅 연차 관리', callback_data: 'leave_menu' },
            { text: '📝 할일 관리', callback_data: 'todo_menu' }
        ],
        [
            { text: '⏰ 타이머', callback_data: 'timer_menu' },
            { text: '🎯 운세', callback_data: 'fortune_menu' }
        ]
    ]
};

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

// 봇 시작
console.log('🤖 두목봇 시작됨...');

// 메인 명령어들
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeText = `🤖 *두목봇에 오신걸 환영합니다!*\n\n` +
                       `원하는 기능을 선택하세요:`;
    
    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: mainKeyboard
    });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `🤖 *두목봇 도움말*\n\n` +
                    `📅 *연차 관리*\n` +
                    `/leave - 연차 현황 및 관리\n\n` +
                    `🔧 *기본 명령어*\n` +
                    `/start - 봇 시작\n` +
                    `/help - 도움말`;
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// 연차 명령어
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
        console.error('Leave command error:', error);
        bot.sendMessage(chatId, '❌ 연차 정보를 불러오는 중 오류가 발생했습니다.');
    }
});

// 콜백 쿼리 처리
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    try {
        switch (data) {
            case 'main_menu':
                await bot.editMessageText('🤖 *두목봇 메인 메뉴*\n\n원하는 기능을 선택하세요:', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: mainKeyboard
                });
                break;

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
                const history = await leaveManager.getLeaveHistory(userId);
                const historyText = leaveManager.formatLeaveHistory(history);
                
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

            default:
                // 다른 기능들은 아직 구현 안됨
                await bot.editMessageText('🚧 *준비 중인 기능입니다*\n\n곧 업데이트될 예정입니다!', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]]
                    }
                });
                break;
        }
    } catch (error) {
        console.error('Callback error:', error);
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

    // 연차 관련 입력 처리
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
                bot.sendMessage(chatId, '❌ 연차 설정 중 오류가 발생했습니다.');
            }
            
            delete userStates[userId];
        }
    }
});

// 연차 사용 처리 함수
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
    } catch (error) {
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
    console.error('Polling error:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
