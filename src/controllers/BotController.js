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
    
    async handleMessage(msg) {
        const text = msg.text;
        if (!text) return;
        
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userName = UserHelper.getUserName(msg.from);
        
        Logger.info(`💬 메시지: "${text}" (사용자: ${userName}, ID: ${userId})`);
        
        // 사용자 상태 확인
        const userState = this.userStates.get(userId);
        
        // 취소 명령어 처리
        if (text === '/cancel') {
            this.userStates.delete(userId);
            await this.bot.sendMessage(chatId, 
                `❌ ${userName}님, 작업이 취소되었습니다.`
            );
            return;
        }
        
        // 사용자 상태가 있는 경우 상태별 처리
        if (userState) {
            await this.messageHandler.handleUserState(msg, userState);
            return;
        }
        
        // 명령어 처리
        if (text.startsWith('/')) {
            await this.commandHandler.handleCommand(msg);
        } else {
            // 일반 메시지 처리 (자동 TTS 등)
            await this.messageHandler.handleMessage(msg);
        }
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