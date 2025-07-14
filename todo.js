class TodoManager {
  constructor() {
    this.todos = new Map(); // chatId -> []
  }

  get(chatId) {
    return this.todos.get(chatId) || [];
  }

  add(chatId, text) {
    const list = this.get(chatId);
    list.push({ text, completed: false, createdAt: new Date() });
    this.todos.set(chatId, list);
  }

  complete(chatId, index) {
    const list = this.get(chatId);
    if (list[index]) {
      list[index].completed = true;
      return true;
    }
    return false;
  }

  delete(chatId, index) {
    const list = this.get(chatId);
    if (list[index]) {
      list.splice(index, 1);
      return true;
    }
    return false;
  }
}
module.exports = new TodoManager();
