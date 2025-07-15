const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGO_URL);
let todos;

(async () => {
  await client.connect();
  console.log("✅ MongoDB Connected");
  const db = client.db("doomock");
  todos = db.collection("todos");
})();

exports.addTodo = async function(userId, task) {
  await todos.insertOne({ userId, task, done: false, createdAt: new Date() });
};

exports.getTodos = async function(userId) {
  return await todos.find({ userId }).toArray();
};

exports.clearTodos = async function(userId) {
  await todos.deleteMany({ userId });
};
