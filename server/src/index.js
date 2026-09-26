import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });
const PORT = Number(process.env.PORT) || 3001;
const roomMap = new Map();
const roomAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const avatars = new Set(['🦊', '🐼', '🐸', '🐯', '🐰', '🐻', '🐙', '🦄']);
const questionSet = [
  { text: 'Loài động vật nào ngủ đứng?', options: ['Ngựa', 'Rái cá', 'Gấu trúc', 'Cá heo'], answer: 0 },
  { text: 'Một chiếc bánh pizza thường được cắt thành mấy phần tư nếu cắt làm 4?', options: ['Hai', 'Ba', 'Bốn', 'Sáu'], answer: 2 },
  { text: 'Hành tinh nào được gọi là hành tinh đỏ?', options: ['Sao Kim', 'Sao Hỏa', 'Sao Mộc', 'Sao Thủy'], answer: 1 },
  { text: 'Con vật nào có ba trái tim?', options: ['Cá mập', 'Bạch tuộc', 'Rùa biển', 'Chim cánh cụt'], answer: 1 },
  { text: 'Cầu vồng có bao nhiêu màu cơ bản thường được nhắc đến?', options: ['Năm', 'Sáu', 'Bảy', 'Tám'], answer: 2 },
];

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.get('/health', (_request, response) => response.json({ ok: true, rooms: roomMap.size }));

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => roomAlphabet[randomInt(roomAlphabet.length)]).join('');
  } while (roomMap.has(code));
  return code;
}

function publicQuestion(question) {
  return { text: question.text, options: question.options };
}

function roomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    players: [...room.players.values()].map(({ id, name, avatar, score }) => ({ id, name, avatar, score })),
    answerCount: room.answers.size,
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit('room:update', roomState(room));
}

function sendError(socket, message) {
  socket.emit('room:error', message);
}

function isHost(socket, room) {
  if (!room || room.hostId !== socket.id) {
    sendError(socket, 'Chỉ chủ phòng mới có thể thực hiện thao tác này.');
    return false;
  }
  return true;
}

function revealResults(room) {
  if (room.phase !== 'question') return;
  clearTimeout(room.timer);
  const question = questionSet[room.questionIndex];
  const answers = [...room.players.values()].map((player) => {
    const submitted = room.answers.get(player.id);
    const isCorrect = submitted?.answerIndex === question.answer;
    const timeBonus = submitted ? Math.max(0, Math.ceil((room.deadline - submitted.answeredAt) / room.duration * 500)) : 0;
    const pointsEarned = isCorrect ? 500 + timeBonus : 0;
    player.score += pointsEarned;
    return {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      answerIndex: submitted?.answerIndex ?? null,
      isCorrect,
      pointsEarned,
    };
  });
  room.phase = 'results';
  const result = {
    question: publicQuestion(question),
    correctIndex: question.answer,
    questionNumber: room.questionIndex + 1,
    totalQuestions: questionSet.length,
    answers,
  };
  io.to(room.code).emit('game:results', result);
  broadcastRoom(room);
}

function launchQuestion(room) {
  room.phase = 'question';
  room.answers.clear();
  room.duration = 20_000;
  room.deadline = Date.now() + room.duration;
  io.to(room.code).emit('game:question', {
    question: publicQuestion(questionSet[room.questionIndex]),
    questionNumber: room.questionIndex + 1,
    totalQuestions: questionSet.length,
    deadline: room.deadline,
  });
  broadcastRoom(room);
  room.timer = setTimeout(() => revealResults(room), room.duration);
}

io.on('connection', (socket) => {
  socket.on('room:create', () => {
    const code = makeCode();
    const room = { code, hostId: socket.id, players: new Map(), phase: 'lobby', questionIndex: 0, answers: new Map(), timer: null };
    roomMap.set(code, room);
    socket.join(code);
    socket.emit('room:created', roomState(room));
  });

  socket.on('room:join', ({ code, name, avatar } = {}) => {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const room = roomMap.get(normalizedCode);
    const normalizedName = String(name || '').trim().slice(0, 18);
    if (!room) return sendError(socket, 'Không tìm thấy phòng. Kiểm tra lại mã phòng nhé.');
    if (room.phase !== 'lobby') return sendError(socket, 'Ván chơi đã bắt đầu, bạn không thể vào lúc này.');
    if (!normalizedName) return sendError(socket, 'Hãy nhập tên để mọi người nhận ra bạn.');
    if (room.players.size >= 12) return sendError(socket, 'Phòng đã đủ 12 người chơi rồi.');
    room.players.set(socket.id, { id: socket.id, name: normalizedName, avatar: avatars.has(avatar) ? avatar : '🦊', score: 0 });
    socket.join(normalizedCode);
    socket.emit('room:joined', roomState(room));
    broadcastRoom(room);
  });

  socket.on('game:start', ({ code } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!isHost(socket, room)) return;
    if (room.phase !== 'lobby' || room.players.size === 0) return sendError(socket, 'Cần ít nhất một người chơi trong phòng để bắt đầu.');
    room.questionIndex = 0;
    for (const player of room.players.values()) player.score = 0;
    launchQuestion(room);
  });

  socket.on('game:answer', ({ code, answerIndex } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    const player = room?.players.get(socket.id);
    if (!player || room.phase !== 'question' || room.answers.has(socket.id)) return;
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return;
    room.answers.set(socket.id, { answerIndex, answeredAt: Date.now() });
    broadcastRoom(room);
    if (room.answers.size === room.players.size) revealResults(room);
  });

  socket.on('game:next', ({ code } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!isHost(socket, room)) return;
    if (room.phase !== 'results') return;
    room.questionIndex += 1;
    if (room.questionIndex >= questionSet.length) {
      room.phase = 'finished';
      const state = roomState(room);
      io.to(room.code).emit('game:finished', { room: state });
      broadcastRoom(room);
      return;
    }
    launchQuestion(room);
  });

  socket.on('disconnect', () => {
    for (const room of roomMap.values()) {
      if (room.hostId === socket.id) {
        clearTimeout(room.timer);
        io.to(room.code).emit('room:closed');
        roomMap.delete(room.code);
        break;
      }
      if (room.players.delete(socket.id)) {
        room.answers.delete(socket.id);
        broadcastRoom(room);
        if (room.phase === 'question' && room.players.size > 0 && room.answers.size === room.players.size) revealResults(room);
        break;
      }
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Family Game Hub server listening on ${PORT}`);
});