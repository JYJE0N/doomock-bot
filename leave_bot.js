require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { MongoClient } = require('mongodb');

// 봇 초기화
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// MongoDB 연결
let client, db, collection;

async function connectDB() {
    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        db = client.db('telegram_bot');
        collection = db.collection('monthly_leaves');
        console.log('✅ MongoDB 연결됨');
    }
}

// 사용자 상태 관리
const userStates = {};

// 키보드 정의
const mainKeyboard = {
    inline_keyboard: [
        [
            { text: '📊 연차 현황', callback_data: 'leave_status' },
            { text: '📝 연차 사용', callback_data: 'leave_use' }
        ],
        [
            { text: '📋 사용 내역', callback_data: 'leave_history' },
            { text: '⚙️ 연차 설정', callback_data: 'leave_setting' }
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
            { text: '🔙 뒤로가기', callback_data: 'main_menu' }
        ]
    ]
};

// 유틸리티 함수들
function getKoreaTime() {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
}

function getCurrentYear() {
    return getKoreaTime().getFullYear();
}

// 사용자 초기화
async function initializeUser(userId) {
    await connectDB();
    
    const currentYear = getCurrentYear();
    const existingUser = await collection.findOne({ 
        userId: userId.toString(),
        year: currentYear 
    });

    if (!existingUser) {
        await collection.insertOne({
            userId: userId.toString(),
            year: currentYear,
            totalLeaves: 15,
            usedLeaves: 0,
            remainingLeaves: 15,
            leaveHistory: [],
            createdAt: getKoreaTime(),
            updatedAt: getKoreaTime()
        });
    }
}

// 사용자 연차 정보 조회
async function getUserLeaves(userId) {
    await connectDB();
    const currentYear = getCurrentYear();
    
    let user = await collection.findOne({ 
        userId: userId.toString(),
        year: currentYear 
    });

    if (!user) {
        await initializeUser(userId);
        user = await collection.findOne({ 
            userId: userId.toString(),
            year: currentYear 
        });
    }

    return user;
}

// 연차 사용
async function useLeave(userId, days, reason = '') {
    await connectDB();
    const currentYear = getCurrentYear();
    
    const user = await getUserLeaves(userId);
    
    if (user.remainingLeaves < days) {
        throw new Error(`잔여 연차가 부족합니다. (잔여: ${user.remainingLeaves}일)`);
    }

    const newUsed = user.usedLeaves + days;
    const newRemaining = user.remainingLeaves - days;
    
    const leaveRecord = {
        date: getKoreaTime(),
        days: days,
        reason: reason,
        type: days === 0.5 ? '반차' : '연차'
    };

    await collection.updateOne(
        { userId: userId.toString(), year: currentYear },
        { 
            $set: { 
                usedLeaves: newUsed,
                remainingLeaves: newRemaining,
                updatedAt: getKoreaTime()
            },
            $push: { leaveHistory: leaveRecord }
        }
    );

    return { usedLeaves: newUsed, remainingLeaves: newRemaining, leaveRecord };
}

// 총 연차 설정
async function setTotalLeaves(userId, totalLeaves) {
    await connectDB();
    const currentYear = getCurrentYear();
    
    await initializeUser(userId);
    
    const user = await getUserLeaves(userId);
    const newRemaining = totalLeaves - user.usedLeaves;
    
    await collection.updateOne(
        { userId: userId.toString(), year: currentYear },
        { 
            $set: { 
                totalLeaves: totalLeaves,
                remainingLeaves: newRemaining,
                updatedAt: getKoreaTime()
            }
        }
    );
    
    return { totalLeaves, remainingLeaves: newRemaining };
}

// 포맷팅 함수들
function formatLeaveStatus(user) {
    const percentage = ((user.usedLeaves / user.totalLeaves) * 100).toFixed(1);
    
    return `📅 *${user.year}년 연차 현황*\n\n` +
           `🏖️ 총 연차: ${user.totalLeaves}일\n` +
           `✅ 사용한 연차: ${user.usedLeaves}일\n` +
           `⏳ 남은 연차: ${user.remainingLeaves}일\n` +
           `📊 사용률: ${percentage}%\n\n` +
           `${user.remainingLeaves <= 3 ? '⚠️ 연차가 얼마 남지 않았습니다!' : '✨ 연차를 효율적으로 관리하세요!'}`;
}

function formatLeaveHistory(history) {
    if (!history || history.length === 0) {
        return '📋 연차 사용 내역이 없습니다.';
    }

    let result = '📋 *연차 사용 내역*\n\n';
    
    history.slice(-10).reverse().forEach((record, index) => {
        const date = new Date(record.date).toLocaleDateString('ko-KR');
        const type = record.type || (record.days === 0.5 ? '반차' : '연차');
        const reason = record.reason ? ` (${record.reason})` : '';
        
        result += `${index + 1}. ${date} - ${type} ${record.days}일${reason}\n`;
    });

    return result;
}

// 봇 시작
console.log('🤖 월차 관리 봇 시작됨...');

// 명령어 처리
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const user = await getUserLeaves(userId);
        const statusText = formatLeaveStatus(user);
        
        await bot.sendMessage(chatId, `🤖 *월차 관리 봇에 오신걸 환영합니다!*\n\n${statusText}`, {
            parse_mode: 'Markdown',
            reply_markup: mainKeyboard
        });
    } catch (error) {
        console.error('Start command error:', error);
        bot.sendMessage(chatId, '❌ 봇 시작 중 오류가 발생했습니다.');
    }
});

bot.onText(/\/leave/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const user = await getUserLeaves(userId);
        const statusText = formatLeaveStatus(user);
        
        await bot.sendMessage(chatId, statusText, {
            parse_mode: 'Markdown',
            reply_markup: mainKeyboard
        });
    } catch (error) {
        console.error('Leave command error:', error);
        bot.sendMessage(chatId, '❌ 연차 정보를 불러오는 중 오류가 발생했습니다.');
    }
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `🤖 *월차 관리 봇 도움말*\n\n` +
                    `📅 *명령어*\n` +
                    `/start - 봇 시작 및 연차 현황\n` +
                    `/leave - 연차 현황 보기\n` +
                    `/help - 도움말\n\n` +
                    `💡 *기능*\n` +
                    `• 연차 현황 조회\n` +
                    `• 연차/반차 사용 기록\n` +
                    `• 사용 내역 확인\n` +
                    `• 총 연차 설정`;
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
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
                const user = await getUserLeaves(userId);
                const statusText = formatLeaveStatus(user);
                
                await bot.editMessageText(statusText, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: mainKeyboard
                });
                break;

            case 'leave_status':
                const statusUser = await getUserLeaves(userId);
                const status = formatLeaveStatus(statusUser);
                
                await bot.editMessageText(status, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: mainKeyboard
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
                const historyUser = await getUserLeaves(userId);
                const historyText = formatLeaveHistory(historyUser.leaveHistory);
                
                await bot.editMessageText(historyText, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 뒤로가기', callback_data: 'main_menu' }]]
                    }
                });
                break;

            case 'leave_setting':
                await bot.editMessageText('⚙️ *연차 설정*\n\n총 연차 일수를 입력하세요.\n예: 15, 20, 25', {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 뒤로가기', callback_data: 'main_menu' }]]
                    }
                });
                
                userStates[userId] = { 
                    state: 'waiting_leave_setting',
                    messageId: message.message_id,
                    chatId: chatId
                };
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
                const result = await setTotalLeaves(userId, totalLeaves);
                
                const settingText = `✅ *연차 설정 완료*\n\n` +
                                   `📅 총 연차: ${result.totalLeaves}일\n` +
                                   `⏳ 남은 연차: ${result.remainingLeaves}일\n\n` +
                                   `연차 설정이 업데이트되었습니다!`;
                
                await bot.editMessageText(settingText, {
                    chat_id: chatId,
                    message_id: state.messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]]
                    }
                });
            } catch (error) {
                console.error('Leave setting error:', error);
                bot.sendMessage(chatId, '❌ 연차 설정 중 오류가 발생했습니다.');
            }
            
            delete userStates[userId];
        }
    }
});

// 연차 사용 처리 함수
async function processLeaveUsage(chatId, userId, messageId, days) {
    try {
        const result = await useLeave(userId, days);
        
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
                inline_keyboard: [[{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]]
            }
        });
    } catch (error) {
        console.error('Leave usage error:', error);
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

// DB 연결 시작
connectDB().catch(console.error);
