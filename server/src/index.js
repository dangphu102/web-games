import { createServer } from 'node:http';
import { randomInt } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });
const PORT = Number(process.env.PORT) || 3001;
const roomMap = new Map();
const roomAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function getLanAddress() {
  const candidates = Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
    (addresses || [])
      .filter(({ address, family, internal }) => {
        if (internal || (family !== 'IPv4' && family !== 4)) return false;
        return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
      })
      .map(({ address }) => ({ name, address })),
  );
  return candidates.find(({ name }) => /wi-?fi|wireless/i.test(name))?.address
    || candidates[0]?.address
    || null;
}

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
function addQuestions(topicId, entries) {
  questionTopics[topicId].questions.push(...entries.map(([text, correct, ...distractors]) => ({
    text,
    options: [correct, ...distractors],
    answer: 0,
  })));
}

addQuestions('history', [
  ['Ai sáng lập triều Lý và lấy niên hiệu Lý Thái Tổ?', 'Lý Công Uẩn', 'Lý Thường Kiệt', 'Lý Nhân Tông', 'Lý Huệ Tông'],
  ['Quốc Tử Giám được thành lập dưới triều vua nào?', 'Lý Nhân Tông', 'Trần Thái Tông', 'Lê Thánh Tông', 'Gia Long'],
  ['Bài thơ “Nam quốc sơn hà” thường được gắn với danh tướng nào?', 'Lý Thường Kiệt', 'Trần Quốc Tuấn', 'Ngô Quyền', 'Nguyễn Trãi'],
  ['Triều Trần đánh bại quân Nguyên lần thứ ba trên sông nào năm 1288?', 'Bạch Đằng', 'Như Nguyệt', 'Lục Đầu', 'Sông Mã'],
  ['Hội nghị Diên Hồng gắn với triều đại nào?', 'Nhà Trần', 'Nhà Lý', 'Nhà Hồ', 'Nhà Nguyễn'],
  ['Ai là tác giả “Hịch tướng sĩ”?', 'Trần Quốc Tuấn', 'Trần Thủ Độ', 'Lê Lợi', 'Nguyễn Huệ'],
  ['Triều Hồ đặt kinh đô tại địa danh nào?', 'Tây Đô', 'Hoa Lư', 'Phú Xuân', 'Cổ Loa'],
  ['Sau khởi nghĩa Lam Sơn, triều đại nào được thành lập?', 'Hậu Lê', 'Nhà Mạc', 'Nhà Hồ', 'Nhà Nguyễn'],
  ['Ai là người sáng lập triều Mạc?', 'Mạc Đăng Dung', 'Mạc Đĩnh Chi', 'Mạc Kính Cung', 'Mạc Thiên Tứ'],
  ['Ba anh em lãnh đạo phong trào Tây Sơn gồm ai?', 'Nguyễn Nhạc, Nguyễn Huệ, Nguyễn Lữ', 'Nguyễn Ánh, Nguyễn Huệ, Nguyễn Du', 'Trương Định, Trương Đăng Quế, Trương Vĩnh Ký', 'Lê Lợi, Lê Lai, Lê Sát'],
  ['Vị vua sáng lập triều Nguyễn năm 1802 là ai?', 'Gia Long', 'Minh Mạng', 'Tự Đức', 'Hàm Nghi'],
  ['Kinh đô của triều Nguyễn đặt ở đâu?', 'Phú Xuân (Huế)', 'Thăng Long', 'Tây Đô', 'Gia Định'],
  ['Cuộc kháng chiến chống Pháp đầu tiên ở Đà Nẵng bắt đầu năm nào?', '1858', '1802', '1885', '1945'],
  ['Phong trào Cần Vương được phát động dưới danh nghĩa của vua nào?', 'Hàm Nghi', 'Duy Tân', 'Thành Thái', 'Bảo Đại'],
  ['Phong trào Đông Kinh Nghĩa Thục diễn ra chủ yếu ở đâu?', 'Hà Nội', 'Huế', 'Sài Gòn', 'Cần Thơ'],
  ['Cách mạng Tháng Tám thành công vào năm nào?', '1945', '1930', '1954', '1975'],
  ['Chiến dịch Điện Biên Phủ do vị tướng nào trực tiếp chỉ huy?', 'Võ Nguyên Giáp', 'Văn Tiến Dũng', 'Nguyễn Chí Thanh', 'Hoàng Văn Thái'],
  ['Hiệp định Genève về Đông Dương được ký kết năm nào?', '1954', '1946', '1968', '1973'],
  ['Đường Trường Sơn trong kháng chiến thường được gọi bằng tên nào?', 'Đường Hồ Chí Minh', 'Đường Cái Quan', 'Đường Thiên Lý', 'Đường số 1'],
  ['Hiệp định Paris về chấm dứt chiến tranh, lập lại hòa bình ở Việt Nam ký năm nào?', '1973', '1954', '1965', '1975'],
  ['Quốc hiệu “Cộng hòa Xã hội chủ nghĩa Việt Nam” được sử dụng từ năm nào?', '1976', '1945', '1954', '1986'],
  ['Nguyễn Ái Quốc trở về Việt Nam hoạt động năm 1941 tại khu vực nào?', 'Pác Bó', 'Tân Trào', 'Ba Đình', 'Địa đạo Củ Chi'],
  ['Đại hội Quốc dân Tân Trào diễn ra trước sự kiện lịch sử nào?', 'Cách mạng Tháng Tám 1945', 'Chiến thắng Điện Biên Phủ', 'Tổng tiến công Tết Mậu Thân', 'Chiến dịch Hồ Chí Minh'],
  ['Ai là nữ tướng nổi tiếng lãnh đạo cuộc khởi nghĩa chống Đông Ngô?', 'Bà Triệu', 'Bà Huyện Thanh Quan', 'Nguyên phi Ỷ Lan', 'Đoàn Thị Điểm'],
  ['Hai Bà Trưng khởi nghĩa chống ách đô hộ của triều đại nào?', 'Nhà Đông Hán', 'Nhà Đường', 'Nhà Tống', 'Nhà Minh'],
  ['Đinh Bộ Lĩnh dẹp loạn nào để thống nhất đất nước?', 'Loạn 12 sứ quân', 'Loạn 7 sứ quân', 'Loạn An Sử', 'Loạn Tam Quốc'],
  ['Ai được nhân dân tôn xưng là “Vạn Thắng Vương” trước khi lên ngôi?', 'Đinh Bộ Lĩnh', 'Lê Hoàn', 'Lý Công Uẩn', 'Trần Thái Tông'],
  ['Lê Hoàn lãnh đạo kháng chiến chống quân xâm lược nào năm 981?', 'Nhà Tống', 'Nhà Minh', 'Nhà Thanh', 'Nhà Nguyên'],
  ['Chiến thắng Như Nguyệt năm 1077 gắn với cuộc kháng chiến chống quân nào?', 'Nhà Tống', 'Nhà Nguyên', 'Nhà Minh', 'Nhà Thanh'],
  ['Ai chỉ huy chiến thắng Rạch Gầm – Xoài Mút năm 1785?', 'Nguyễn Huệ', 'Nguyễn Nhạc', 'Nguyễn Ánh', 'Trương Định'],
  ['Ai là vị vua cuối cùng của triều Nguyễn?', 'Bảo Đại', 'Hàm Nghi', 'Duy Tân', 'Tự Đức'],
  ['Nguyễn Du nổi tiếng nhất với tác phẩm văn học nào?', 'Truyện Kiều', 'Chinh phụ ngâm', 'Lục Vân Tiên', 'Bình Ngô đại cáo'],
  ['Ai là tác giả tập thơ “Nhật ký trong tù”?', 'Hồ Chí Minh', 'Tố Hữu', 'Nguyễn Du', 'Phan Bội Châu'],
  ['Mặt trận Việt Minh được thành lập năm nào?', '1941', '1930', '1945', '1954'],
  ['Chiến dịch Hồ Chí Minh kết thúc bằng sự kiện lịch sử nào?', 'Giải phóng Sài Gòn ngày 30/4/1975', 'Tuyên ngôn Độc lập', 'Chiến thắng Điện Biên Phủ', 'Ký Hiệp định Genève'],
  ['Ngày Quốc khánh Việt Nam là ngày nào?', '2 tháng 9', '30 tháng 4', '7 tháng 5', '19 tháng 8'],
  ['Ngày thành lập Quân đội nhân dân Việt Nam là ngày nào?', '22 tháng 12', '2 tháng 9', '27 tháng 7', '19 tháng 5'],
  ['Hội nghị hợp nhất các tổ chức cộng sản thành lập Đảng Cộng sản Việt Nam diễn ra năm nào?', '1930', '1925', '1941', '1954'],
]);

addQuestions('geography', [
  ['Điểm cực Bắc trên đất liền Việt Nam thuộc địa danh nào?', 'Lũng Cú', 'Mũi Cà Mau', 'Mũi Đại Lãnh', 'A Pa Chải'],
  ['Mũi đất thường được xem là cực Nam trên đất liền Việt Nam là gì?', 'Mũi Cà Mau', 'Mũi Đôi', 'Mũi Né', 'Mũi Đại Lãnh'],
  ['Biển nằm ở phía đông Việt Nam thường được gọi là gì?', 'Biển Đông', 'Biển Đỏ', 'Biển Java', 'Biển Andaman'],
  ['Đỉnh Fansipan thuộc dãy núi nào?', 'Hoàng Liên Sơn', 'Trường Sơn', 'Tam Đảo', 'Bạch Mã'],
  ['Hang Sơn Đoòng thuộc hệ thống vườn quốc gia nào?', 'Phong Nha – Kẻ Bàng', 'Cát Tiên', 'Cúc Phương', 'Ba Vì'],
  ['Quần thể danh thắng Tràng An nằm ở khu vực nào?', 'Ninh Bình', 'Lào Cai', 'Đồng Tháp', 'Quảng Ninh'],
  ['Thác Bản Giốc nằm ở khu vực biên giới phía bắc nào?', 'Cao Bằng', 'Lạng Sơn', 'Hà Giang', 'Lai Châu'],
  ['Hồ Ba Bể thuộc vùng núi nào của Việt Nam?', 'Đông Bắc', 'Tây Nguyên', 'Nam Trung Bộ', 'Đồng bằng Nam Bộ'],
  ['Thành phố Đà Nẵng nằm bên con sông nào chảy qua trung tâm?', 'Sông Hàn', 'Sông Hương', 'Sông Cấm', 'Sông Tiền'],
  ['Sông Đà là phụ lưu lớn của con sông nào?', 'Sông Hồng', 'Sông Cửu Long', 'Sông Đồng Nai', 'Sông Thu Bồn'],
  ['Hồ thủy điện Hòa Bình được hình thành trên dòng sông nào?', 'Sông Đà', 'Sông Mã', 'Sông Lam', 'Sông Lô'],
  ['Đà Lạt nằm trên cao nguyên nào?', 'Lâm Viên', 'Mộc Châu', 'Pleiku', 'Đồng Văn'],
  ['Thành phố Nha Trang giáp vùng biển nào?', 'Biển Đông', 'Vịnh Bắc Bộ', 'Vịnh Thái Lan', 'Biển Hồ'],
  ['Vườn quốc gia Cúc Phương nổi tiếng với hệ sinh thái nào?', 'Rừng mưa nhiệt đới', 'Rừng ngập mặn ven biển', 'Thảo nguyên khô', 'Rừng lá kim ôn đới'],
  ['Rừng U Minh có kiểu hệ sinh thái đặc trưng nào?', 'Rừng tràm đất ngập nước', 'Rừng thông núi cao', 'Rừng lá kim', 'Rừng tre ôn đới'],
  ['Khu dự trữ sinh quyển Cần Giờ nổi tiếng với loại rừng nào?', 'Rừng ngập mặn', 'Rừng thông', 'Rừng khộp', 'Rừng lá kim'],
  ['Vịnh Thái Lan nằm ở phía nào của đồng bằng sông Cửu Long?', 'Phía tây nam', 'Phía đông bắc', 'Phía bắc', 'Phía đông'],
  ['Côn Đảo là một quần đảo thuộc vùng biển nào?', 'Đông Nam Bộ', 'Vịnh Bắc Bộ', 'Tây Bắc', 'Tây Nguyên'],
  ['Đảo Lý Sơn nằm ngoài khơi khu vực duyên hải nào?', 'Nam Trung Bộ', 'Đồng bằng Bắc Bộ', 'Tây Nam Bộ', 'Đông Bắc Bộ'],
  ['Cát Bà là quần đảo nằm gần vùng biển nào?', 'Vịnh Bắc Bộ', 'Vịnh Thái Lan', 'Biển Java', 'Biển Hoa Đông'],
  ['Đồng bằng sông Hồng nằm chủ yếu ở miền nào?', 'Miền Bắc', 'Miền Trung', 'Tây Nguyên', 'Miền Nam'],
  ['Đồng bằng sông Cửu Long được bồi đắp bởi hệ thống sông nào?', 'Mekong', 'Sông Hồng', 'Sông Mã', 'Sông Cả'],
  ['Tên gọi “Cửu Long” gợi đến đặc điểm nào của sông ở miền Tây?', 'Chín cửa sông theo cách gọi truyền thống', 'Chín hồ lớn', 'Chín ngọn núi', 'Chín nhánh sông Hồng'],
  ['Cao nguyên Mộc Châu thuộc vùng địa lý nào?', 'Tây Bắc', 'Đông Nam Bộ', 'Tây Nam Bộ', 'Nam Trung Bộ'],
  ['Cao nguyên đá Đồng Văn nổi tiếng với loại địa hình nào?', 'Karst đá vôi', 'Đồng bằng phù sa', 'Đồi cát ven biển', 'Đầm lầy than bùn'],
  ['Dãy Bạch Mã thường được nhắc đến như ranh giới tự nhiên gần giữa hai miền nào?', 'Bắc Trung Bộ và Duyên hải Nam Trung Bộ', 'Tây Bắc và Đông Bắc', 'Tây Nguyên và Nam Bộ', 'Đồng bằng Bắc Bộ và Đông Bắc'],
  ['Đèo Hải Vân nằm giữa thành phố Đà Nẵng và khu vực nào?', 'Thừa Thiên Huế', 'Quảng Ninh', 'Bình Thuận', 'Cà Mau'],
  ['Đèo Ô Quy Hồ nằm trên tuyến nối hai tỉnh miền núi nào theo địa giới quen thuộc?', 'Lào Cai và Lai Châu', 'Cao Bằng và Lạng Sơn', 'Đắk Lắk và Gia Lai', 'Ninh Bình và Thanh Hóa'],
  ['Vườn quốc gia Yok Đôn nổi tiếng với sinh cảnh rừng nào?', 'Rừng khộp', 'Rừng ngập mặn', 'Rừng tràm', 'Rừng thông ôn đới'],
  ['Hồ Tà Đùng thường được ví như “vịnh Hạ Long” của vùng nào?', 'Tây Nguyên', 'Đồng bằng Bắc Bộ', 'Tây Nam Bộ', 'Đông Bắc'],
  ['Biển Hồ (T’Nưng) là hồ nước ngọt nổi tiếng gần thành phố nào?', 'Pleiku', 'Huế', 'Hạ Long', 'Cần Thơ'],
  ['Sông Hương chảy qua thành phố nào?', 'Huế', 'Hà Nội', 'Đà Lạt', 'Cần Thơ'],
  ['Sông Sài Gòn chảy qua đô thị lớn nào?', 'Thành phố Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Huế'],
  ['Hồ Tây là hồ nước nổi tiếng ở thành phố nào?', 'Hà Nội', 'Cần Thơ', 'Nha Trang', 'Đà Nẵng'],
  ['Vườn quốc gia Cát Tiên trải rộng trên khu vực địa lý nào?', 'Miền Đông Nam Bộ và Tây Nguyên', 'Đồng bằng Bắc Bộ', 'Tây Bắc', 'Đồng bằng sông Cửu Long'],
  ['Miền Trung Việt Nam có đặc điểm địa hình phổ biến nào?', 'Đồng bằng hẹp nằm giữa núi và biển', 'Đồng bằng rộng liên tục', 'Không có bờ biển', 'Chủ yếu là cao nguyên băng giá'],
  ['Gió mùa mùa đông thường đem không khí lạnh rõ nhất đến miền nào?', 'Miền Bắc', 'Tây Nam Bộ', 'Nam Bộ quanh năm', 'Quần đảo Trường Sa'],
  ['Vùng nào của Việt Nam nổi tiếng với nhiều đồi cát ven biển?', 'Duyên hải Nam Trung Bộ', 'Tây Bắc', 'Đồng bằng sông Hồng', 'Đông Bắc nội địa'],
]);

addQuestions('culture', [
  ['Việt Nam có bao nhiêu dân tộc được công nhận?', '54', '45', '63', '72'],
  ['Lễ Giỗ Tổ Hùng Vương diễn ra vào ngày nào theo âm lịch?', 'Mùng 10 tháng 3', 'Rằm tháng 8', 'Mùng 5 tháng 5', 'Mùng 1 tháng Giêng'],
  ['Tết Trung thu truyền thống diễn ra vào ngày nào theo âm lịch?', 'Rằm tháng 8', 'Mùng 10 tháng 3', 'Rằm tháng 7', 'Mùng 5 tháng 5'],
  ['Tết Đoan Ngọ diễn ra vào ngày nào theo âm lịch?', 'Mùng 5 tháng 5', 'Mùng 1 tháng 1', 'Rằm tháng 8', 'Mùng 10 tháng 3'],
  ['Đờn ca tài tử là loại hình nghệ thuật đặc trưng của vùng nào?', 'Nam Bộ', 'Tây Bắc', 'Đông Bắc', 'Tây Nguyên'],
  ['Nghệ thuật Bài chòi phổ biến ở khu vực nào?', 'Trung Bộ', 'Tây Bắc', 'Đồng bằng sông Hồng', 'Đông Nam Bộ'],
  ['Ca trù là loại hình nghệ thuật âm nhạc truyền thống nào?', 'Hát thính phòng với phách và đàn đáy', 'Múa mặt nạ trên băng', 'Hát hợp xướng không nhạc cụ', 'Nhạc kèn đồng hiện đại'],
  ['Cồng chiêng gắn liền với không gian văn hóa nào được UNESCO ghi danh?', 'Tây Nguyên', 'Đồng bằng sông Hồng', 'Nam Bộ', 'Duyên hải Bắc Bộ'],
  ['Dân ca ví, giặm gắn với khu vực hai tỉnh nào theo địa giới quen thuộc?', 'Nghệ An và Hà Tĩnh', 'Lào Cai và Yên Bái', 'Đồng Nai và Bình Dương', 'Cà Mau và Bạc Liêu'],
  ['Hát Then gắn bó đặc biệt với cộng đồng dân tộc nào ở miền núi phía Bắc?', 'Tày, Nùng và Thái', 'Chăm và Khmer', 'Ê Đê và Gia Rai', 'Kinh và Hoa'],
  ['Không gian văn hóa cồng chiêng gắn với loại nhạc cụ nào?', 'Cồng và chiêng', 'Đàn tranh và sáo trúc', 'Trống jazz và kèn saxophone', 'Đàn piano và violin'],
  ['Hội An nổi tiếng với những ngôi nhà cổ mang phong cách giao thương của các cộng đồng nào?', 'Việt, Hoa và Nhật', 'Việt, Ả Rập và Inuit', 'Chăm, Maya và Inca', 'Mông Cổ, Nga và Pháp'],
  ['Phố cổ Hội An từng là một thương cảng quan trọng vào khoảng thời gian nào?', 'Thế kỷ 16–17', 'Thế kỷ 5–6', 'Thế kỷ 20–21', 'Thời tiền sử'],
  ['Chùa Một Cột ở Hà Nội thường được mô tả có kiến trúc như thế nào?', 'Một ngôi chùa trên một cột đá', 'Chùa nằm dưới lòng hồ', 'Tháp có hình kim tự tháp', 'Ngôi chùa hoàn toàn bằng tre nổi'],
  ['Văn Miếu – Quốc Tử Giám gắn với truyền thống nào?', 'Tôn vinh đạo học và các bậc hiền tài', 'Nghi lễ cầu ngư ven biển', 'Lễ hội đua voi', 'Nghề làm gốm Chăm'],
  ['Phở truyền thống thường có thành phần chính nào?', 'Bánh phở và nước dùng', 'Bột mì nướng và phô mai', 'Lúa mạch và cà ri', 'Mì ống và sốt cà chua'],
  ['Bánh tét thường có hình dạng nào?', 'Hình trụ dài', 'Hình vuông dẹt', 'Hình cầu', 'Hình chóp tam giác'],
  ['Bánh chưng truyền thống thường gắn với dịp lễ nào?', 'Tết Nguyên đán', 'Tết Trung thu', 'Ngày Nhà giáo', 'Tết Đoan Ngọ'],
  ['Bánh xèo thường được nhận biết bởi đặc điểm nào?', 'Lớp bánh vàng giòn, có tiếng xèo khi đổ bột', 'Bánh hấp trong ống tre', 'Bánh nếp hình vuông gói lá', 'Bánh lạnh làm từ kem'],
  ['Mắm thường được tạo ra bằng phương pháp chế biến nào?', 'Ủ lên men thủy sản với muối', 'Đông lạnh trái cây', 'Nướng bột mì', 'Chưng cất đường mía'],
  ['Cà phê sữa đá Việt Nam thường pha với dụng cụ nhỏ giọt nào?', 'Phin', 'Ấm samovar', 'Bình moka cỡ lớn', 'Ấm trà đạo'],
  ['Làng gốm Bát Tràng nằm gần thành phố nào?', 'Hà Nội', 'Huế', 'Đà Lạt', 'Cần Thơ'],
  ['Làng lụa Vạn Phúc nổi tiếng với nghề truyền thống nào?', 'Dệt lụa', 'Đúc đồng', 'Làm nước mắm', 'Trồng cà phê'],
  ['Làng tranh Đông Hồ nổi tiếng với dòng tranh dân gian nào?', 'Tranh khắc gỗ in màu', 'Tranh sơn dầu trừu tượng', 'Tranh thêu trên kính', 'Tranh khảm đá quý'],
  ['Tranh Hàng Trống là dòng tranh dân gian gắn với đô thị nào?', 'Hà Nội', 'Hội An', 'Cần Thơ', 'Đà Lạt'],
  ['Nhà Rông là công trình cộng đồng đặc trưng của nhiều dân tộc ở vùng nào?', 'Tây Nguyên', 'Đồng bằng Bắc Bộ', 'Tây Nam Bộ', 'Duyên hải Bắc Trung Bộ'],
  ['Nhà dài truyền thống thường gắn với cộng đồng nào ở Tây Nguyên?', 'Ê Đê', 'Chăm', 'Tày', 'Khmer'],
  ['Lễ hội đua ghe Ngo gắn với cộng đồng dân tộc nào ở Nam Bộ?', 'Khmer', 'Tày', 'Mông', 'Dao'],
  ['Lễ hội Katê là lễ hội truyền thống của cộng đồng nào?', 'Người Chăm', 'Người Tày', 'Người Mông', 'Người Thái'],
  ['Tín ngưỡng thờ cúng Hùng Vương gắn với truyền thuyết về ai?', 'Các Vua Hùng', 'An Dương Vương', 'Chử Đồng Tử', 'Sơn Tinh'],
  ['Trống đồng Đông Sơn là hiện vật tiêu biểu của nền văn hóa nào?', 'Văn hóa Đông Sơn', 'Văn hóa Sa Huỳnh', 'Văn hóa Óc Eo', 'Văn hóa Champa'],
  ['Thánh Gióng là hình tượng anh hùng trong truyền thuyết nào?', 'Truyền thuyết dân gian Việt Nam', 'Sử thi Hy Lạp', 'Truyện cổ Nhật Bản', 'Thần thoại Bắc Âu'],
  ['“Lục Vân Tiên” là tác phẩm của nhà thơ nào?', 'Nguyễn Đình Chiểu', 'Nguyễn Du', 'Hồ Xuân Hương', 'Nguyễn Trãi'],
  ['“Chinh phụ ngâm” bản diễn Nôm thường được gắn với dịch giả nào?', 'Đoàn Thị Điểm', 'Bà Huyện Thanh Quan', 'Nguyễn Du', 'Hồ Xuân Hương'],
  ['“Qua Đèo Ngang” là bài thơ nổi tiếng của nữ sĩ nào?', 'Bà Huyện Thanh Quan', 'Đoàn Thị Điểm', 'Hồ Xuân Hương', 'Xuân Quỳnh'],
  ['Nhạc cụ đàn bầu thường có đặc điểm nào?', 'Một dây', 'Hai mươi mốt dây', 'Không có dây', 'Chỉ dùng phím điện tử'],
  ['Đàn tranh truyền thống thuộc nhóm nhạc cụ nào?', 'Nhạc cụ dây gảy', 'Nhạc cụ hơi bằng đồng', 'Nhạc cụ bàn phím', 'Nhạc cụ điện tử không dây'],
  ['Múa rối nước biểu diễn sân khấu trên môi trường nào?', 'Mặt nước', 'Sườn núi', 'Băng tuyết', 'Sân khấu treo trên không'],
]);

addQuestions('science', [
  ['Công thức hóa học của nước là gì?', 'H₂O', 'CO₂', 'O₂', 'NaCl'],
  ['Phân tử DNA có dạng cấu trúc nổi tiếng nào?', 'Xoắn kép', 'Hình lập phương', 'Vòng tròn hoàn hảo đơn', 'Hình nón cụt'],
  ['Sắc tố nào giúp lá cây hấp thụ ánh sáng trong quang hợp?', 'Diệp lục', 'Hemoglobin', 'Melanin', 'Keratin'],
  ['Nguyên tố nào chiếm phần lớn thể tích khí quyển Trái Đất?', 'Nitơ', 'Ôxy', 'Argon', 'Carbon dioxide'],
  ['Ở điều kiện tiêu chuẩn gần mặt đất, nước đóng băng ở khoảng bao nhiêu độ C?', '0°C', '100°C', '32°C', '−100°C'],
  ['Âm thanh không thể truyền qua môi trường nào?', 'Chân không', 'Nước', 'Không khí', 'Thép'],
  ['Ánh sáng nhìn thấy có thể truyền qua môi trường nào nhanh nhất trong các lựa chọn?', 'Chân không', 'Nước', 'Thủy tinh', 'Không khí ẩm'],
  ['Lực hấp dẫn giữ chúng ta trên bề mặt của thiên thể nào?', 'Trái Đất', 'Sao Thổ', 'Sao Hải Vương', 'Sao Kim'],
  ['Một năm trên Trái Đất gần bằng thời gian Trái Đất làm gì?', 'Quay một vòng quanh Mặt Trời', 'Quay một vòng quanh trục', 'Mặt Trăng quay quanh Trái Đất', 'Mặt Trời quay quanh Trái Đất'],
  ['Ngày và đêm luân phiên chủ yếu do chuyển động nào của Trái Đất?', 'Tự quay quanh trục', 'Quay quanh Mặt Trăng', 'Mặt Trời quay quanh Trái Đất', 'Trục Trái Đất ngừng quay'],
  ['Các mùa trong năm chủ yếu liên quan đến yếu tố nào?', 'Độ nghiêng trục Trái Đất khi quay quanh Mặt Trời', 'Khoảng cách Mặt Trăng tới Trái Đất', 'Số lượng đại dương', 'Trái Đất đổi kích thước'],
  ['Hệ Mặt Trời hiện có bao nhiêu hành tinh được công nhận?', '8', '7', '9', '12'],
  ['Ngôi sao gần Trái Đất nhất là gì?', 'Mặt Trời', 'Sirius', 'Sao Bắc Cực', 'Proxima Centauri'],
  ['Hành tinh nào nổi tiếng với hệ vành đai dễ quan sát?', 'Sao Thổ', 'Sao Thủy', 'Sao Hỏa', 'Trái Đất'],
  ['Vệ tinh tự nhiên của Trái Đất là gì?', 'Mặt Trăng', 'Phobos', 'Europa', 'Titan'],
  ['Loài nào thuộc nhóm động vật có vú?', 'Cá voi', 'Cá mập', 'Cá hồi', 'Bạch tuộc'],
  ['Động vật lưỡng cư thường trải qua quá trình phát triển nào?', 'Biến thái, như nòng nọc thành ếch', 'Lột xác thành bướm từ nhộng', 'Nở từ trứng có vỏ cứng như chim', 'Phân đôi như vi khuẩn'],
  ['Côn trùng trưởng thành thường có bao nhiêu chân?', '6', '4', '8', '10'],
  ['Nhện trưởng thành thường có bao nhiêu chân?', '8', '6', '10', '12'],
  ['Con vật nào nổi tiếng có ba trái tim?', 'Bạch tuộc', 'Cá heo', 'Cá mập', 'Rùa biển'],
  ['Ong mật góp phần quan trọng vào quá trình nào của nhiều loài cây?', 'Thụ phấn', 'Quang hợp dưới đất', 'Cố định nitrogen trong rễ mọi cây', 'Tạo ra ánh sáng'],
  ['Chất nào trong hồng cầu giúp vận chuyển ôxy?', 'Hemoglobin', 'Chlorophyll', 'Insulin', 'Keratin'],
  ['Cơ quan nào lọc máu và tạo nước tiểu?', 'Thận', 'Phổi', 'Dạ dày', 'Tụy'],
  ['Ở người trưởng thành, bộ xương thường có khoảng bao nhiêu xương?', '206', '106', '306', '406'],
  ['Vitamin nào cơ thể có thể tổng hợp ở da khi tiếp xúc ánh nắng phù hợp?', 'Vitamin D', 'Vitamin C', 'Vitamin B12', 'Vitamin K'],
  ['Đơn vị cơ bản cấu tạo nên cơ thể sống được gọi là gì?', 'Tế bào', 'Khoáng vật', 'Phân tử nước', 'Tinh thể muối'],
  ['Vi khuẩn thường được xếp vào nhóm sinh vật nào?', 'Sinh vật đơn bào nhân sơ', 'Động vật có xương sống', 'Thực vật có hoa', 'Nấm đa bào'],
  ['Nấm lấy chất dinh dưỡng chủ yếu bằng cách nào?', 'Hấp thụ chất hữu cơ từ môi trường', 'Quang hợp như cây xanh', 'Lọc ánh sáng thành đường', 'Tự tạo đất đá'],
  ['Hiện tượng nước lỏng chuyển thành hơi gọi là gì?', 'Bay hơi', 'Đông đặc', 'Ngưng tụ', 'Nóng chảy'],
  ['Hơi nước chuyển thành giọt nước lỏng gọi là gì?', 'Ngưng tụ', 'Thăng hoa', 'Đông đặc', 'Nóng chảy'],
  ['Độ pH khoảng 7 thường biểu thị dung dịch có tính chất nào?', 'Trung tính', 'Axit mạnh', 'Bazơ mạnh', 'Luôn là muối đậm đặc'],
  ['Đơn vị SI của lực là gì?', 'Newton', 'Joule', 'Watt', 'Pascal'],
  ['Đơn vị SI của năng lượng là gì?', 'Joule', 'Newton', 'Ampere', 'Hertz'],
  ['Nam châm có những cực nào?', 'Cực Bắc và cực Nam', 'Cực Đông và cực Tây', 'Cực Nóng và cực Lạnh', 'Cực Dương và cực Âm'],
  ['Hai cực cùng tên của hai nam châm đặt gần nhau thường thế nào?', 'Đẩy nhau', 'Hút nhau', 'Không tương tác trong mọi trường hợp', 'Tự biến mất'],
  ['Sấm thường được nghe sau khi thấy chớp vì điều gì?', 'Ánh sáng truyền nhanh hơn âm thanh', 'Âm thanh truyền nhanh hơn ánh sáng', 'Chớp tạo ra âm thanh trước ánh sáng', 'Mây hấp thụ hết âm thanh'],
  ['Cầu vồng hình thành khi ánh sáng Mặt Trời tương tác với điều gì?', 'Các giọt nước trong không khí', 'Hạt bụi sắt', 'Từ trường Trái Đất', 'Tinh thể muối khô'],
  ['Động vật ăn thực vật được gọi là nhóm nào?', 'Động vật ăn cỏ', 'Động vật ăn thịt', 'Sinh vật phân hủy', 'Sinh vật quang hợp'],
]);

addQuestions('stem', [
  ['Đơn vị SI cơ bản để đo độ dài là gì?', 'Mét', 'Lít', 'Kilogram', 'Giây'],
  ['Đơn vị SI cơ bản để đo khối lượng là gì?', 'Kilogram', 'Mét', 'Newton', 'Watt'],
  ['Đơn vị SI của cường độ dòng điện là gì?', 'Ampere', 'Volt', 'Ohm', 'Watt'],
  ['Một tam giác có bao nhiêu cạnh?', '3', '2', '4', '5'],
  ['Tổng số đo ba góc trong một tam giác phẳng là bao nhiêu?', '180 độ', '90 độ', '270 độ', '360 độ'],
  ['Giá trị gần đúng thường dùng của số pi là gì?', '3,14', '2,14', '1,41', '4,13'],
  ['Diện tích hình vuông cạnh dài a được tính bằng công thức nào?', 'a × a', '4 × a', '2 × a', 'a + 4'],
  ['Chu vi hình vuông cạnh dài a được tính bằng công thức nào?', '4 × a', 'a × a', '2 × a', 'a ÷ 4'],
  ['Ròng rọc cố định đơn giản chủ yếu giúp thay đổi yếu tố nào khi nâng vật?', 'Hướng tác dụng của lực', 'Khối lượng của vật', 'Trọng lực của Trái Đất', 'Thể tích vật'],
  ['Bánh răng ăn khớp có thể truyền chuyển động và thay đổi yếu tố nào?', 'Tốc độ quay và mô-men xoắn', 'Màu sắc và khối lượng', 'Nhiệt độ môi trường', 'Độ trong suốt'],
  ['Pin thông thường biến đổi năng lượng hóa học thành dạng nào?', 'Điện năng', 'Âm năng', 'Năng lượng hạt nhân', 'Thế năng hấp dẫn'],
  ['Đèn LED phát sáng khi có dòng điện chạy qua loại linh kiện nào?', 'Điốt phát quang', 'Điện trở nhiệt', 'Tụ điện rỗng', 'Cầu chì đứt'],
  ['GPS xác định vị trí chủ yếu dựa trên tín hiệu từ đâu?', 'Vệ tinh định vị', 'Cáp quang dưới biển', 'Đài phát thanh AM', 'La bàn cơ'],
  ['CPU trong máy tính thường được ví như bộ phận nào?', 'Bộ xử lý trung tâm', 'Bộ phận phát âm thanh duy nhất', 'Nguồn điện dự phòng', 'Màn hình cảm ứng'],
  ['RAM thường lưu dữ liệu như thế nào?', 'Tạm thời khi thiết bị đang hoạt động', 'Lưu trữ vĩnh viễn không cần điện', 'Chỉ lưu được hình ảnh in giấy', 'Chỉ lưu dữ liệu trên Internet'],
  ['Ổ SSD thường được dùng để làm gì?', 'Lưu trữ dữ liệu lâu dài', 'Đo nhiệt độ phòng', 'Phát Wi-Fi bằng sóng âm', 'Thay thế màn hình'],
  ['Trong phát triển web, CSS chủ yếu dùng để làm gì?', 'Định dạng và trình bày giao diện', 'Lưu trữ dữ liệu quan hệ', 'Biên dịch mã máy cho CPU', 'Quản lý điện áp pin'],
  ['JavaScript trên trình duyệt thường giúp trang web làm gì?', 'Tương tác và cập nhật nội dung động', 'Thay thế hoàn toàn HTML trong mọi trang', 'Tăng tốc độ mạng vật lý', 'Điều khiển trực tiếp vệ tinh'],
  ['Python là gì?', 'Một ngôn ngữ lập trình', 'Một loại cảm biến nhiệt', 'Một hệ điều hành phần cứng', 'Một thiết bị lưu điện'],
  ['Trong lập trình, biến thường dùng để làm gì?', 'Đặt tên cho giá trị có thể được sử dụng trong chương trình', 'Làm mát bộ xử lý', 'Mã hóa tín hiệu Wi-Fi bằng ánh sáng', 'Đo chiều dài cáp'],
  ['Câu lệnh điều kiện giúp chương trình làm gì?', 'Chọn nhánh lệnh tùy theo điều kiện', 'Lặp lại lệnh vô hạn trong mọi trường hợp', 'Tự động tăng dung lượng pin', 'Biến số thành hình ảnh'],
  ['API thường là giao diện để các phần mềm làm gì?', 'Trao đổi dữ liệu và chức năng với nhau', 'Tạo điện cho thiết bị', 'Làm mát phòng máy', 'Vẽ sơ đồ mạch bằng tay'],
  ['Mã hóa dữ liệu thường nhằm mục đích nào?', 'Bảo vệ thông tin khi lưu trữ hoặc truyền tải', 'Làm màn hình sáng hơn', 'Tăng kích thước tệp vô hạn', 'Thay thế việc sao lưu'],
  ['Mã QR có thể dùng để lưu trữ loại thông tin nào?', 'Dữ liệu được mã hóa thành mẫu ô vuông', 'Chỉ âm thanh analog', 'Chỉ tọa độ của Mặt Trăng', 'Nhiệt độ của giấy'],
  ['Cảm biến siêu âm trên robot thường giúp đo điều gì?', 'Khoảng cách tới vật cản', 'Màu sắc của âm thanh', 'Khối lượng pin từ xa', 'Độ mặn của kim loại'],
  ['Cảm biến ánh sáng có thể giúp đèn tự động làm gì?', 'Bật khi môi trường tối', 'Tăng trọng lượng bóng đèn', 'Đo tốc độ âm thanh', 'Tạo mưa trong phòng'],
  ['Nam châm điện tạo từ trường mạnh hơn khi nào trong cuộn dây?', 'Có dòng điện chạy qua cuộn dây', 'Cuộn dây bị cắt rời hoàn toàn', 'Không có nguồn và không có dòng điện', 'Cuộn dây làm bằng giấy'],
  ['Vật liệu cách điện thường có tính chất nào?', 'Cản trở dòng điện đi qua', 'Luôn tự phát ra điện', 'Chỉ dẫn nhiệt và điện hoàn hảo', 'Hút mọi sóng âm'],
  ['Vật liệu dẫn điện tốt thường được dùng làm gì trong dây dẫn?', 'Lõi kim loại', 'Vỏ nhựa bên ngoài', 'Lớp sơn cách điện', 'Vỏ cao su'],
  ['Tua-bin gió phát điện nhờ chuyển đổi năng lượng nào?', 'Động năng của gió thành điện năng', 'Điện năng thành năng lượng hóa học của gió', 'Âm thanh thành khối lượng', 'Ánh sáng thành lực hấp dẫn'],
  ['Nhà máy thủy điện khai thác nguồn năng lượng nào?', 'Nước chuyển động hoặc chảy từ cao xuống thấp', 'Than đá đang cháy', 'Ánh sáng từ đèn đường', 'Sóng vô tuyến'],
  ['Vật liệu cách nhiệt được dùng để làm gì?', 'Hạn chế truyền nhiệt', 'Tăng dòng điện qua tường', 'Làm vật luôn trong suốt', 'Tạo ra khối lượng mới'],
  ['Trong quy trình thiết kế kỹ thuật, nguyên mẫu là gì?', 'Mô hình thử nghiệm của giải pháp', 'Bản báo cáo đã xóa', 'Sản phẩm chắc chắn không cần thử', 'Một phép đo không có thiết bị'],
  ['Thử nghiệm nguyên mẫu giúp nhóm thiết kế điều gì?', 'Tìm lỗi và cải tiến giải pháp', 'Bỏ qua yêu cầu người dùng', 'Đảm bảo không bao giờ có sai số', 'Thay thế mọi phép đo'],
  ['Bản vẽ kỹ thuật thường giúp truyền đạt điều gì?', 'Hình dạng, kích thước và cách lắp ráp', 'Mùi vị của vật liệu', 'Tốc độ ánh sáng trong chân không', 'Lịch sử của người thiết kế'],
  ['Cấu trúc hình tam giác thường được dùng trong giàn vì sao?', 'Khó bị biến dạng khi chịu lực phù hợp', 'Không chịu tác dụng của trọng lực', 'Tự tạo thêm vật liệu', 'Luôn nhẹ hơn không khí'],
  ['Vít và bu-lông thường có tác dụng gì trong lắp ráp?', 'Liên kết các chi tiết có thể tháo lắp', 'Tạo ánh sáng Mặt Trời', 'Đo nhiệt độ chất lỏng', 'Làm bánh răng biến mất'],
  ['Thước cặp thường dùng để đo kích thước nào chính xác hơn thước thẳng?', 'Đường kính ngoài, đường kính trong và chiều sâu', 'Nhiệt độ và độ ẩm', 'Khối lượng và thời gian', 'Điện áp và cường độ dòng điện'],
]);

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
    game: room.game,
    gameType: room.game,
    topic: room.topic,
    bingoMode: room.bingoMode,
    calledNumbers: room.calledNumbers,
    bingoWinner: room.bingoWinner,
    players: [...room.players.values()].map(({ id, name, avatar, score }) => ({ id, name, avatar, score })),
    answerCount: room.phase === 'bluff-vote' ? room.votes.size : room.answers.size,
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
  room.bingoMode = 'auto';
  clearInterval(room.bingoTimer);
  room.bingoTimer = null;
  for (const player of room.players.values()) {
    player.bingoCard = makeBingoCard();
    player.markedNumbers = new Set([0]);
  }
  room.bingoTimer = setInterval(() => drawBingoNumber(room), 3000);
  io.to(room.code).emit('game:bingo-start', roomState(room));
  for (const player of room.players.values()) {
    io.to(player.id).emit('bingo:card', {
      card: player.bingoCard,
      markedNumbers: [...player.markedNumbers],
    });
  }
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
  socket.on('network:get-address', () => {
    socket.emit('network:address', getLanAddress());
  });

  socket.on('room:create', () => {
    const code = makeCode();
    const room = { code, hostId: socket.id, players: new Map(), phase: 'lobby', game: 'quiz', gameType: 'quiz', topic: 'mixed', quizQuestions: [], calledNumbers: [], bingoWinner: null, bingoMode: 'manual', bingoTimer: null, advanceTimer: null, questionIndex: 0, answers: new Map(), votes: new Map(), timer: null };
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
    if (!['quiz', 'bingo', 'drawing', 'bluff'].includes(game)) return sendError(socket, 'Game này chưa được hỗ trợ.');
    room.game = game;
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
    if (room.phase !== 'lobby') return sendError(socket, 'Phòng này không ở trạng thái chờ.');
    const minimumPlayers = ['drawing', 'bluff'].includes(room.game) ? 2 : 1;
    if (room.players.size < minimumPlayers) return sendError(socket, `Cần ít nhất ${minimumPlayers} người chơi để bắt đầu game này.`);
    for (const player of room.players.values()) player.score = 0;
    if (room.game === 'bingo') return launchBingo(room);
    if (room.game === 'drawing') {
      room.drawRoundIndex = 0;
      launchDrawingTurn(room);
    } else if (room.game === 'bluff') {
      room.bluffRoundIndex = 0;
      launchBluffPrompt(room);
    } else {
      room.quizQuestions = randomQuestions(questionTopics[room.topic].questions);
      room.questionIndex = 0;
      launchQuestion(room);
    }
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
    advanceQuestion(room);
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
        clearTimeout(room.advanceTimer);
        clearInterval(room.bingoTimer);
        io.to(room.code).emit('room:closed');
        roomMap.delete(room.code);
        break;
      }
      if (room.players.delete(socket.id)) {
        room.answers.delete(socket.id);
        room.votes.delete(socket.id);
        if (room.phase === 'question' && room.players.size > 0 && room.answers.size === room.players.size) revealResults(room);
        if (room.phase === 'drawing' && socket.id === room.currentDrawerId) finishDrawingTurn(room);
        if (room.phase === 'drawing' && room.correctGuessers.size >= room.players.size - 1) finishDrawingTurn(room);
        if (room.phase === 'bluff-submit' && room.answers.size === room.players.size) launchBluffVote(room);
        if (room.phase === 'bluff-vote' && room.votes.size === room.players.size) finishBluffRound(room);
        broadcastRoom(room);
        break;
      }
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Family Game Hub server listening on ${PORT}`);
});