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
const drawingWords = ['Máy bay', 'Con nhím', 'Bánh sinh nhật', 'Cây xương rồng', 'Cầu vồng', 'Đồng hồ'];
const bluffPrompts = [
  { question: 'Một con ốc sên có thể ngủ liên tục tối đa khoảng bao lâu?', answer: 'Ba năm' },
  { question: 'Mật ong được phát hiện trong lăng mộ Ai Cập cổ đại có tuổi đời khoảng bao nhiêu?', answer: '3.000 năm' },
  { question: 'Ở Nhật Bản, có loại dưa hấu nào thường được trồng trong khuôn thành hình gì?', answer: 'Hình vuông' },
];
const drawingRounds = 3;
const bluffRounds = bluffPrompts.length;

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
    game: room.game,
    players: [...room.players.values()].map(({ id, name, avatar, score }) => ({ id, name, avatar, score })),
    answerCount: room.phase === 'bluff-vote' ? room.votes.size : room.answers.size,
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

function finishGame(room) {
  room.phase = 'finished';
  const state = roomState(room);
  io.to(room.code).emit('game:finished', { room: state });
  broadcastRoom(room);
}

function normalizedText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

function launchDrawingTurn(room) {
  const players = [...room.players.values()];
  if (room.drawRoundIndex >= drawingRounds || players.length === 0) return finishGame(room);
  const drawer = players[room.drawRoundIndex % players.length];
  const word = drawingWords[randomInt(drawingWords.length)];
  room.currentDrawerId = drawer.id;
  room.currentWord = word;
  room.correctGuessers = new Set();
  room.strokes = [];
  room.phase = 'drawing';
  room.deadline = Date.now() + 60_000;
  io.to(room.code).emit('draw:turn', {
    drawer: { id: drawer.id, name: drawer.name, avatar: drawer.avatar },
    roundNumber: room.drawRoundIndex + 1,
    totalRounds: drawingRounds,
    deadline: room.deadline,
  });
  io.to(drawer.id).emit('draw:secret', { word });
  broadcastRoom(room);
  room.timer = setTimeout(() => finishDrawingTurn(room), 60_000);
}

function finishDrawingTurn(room) {
  if (room.phase !== 'drawing') return;
  clearTimeout(room.timer);
  const drawer = room.players.get(room.currentDrawerId);
  if (drawer && room.correctGuessers.size > 0) drawer.score += 300;
  room.phase = 'draw-results';
  io.to(room.code).emit('draw:turn-results', {
    word: room.currentWord,
    drawerId: room.currentDrawerId,
    correctGuessers: [...room.correctGuessers].map((id) => {
      const player = room.players.get(id);
      return player ? { id, name: player.name, avatar: player.avatar } : null;
    }).filter(Boolean),
    roundNumber: room.drawRoundIndex + 1,
    totalRounds: drawingRounds,
  });
  broadcastRoom(room);
}

function launchBluffPrompt(room) {
  if (room.bluffRoundIndex >= bluffRounds) return finishGame(room);
  const prompt = bluffPrompts[room.bluffRoundIndex];
  room.answers.clear();
  room.votes.clear();
  room.phase = 'bluff-submit';
  room.deadline = Date.now() + 60_000;
  io.to(room.code).emit('bluff:prompt', {
    question: prompt.question,
    roundNumber: room.bluffRoundIndex + 1,
    totalRounds: bluffRounds,
    deadline: room.deadline,
  });
  broadcastRoom(room);
  room.timer = setTimeout(() => launchBluffVote(room), 60_000);
}

function launchBluffVote(room) {
  if (room.phase !== 'bluff-submit') return;
  clearTimeout(room.timer);
  const prompt = bluffPrompts[room.bluffRoundIndex];
  const choices = [
    { id: 'truth', text: prompt.answer },
    ...[...room.answers.entries()].map(([id, text]) => ({ id, text })),
  ].sort(() => Math.random() - 0.5);
  room.bluffChoices = choices;
  room.phase = 'bluff-vote';
  room.deadline = Date.now() + 45_000;
  io.to(room.code).emit('bluff:vote', {
    question: prompt.question,
    choices,
    roundNumber: room.bluffRoundIndex + 1,
    totalRounds: bluffRounds,
    deadline: room.deadline,
  });
  broadcastRoom(room);
  room.timer = setTimeout(() => finishBluffRound(room), 45_000);
  if (room.players.size === 0 || room.votes.size === room.players.size) finishBluffRound(room);
}

function finishBluffRound(room) {
  if (room.phase !== 'bluff-vote') return;
  clearTimeout(room.timer);
  const prompt = bluffPrompts[room.bluffRoundIndex];
  const voteCounts = new Map();
  for (const choiceId of room.votes.values()) voteCounts.set(choiceId, (voteCounts.get(choiceId) || 0) + 1);
  for (const [playerId, choiceId] of room.votes) {
    if (choiceId === 'truth') {
      const player = room.players.get(playerId);
      if (player) player.score += 500;
    } else {
      const author = room.players.get(choiceId);
      if (author) author.score += 250;
    }
  }
  room.phase = 'bluff-results';
  io.to(room.code).emit('bluff:results', {
    question: prompt.question,
    answer: prompt.answer,
    choices: room.bluffChoices.map((choice) => ({
      ...choice,
      isCorrect: choice.id === 'truth',
      votes: voteCounts.get(choice.id) || 0,
      authorName: choice.id === 'truth' ? null : room.players.get(choice.id)?.name || 'Người chơi đã rời phòng',
    })),
    roundNumber: room.bluffRoundIndex + 1,
    totalRounds: bluffRounds,
  });
  broadcastRoom(room);
}

io.on('connection', (socket) => {
  socket.on('room:create', () => {
    const code = makeCode();
    const room = { code, hostId: socket.id, players: new Map(), phase: 'lobby', game: 'quiz', questionIndex: 0, answers: new Map(), votes: new Map(), timer: null };
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

  socket.on('room:set-game', ({ code, game } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!isHost(socket, room)) return;
    if (room.phase !== 'lobby') return sendError(socket, 'Chỉ có thể đổi game trong phòng chờ.');
    if (!['quiz', 'drawing', 'bluff'].includes(game)) return sendError(socket, 'Game này chưa được hỗ trợ.');
    room.game = game;
    broadcastRoom(room);
  });

  socket.on('game:start', ({ code } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!isHost(socket, room)) return;
    if (room.phase !== 'lobby') return sendError(socket, 'Phòng này không ở trạng thái chờ.');
    const minimumPlayers = room.game === 'quiz' ? 1 : 2;
    if (room.players.size < minimumPlayers) return sendError(socket, `Cần ít nhất ${minimumPlayers} người chơi để bắt đầu game này.`);
    for (const player of room.players.values()) player.score = 0;
    if (room.game === 'drawing') {
      room.drawRoundIndex = 0;
      launchDrawingTurn(room);
    } else if (room.game === 'bluff') {
      room.bluffRoundIndex = 0;
      launchBluffPrompt(room);
    } else {
      room.questionIndex = 0;
      launchQuestion(room);
    }
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
    if (room.game === 'drawing' && room.phase === 'draw-results') {
      room.drawRoundIndex += 1;
      launchDrawingTurn(room);
      return;
    }
    if (room.game === 'bluff' && room.phase === 'bluff-results') {
      room.bluffRoundIndex += 1;
      launchBluffPrompt(room);
      return;
    }
    if (room.phase !== 'results') return;
    room.questionIndex += 1;
    if (room.questionIndex >= questionSet.length) {
      finishGame(room);
      return;
    }
    launchQuestion(room);
  });

  socket.on('draw:stroke', ({ code, segment } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!room || room.phase !== 'drawing' || socket.id !== room.currentDrawerId) return;
    const { x1, y1, x2, y2, color, width } = segment || {};
    if (![x1, y1, x2, y2, width].every(Number.isFinite) || [x1, y1, x2, y2].some((point) => point < 0 || point > 1)) return;
    const safeSegment = { x1, y1, x2, y2, color: ['#173a34', '#f9795b', '#79c8e5', '#e4b93f', '#f1f6f0'].includes(color) ? color : '#173a34', width: Math.max(0.002, Math.min(width, 0.04)) };
    room.strokes.push(safeSegment);
    socket.to(room.code).emit('draw:stroke', safeSegment);
  });

  socket.on('draw:clear', ({ code } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!room || room.phase !== 'drawing' || socket.id !== room.currentDrawerId) return;
    room.strokes = [];
    io.to(room.code).emit('draw:clear');
  });

  socket.on('draw:guess', ({ code, guess } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    const player = room?.players.get(socket.id);
    if (!player || room.phase !== 'drawing' || socket.id === room.currentDrawerId || room.correctGuessers.has(socket.id)) return;
    const submittedGuess = String(guess || '').trim().slice(0, 60);
    if (!submittedGuess) return;
    const isCorrect = normalizedText(submittedGuess) === normalizedText(room.currentWord);
    if (isCorrect) {
      room.correctGuessers.add(socket.id);
      player.score += 500;
    }
    socket.emit('draw:guess-result', { isCorrect, guess: submittedGuess });
    io.to(room.code).emit('draw:progress', {
      correctCount: room.correctGuessers.size,
      playerCount: Math.max(0, room.players.size - 1),
      player: { id: player.id, name: player.name, avatar: player.avatar },
      isCorrect,
    });
    broadcastRoom(room);
    if (room.correctGuessers.size >= room.players.size - 1) finishDrawingTurn(room);
  });

  socket.on('bluff:submit', ({ code, answer } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    const player = room?.players.get(socket.id);
    if (!player || room.phase !== 'bluff-submit' || room.answers.has(socket.id)) return;
    const submission = String(answer || '').trim().slice(0, 100);
    if (!submission) return sendError(socket, 'Hãy nhập một đáp án nghe thật thuyết phục.');
    if (normalizedText(submission) === normalizedText(bluffPrompts[room.bluffRoundIndex].answer)) return sendError(socket, 'Đáp án thật chưa phải đáp án giả đâu nhé.');
    room.answers.set(socket.id, submission);
    socket.emit('bluff:submitted');
    broadcastRoom(room);
    if (room.answers.size === room.players.size) launchBluffVote(room);
  });

  socket.on('bluff:vote', ({ code, choiceId } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!room?.players.has(socket.id) || room.phase !== 'bluff-vote' || room.votes.has(socket.id)) return;
    const choice = room.bluffChoices.find((item) => item.id === choiceId);
    if (!choice || choice.id === socket.id) return;
    room.votes.set(socket.id, choiceId);
    socket.emit('bluff:voted');
    broadcastRoom(room);
    if (room.votes.size === room.players.size) finishBluffRound(room);
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
        room.votes.delete(socket.id);
        broadcastRoom(room);
        if (room.phase === 'question' && room.players.size > 0 && room.answers.size === room.players.size) revealResults(room);
        if (room.phase === 'drawing' && socket.id === room.currentDrawerId) finishDrawingTurn(room);
        if (room.phase === 'drawing' && room.correctGuessers.size >= room.players.size - 1) finishDrawingTurn(room);
        if (room.phase === 'bluff-submit' && room.answers.size === room.players.size) launchBluffVote(room);
        if (room.phase === 'bluff-vote' && room.votes.size === room.players.size) finishBluffRound(room);
        break;
      }
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Family Game Hub server listening on ${PORT}`);
});