# 🎮 Family Game Hub - Web Game Giải Trí Gia Đình

Hệ thống Web Game thời gian thực (Real-time Web App) thiết kế riêng cho gia đình. Mô hình hoạt động dạng **Host/Controller** (tương tự Jackbox Games):
- **Host Screen (TV / Laptop):** Màn hình chung hiển thị câu hỏi, bảng xếp hạng, kết quả và hiệu ứng.
- **Controller Screen (Điện thoại / iPad):** Tay cầm điều khiển cá nhân để chọn đáp án, vẽ tranh, hoặc nhập câu trả lời.

---

## 🛠️ 1. Kiến Trúc Kỹ Thuật (Tech Stack)

### Core Technologies
* **Frontend Framework:** React.js (hoặc Next.js / Vue.js) + TailwindCSS *(Tối ưu giao diện đáp ứng mọi kích thước màn hình)*.
* **Backend Runtime:** Node.js (Express.js).
* **Real-time Engine:** Socket.IO *(Truyền tải dữ liệu tức thì giữa điện thoại và TV)*.
* **State Management:** Zustand / Redux Toolkit *(Quản lý trạng thái phòng chơi và người chơi)*.

### Architecture Overview
```text
┌────────────────────────┐      Socket.IO (WebSocket)      ┌────────────────────────┐
│  Host Screen (TV/PC)   │ ◄──────────────────────────────► │  Node.js + Socket.IO   │
└────────────────────────┘                                 │        Server          │
                                                           └───────────▲────────────┘
┌────────────────────────┐                                             │
│ Controller (Mobile/Pad)│ ◄───────────────────────────────────────────┘
└────────────────────────┘
```

---

## 🎲 2. Danh Sách Trò Chơi Gia Đình

### 🎨 Game 1: Tam Sao Thất Bản (Draw & Guess)
* **Trạng thái:** Đã triển khai.
* **Thể loại:** Sáng tạo, hài hước. Cần ít nhất 2 người chơi (không tính chủ phòng).
* **Cách chơi:**
  1. Người chơi lần lượt nhận từ khóa bí mật trên điện thoại và có 60 giây để vẽ.
  2. Nét vẽ được truyền thời gian thực lên màn hình chung.
  3. Những người còn lại đoán từ khóa bằng điện thoại; đoán đúng được 500 điểm, người vẽ được 300 điểm nếu có người đoán đúng.
* Mỗi ván có 3 lượt vẽ.

### ❓ Game 2: Tri Thức Gia Đình (Family Quiz Trivia)
* **Thể loại:** Đố vui, học hỏi.
* **Cách chơi:**
  1. Màn hình TV hiển thị câu hỏi và đếm ngược thời gian (15-30 giây).
  2. Điện thoại của từng người xuất hiện 4 nút màu tương ứng với 4 đáp án A, B, C, D.
  3. Người trả lời nhanh và chính xác nhất sẽ nhận số điểm cao hơn.
* **Tùy chỉnh:** Có thể thêm bộ câu hỏi về kỷ niệm gia đình, ngày sinh nhật, sở thích các thành viên.

### 🎭 Game 3: Ai Là Kẻ Nói Lối? (Bluff Master)
* **Trạng thái:** Đã triển khai.
* **Thể loại:** Hài hước, đánh đố. Cần ít nhất 2 người chơi (không tính chủ phòng).
* **Cách chơi:**
  1. Mỗi vòng đưa ra một câu hỏi về sự thật lạ đời.
  2. Người chơi có 60 giây để gửi một đáp án giả nghe thật thuyết phục.
  3. Mọi người bình chọn trong 45 giây. Đoán đáp án thật được 500 điểm; mỗi lượt bình chọn vào đáp án giả giúp tác giả đáp án đó nhận 250 điểm.
* Mỗi ván có 3 vòng; không thể bình chọn cho đáp án giả của chính mình.

### 🎰 Game 4: Bingo Gia Đình (Family Loto)
* **Trạng thái:** Chưa triển khai.
* **Thể loại:** May mắn, thư giãn.
* **Cách chơi:**
  1. Màn hình TV thực hiện quay số ngẫu nhiên.
  2. Mỗi thiết bị di động nhận được 1 tấm vé Bingo 5x5 ngẫu nhiên.
  3. Mọi người chạm vào màn hình để đánh dấu số đã quay. Ai hoàn thành hàng/cột trước sẽ bấm nút **BINGO!**.

---

## 🚀 3. Hướng Dẫn Cài Đặt & Phát Triển (Chạy Local)

### Yêu cầu hệ thống
* Node.js Version 18.x trở lên.
* npm hoặc yarn.

### Các bước khởi tạo dự án

1. **Khởi tạo thư mục dự án:**
   ```bash
   mkdir family-game-hub
   cd family-game-hub
   ```

2. **Cài đặt Backend (Server Node.js):**
   ```bash
   mkdir server
   cd server
   npm init -y
   npm install express socket.io cors dotenv
   ```

3. **Cài đặt Frontend (Client React):**
   ```bash
   cd ..
   npx create-react-app client
   cd client
   npm install socket.io-client lucide-react canvas-confetti
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

---

## 📌 4. Sơ Đồ Luồng Phòng Chơi (Room Flow)

1. **Tạo phòng (Host):** TV bấm "Tạo phòng mới" $\rightarrow$ Server cấp `Room Code` 4 ký tự (Ví dụ: `GAME`).
2. **Tham gia (Players):** Người chơi dùng Điện thoại/iPad mở web $\rightarrow$ Nhập `Room Code` + `Tên người chơi` + `Chọn Avatar`.
3. **Sảnh chờ (Lobby):** TV hiển thị danh sách các thành viên đã kết nối thành công.
4. **Bắt đầu:** Host bấm "Bắt đầu Game" trên TV hoặc thiết bị trưởng phòng.

---

## 🗺️ 5. Lộ Trình Phát Triển (Roadmap)

- [x] **Giai đoạn 1:** Dựng Server Socket.IO cơ bản & luồng kết nối Room Code.
- [x] **Giai đoạn 2:** Phát triển Game 2 (Tri Thức Gia Đình - Quiz Trivia).
- [x] **Giai đoạn 3:** Phát triển Game 1 (Tam Sao Thất Bản) tích hợp HTML5 Canvas.
- [x] **Giai đoạn 4:** Phát triển Game 3 (Ai Là Kẻ Nói Dối?).
- [ ] **Giai đoạn 5:** Phát triển Game 4 (Bingo Gia Đình).
- [ ] **Giai đoạn 6:** Tối ưu hóa UI/UX cho thiết bị di động và màn hình TV cỡ lớn.
- [ ] **Giai đoạn 7:** Deploy hệ thống lên môi trường Internet (Vercel / Render) để chơi từ xa.
Hiển thị Hồ_sơ_Dự_án_Web_Game_Gia_Đình.md.