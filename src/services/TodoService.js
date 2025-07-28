// src/services/TodoService.js - 최종 수정 버전

const logger = require("../utils/Logger");
const { ObjectId } = require("mongodb");

// 그 어떤 것도 상속하지 않는 독립적인 클래스입니다.
class TodoService {
  /**
   * 생성자에서는 dbManager만 받습니다.
   * @param {object} options
   * @param {DatabaseManager} options.dbManager
   */
  constructor({ dbManager }) {
    if (!dbManager) {
      throw new Error(
        "DatabaseManager (dbManager) is required for TodoService."
      );
    }
    this.dbManager = dbManager;
    this.Todo = this.dbManager.getModel("Todo");

    if (!this.Todo) {
      throw new Error("DatabaseManager에서 Todo 모델을 찾을 수 없습니다.");
    }
  }

  // initialize 함수는 ServiceBuilder가 호출해줍니다.
  async initialize() {
    logger.success("✅ TodoService 초기화 완료 (독립 클래스).");
  }

  // ObjectId 생성을 위한 헬퍼 함수
  getObjectId(id) {
    try {
      return new ObjectId(id);
    } catch (error) {
      logger.error(`Invalid ObjectId format: ${id}`, error);
      return null;
    }
  }

  async getTodos(userId) {
    return await this.Todo.find({ userId: String(userId) }).sort({
      createdAt: -1,
    });
  }

  async addTodo(userId, text) {
    return await this.Todo.create({
      userId: String(userId),
      text,
      completed: false,
    });
  }

  async toggleTodo(userId, todoId) {
    const todo = await this.Todo.findOne({
      _id: this.getObjectId(todoId),
      userId: String(userId),
    });
    if (!todo) return null;

    todo.completed = !todo.completed;
    await todo.save();
    return todo;
  }

  async deleteTodo(userId, todoId) {
    const result = await this.Todo.deleteOne({
      _id: this.getObjectId(todoId),
      userId: String(userId),
    });
    return result.deletedCount > 0;
  }
}

module.exports = TodoService;
