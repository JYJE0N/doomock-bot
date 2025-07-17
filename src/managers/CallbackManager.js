// src/managers/CallbackManager.js - 수정된 버전

const Logger = require('../utils/Logger');

class CallbackManager {
    constructor(bot, modules) {
        this.bot = bot;
        this.modules = modules;
        
        Logger.info('CallbackManager 초기화됨');
    }
    
    async handleCallback(callbackQuery) {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        
        Logger.info(`📞 콜백 처리: ${data}`);
        
        try {
            // 콜백 응답
            await this.bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            Logger.error('콜백 응답 실패:', error);
        }
        
        try {
            // 콜백 데이터 파싱
            const parts = data.split('_');
            const moduleType = parts[0];
            const action = parts[1];
            const params = parts.slice(2);
            
            Logger.debug(`모듈: ${moduleType}, 액션: ${action}, 파라미터: ${params}`);
            
            // 시스템 콜백 처리
            if (await this.handleSystemCallback(callbackQuery, data)) {
                return;
            }
            
            // 모듈별 콜백 처리
            await this.handleModuleCallback(callbackQuery, moduleType, action, params);
            
        } catch (error) {
            Logger.error('콜백 처리 오류:', error);
            await this.sendErrorMessage(chatId);
        }
    }
    
    async handleSystemCallback(callbackQuery, data) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        switch (data) {
            case 'main_menu':
                await this.showMainMenu(callbackQuery);
                return true;
            case 'help_menu':
                await this.showHelpMenu(callbackQuery);
                return true;
            case 'cancel_action':
                await this.handleCancel(callbackQuery);
                return true;
            case 'noop':
                // 아무것도 하지 않음
                return true;
            default:
                return false;
        }
    }
    
    async handleModuleCallback(callbackQuery, moduleType, action, params) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        // 모듈 찾기
        const moduleInstance = this.modules[moduleType];
        
        if (!moduleInstance) {
            Logger.error(`모듈을 찾을 수 없음: ${moduleType}`);
            await this.sendErrorMessage(chatId);
            return;
        }
        
        // 모듈에 handleCallback 메서드가 있는지 확인
        if (typeof moduleInstance.handleCallback === 'function') {
            try {
                await moduleInstance.handleCallback(this.bot, callbackQuery, action, params);
            } catch (error) {
                Logger.error(`모듈 ${moduleType} 콜백 처리 실패:`, error);
                await this.sendErrorMessage(chatId);
            }
        } else {
            Logger.error(`모듈 ${moduleType}에 handleCallback 메서드가 없습니다`);
            await this.sendErrorMessage(chatId);
        }
    }
    
    async showMainMenu(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userName = callbackQuery.from.first_name || '사용자';
        
        const welcomeText = this.getMainMenuText(userName);
        const keyboard = this.createMainMenuKeyboard();
        
        try {
            await this.bot.editMessageText(welcomeText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } catch (error) {
            Logger.error('메인 메뉴 표시 실패:', error);
            await this.sendErrorMessage(chatId);
        }
    }
    
    async showHelpMenu(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        const helpText = `❓ **두목봇 도움말**\n\n` +
                        `🤖 **주요 기능:**\n` +
                        `• 📝 할일 관리 - 할일 추가/완료/삭제\n` +
                        `• 📅 휴가 관리 - 연차 사용/관리\n` +
                        `• 🔮 운세 - 다양한 운세 정보\n` +
                        `• ⏰ 타이머 - 작업 시간 관리\n` +
                        `• 🔔 리마인더 - 알림 설정\n` +
                        `• 🌤️ 날씨 - 날씨 정보\n` +
                        `• 📊 인사이트 - 마케팅 인사이트\n` +
                        `• 🛠️ 유틸리티 - TTS 등\n\n` +
                        `🎯 **빠른 명령어:**\n` +
                        `• /start - 메인 메뉴\n` +
                        `• /help - 도움말\n\n` +
                        `🚀 **Railway 클라우드에서 24/7 운영 중!**`;
        
        try {
            await this.bot.editMessageText(helpText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
                    ]
                }
            });
        } catch (error) {
            Logger.error('도움말 메뉴 표시 실패:', error);
            await this.sendErrorMessage(chatId);
        }
    }
    
    async handleCancel(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const userName = callbackQuery.from.first_name || '사용자';
        
        await this.bot.sendMessage(chatId, 
            `❌ ${userName}님, 작업이 취소되었습니다.`,
            { 
                reply_markup: { 
                    inline_keyboard: [[
                        { text: "🔙 메인 메뉴", callback_data: "main_menu" }
                    ]] 
                } 
            }
        );
    }
    
    getMainMenuText(userName) {
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        const hour = koreaTime.getHours();
        
        let greeting = '안녕하세요';
        if (hour >= 5 && hour < 12) {
            greeting = '좋은 아침이에요';
        } else if (hour >= 12 && hour < 18) {
            greeting = '좋은 오후에요';
        } else if (hour >= 18 && hour < 22) {
            greeting = '좋은 저녁이에요';
        } else {
            greeting = '늦은 시간이네요';
        }
        
        return `🤖 **두목봇 메인 메뉴**\n\n` +
               `${greeting} ${userName}님! 👋\n\n` +
               `🏡 **동탄/화성 지역 특화 서비스**\n` +
               `• 화성 날씨 정보 우선 제공\n` +
               `• 동탄 근무시간 기반 기능\n\n` +
               `원하는 기능을 선택해주세요:`;
    }
    
    createMainMenuKeyboard() {
        const keyboard = [];
        
        // 활성화된 모듈에 따라 메뉴 구성
        const firstRow = [];
        if (this.modules.todo) firstRow.push({ text: '📝 할일 관리', callback_data: 'todo_menu' });
        if (this.modules.leave) firstRow.push({ text: '📅 휴가 관리', callback_data: 'leave_menu' });
        if (firstRow.length > 0) keyboard.push(firstRow);
        
        const secondRow = [];
        if (this.modules.timer) secondRow.push({ text: '⏰ 타이머', callback_data: 'timer_menu' });
        if (this.modules.fortune) secondRow.push({ text: '🔮 운세', callback_data: 'fortune_menu' });
        if (secondRow.length > 0) keyboard.push(secondRow);
        
        const thirdRow = [];
        if (this.modules.worktime) thirdRow.push({ text: '🕐 근무시간', callback_data: 'worktime_menu' });
        if (this.modules.weather) thirdRow.push({ text: '🌤️ 날씨', callback_data: 'weather_menu' });
        if (thirdRow.length > 0) keyboard.push(thirdRow);
        
        const fourthRow = [];
        if (this.modules.insight) fourthRow.push({ text: '📊 인사이트', callback_data: 'insight_menu' });
        if (this.modules.reminder) fourthRow.push({ text: '🔔 리마인더', callback_data: 'reminder_menu' });
        if (fourthRow.length > 0) keyboard.push(fourthRow);
        
        const lastRow = [];
        if (this.modules.utils) lastRow.push({ text: '🛠️ 유틸리티', callback_data: 'utils_menu' });
        lastRow.push({ text: '❓ 도움말', callback_data: 'help_menu' });
        keyboard.push(lastRow);
        
        return { inline_keyboard: keyboard };
    }
    
    async sendErrorMessage(chatId) {
        try {
            await this.bot.sendMessage(chatId, "❌ 처리 중 오류가 발생했습니다.", {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                    ]]
                }
            });
        } catch (error) {
            Logger.error('오류 메시지 전송 실패:', error);
        }
    }
}

module.exports = CallbackManager;