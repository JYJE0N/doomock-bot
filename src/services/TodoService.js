// src/services/TodoService.js - 최종 수정 버전

const logger = require("../utils/Logger");

class TodoService extends BaseService {
  constructor(options) {
    super(options); // 부모인 BaseService에 { dbManager } 등을 전달
    // DatabaseManager로부터 Todo 모델을 받아와서 클래스 속성으로 저장합니다.
    this.Todo = this.dbManager.getModel("Todo");

    // 모델을 받아오지 못했다면, 치명적인 오류를 발생시켜 문제를 즉시 알립니다.
    if (!this.Todo) {
      throw new Error("DatabaseManager에서 Todo 모델을 찾을 수 없습니다.");
    }
  }

  async initialize() {
    // 인덱스 생성 로직 등은 이미 DatabaseManager가 처리하므로, 여기서는 할 필요가 없습니다.
    logger.success("✅ TodoService 초기화 완료 (모델 사용).");
  }

  async getTodos(userId) {
    // 이제 this.collection 대신 this.Todo 모델을 사용합니다.
    return await this.Todo.find({ userId: String(userId) }).sort({
      createdAt: -1,
    });
  }

  async addTodo(userId, text) {
    const newTodo = {
      userId: String(userId),
      text,
      completed: false,
    };
    // 모델을 사용하여 새로운 데이터를 생성합니다.
    return await this.Todo.create(newTodo);
  }

  async toggleTodo(userId, todoId) {
    const todo = await this.Todo.findOne({
      _id: this.getObjectId(todoId),
      userId: String(userId),
    });
    if (!todo) return null;

    todo.completed = !todo.completed;
    await todo.save(); // 모델 인스턴스의 save 메서드를 사용합니다.
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
