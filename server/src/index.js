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
const questionsPerGame = 10;
const questionTopics = {
  history: {
    label: 'Lịch sử Việt Nam',
    questions: [
      { text: 'Năm 1010, vua Lý Thái Tổ dời đô từ Hoa Lư đến đâu?', options: ['Thăng Long', 'Phú Xuân', 'Cổ Loa', 'Tây Đô'], answer: 0 },
      { text: 'Ai chỉ huy quân Đại Việt trong chiến thắng Bạch Đằng năm 938?', options: ['Ngô Quyền', 'Lê Hoàn', 'Trần Quốc Tuấn', 'Lý Thường Kiệt'], answer: 0 },
      { text: 'Ai là lãnh tụ cuộc khởi nghĩa Lam Sơn chống quân Minh?', options: ['Lê Lợi', 'Nguyễn Huệ', 'Phan Bội Châu', 'Đinh Bộ Lĩnh'], answer: 0 },
      { text: 'Tác phẩm Bình Ngô đại cáo gắn liền với danh nhân nào?', options: ['Nguyễn Trãi', 'Chu Văn An', 'Nguyễn Du', 'Lê Quý Đôn'], answer: 0 },
      { text: 'Vua Quang Trung đại phá quân Thanh vào mùa xuân năm nào?', options: ['1789', '1771', '1802', '1858'], answer: 0 },
      { text: 'Ai đọc Tuyên ngôn Độc lập tại Quảng trường Ba Đình ngày 2/9/1945?', options: ['Hồ Chí Minh', 'Võ Nguyên Giáp', 'Phạm Văn Đồng', 'Tôn Đức Thắng'], answer: 0 },
      { text: 'Chiến thắng Điện Biên Phủ diễn ra vào năm nào?', options: ['1954', '1945', '1968', '1975'], answer: 0 },
      { text: 'Ngày thống nhất đất nước được kỷ niệm vào ngày nào?', options: ['30/4/1975', '2/9/1945', '7/5/1954', '19/8/1945'], answer: 0 },
      { text: 'Ai chỉ huy chiến thắng trên sông Bạch Đằng năm 1288?', options: ['Trần Quốc Tuấn', 'Ngô Quyền', 'Lê Lợi', 'Lý Công Uẩn'], answer: 0 },
      { text: 'Nhà nước Đại Cồ Việt được thành lập dưới triều đại của ai?', options: ['Đinh Tiên Hoàng', 'Lý Thái Tổ', 'Trần Thái Tông', 'Lê Thánh Tông'], answer: 0 },
      { text: 'Phong trào Đông Du đầu thế kỷ 20 gắn với nhà yêu nước nào?', options: ['Phan Bội Châu', 'Nguyễn Trãi', 'Trương Định', 'Nguyễn Du'], answer: 0 },
      { text: 'Chiến thắng Ngọc Hồi – Đống Đa gắn với vị vua nào?', options: ['Quang Trung', 'Gia Long', 'Minh Mạng', 'Tự Đức'], answer: 0 },
    ],
  },
  geography: {
    label: 'Địa lý Việt Nam',
    questions: [
      { text: 'Đỉnh núi cao nhất Việt Nam là đỉnh nào?', options: ['Fansipan', 'Bạch Mã', 'Langbiang', 'Núi Bà Đen'], answer: 0 },
      { text: 'Vịnh Hạ Long nằm bên bờ vùng biển nào?', options: ['Vịnh Bắc Bộ', 'Vịnh Thái Lan', 'Biển Andaman', 'Biển Java'], answer: 0 },
      { text: 'Sông nào bồi đắp nên đồng bằng lớn ở miền Bắc Việt Nam?', options: ['Sông Hồng', 'Sông Đồng Nai', 'Sông Thu Bồn', 'Sông Ba'], answer: 0 },
      { text: 'Đồng bằng sông Cửu Long nằm chủ yếu ở miền nào?', options: ['Nam Bộ', 'Bắc Bộ', 'Tây Bắc', 'Bắc Trung Bộ'], answer: 0 },
      { text: 'Việt Nam có đường biên giới trên đất liền với những nước nào?', options: ['Trung Quốc, Lào, Campuchia', 'Thái Lan, Lào, Myanmar', 'Trung Quốc, Thái Lan, Campuchia', 'Lào, Malaysia, Campuchia'], answer: 0 },
      { text: 'Đảo lớn nhất Việt Nam là đảo nào?', options: ['Phú Quốc', 'Cát Bà', 'Lý Sơn', 'Côn Đảo'], answer: 0 },
      { text: 'Thành phố Huế gắn với dòng sông nào?', options: ['Sông Hương', 'Sông Hàn', 'Sông Đà', 'Sông Tiền'], answer: 0 },
      { text: 'Cao nguyên nào nổi tiếng với hoạt động trồng cà phê ở Việt Nam?', options: ['Tây Nguyên', 'Mộc Châu', 'Đồng Văn', 'Trùng Khánh'], answer: 0 },
      { text: 'Sông Mekong khi chảy vào Việt Nam thường được gọi là gì?', options: ['Sông Cửu Long', 'Sông Lam', 'Sông Mã', 'Sông Lô'], answer: 0 },
      { text: 'Dãy núi nào chạy dọc phần lớn biên giới phía tây Việt Nam?', options: ['Trường Sơn', 'Hoàng Liên Sơn', 'Tam Đảo', 'Bạch Mã'], answer: 0 },
      { text: 'Sa Pa thuộc khu vực địa lý nào của Việt Nam?', options: ['Tây Bắc', 'Đông Nam Bộ', 'Tây Nguyên', 'Đồng bằng sông Cửu Long'], answer: 0 },
      { text: 'Địa hình karst với nhiều đảo đá vôi là nét đặc trưng của nơi nào?', options: ['Vịnh Hạ Long', 'Mũi Cà Mau', 'Đồng bằng sông Hồng', 'Côn Đảo'], answer: 0 },
    ],
  },
  culture: {
    label: 'Văn hóa, xã hội',
    questions: [
      { text: 'Tết Nguyên đán được tính theo loại lịch nào?', options: ['Âm lịch', 'Dương lịch', 'Lịch Julius', 'Lịch Maya'], answer: 0 },
      { text: 'Áo dài thường được xem là trang phục truyền thống của nước nào?', options: ['Việt Nam', 'Nhật Bản', 'Ấn Độ', 'Mông Cổ'], answer: 0 },
      { text: 'Dân ca quan họ gắn với vùng văn hóa nào?', options: ['Kinh Bắc', 'Tây Nguyên', 'Nam Bộ', 'Tây Bắc'], answer: 0 },
      { text: 'Nhã nhạc cung đình nổi tiếng gắn với cố đô nào?', options: ['Huế', 'Hoa Lư', 'Thăng Long', 'Cổ Loa'], answer: 0 },
      { text: 'Múa rối nước truyền thống phát triển từ vùng nào?', options: ['Đồng bằng Bắc Bộ', 'Cao nguyên đá', 'Đồng bằng Nam Bộ', 'Duyên hải Nam Trung Bộ'], answer: 0 },
      { text: 'Theo truyền thuyết, bánh chưng có hình gì?', options: ['Hình vuông', 'Hình tròn', 'Hình tam giác', 'Hình trụ dài'], answer: 0 },
      { text: 'Nhạc cụ cồng chiêng gắn bó đặc biệt với vùng văn hóa nào?', options: ['Tây Nguyên', 'Đồng bằng Bắc Bộ', 'Nam Bộ', 'Đông Bắc'], answer: 0 },
      { text: 'Tiếng Việt sử dụng hệ chữ viết nào trong đời sống hiện nay?', options: ['Chữ Quốc ngữ', 'Chữ Cyrillic', 'Chữ Kana', 'Chữ Devanagari'], answer: 0 },
      { text: 'Nón lá truyền thống thường được làm theo dạng hình học nào?', options: ['Hình nón', 'Hình lập phương', 'Hình trụ', 'Hình cầu'], answer: 0 },
      { text: 'Hát Xoan là loại hình nghệ thuật dân gian gắn với tỉnh nào?', options: ['Phú Thọ', 'Khánh Hòa', 'An Giang', 'Quảng Bình'], answer: 0 },
      { text: 'Màu nền lá cờ Việt Nam là màu gì?', options: ['Đỏ', 'Xanh dương', 'Vàng', 'Trắng'], answer: 0 },
      { text: 'Đơn vị tiền tệ chính thức của Việt Nam là gì?', options: ['Đồng', 'Baht', 'Yên', 'Riel'], answer: 0 },
    ],
  },
  science: {
    label: 'Khoa học tự nhiên',
    questions: [
      { text: 'Ở áp suất khí quyển tiêu chuẩn, nước sôi ở khoảng bao nhiêu độ C?', options: ['100°C', '50°C', '0°C', '150°C'], answer: 0 },
      { text: 'Hành tinh nào thường được gọi là “hành tinh đỏ”?', options: ['Sao Hỏa', 'Sao Kim', 'Sao Mộc', 'Sao Thủy'], answer: 0 },
      { text: 'Hành tinh lớn nhất trong Hệ Mặt Trời là hành tinh nào?', options: ['Sao Mộc', 'Trái Đất', 'Sao Thổ', 'Sao Hải Vương'], answer: 0 },
      { text: 'Mặt Trăng tỏa sáng trên bầu trời chủ yếu nhờ điều gì?', options: ['Phản chiếu ánh sáng Mặt Trời', 'Tự phát sáng như một ngôi sao', 'Ánh sáng từ Trái Đất', 'Ánh sáng từ sao Hỏa'], answer: 0 },
      { text: 'Cơ quan nào bơm máu đi khắp cơ thể người?', options: ['Tim', 'Phổi', 'Dạ dày', 'Thận'], answer: 0 },
      { text: 'Quá trình cây xanh dùng ánh sáng tạo chất dinh dưỡng gọi là gì?', options: ['Quang hợp', 'Hô hấp', 'Bay hơi', 'Lên men'], answer: 0 },
      { text: 'Nước ở thể rắn được gọi là gì?', options: ['Nước đá', 'Hơi nước', 'Sương', 'Mưa'], answer: 0 },
      { text: 'Khí nào chiếm tỷ lệ lớn nhất trong khí quyển Trái Đất?', options: ['Nitơ', 'Ôxy', 'Carbon dioxide', 'Hydro'], answer: 0 },
      { text: 'Âm thanh truyền đến tai chúng ta trong không khí dưới dạng gì?', options: ['Dao động của môi trường', 'Dòng điện', 'Tia sáng', 'Từ trường tĩnh'], answer: 0 },
      { text: 'Nước đá thường nổi trên mặt nước lỏng vì lý do nào?', options: ['Nước đá có khối lượng riêng nhỏ hơn nước lỏng', 'Nước đá nóng hơn nước lỏng', 'Nước đá không chịu tác dụng của trọng lực', 'Nước đá chứa nhiều muối hơn'], answer: 0 },
      { text: 'Trái Đất mất khoảng bao lâu để quay một vòng quanh Mặt Trời?', options: ['Một năm', 'Một ngày', 'Một tháng', 'Mười năm'], answer: 0 },
      { text: 'Cơ quan nào giúp cơ thể trao đổi ôxy và khí carbon dioxide với không khí?', options: ['Phổi', 'Gan', 'Dạ dày', 'Bàng quang'], answer: 0 },
    ],
  },
  stem: {
    label: 'STEM',
    questions: [
      { text: 'Trong hệ nhị phân, máy tính cơ bản biểu diễn dữ liệu bằng những chữ số nào?', options: ['0 và 1', '1 và 2', '0 đến 9', 'A và B'], answer: 0 },
      { text: 'Trong lập trình, thuật toán là gì?', options: ['Các bước giải quyết một vấn đề', 'Một loại màn hình', 'Một linh kiện lưu điện', 'Một ngôn ngữ chỉ dùng để vẽ'], answer: 0 },
      { text: 'Để dòng điện chạy liên tục qua mạch đơn giản, mạch cần ở trạng thái nào?', options: ['Kín', 'Hở hoàn toàn', 'Không có nguồn điện', 'Bị đứt ở mọi nhánh'], answer: 0 },
      { text: 'Trong đòn bẩy, điểm tựa có vai trò gì?', options: ['Là điểm quanh đó đòn bẩy quay', 'Là nguồn phát sáng', 'Là nơi tạo ra điện', 'Là vật luôn phải chuyển động thẳng'], answer: 0 },
      { text: 'Tấm pin mặt trời chuyển đổi năng lượng nào thành điện năng?', options: ['Ánh sáng', 'Âm thanh', 'Nhiệt từ băng', 'Năng lượng hóa học của đất'], answer: 0 },
      { text: 'Cảm biến trong robot thường dùng để làm gì?', options: ['Thu nhận thông tin từ môi trường', 'Trang trí robot', 'Thay thế mọi nguồn điện', 'Lưu trữ thức ăn'], answer: 0 },
      { text: 'HTML chủ yếu được dùng để làm gì?', options: ['Mô tả cấu trúc nội dung trang web', 'Điều khiển động cơ máy bay', 'Tạo nguồn điện', 'Nén ảnh thành âm thanh'], answer: 0 },
      { text: 'Máy in 3D thường tạo vật thể bằng cách nào?', options: ['Đắp vật liệu thành từng lớp', 'Khoan xuyên từ một khối duy nhất trong mọi trường hợp', 'Chiếu ảnh lên giấy', 'Dệt bằng sóng vô tuyến'], answer: 0 },
      { text: 'Cánh quạt tua-bin gió giúp biến năng lượng gió thành dạng nào?', options: ['Điện năng', 'Năng lượng hạt nhân', 'Năng lượng hóa học trong xăng', 'Ánh sáng Mặt Trăng'], answer: 0 },
      { text: 'Trong chương trình, câu lệnh lặp thường giúp làm gì?', options: ['Thực hiện lại một nhóm lệnh', 'Xóa mọi dữ liệu trên máy', 'Tăng kích thước màn hình', 'Ngắt kết nối Internet'], answer: 0 },
      { text: 'Vì sao các thanh giằng hình tam giác thường được dùng trong kết cấu?', options: ['Giúp kết cấu vững chắc và ít biến dạng', 'Giúp vật liệu biến mất', 'Tạo ra điện mà không cần nguồn', 'Làm kết cấu luôn mềm hơn'], answer: 0 },
      { text: 'Trong mô hình kỹ thuật, bước thử nghiệm nguyên mẫu giúp làm gì?', options: ['Phát hiện vấn đề để cải tiến thiết kế', 'Thay thế việc xác định mục tiêu', 'Đảm bảo không cần đo đạc', 'Biến mọi vật liệu thành kim loại'], answer: 0 },
    ],
  },
};
questionTopics.mixed = {
  label: 'Tổng hợp',
  questions: Object.entries(questionTopics).flatMap(([topic, data]) => topic === 'mixed' ? [] : data.questions),
};
const topicIds = new Set(Object.keys(questionTopics));

function randomQuestions(questions) {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, questionsPerGame).map((question) => {
    const options = question.options.map((text, index) => ({ text, isCorrect: index === question.answer }));
    for (let index = options.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [options[index], options[swapIndex]] = [options[swapIndex], options[index]];
    }
    return {
      ...question,
      options: options.map((option) => option.text),
      answer: options.findIndex((option) => option.isCorrect),
    };
  });
}

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
    gameType: room.gameType,
    topic: room.topic,
    bingoMode: room.bingoMode,
    calledNumbers: room.calledNumbers,
    bingoWinner: room.bingoWinner,
    players: [...room.players.values()].map(({ id, name, avatar, score }) => ({ id, name, avatar, score })),
    answerCount: room.answers.size,
  };
}

function makeBingoCard() {
  const columns = Array.from({ length: 5 }, (_, column) => {
    const min = column * 15 + 1;
    const numbers = new Set();
    while (numbers.size < 5) numbers.add(randomInt(min, min + 15));
    return [...numbers].sort((a, b) => a - b);
  });
  const card = Array.from({ length: 5 }, (_, row) => columns.map((column) => column[row]));
  card[2][2] = 0;
  return card;
}

function hasBingo(player) {
  const marked = player.markedNumbers;
  const lines = [];
  for (let index = 0; index < 5; index += 1) {
    lines.push(player.bingoCard[index], player.bingoCard.map((row) => row[index]));
  }
  lines.push(
    player.bingoCard.map((row, index) => row[index]),
    player.bingoCard.map((row, index) => row[4 - index]),
  );
  return lines.some((line) => line.every((number) => number === 0 || marked.has(number)));
}

function launchBingo(room) {
  room.phase = 'bingo';
  room.calledNumbers = [];
  room.bingoWinner = null;
  room.bingoMode = 'manual';
  clearInterval(room.bingoTimer);
  room.bingoTimer = null;
  for (const player of room.players.values()) {
    player.bingoCard = makeBingoCard();
    player.markedNumbers = new Set([0]);
    io.to(player.id).emit('bingo:card', {
      card: player.bingoCard,
      markedNumbers: [...player.markedNumbers],
    });
  }
  io.to(room.code).emit('game:bingo-start', roomState(room));
  broadcastRoom(room);
}

function drawBingoNumber(room) {
  if (room.phase !== 'bingo' || room.calledNumbers.length >= 75) {
    clearInterval(room.bingoTimer);
    room.bingoTimer = null;
    return;
  }
  const remaining = Array.from({ length: 75 }, (_, index) => index + 1)
    .filter((number) => !room.calledNumbers.includes(number));
  room.calledNumbers.push(remaining[randomInt(remaining.length)]);
  if (room.calledNumbers.length >= 75) {
    clearInterval(room.bingoTimer);
    room.bingoTimer = null;
  }
  broadcastRoom(room);
}

function setBingoMode(room, mode) {
  clearInterval(room.bingoTimer);
  room.bingoTimer = null;
  room.bingoMode = mode;
  if (mode === 'auto' && room.phase === 'bingo') {
    room.bingoTimer = setInterval(() => drawBingoNumber(room), 3000);
  }
  broadcastRoom(room);
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
  clearTimeout(room.advanceTimer);
  const question = room.quizQuestions[room.questionIndex];
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
    totalQuestions: room.quizQuestions.length,
    answers,
  };
  io.to(room.code).emit('game:results', result);
  broadcastRoom(room);
  room.advanceTimer = setTimeout(() => advanceQuestion(room), 2000);
}

function advanceQuestion(room) {
  if (room.phase !== 'results') return;
  clearTimeout(room.advanceTimer);
  room.advanceTimer = null;
  room.questionIndex += 1;
  if (room.questionIndex >= room.quizQuestions.length) {
    room.phase = 'finished';
    const state = roomState(room);
    io.to(room.code).emit('game:finished', { room: state });
    broadcastRoom(room);
    return;
  }
  launchQuestion(room);
}

function launchQuestion(room) {
  room.phase = 'question';
  room.answers.clear();
  room.duration = 10_000;
  room.deadline = Date.now() + room.duration;
  io.to(room.code).emit('game:question', {
    question: publicQuestion(room.quizQuestions[room.questionIndex]),
    questionNumber: room.questionIndex + 1,
    totalQuestions: room.quizQuestions.length,
    deadline: room.deadline,
  });
  broadcastRoom(room);
  room.timer = setTimeout(() => revealResults(room), room.duration);
}

io.on('connection', (socket) => {
  socket.on('room:create', () => {
    const code = makeCode();
    const room = { code, hostId: socket.id, players: new Map(), phase: 'lobby', gameType: 'quiz', topic: 'mixed', quizQuestions: [], calledNumbers: [], bingoWinner: null, bingoMode: 'manual', bingoTimer: null, advanceTimer: null, questionIndex: 0, answers: new Map(), timer: null };
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

  socket.on('game:select', ({ code, gameType } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!isHost(socket, room)) return;
    if (room.phase !== 'lobby') return;
    if (!['quiz', 'bingo'].includes(gameType)) return;
    room.gameType = gameType;
    broadcastRoom(room);
  });

  socket.on('game:topic', ({ code, topic } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!isHost(socket, room)) return;
    if (room.phase !== 'lobby' || !topicIds.has(topic)) return;
    room.topic = topic;
    broadcastRoom(room);
  });

  socket.on('game:start', ({ code } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!isHost(socket, room)) return;
    if (room.phase !== 'lobby' || room.players.size === 0) return sendError(socket, 'Cần ít nhất một người chơi trong phòng để bắt đầu.');
    if (room.gameType === 'bingo') return launchBingo(room);
    room.quizQuestions = randomQuestions(questionTopics[room.topic].questions);
    room.questionIndex = 0;
    for (const player of room.players.values()) player.score = 0;
    launchQuestion(room);
  });

  socket.on('bingo:draw', ({ code } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!isHost(socket, room)) return;
    if (room.phase !== 'bingo' || room.calledNumbers.length >= 75) return;
    drawBingoNumber(room);
  });

  socket.on('bingo:mode', ({ code, mode } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    if (!isHost(socket, room)) return;
    if (room.phase !== 'bingo' || !['auto', 'manual'].includes(mode)) return;
    setBingoMode(room, mode);
  });

  socket.on('bingo:mark', ({ code, number } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    const player = room?.players.get(socket.id);
    if (!player || room.phase !== 'bingo' || !Number.isInteger(number)) return;
    if (!room.calledNumbers.includes(number) || !player.bingoCard.flat().includes(number)) return;
    player.markedNumbers.add(number);
    socket.emit('bingo:card', {
      card: player.bingoCard,
      markedNumbers: [...player.markedNumbers],
    });
    broadcastRoom(room);
  });

  socket.on('bingo:claim', ({ code } = {}) => {
    const room = roomMap.get(String(code || '').toUpperCase());
    const player = room?.players.get(socket.id);
    if (!player || room.phase !== 'bingo' || room.bingoWinner || !hasBingo(player)) return;
    clearInterval(room.bingoTimer);
    room.bingoTimer = null;
    room.bingoWinner = { id: player.id, name: player.name, avatar: player.avatar };
    room.phase = 'finished';
    io.to(room.code).emit('game:bingo-winner', { winner: room.bingoWinner, room: roomState(room) });
    broadcastRoom(room);
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
    advanceQuestion(room);
  });

  socket.on('disconnect', () => {
    for (const room of roomMap.values()) {
      if (room.hostId === socket.id) {
        clearTimeout(room.timer);
        clearTimeout(room.advanceTimer);
        clearInterval(room.bingoTimer);
        io.to(room.code).emit('room:closed');
        roomMap.delete(room.code);
        break;
      }
      if (room.players.delete(socket.id)) {
        room.answers.delete(socket.id);
        if (room.phase === 'question' && room.players.size > 0 && room.answers.size === room.players.size) revealResults(room);
        broadcastRoom(room);
        break;
      }
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Family Game Hub server listening on ${PORT}`);
});