// src/managers/ModuleManager.js - 모듈 관리자
const Logger = require('../utils/Logger');
const AppConfig = require('../config/AppConfig');
const ModuleConfig = require('../config/ModuleConfig');

class ModuleManager {
    constructor() {
        this.modules = new Map();
        this.moduleOrder = [];
        this.isInitialized = false;
        
        Logger.info('🔧 ModuleManager 생성됨');
    }

    // 초기화
    async initialize() {
        try {
            Logger.info('⚙️ ModuleManager 초기화 시작...');
            
            await this.loadModules();
            await this.initializeModules();
            await this.validateDependencies();
            
            this.isInitialized = true;
            Logger.success('✅ ModuleManager 초기화 완료', {
                loadedModules: this.modules.size,
                moduleNames: Array.from(this.modules.keys())
            });
            
        } catch (error) {
            Logger.error('❌ ModuleManager 초기화 실패:', error);
            throw error;
        }
    }

    // 모듈 로드
    async loadModules() {
        const moduleConfigs = ModuleConfig.getModuleConfigs();
        
        // 우선순위별로 정렬
        const sortedConfigs = Object.entries(moduleConfigs)
            .sort(([,a], [,b]) => (a.priority || 100) - (b.priority || 100));
        
        for (const [moduleName, config] of sortedConfigs) {
            try {
                // 기능 토글 확인
                if (!this.isFeatureEnabled(moduleName)) {
                    Logger.info(`⏸️ 모듈 ${moduleName} 비활성화됨`);
                    continue;
                }
                
                await this.loadModule(moduleName, config);
                this.moduleOrder.push(moduleName);
                
            } catch (error) {
                Logger.error(`❌ 모듈 ${moduleName} 로드 실패:`, error);
                
                // 필수 모듈인 경우 전체 시스템 중단
                if (config.required) {
                    throw new Error(`필수 모듈 ${moduleName} 로드 실패`);
                }
            }
        }
    }

    // 개별 모듈 로드
async loadModule(moduleName, config) {
    try {
        Logger.info(`📦 모듈 ${moduleName} 로드 중...`);

        if (!config.path) {
            throw new Error(`❌ ${moduleName} 모듈에 path 값이 없습니다.`);
        }

        // 모듈 클래스 import - 파일 존재 확인 추가
        let ModuleClass;
        try {
            ModuleClass = require(config.path);
        } catch (requireError) {
            Logger.warn(`⚠️ 모듈 파일 ${config.path}을 찾을 수 없습니다. 스킵합니다.`);
            return; // 모듈 로드 실패 시 그냥 스킵
        }

        // 모듈 인스턴스 생성_임시생성
        const moduleInstance = new ModuleClass(config);

        // 모듈 등록
        this.modules.set(moduleName, {
            instance: moduleInstance,
            config: config,
            status: 'loaded',
            loadTime: new Date()
        });

        Logger.success(`✅ 모듈 ${moduleName} 로드 완료`);

    } catch (error) {
        Logger.error(`❌ 모듈 ${moduleName} 로드 실패:`, error);
        // 필수 모듈이 아니면 에러를 던지지 않음
        if (!config.required) {
            Logger.warn(`⚠️ 선택적 모듈 ${moduleName} 로드 실패, 계속 진행합니다.`);
            return;
        }
        throw error;
    }
}


    // 모듈 초기화
    async initializeModules() {
        for (const moduleName of this.moduleOrder) {
            try {
                const moduleData = this.modules.get(moduleName);
                if (!moduleData) continue;
                
                Logger.info(`🔧 모듈 ${moduleName} 초기화 중...`);
                
                await moduleData.instance.initialize();
                moduleData.status = 'initialized';
                
                Logger.success(`✅ 모듈 ${moduleName} 초기화 완료`);
                
            } catch (error) {
                Logger.error(`❌ 모듈 ${moduleName} 초기화 실패:`, error);
                
                const moduleData = this.modules.get(moduleName);
                if (moduleData) {
                    moduleData.status = 'error';
                    moduleData.error = error.message;
                }
                
                // 필수 모듈인 경우 전체 시스템 중단
                if (moduleData?.config.required) {
                    throw new Error(`필수 모듈 ${moduleName} 초기화 실패`);
                }
            }
        }
    }

    // 의존성 검증
    async validateDependencies() {
        for (const [moduleName, moduleData] of this.modules) {
            if (moduleData.status !== 'initialized') continue;
            
            const dependencies = moduleData.config.dependencies || [];
            
            for (const dependency of dependencies) {
                if (!this.isModuleLoaded(dependency)) {
                    const error = `모듈 ${moduleName}의 의존성 ${dependency}가 로드되지 않음`;
                    Logger.error(error);
                    
                    moduleData.status = 'dependency_error';
                    moduleData.error = error;
                    
                    if (moduleData.config.required) {
                        throw new Error(error);
                    }
                }
            }
        }
    }

    // 기능 활성화 여부 확인
    isFeatureEnabled(moduleName) {
        const featureMap = {
            'TodoModule': AppConfig.FEATURES.TODO_MODULE,
            'LeaveModule': AppConfig.FEATURES.LEAVE_MODULE,
            'WeatherModule': AppConfig.FEATURES.WEATHER_MODULE,
            'FortuneModule': AppConfig.FEATURES.FORTUNE_MODULE,
            'TimerModule': AppConfig.FEATURES.TIMER_MODULE,
            'InsightModule': AppConfig.FEATURES.INSIGHT_MODULE,
            'UtilsModule': AppConfig.FEATURES.UTILS_MODULE,
            'ReminderModule': AppConfig.FEATURES.REMINDER_MODULE,
            'WorktimeModule': AppConfig.FEATURES.WORKTIME_MODULE
        };
        
        return featureMap[moduleName] !== false;
    }

    // 모듈 조회
    getModule(moduleName) {
        const moduleData = this.modules.get(moduleName);
        return moduleData?.status === 'initialized' ? moduleData.instance : null;
    }

    // 모듈 로드 여부 확인
    isModuleLoaded(moduleName) {
        const moduleData = this.modules.get(moduleName);
        return moduleData && moduleData.status === 'initialized';
    }

    // 명령어 처리할 모듈 찾기
    findModuleForCommand(command) {
        for (const [moduleName, moduleData] of this.modules) {
            if (moduleData.status !== 'initialized') continue;
            
            const instance = moduleData.instance;
            if (instance.canHandleCommand && instance.canHandleCommand(command)) {
                return instance;
            }
        }
        return null;
    }

    // 콜백 처리할 모듈 찾기
    findModuleForCallback(callbackData) {
        for (const [moduleName, moduleData] of this.modules) {
            if (moduleData.status !== 'initialized') continue;
            
            const instance = moduleData.instance;
            if (instance.canHandleCallback && instance.canHandleCallback(callbackData)) {
                return instance;
            }
        }
        return null;
    }

    // 메시지 처리
    async handleMessage(bot, msg) {
        const text = msg.text;
        if (!text) return false;
        
        // 명령어 파싱
        if (text.startsWith('/')) {
            return await this.handleCommand(bot, msg);
        }
        
        // 일반 메시지 처리 (모든 모듈에 전달)
        let handled = false;
        for (const [moduleName, moduleData] of this.modules) {
            if (moduleData.status !== 'initialized') continue;
            
            try {
                const instance = moduleData.instance;
                if (instance.handleMessage) {
                    const result = await instance.handleMessage(bot, msg);
                    if (result) {
                        handled = true;
                        Logger.debug(`메시지가 ${moduleName} 모듈에서 처리됨`);
                        break; // 첫 번째 처리한 모듈에서 중단
                    }
                }
            } catch (error) {
                Logger.error(`모듈 ${moduleName}에서 메시지 처리 실패:`, error);
            }
        }
        
        return handled;
    }

    // 명령어 처리
    async handleCommand(bot, msg) {
        const text = msg.text;
        const parts = text.split(' ');
        const command = parts[0].substring(1); // '/' 제거
        const args = parts.slice(1);
        
        Logger.userAction(msg.from.id, 'command', { command, args });
        
        // 시스템 명령어 우선 처리
        if (await this.handleSystemCommand(bot, msg, command, args)) {
            return true;
        }
        
        // 모듈에서 명령어 처리
        const module = this.findModuleForCommand(command);
        if (module) {
            try {
                const timer = Logger.startTimer(`command:${command}`);
                const result = await module.handleCommand(bot, msg, command, args);
                timer.end({ module: module.name, success: !!result });
                
                return result;
            } catch (error) {
                Logger.error(`명령어 ${command} 처리 실패:`, error);
                await this.sendErrorMessage(bot, msg.chat.id, error);
                return false;
            }
        }
        
        // 알 수 없는 명령어
        await this.handleUnknownCommand(bot, msg, command);
        return false;
    }

    // 시스템 명령어 처리
    async handleSystemCommand(bot, msg, command, args) {
        switch (command) {
            case 'start':
                await this.handleStartCommand(bot, msg);
                return true;
            
            case 'help':
                await this.handleHelpCommand(bot, msg);
                return true;
            
            case 'status':
                await this.handleStatusCommand(bot, msg);
                return true;
            
            case 'modules':
                await this.handleModulesCommand(bot, msg);
                return true;
            
            default:
                return false;
        }
    }

    // /start 명령어 처리
    async handleStartCommand(bot, msg) {
        const { getUserName } = require('../utils/UserHelper');
        const userName = getUserName(msg.from);
        
        const welcomeMessage = `🤖 **두목봇에 오신걸 환영합니다!**\n\n` +
                             `안녕하세요 ${userName}님! 👋\n\n` +
                             `두목봇은 직장인을 위한 종합 생산성 도구입니다.\n` +
                             `아래 메뉴에서 원하는 기능을 선택해주세요:`;
        
        // 메인 메뉴 키보드 생성
        const MenuManager = require('./MenuManager');
        const menuManager = new MenuManager(this);
        const mainKeyboard = await menuManager.getMainMenuKeyboard();
        
        await bot.sendMessage(msg.chat.id, welcomeMessage, {
            parse_mode: 'Markdown',
            reply_markup: mainKeyboard
        });
    }

    // /help 명령어 처리
    async handleHelpCommand(bot, msg) {
        let helpMessage = `❓ **두목봇 도움말**\n\n`;
        
        // 활성화된 모듈들의 도움말 수집
        const moduleHelps = [];
        for (const [moduleName, moduleData] of this.modules) {
            if (moduleData.status !== 'initialized') continue;
            
            const instance = moduleData.instance;
            if (instance.getHelpMessage) {
                try {
                    const moduleHelp = await instance.getHelpMessage();
                    moduleHelps.push(moduleHelp);
                } catch (error) {
                    Logger.error(`모듈 ${moduleName} 도움말 생성 실패:`, error);
                }
            }
        }
        
        if (moduleHelps.length > 0) {
            helpMessage += moduleHelps.join('\n\n');
        } else {
            helpMessage += '사용 가능한 모듈이 없습니다.';
        }
        
        helpMessage += `\n\n**🔧 시스템 명령어**\n`;
        helpMessage += `• /start - 메인 메뉴\n`;
        helpMessage += `• /help - 도움말\n`;
        helpMessage += `• /status - 봇 상태\n`;
        helpMessage += `• /modules - 모듈 목록\n`;
        
        await bot.sendMessage(msg.chat.id, helpMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                ]]
            }
        });
    }

    // /status 명령어 처리
    async handleStatusCommand(bot, msg) {
        const status = this.getModuleStatus();
        
        let statusMessage = `📊 **모듈 상태**\n\n`;
        
        for (const [moduleName, moduleStatus] of Object.entries(status)) {
            const statusEmoji = moduleStatus.status === 'initialized' ? '✅' : '❌';
            statusMessage += `${statusEmoji} **${moduleName}**\n`;
            statusMessage += `• 상태: ${moduleStatus.status}\n`;
            
            if (moduleStatus.error) {
                statusMessage += `• 오류: ${moduleStatus.error}\n`;
            }
            
            if (moduleStatus.stats) {
                statusMessage += `• 명령어: ${moduleStatus.stats.commandCount}회\n`;
                statusMessage += `• 콜백: ${moduleStatus.stats.callbackCount}회\n`;
            }
            
            statusMessage += `\n`;
        }
        
        await bot.sendMessage(msg.chat.id, statusMessage, {
            parse_mode: 'Markdown'
        });
    }

    // /modules 명령어 처리
    async handleModulesCommand(bot, msg) {
        let modulesMessage = `🔧 **로드된 모듈 목록**\n\n`;
        
        const moduleCount = {
            total: this.modules.size,
            initialized: 0,
            error: 0
        };
        
        for (const [moduleName, moduleData] of this.modules) {
            const statusEmoji = {
                'initialized': '✅',
                'loaded': '⏳',
                'error': '❌',
                'dependency_error': '⚠️'
            }[moduleData.status] || '❓';
            
            modulesMessage += `${statusEmoji} ${moduleName} (${moduleData.status})\n`;
            
            if (moduleData.status === 'initialized') {
                moduleCount.initialized++;
            } else if (moduleData.status === 'error' || moduleData.status === 'dependency_error') {
                moduleCount.error++;
            }
        }
        
        modulesMessage += `\n**📈 통계**\n`;
        modulesMessage += `• 전체: ${moduleCount.total}개\n`;
        modulesMessage += `• 정상: ${moduleCount.initialized}개\n`;
        modulesMessage += `• 오류: ${moduleCount.error}개\n`;
        
        await bot.sendMessage(msg.chat.id, modulesMessage, {
            parse_mode: 'Markdown'
        });
    }

    // 알 수 없는 명령어 처리
    async handleUnknownCommand(bot, msg, command) {
        const message = `❓ 알 수 없는 명령어입니다: /${command}\n\n` +
                       `/help 명령어로 사용 가능한 기능을 확인하거나\n` +
                       `/start 명령어로 메인 메뉴로 이동하세요.`;
        
        await bot.sendMessage(msg.chat.id, message, {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 메인 메뉴', callback_data: 'main_menu' },
                    { text: '❓ 도움말', callback_data: 'help' }
                ]]
            }
        });
    }

    // 콜백 처리
    async handleCallback(bot, callbackQuery) {
        const data = callbackQuery.data;
        
        Logger.userAction(callbackQuery.from.id, 'callback', { data });
        
        // 시스템 콜백 우선 처리
        if (await this.handleSystemCallback(bot, callbackQuery)) {
            return true;
        }
        
        // 모듈에서 콜백 처리
        const module = this.findModuleForCallback(data);
        if (module) {
            try {
                const timer = Logger.startTimer(`callback:${data}`);
                const result = await module.handleCallback(bot, callbackQuery);
                timer.end({ module: module.name, success: !!result });
                
                return result;
            } catch (error) {
                Logger.error(`콜백 ${data} 처리 실패:`, error);
                await this.sendErrorMessage(bot, callbackQuery.message.chat.id, error);
                return false;
            }
        }
        
        Logger.warn(`처리할 수 없는 콜백: ${data}`);
        return false;
    }

    // 시스템 콜백 처리
    async handleSystemCallback(bot, callbackQuery) {
        const data = callbackQuery.data;
        
        switch (data) {
            case 'main_menu':
                const MenuManager = require('./MenuManager');
                const menuManager = new MenuManager(this);
                await menuManager.showMainMenu(bot, callbackQuery);
                return true;
            
            case 'help':
                await this.handleHelpCommand(bot, callbackQuery.message);
                return true;
            
            case 'noop':
                // 아무것도 하지 않음 (페이지네이션 등에서 사용)
                return true;
            
            default:
                return false;
        }
    }

    // 오류 메시지 전송
    async sendErrorMessage(bot, chatId, error) {
        try {
            const errorMessage = `❌ 처리 중 오류가 발생했습니다.\n\n` +
                               `${error.message || '알 수 없는 오류'}`;
            
            await bot.sendMessage(chatId, errorMessage, {
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

    // 모듈 재로드
    async reloadModules() {
        Logger.info('🔄 모듈 재로드 시작...');
        
        try {
            // 기존 모듈들 정리
            await this.shutdown();
            
            // 모듈 캐시 클리어
            this.clearModuleCache();
            
            // 다시 초기화
            this.modules.clear();
            this.moduleOrder = [];
            this.isInitialized = false;
            
            await this.initialize();
            
            Logger.success('✅ 모듈 재로드 완료');
        } catch (error) {
            Logger.error('❌ 모듈 재로드 실패:', error);
            throw error;
        }
    }

    // 모듈 캐시 클리어
    clearModuleCache() {
        const moduleFiles = [
            '../modules/TodoModule',
            '../modules/LeaveModule',
            '../modules/WeatherModule',
            '../modules/FortuneModule',
            '../modules/TimerModule',
            '../modules/InsightModule',
            '../modules/UtilsModule',
            '../modules/ReminderModule',
            '../modules/WorktimeModule'
        ];
        
        for (const moduleFile of moduleFiles) {
            try {
                delete require.cache[require.resolve(moduleFile)];
            } catch (error) {
                // 파일이 없는 경우 무시
            }
        }
    }

    // 모듈 상태 조회
    getModuleStatus() {
        const status = {};
        
        for (const [moduleName, moduleData] of this.modules) {
            status[moduleName] = {
                status: moduleData.status,
                error: moduleData.error,
                loadTime: moduleData.loadTime,
                config: {
                    priority: moduleData.config.priority,
                    required: moduleData.config.required
                }
            };
            
            if (moduleData.instance && moduleData.instance.getStatus) {
                try {
                    const instanceStatus = moduleData.instance.getStatus();
                    status[moduleName] = { ...status[moduleName], ...instanceStatus };
                } catch (error) {
                    Logger.error(`모듈 ${moduleName} 상태 조회 실패:`, error);
                }
            }
        }
        
        return status;
    }

    // 종료
    async shutdown() {
        Logger.info('⏹️ ModuleManager 종료 시작...');
        
        try {
            // 모든 모듈 정리
            for (const [moduleName, moduleData] of this.modules) {
                try {
                    if (moduleData.instance && moduleData.instance.cleanup) {
                        await moduleData.instance.cleanup();
                    }
                } catch (error) {
                    Logger.error(`모듈 ${moduleName} 정리 실패:`, error);
                }
            }
            
            this.modules.clear();
            this.moduleOrder = [];
            this.isInitialized = false;
            
            Logger.success('✅ ModuleManager 종료 완료');
            
        } catch (error) {
            Logger.error('❌ ModuleManager 종료 실패:', error);
            throw error;
        }
    }
}

module.exports = ModuleManager;