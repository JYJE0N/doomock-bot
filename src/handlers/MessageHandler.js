// src/handlers/MessageHandler.js - 수정된 버전

const { getUserName } = require("../utils/UserHelper");
const Logger = require("../utils/Logger");

class MessageHandler {
    constructor(bot, options) {
        this.bot = bot;
        this.moduleManager = options.moduleManager;
        this.menuManager = options.menuManager;
        this.callbackManager = options.callbackManager;
        this.userStates = options.userStates;
        
        Logger.info('MessageHandler 초기화됨');
    }

    async handleMessage(msg) {
        const {
            chat: { id: chatId },
            from: { id: userId },
            text,
        } = msg;
        const userName = getUserName(msg.from);

        if (!text) return;

        Logger.info(`💬 메시지 처리: "${text}" (사용자: ${userName})`);

        try {
            // 취소 명령어 처리
            if (text === "/cancel") {
                this.userStates.delete(userId);
                await this.bot.sendMessage(
                    chatId,
                    `❌ ${userName}님, 작업이 취소되었습니다.`
                );
                return;
            }

            // 사용자 상태 기반 처리
            if (this.userStates.has(userId)) {
                const handled = await this.handleUserState(msg);
                if (handled) return;
            }

            // 명령어 처리
            if (text.startsWith("/")) {
                await this.handleCommand(msg);
                return;
            }

            // 자동 기능 처리 (TTS 등)
            await this.handleAutoFeatures(msg);
            
        } catch (error) {
            Logger.error("메시지 처리 오류:", error);
            await this.bot.sendMessage(
                chatId,
                "❌ 처리 중 오류가 발생했습니다. /start 를 입력해서 다시 시작해주세요."
            );
        }
    }

    async handleUserState(msg) {
        const { from: { id: userId } } = msg;
        const userState = this.userStates.get(userId);

        if (!userState) return false;

        // 모듈별 상태 처리 위임
        const modules = this.moduleManager.getModules();
        
        for (const [moduleName, moduleInstance] of Object.entries(modules)) {
            try {
                if (moduleInstance && moduleInstance.handleMessage) {
                    const handled = await moduleInstance.handleMessage(this.bot, msg);
                    if (handled) {
                        return true;
                    }
                }
            } catch (error) {
                Logger.error(`모듈 ${moduleName} 사용자 상태 처리 오류:`, error);
            }
        }

        return false;
    }

    async handleCommand(msg) {
        const {
            chat: { id: chatId },
            from: { id: userId },
            text,
        } = msg;
        const userName = getUserName(msg.from);

        // 기본 명령어 처리
        switch (text) {
            case "/start":
                await this.showMainMenu(chatId, userName);
                break;
            case "/help":
                await this.showHelpMenu(chatId, userName);
                break;
            default:
                // 모듈별 명령어 처리 위임
                const handled = await this.delegateCommand(msg);
                if (!handled) {
                    await this.bot.sendMessage(
                        chatId,
                        `😅 ${userName}님, 알 수 없는 명령어입니다. /start 를 입력해서 메뉴를 확인하세요.`
                    );
                }
        }
    }

    async delegateCommand(msg) {
        const modules = this.moduleManager.getModules();
        
        for (const [moduleName, moduleInstance] of Object.entries(modules)) {
            try {
                if (moduleInstance && moduleInstance.handleMessage) {
                    const handled = await moduleInstance.handleMessage(this.bot, msg);
                    if (handled) {
                        Logger.debug(`명령어가 ${moduleName} 모듈에서 처리됨`);
                        return true;
                    }
                }
            } catch (error) {
                Logger.error(`모듈 ${moduleName} 명령어 처리 오류:`, error);
            }
        }
        
        return false;
    }

    async showMainMenu(chatId, userName) {
        try {
            const menuText = this.getMainMenuText(userName);
            const keyboard = await this.menuManager.getMainMenuKeyboard();

            await this.bot.sendMessage(chatId, menuText, {
                parse_mode: "Markdown",
                reply_markup: keyboard,
            });
        } catch (error) {
            Logger.error('메인 메뉴 표시 오류:', error);
            await this.bot.sendMessage(chatId, '❌ 메뉴를 불러올 수 없습니다.');
        }
    }

    async showHelpMenu(chatId, userName) {
        try {
            const helpText = this.getHelpMenuText(userName);
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔙 메인 메뉴', callback_data: 'main_menu' }]
                ]
            };

            await this.bot.sendMessage(chatId, helpText, {
                parse_mode: "Markdown",
                reply_markup: keyboard,
            });
        } catch (error) {
            Logger.error('도움말 메뉴 표시 오류:', error);
            await this.bot.sendMessage(chatId, '❌ 도움말을 불러올 수 없습니다.');
        }
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

    getHelpMenuText(userName) {
        return `❓ **두목봇 도움말**\n\n` +
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
               `• /add [할일] - 할일 빠른 추가\n` +
               `• /help - 도움말\n\n` +
               `🚀 **Railway 클라우드에서 24/7 운영 중!**`;
    }

    async handleAutoFeatures(msg) {
        try {
            // TTS 자동 처리
            const utilsModule = this.moduleManager.getModule('utils');
            if (utilsModule && utilsModule.handleAutoTTS) {
                const handled = await utilsModule.handleAutoTTS(this.bot, msg);
                if (handled) return;
            }
            
            // 다른 자동 기능들 추가 가능
            
        } catch (error) {
            Logger.error('자동 기능 처리 오류:', error);
        }
    }

    setUserState(userId, state) {
        this.userStates.set(userId, state);
    }

    clearUserState(userId) {
        this.userStates.delete(userId);
    }

    getUserState(userId) {
        return this.userStates.get(userId);
    }
}

module.exports =  MessageHandler ;