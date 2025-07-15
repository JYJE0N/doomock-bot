const { MongoClient } = require("mongodb");

// 여러 환경 변수 시도
const mongoUrl = process.env.MONGO_URL || 
                 process.env.MONGO_PUBLIC_URL || 
                 `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.MONGOHOST}:${process.env.MONGOPORT}`;

console.log("DEBUG MONGO_URL:", mongoUrl);
console.log("🔍 All MONGO env vars:", Object.keys(process.env).filter(k => k.includes('MONGO')));

const client = new MongoClient(mongoUrl);
let todos;

(async () => {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected");
    const db = client.db("doomock");
    todos = db.collection("todos");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
  }
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
