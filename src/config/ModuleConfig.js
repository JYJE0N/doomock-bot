// src/config/ModuleConfig.js - 수정된 버전

function getModuleConfigs() {
    // 객체 형태로 반환 (배열이 아닌)
    return {
        TodoModule: {
            name: 'TodoModule', 
            path: '../modules/TodoModule',
            priority: 10,
            required: false,
            dependencies: []
        },
        FortuneModule: {
            name: 'FortuneModule', 
            path: '../modules/FortuneModule',
            priority: 20,
            required: false,
            dependencies: []
        },
        InsightModule: {
            name: 'InsightModule', 
            path: '../modules/InsightModule',
            priority: 30,
            required: false,
            dependencies: []
        },
        LeaveModule: {
            name: 'LeaveModule', 
            path: '../modules/LeaveModule',
            priority: 40,
            required: false,
            dependencies: []
        },
        ReminderModule: {
            name: 'ReminderModule', 
            path: '../modules/ReminderModule',
            priority: 50,
            required: false,
            dependencies: []
        },
        TimerModule: {
            name: 'TimerModule', 
            path: '../modules/TimerModule',
            priority: 60,
            required: false,
            dependencies: []
        },
        WeatherModule: {
            name: 'WeatherModule', 
            path: '../modules/WeatherModule',
            priority: 70,
            required: false,
            dependencies: []
        },
        WorktimeModule: {
            name: 'WorktimeModule', 
            path: '../modules/WorktimeModule',
            priority: 80,
            required: false,
            dependencies: []
        },
        UtilsModule: {
            name: 'UtilsModule', 
            path: '../modules/UtilsModule',
            priority: 90,
            required: false,
            dependencies: []
        }
    };
}

module.exports = { getModuleConfigs };