// todo.js - 할일 관리 모듈

let todos = {}; // 사용자별 할일 저장 (메모리)

function handleTodo(bot, msg) {
 const text = msg.text;
 const chatId = msg.chat.id;
 const userId = msg.from.id;

 // 사용자별 할일 목록 초기화
 if (!todos[userId]) {
   todos[userId] = [];
 }

 try {
   if (text.startsWith('/add ')) {
     // 할일 추가
     const todoText = text.slice(5).trim();
     if (todoText) {
       const todoItem = {
         id: Date.now(),
         text: todoText,
         completed: false,
         createdAt: new Date()
       };
       todos[userId].push(todoItem);
       bot.sendMessage(chatId, `✅ 할일이 추가되었습니다: "${todoText}"`);
     } else {
       bot.sendMessage(chatId, '❌ 할일 내용을 입력해주세요.\n사용법: /add 할일내용');
     }

   } else if (text === '/todo' || text === '/list') {
     // 할일 목록 표시
     const userTodos = todos[userId];
     if (userTodos.length === 0) {
       bot.sendMessage(chatId, '📝 등록된 할일이 없습니다.\n/add 할일내용 으로 추가해보세요!');
     } else {
       let message = '📋 **할일 목록**\n\n';
       userTodos.forEach((todo, index) => {
         const status = todo.completed ? '✅' : '📌';
         message += `${index + 1}. ${status} ${todo.text}\n`;
       });
       message += `\n총 ${userTodos.length}개의 할일`;
       bot.sendMessage(chatId, message);
     }

   } else if (text.startsWith('/done ')) {
     // 할일 완료 처리
     const todoNumber = parseInt(text.slice(6).trim());
     const userTodos = todos[userId];
     
     if (isNaN(todoNumber) || todoNumber < 1 || todoNumber > userTodos.length) {
       bot.sendMessage(chatId, '❌ 올바른 할일 번호를 입력해주세요.\n사용법: /done 번호');
     } else {
       const todoIndex = todoNumber - 1;
       userTodos[todoIndex].completed = true;
       bot.sendMessage(chatId, `✅ "${userTodos[todoIndex].text}" 완료 처리되었습니다!`);
     }

   } else if (text.startsWith('/delete ')) {
     // 할일 삭제
     const todoNumber = parseInt(text.slice(8).trim());
     const userTodos = todos[userId];
     
     if (isNaN(todoNumber) || todoNumber < 1 || todoNumber > userTodos.length) {
       bot.sendMessage(chatId, '❌ 올바른 할일 번호를 입력해주세요.\n사용법: /delete 번호');
     } else {
       const todoIndex = todoNumber - 1;
       const deletedTodo = userTodos.splice(todoIndex, 1)[0];
       bot.sendMessage(chatId, `🗑️ "${deletedTodo.text}" 가 삭제되었습니다.`);
     }

   } else if (text === '/clear') {
     // 모든 할일 삭제
     const userTodos = todos[userId];
     if (userTodos.length === 0) {
       bot.sendMessage(chatId, '📝 삭제할 할일이 없습니다.');
     } else {
       const count = userTodos.length;
       todos[userId] = [];
       bot.sendMessage(chatId, `🗑️ 모든 할일(${count}개)이 삭제되었습니다.`);
     }

   } else if (text.startsWith('/todo')) {
     // 기타 todo 관련 명령어 도움말
     const helpMessage = `
📝 **할일 관리 명령어**

/add 할일내용 - 새 할일 추가
/todo 또는 /list - 할일 목록 보기
/done 번호 - 할일 완료 처리
/delete 번호 - 할일 삭제
/clear - 모든 할일 삭제

**사용 예시:**
/add 장보기
/done 1
/delete 2
     `;
     bot.sendMessage(chatId, helpMessage);
   }

 } catch (error) {
   console.error('Todo 처리 중 오류:', error);
   bot.sendMessage(chatId, '❌ 할일 처리 중 오류가 발생했습니다.');
 }
}

// 함수 export (이 부분이 중요!)
module.exports = handleTodo;
