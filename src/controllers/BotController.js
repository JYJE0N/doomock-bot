// src/controllers/BotController.js - 수정된 버전

const MenuManager = require('../managers/MenuManager');
const CallbackManager = require('../managers/CallbackManager');
const ModuleManager = require('../managers/ModuleManager');
const MessageHandler = require('../handlers/MessageHandler');
const CommandHandler = require('../handlers/CommandHandler');
const { DatabaseManager } = require('../database/DatabaseManager');
const Logger = require('../utils/Logger');
const UserHelper = require('../utils/UserHelper');

class BotController {
    constructor(bot, config) {
        this.bot = bot;
        this.config = config;
        
        // 매니저들
        this.dbManager = null;
        this.moduleManager = null;
        this.menuManager = null;
        this.callbackManager = null;
        
        // 핸들러들
        this.messageHandler = null;
        this.commandHandler = null;
        
        // 사용자 상태 관리
        this.userStates = new Map();
    }
    
    async initialize() {
        try {
            Logger.info('BotController 초기화 시작...');
            
            // 1. 데이터베이스 연결
            await this.initializeDatabase();
            
            // 2. 모듈 매니저 초기화
            await this.initializeModuleManager();
            
            // 3. 메뉴 매니저 초기화
            this.initializeMenuManager();
            
            // 4. 콜백 매니저 초기화 - 중요: MenuManager 이후에 초기화
            this.initializeCallbackManager();
            
            // 5. 핸들러 초기화
            this.initializeHandlers();
            
            // 6. 이벤트 리스너 등록
            this.registerEventListeners();
            
            Logger.success('BotController 초기화 완료');
            
        } catch (error) {
            Logger.error('BotController 초기화 실패:', error);
            throw error;
        }
    }
    
    // BotController.js - initializeDatabase 메서드

async initializeDatabase() {
    if (this.config.mongoUrl) {
        try {
            this.dbManager = new DatabaseManager(this.config.mongoUrl);
            await this.dbManager.connect();
            
            // 싱글톤 인스턴스 설정 (서비스들이 사용할 수 있도록)
            if (DatabaseManager.setInstance) {
                DatabaseManager.setInstance(this.dbManager);
            }
            
            Logger.success('데이터베이스 연결 성공');
        } catch (error) {
            Logger.error('데이터베이스 연결 실패:', error);
            // DB 연결 실패해도 봇은 계속 실행
            Logger.warn('MongoDB 없이 봇을 실행합니다. 일부 기능이 제한됩니다.');
        }
    } else {
        Logger.warn('MongoDB URL이 없습니다. 일부 기능이 제한됩니다.');
    }
}
    
    async initializeModuleManager() {
        this.moduleManager = new ModuleManager(this.bot, {
            dbManager: this.dbManager,
            userStates: this.userStates
        });
        
        await this.moduleManager.loadModules();
        Logger.success('모듈 매니저 초기화 완료');
    }
    
    initializeMenuManager() {
        // ModuleManager를 MenuManager에 전달
        this.menuManager = new MenuManager(this.moduleManager);
        Logger.success('메뉴 매니저 초기화 완료');
    }
    
    initializeCallbackManager() {
        const modules = this.moduleManager.getModules();
        
        // 새로운 CallbackManager 생성 방식
        this.callbackManager = new CallbackManager(this.bot, modules);
        
        // MenuManager를 CallbackManager에 설정 - 이 부분이 핵심!
        if (this.menuManager) {
            this.callbackManager.setMenuManager(this.menuManager);
            Logger.success('MenuManager가 CallbackManager에 성공적으로 연결됨');
        } else {
            Logger.error('MenuManager가 없어서 CallbackManager에 연결 실패!');
            throw new Error('MenuManager 초기화 필요');
        }
        
        Logger.success('콜백 매니저 초기화 완료');
    }
    
    initializeHandlers() {
        // 메시지 핸들러
        this.messageHandler = new MessageHandler(this.bot, {
            moduleManager: this.moduleManager,
            menuManager: this.menuManager,
            callbackManager: this.callbackManager,
            userStates: this.userStates
        });
        
        // 명령어 핸들러
        this.commandHandler = new CommandHandler(this.bot, {
            moduleManager: this.moduleManager,
            menuManager: this.menuManager,
            userStates: this.userStates
        });
        
        Logger.success('핸들러 초기화 완료');
    }
    
    registerEventListeners() {
        // 메시지 이벤트
        this.bot.on('message', async (msg) => {
            try {
                await this.handleMessage(msg);
            } catch (error) {
                Logger.error('메시지 처리 오류:', error);
                await this.sendErrorMessage(msg.chat.id);
            }
        });
        
        // 콜백 쿼리 이벤트
        this.bot.on('callback_query', async (callbackQuery) => {
            try {
                await this.handleCallbackQuery(callbackQuery);
            } catch (error) {
                Logger.error('콜백 처리 오류:', error);
                await this.sendErrorMessage(callbackQuery.message.chat.id);
            }
        });
        
        // 폴링 에러 이벤트
        this.bot.on('polling_error', (error) => {
            Logger.error('폴링 오류:', error);
        });
        
        Logger.success('이벤트 리스너 등록 완료');
    }
    
    // BotController.js의 handleMessage 메서드에 추가

async handleMessage(msg) {
    const text = msg.text;
    if (!text) return;
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = UserHelper.getUserName(msg.from);
    
    Logger.info(`💬 메시지: "${text}" (사용자: ${userName}, ID: ${userId})`);
    
    // /start 명령어 직접 처리 (임시)
    if (text === '/start') {
        const welcomeText = `🤖 **두목봇에 오신걸 환영합니다!**\n\n` +
                          `안녕하세요 ${userName}님! 👋\n\n` +
                          `두목봇은 직장인을 위한 종합 생산성 도구입니다.\n` +
                          `아래 메뉴에서 원하는 기능을 선택해주세요:`;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📝 할일 관리', callback_data: 'todo_menu' },
                    { text: '📅 휴가 관리', callback_data: 'leave_menu' }
                ],
                [
                    { text: '⏰ 타이머', callback_data: 'timer_menu' },
                    { text: '🔮 운세', callback_data: 'fortune_menu' }
                ],
                [
                    { text: '🕐 근무시간', callback_data: 'worktime_menu' },
                    { text: '🌤️ 날씨', callback_data: 'weather_menu' }
                ],
                [
                    { text: '📊 인사이트', callback_data: 'insight_menu' },
                    { text: '🔔 리마인더', callback_data: 'reminder_menu' }
                ],
                [
                    { text: '🛠️ 유틸리티', callback_data: 'utils_menu' },
                    { text: '❓ 도움말', callback_data: 'help_menu' }
                ]
            ]
        };
        
        await this.bot.sendMessage(chatId, welcomeText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
        return;
    }
    
    // ... 나머지 코드
}
    
    async handleCallbackQuery(callbackQuery) {
        await this.callbackManager.handleCallback(callbackQuery);
    }
    
    async sendErrorMessage(chatId) {
        try {
            await this.bot.sendMessage(chatId, 
                '❌ 처리 중 오류가 발생했습니다. /start 를 입력해서 다시 시작해주세요.'
            );
        } catch (error) {
            Logger.error('오류 메시지 전송 실패:', error);
        }
    }
    
    async shutdown() {
        Logger.info('BotController 종료 시작...');
        
        try {
            // 모듈 종료
            if (this.moduleManager) {
                await this.moduleManager.shutdown();
            }
            
            // 데이터베이스 연결 종료
            if (this.dbManager) {
                await this.dbManager.disconnect();
            }
            
            // 봇 폴링 중지
            if (this.bot) {
                await this.bot.stopPolling();
            }
            
            Logger.success('BotController 종료 완료');
        } catch (error) {
            Logger.error('BotController 종료 중 오류:', error);
        }
    }
}

module.exports = BotController;