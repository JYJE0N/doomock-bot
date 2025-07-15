const { MongoClient } = require("mongodb");

// 여러 환경 변수 시도
const mongoUrl = process.env.MONGO_URL || 
                 process.env.MONGO_PUBLIC_URL || 
                 `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.MONGOHOST}:${process.env.MONGOPORT}`;

console.log("DEBUG MONGO_URL:", mongoUrl);
console.log("🔍 All MONGO env vars:", Object.keys(process.env).filter(k => k.includes('MONGO')));

if (!mongoUrl.startsWith("mongodb://") && !mongoUrl.startsWith("mongodb+srv://")) {
  console.error("🚨 Invalid MONGO_URL detected:", mongoUrl);
  process.exit(1);  // 잘못된 URL일 때 강제 종료
}

const client = new MongoClient(mongoUrl);
let todos;
let isConnected = false;

// MongoDB 연결 함수
async function connectDB() {
  if (!isConnected) {
    try {
      await client.connect();
      console.log("✅ MongoDB Connected");
      const db = client.db("test");
      todos = db.collection("todos");
      isConnected = true;
    } catch (error) {
      console.error("❌ MongoDB Connection Error:", error.message);
      throw error;
    }
  }
}

// 연결 확인 함수
async function ensureConnection() {
  if (!isConnected) {
    await connectDB();
  }
}

// 할 일 추가
exports.addTodo = async function(userId, task) {
  try {
    await ensureConnection();
    await todos.insertOne({ 
      userId, 
      task, 
      done: false, 
      createdAt: new Date() 
    });
    console.log(`✅ Todo added for user ${userId}: ${task}`);
    return true;
  } catch (error) {
    console.error("❌ Add Todo Error:", error.message);
    return false;
  }
};

// 할 일 목록 가져오기
exports.getTodos = async function(userId) {
  try {
    await ensureConnection();
    const result = await todos.find({ userId }).sort({ createdAt: 1 }).toArray();
    console.log(`📋 Found ${result.length} todos for user ${userId}`);
    return result;
  } catch (error) {
    console.error("❌ Get Todos Error:", error.message);
    return [];
  }
};

// 모든 할 일 삭제
exports.clearTodos = async function(userId) {
  try {
    await ensureConnection();
    const result = await todos.deleteMany({ userId });
    console.log(`🗑️ Deleted ${result.deletedCount} todos for user ${userId}`);
    return true;
  } catch (error) {
    console.error("❌ Clear Todos Error:", error.message);
    return false;
  }
};

// 할 일 완료/미완료 토글
exports.toggleTodo = async function(userId, todoIndex) {
  try {
    await ensureConnection();
    const userTodos = await todos.find({ userId }).sort({ createdAt: 1 }).toArray();
    
    if (todoIndex >= 0 && todoIndex < userTodos.length) {
      const todo = userTodos[todoIndex];
      const newDoneStatus = !todo.done;
      
      await todos.updateOne(
        { _id: todo._id },
        { 
          $set: { 
            done: newDoneStatus,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log(`✅ Todo ${todoIndex + 1} toggled to ${newDoneStatus ? 'done' : 'pending'}`);
      return newDoneStatus;
    }
    console.log(`❌ Invalid todo index: ${todoIndex}`);
    return null;
  } catch (error) {
    console.error("❌ Toggle Todo Error:", error.message);
    return null;
  }
};

// 특정 할 일 삭제
exports.deleteTodo = async function(userId, todoIndex) {
  try {
    await ensureConnection();
    const userTodos = await todos.find({ userId }).sort({ createdAt: 1 }).toArray();
    
    if (todoIndex >= 0 && todoIndex < userTodos.length) {
      const todo = userTodos[todoIndex];
      await todos.deleteOne({ _id: todo._id });
      console.log(`🗑️ Todo ${todoIndex + 1} deleted`);
      return true;
    }
    console.log(`❌ Invalid todo index: ${todoIndex}`);
    return false;
  } catch (error) {
    console.error("❌ Delete Todo Error:", error.message);
    return false;
  }
};

// 할 일 수정
exports.editTodo = async function(userId, todoIndex, newTask) {
  try {
    await ensureConnection();
    const userTodos = await todos.find({ userId }).sort({ createdAt: 1 }).toArray();
    
    if (todoIndex >= 0 && todoIndex < userTodos.length) {
      const todo = userTodos[todoIndex];
      await todos.updateOne(
        { _id: todo._id },
        { 
          $set: { 
            task: newTask,
            updatedAt: new Date()
          } 
        }
      );
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Edit Todo Error:", error.message);
    return false;
  }
};

// 완료된 할 일만 삭제
exports.clearCompletedTodos = async function(userId) {
  try {
    await ensureConnection();
    const result = await todos.deleteMany({ userId, done: true });
    console.log(`🗑️ Deleted ${result.deletedCount} completed todos`);
    return true;
  } catch (error) {
    console.error("❌ Clear Completed Todos Error:", error.message);
    return false;
  }
};

// 할 일 통계
exports.getTodoStats = async function(userId) {
  try {
    await ensureConnection();
    const allTodos = await todos.find({ userId }).toArray();
    const completed = allTodos.filter(todo => todo.done).length;
    const pending = allTodos.length - completed;
    
    return {
      total: allTodos.length,
      completed: completed,
      pending: pending,
      completionRate: allTodos.length > 0 ? Math.round((completed / allTodos.length) * 100) : 0
    };
  } catch (error) {
    console.error("❌ Get Todo Stats Error:", error.message);
    return {
      total: 0,
      completed: 0,
      pending: 0,
      completionRate: 0
    };
  }
};

// 데이터베이스 연결 종료
exports.closeConnection = async function() {
  try {
    await client.close();
    console.log("✅ MongoDB Connection Closed");
    isConnected = false;
  } catch (error) {
    console.error("❌ Close Connection Error:", error.message);
  }
};

// 초기 연결
connectDB().catch(console.error);
