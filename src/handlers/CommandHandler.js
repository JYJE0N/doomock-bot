// src/handlers/CommandHandler.js - 새로 생성

const { getUserName } = require('../utils/UserHelper');
const Logger = require('../utils/Logger');

class CommandHandler {
    constructor(bot, options) {
        this.bot = bot;
        this.moduleManager = options.moduleManager;
        this.menuManager = options.menuManager;
        this.userStates = options.userStates;
        
        Logger.info('CommandHandler 초기화됨');
    }
    
    async handleCommand(msg) {
        const text = msg.text;
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userName = getUserName(msg.from);
        
        // 명령어 파싱
        const parts = text.split(' ');
        const command = parts[0].substring(1); // '/' 제거
        const args = parts.slice(1);
        
        Logger.userAction(userId, 'command', { command, args });
        
        try {
            // 시스템 명령어 처리
            if (await this.handleSystemCommand(msg, command, args)) {
                return true;
            }
            
            // 모듈 명령어 처리
            const result = await this.moduleManager.handleCommand(this.bot, msg);
            
            if (!result) {
                await this.handleUnknownCommand(msg, command);
            }
            
            return result;
            
        } catch (error) {
            Logger.error(`명령어 처리 실패 [${command}]:`, error);
            await this.sendErrorMessage(chatId, error);
            return false;
        }
    }
    
    async handleSystemCommand(msg, command, args) {
        const chatId = msg.chat.id;
        const userName = getUserName(msg.from);
        
        switch (command) {
            case 'start':
                await this.handleStartCommand(msg);
                return true;
                
            case 'help':
                await this.handleHelpCommand(msg);
                return true;
                
            case 'status':
                await this.handleStatusCommand(msg);
                return true;
                
            case 'cancel':
                await this.handleCancelCommand(msg);
                return true;
                
            default:
                return false;
        }
    }
    
    async handleStartCommand(msg) {
        const chatId = msg.chat.id;
        const userName = getUserName(msg.from);
        
        try {
            const welcomeMessage = this.getWelcomeMessage(userName);
            const keyboard = await this.menuManager.getMainMenuKeyboard();
            
            await this.bot.sendMessage(chatId, welcomeMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            Logger.error('시작 명령어 처리 실패:', error);
            await this.bot.sendMessage(chatId, '❌ 메뉴를 불러올 수 없습니다.');
        }
    }
    
    async handleHelpCommand(msg) {
        const chatId = msg.chat.id;
        const userName = getUserName(msg.from);
        
        try {
            const helpMessage = this.getHelpMessage(userName);
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
                ]
            };
            
            await this.bot.sendMessage(chatId, helpMessage, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            Logger.error('도움말 명령어 처리 실패:', error);
            await this.bot.sendMessage(chatId, '❌ 도움말을 불러올 수 없습니다.');
        }
    }
    
    async handleStatusCommand(msg) {
        const chatId = msg.chat.id;
        
        try {
            const status = this.moduleManager.getModuleStatus();
            const statusMessage = this.formatStatusMessage(status);
            
            await this.bot.sendMessage(chatId, statusMessage, {
                parse_mode: 'Markdown'
            });
            
        } catch (error) {
            Logger.error('상태 명령어 처리 실패:', error);
            await this.bot.sendMessage(chatId, '❌ 상태 정보를 불러올 수 없습니다.');
        }
    }
    
    async handleCancelCommand(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userName = getUserName(msg.from);
        
        // 사용자 상태 초기화
        this.userStates.delete(userId);
        
        await this.bot.sendMessage(chatId, 
            `❌ ${userName}님, 작업이 취소되었습니다.`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                    ]]
                }
            }
        );
    }
    
    async handleUnknownCommand(msg, command) {
        const chatId = msg.chat.id;
        const userName = getUserName(msg.from);
        
        const message = `❓ 알 수 없는 명령어입니다: /${command}\n\n` +
                       `${userName}님, 아래 메뉴를 사용해주세요:`;
        
        await this.bot.sendMessage(chatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔙 메인 메뉴', callback_data: 'main_menu' },
                        { text: '❓ 도움말', callback_data: 'help' }
                    ]
                ]
            }
        });
    }
    
    getWelcomeMessage(userName) {
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
        
        return `🤖 **두목봇에 오신걸 환영합니다!**\n\n` +
               `${greeting} ${userName}님! 👋\n\n` +
               `두목봇은 직장인을 위한 종합 생산성 도구입니다.\n\n` +
               `🏡 **동탄/화성 지역 특화 서비스**\n` +
               `• 화성 날씨 정보 우선 제공\n` +
               `• 동탄 근무시간 기반 기능\n\n` +
               `아래 메뉴에서 원하는 기능을 선택해주세요:`;
    }
    
    getHelpMessage(userName) {
        return `❓ **두목봇 도움말**\n\n` +
               `🤖 **주요 기능:**\n` +
               `• 📝 할일 관리 - 할일 추가/완료/삭제\n` +
               `• 📅 휴가 관리 - 연차 사용/관리\n` +
               `• 🔮 운세 - 다양한 운세 정보\n` +
               `• ⏰ 타이머 - 작업 시간 관리\n` +
               `• 🔔 리마인더 - 알림 설정\n` +
               `• 🌤️ 날씨 - 날씨 정보\n` +
               `• 📊 인사이트 - 마케팅 인사이트\n` +
               `• 🛠️ 유틸리티 - TTS 등\n` +
               `• 🕐 근무시간 - 근무 시간 관리\n\n` +
               `🎯 **빠른 명령어:**\n` +
               `• /start - 메인 메뉴\n` +
               `• /help - 도움말\n` +
               `• /status - 봇 상태\n` +
               `• /cancel - 작업 취소\n` +
               `• /add [할일] - 할일 빠른 추가\n\n` +
               `🚀 **Railway 클라우드에서 24/7 운영 중!**`;
    }
    
    formatStatusMessage(status) {
        let message = `📊 **모듈 상태**\n\n`;
        
        const moduleCount = {
            total: 0,
            initialized: 0,
            error: 0
        };
        
        for (const [moduleName, moduleData] of Object.entries(status)) {
            moduleCount.total++;
            
            const statusEmoji = moduleData.status === 'initialized' ? '✅' : '❌';
            message += `${statusEmoji} **${moduleName}**\n`;
            message += `• 상태: ${moduleData.status}\n`;
            
            if (moduleData.status === 'initialized') {
                moduleCount.initialized++;
            } else {
                moduleCount.error++;
                if (moduleData.error) {
                    message += `• 오류: ${moduleData.error}\n`;
                }
            }
            
            message += `\n`;
        }
        
        message += `**📈 통계**\n`;
        message += `• 전체 모듈: ${moduleCount.total}개\n`;
        message += `• 정상 동작: ${moduleCount.initialized}개\n`;
        message += `• 오류 발생: ${moduleCount.error}개\n`;
        
        return message;
    }
    
    async sendErrorMessage(chatId, error) {
        try {
            const errorMessage = `❌ 명령어 처리 중 오류가 발생했습니다.\n\n` +
                               `${error.message || '알 수 없는 오류'}`;
            
            await this.bot.sendMessage(chatId, errorMessage, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                    ]]
                }
            });
        } catch (sendError) {
            Logger.error('오류 메시지 전송 실패:', sendError);
        }
    }
}

module.exports = CommandHandler;