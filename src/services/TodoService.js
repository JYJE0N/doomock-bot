const { DatabaseManager } = require('../database/DatabaseManager');
const { TodoService } = require ('../services/TodoService')
const  Logger  = require('../utils/Logger');

class TodoService {
    constructor() {
        this.collectionName = 'todos';
    }

    async addTodo(userId, task) {
        try {
            await DatabaseManager.ensureConnection();
            const collection = DatabaseManager.getCollection(this.collectionName);
            
            const todoItem = {
                userId: userId.toString(),
                task: task,
                done: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await collection.insertOne(todoItem);
            Logger.info(`할일 추가: 사용자 ${userId}, 작업 "${task}"`);
            return true;
        } catch (error) {
            Logger.error('할일 추가 오류:', error);
            return false;
        }
    }

    async getTodos(userId) {
        try {
            await DatabaseManager.ensureConnection();
            const collection = DatabaseManager.getCollection(this.collectionName);
            
            const todos = await collection
                .find({ userId: userId.toString() })
                .sort({ createdAt: 1 })
                .toArray();
            
            return todos;
        } catch (error) {
            Logger.error('할일 목록 조회 오류:', error);
            return [];
        }
    }

    async toggleTodo(userId, todoIndex) {
        try {
            await DatabaseManager.ensureConnection();
            const collection = DatabaseManager.getCollection(this.collectionName);
            
            const todos = await this.getTodos(userId);
            if (todoIndex < 0 || todoIndex >= todos.length) {
                return null;
            }

            const todo = todos[todoIndex];
            const newDoneStatus = !todo.done;

            await collection.updateOne(
                { _id: todo._id },
                { 
                    $set: { 
                        done: newDoneStatus,
                        updatedAt: new Date()
                    } 
                }
            );

            Logger.info(`할일 토글: 사용자 ${userId}, 인덱스 ${todoIndex}, 상태 ${newDoneStatus}`);
            return newDoneStatus;
        } catch (error) {
            Logger.error('할일 토글 오류:', error);
            return null;
        }
    }

    async deleteTodo(userId, todoIndex) {
        try {
            await DatabaseManager.ensureConnection();
            const collection = DatabaseManager.getCollection(this.collectionName);
            
            const todos = await this.getTodos(userId);
            if (todoIndex < 0 || todoIndex >= todos.length) {
                return false;
            }

            const todo = todos[todoIndex];
            await collection.deleteOne({ _id: todo._id });

            Logger.info(`할일 삭제: 사용자 ${userId}, 인덱스 ${todoIndex}`);
            return true;
        } catch (error) {
            Logger.error('할일 삭제 오류:', error);
            return false;
        }
    }

    async clearCompletedTodos(userId) {
        try {
            await DatabaseManager.ensureConnection();
            const collection = DatabaseManager.getCollection(this.collectionName);
            
            const result = await collection.deleteMany({ 
                userId: userId.toString(), 
                done: true 
            });

            Logger.info(`완료된 할일 삭제: 사용자 ${userId}, 삭제된 개수 ${result.deletedCount}`);
            return true;
        } catch (error) {
            Logger.error('완료된 할일 삭제 오류:', error);
            return false;
        }
    }

    async clearAllTodos(userId) {
        try {
            await DatabaseManager.ensureConnection();
            const collection = DatabaseManager.getCollection(this.collectionName);
            
            const result = await collection.deleteMany({ 
                userId: userId.toString()
            });

            Logger.info(`모든 할일 삭제: 사용자 ${userId}, 삭제된 개수 ${result.deletedCount}`);
            return true;
        } catch (error) {
            Logger.error('모든 할일 삭제 오류:', error);
            return false;
        }
    }

    async getTodoStats(userId) {
        try {
            const todos = await this.getTodos(userId);
            const completed = todos.filter(todo => todo.done).length;
            const pending = todos.length - completed;
            const completionRate = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0;

            return {
                total: todos.length,
                completed: completed,
                pending: pending,
                completionRate: completionRate
            };
        } catch (error) {
            Logger.error('할일 통계 조회 오류:', error);
            return {
                total: 0,
                completed: 0,
                pending: 0,
                completionRate: 0
            };
        }
    }
}

module.exports = { TodoService };