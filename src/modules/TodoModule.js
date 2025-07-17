const BaseModule = require('./BaseModule')
const { TodoService } = require('../services/TodoService');
const { getUserName } = require('../utils/UserHelper');
const { ValidationHelper } = require('../utils/ValidationHelper');

class TodoModule extends BaseModule {
    constructor() {
        super('TodoModule');
        this.todoService = new TodoService();
        this.userStates = new Map();
    }

    async handleMessage(bot, msg) {
        const { chat: { id: chatId }, from: { id: userId }, text } = msg;
        const userState = this.userStates.get(userId);

        // 상태별 메시지 처리
        if (userState && userState.action === 'adding_todo') {
            return await this.handleTodoAdd(bot, chatId, userId, text);
        }

        // 명령어 처리
        if (text && text.startsWith('/add ')) {
            const taskText = text.replace('/add ', '').trim();
            if (taskText) {
                await this.addTodo(bot, chatId, userId, taskText);
                return true;
            }
        }

        return false;
    }

    async processCallback(bot, callbackQuery, subAction, params) {
        const { message: { chat: { id: chatId }, message_id: messageId }, from: { id: userId } } = callbackQuery;
        const userName = getUserName(callbackQuery.from);

        switch (subAction) {
            case 'menu':
                await this.showTodoMenu(bot, chatId, messageId, userName);
                break;
            case 'list':
                await this.showTodoList(bot, chatId, messageId, userId, userName);
                break;
            case 'add':
                await this.startTodoAdd(bot, chatId, messageId, userId);
                break;
            case 'stats':
                await this.showTodoStats(bot, chatId, messageId, userId);
                break;
            case 'clear':
                if (params[0] === 'completed') {
                    await this.clearCompletedTodos(bot, chatId, messageId, userId);
                } else if (params[0] === 'all') {
                    await this.clearAllTodos(bot, chatId, messageId, userId);
                }
                break;
            case 'toggle':
                await this.toggleTodo(bot, chatId, messageId, userId, parseInt(params[0]));
                break;
            case 'delete':
                await this.deleteTodo(bot, chatId, messageId, userId, parseInt(params[0]));
                break;
            default:
                await this.sendMessage(bot, chatId, '❌ 알 수 없는 할일 관리 명령입니다.');
                return false;
        }
        return true;
    }

    async showTodoMenu(bot, chatId, messageId, userName) {
        const menuText = `📝 **${userName}님의 할일 관리**\n\n할일을 효율적으로 관리해보세요:`;
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '📝 할일 추가', callback_data: 'todo_add' },
                    { text: '📋 할일 목록', callback_data: 'todo_list' }
                ],
                [
                    { text: '📊 통계 보기', callback_data: 'todo_stats' },
                    { text: '🗑️ 완료 삭제', callback_data: 'todo_clear_completed' }
                ],
                [
                    { text: '⚠️ 전체 삭제', callback_data: 'todo_clear_all' },
                    { text: '🔙 메인 메뉴', callback_data: 'main_menu' }
                ]
            ]
        };
        
        await this.editMessage(bot, chatId, messageId, menuText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showTodoList(bot, chatId, messageId, userId, userName) {
        try {
            const todos = await this.todoService.getTodos(userId);
            
            if (todos.length === 0) {
                await this.editMessage(bot, chatId, messageId, 
                    `📝 ${userName}님의 할일이 없습니다.\n\n새로운 할일을 추가해보세요!`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '➕ 할일 추가', callback_data: 'todo_add' }],
                                [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                            ]
                        }
                    }
                );
                return;
            }

            const todoText = this.formatTodoList(todos, userName);
            const todoButtons = this.createTodoButtons(todos);

            await this.editMessage(bot, chatId, messageId, todoText, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: todoButtons }
            });
        } catch (error) {
            console.error('할일 목록 조회 오류:', error);
            await this.sendMessage(bot, chatId, '❌ 할일 목록을 불러오는 중 오류가 발생했습니다.');
        }
    }

    async startTodoAdd(bot, chatId, messageId, userId) {
        this.userStates.set(userId, { action: 'adding_todo' });
        
        await this.editMessage(bot, chatId, messageId,
            '📝 **할일 추가하기**\n\n추가할 할일을 입력해주세요.',
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '❌ 취소', callback_data: 'cancel_action' }]
                    ]
                }
            }
        );
    }

    async handleTodoAdd(bot, chatId, userId, text) {
        try {
            const validatedTask = ValidationHelper.validateTodoTask(text);
            await this.addTodo(bot, chatId, userId, validatedTask);
            this.userStates.delete(userId);
            return true;
        } catch (error) {
            await this.sendMessage(bot, chatId, `❌ ${error.message}`);
            return true;
        }
    }

    async addTodo(bot, chatId, userId, taskText) {
        const success = await this.todoService.addTodo(userId, taskText);
        
        if (success) {
            await this.sendMessage(bot, chatId,
                `✅ 할일이 추가되었습니다!\n\n📝 "${taskText}"`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }],
                            [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                        ]
                    }
                }
            );
        } else {
            await this.sendMessage(bot, chatId, '❌ 할일 추가 중 오류가 발생했습니다.');
        }
    }

    async showTodoStats(bot, chatId, messageId, userId) {
        try {
            const stats = await this.todoService.getTodoStats(userId);
            
            const statsText = `📊 **할일 통계**\n\n` +
                             `📝 전체 할일: ${stats.total}개\n` +
                             `✅ 완료: ${stats.completed}개\n` +
                             `⏳ 진행중: ${stats.pending}개\n` +
                             `📈 완료율: ${stats.completionRate}%\n\n` +
                             `${stats.completionRate >= 80 ? '🎉 훌륭해요!' : 
                               stats.completionRate >= 50 ? '💪 잘하고 있어요!' : '📚 화이팅!'}`;
            
            await this.editMessage(bot, chatId, messageId, statsText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                    ]
                }
            });
        } catch (error) {
            console.error('할일 통계 조회 오류:', error);
            await this.sendMessage(bot, chatId, '❌ 할일 통계를 불러오는 중 오류가 발생했습니다.');
        }
    }

    async toggleTodo(bot, chatId, messageId, userId, todoIndex) {
        try {
            const newStatus = await this.todoService.toggleTodo(userId, todoIndex);
            if (newStatus !== null) {
                const statusText = newStatus ? "완료" : "미완료";
                await this.sendMessage(bot, chatId,
                    `✅ 할일 ${todoIndex + 1}번이 ${statusText}로 변경되었습니다!`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }],
                                [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                            ]
                        }
                    }
                );
            }
        } catch (error) {
            await this.sendMessage(bot, chatId, '❌ 할일 상태 변경 중 오류가 발생했습니다.');
        }
    }

    async deleteTodo(bot, chatId, messageId, userId, todoIndex) {
        try {
            const success = await this.todoService.deleteTodo(userId, todoIndex);
            if (success) {
                await this.sendMessage(bot, chatId,
                    `🗑️ 할일 ${todoIndex + 1}번이 삭제되었습니다!`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }],
                                [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                            ]
                        }
                    }
                );
            }
        } catch (error) {
            await this.sendMessage(bot, chatId, '❌ 할일 삭제 중 오류가 발생했습니다.');
        }
    }

    async clearCompletedTodos(bot, chatId, messageId, userId) {
        try {
            const success = await this.todoService.clearCompletedTodos(userId);
            if (success) {
                await this.editMessage(bot, chatId, messageId,
                    "✅ 완료된 할일이 모두 삭제되었습니다!",
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📋 할일 목록 보기', callback_data: 'todo_list' }],
                                [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                            ]
                        }
                    }
                );
            } else {
                await this.sendMessage(bot, chatId, "❌ 할일 삭제 중 오류가 발생했습니다.");
            }
        } catch (error) {
            await this.sendMessage(bot, chatId, "❌ 할일 삭제 중 오류가 발생했습니다.");
        }
    }

    async clearAllTodos(bot, chatId, messageId, userId) {
        try {
            const success = await this.todoService.clearAllTodos(userId);
            if (success) {
                await this.editMessage(bot, chatId, messageId,
                    "⚠️ 모든 할일이 삭제되었습니다!",
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '➕ 새 할일 추가', callback_data: 'todo_add' }],
                                [{ text: '🔙 할일 메뉴', callback_data: 'todo_menu' }]
                            ]
                        }
                    }
                );
            } else {
                await this.sendMessage(bot, chatId, "❌ 할일 삭제 중 오류가 발생했습니다.");
            }
        } catch (error) {
            await this.sendMessage(bot, chatId, "❌ 할일 삭제 중 오류가 발생했습니다.");
        }
    }

    formatTodoList(todos, userName) {
        const pendingTodos = todos.filter(todo => !todo.done);
        const completedTodos = todos.filter(todo => todo.done);

        let todoText = `📋 **${userName}님의 할일 관리**\n\n`;

        if (pendingTodos.length > 0) {
            todoText += `🟢 **진행 중** (${pendingTodos.length}개)\n`;
            pendingTodos.forEach(todo => {
                todoText += `☐ ${todo.task}\n`;
            });
            todoText += '\n';
        }

        if (completedTodos.length > 0) {
            todoText += `📌 **완료** (${completedTodos.length}개)\n`;
            completedTodos.forEach(todo => {
                todoText += `📌 ~~${todo.task}~~\n`;
            });
        }

        return todoText;
    }

    createTodoButtons(todos) {
        const todoButtons = [];
        
        todos.forEach((todo, index) => {
            todoButtons.push([
                {
                    text: `${todo.done ? '↩️' : '✅'} ${index + 1}번`,
                    callback_data: `todo_toggle_${index}`
                },
                {
                    text: `🗑️ ${index + 1}번`,
                    callback_data: `todo_delete_${index}`
                }
            ]);
        });

        todoButtons.push([
            { text: '🔙 할일 메뉴', callback_data: 'todo_menu' }
        ]);

        return todoButtons;
    }
}

module.exports = TodoModule;