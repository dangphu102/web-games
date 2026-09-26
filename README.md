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
* **Thể loại:** Sáng tạo, hài hước.
* **Cách chơi:**
  1. Người vẽ nhận từ khóa bí mật trên điện thoại và tiến hành vẽ.
  2. Nét vẽ được truyền thời gian thực (Real-time Canvas) lên màn hình TV.
  3. Các thành viên khác nhập dự đoán từ điện thoại của mình.
* **Điểm thu hút:** Trẻ em thỏa sức sáng tạo, người lớn đoán các hình vẽ ngộ nghĩnh.

### ❓ Game 2: Tri Thức Gia Đình (Family Quiz Trivia)
* **Thể loại:** Đố vui, học hỏi.
* **Cách chơi:**
  1. Màn hình TV hiển thị câu hỏi và đếm ngược thời gian (15-30 giây).
  2. Điện thoại của từng người xuất hiện 4 nút màu tương ứng với 4 đáp án A, B, C, D.
  3. Người trả lời nhanh và chính xác nhất sẽ nhận số điểm cao hơn.
* **Tùy chỉnh:** Có thể thêm bộ câu hỏi về kỷ niệm gia đình, ngày sinh nhật, sở thích các thành viên.

### 🎭 Game 3: Ai Là Kẻ Nói Lối? (Bluff Master)
* **Thể loại:** Hài hước, đánh đố.
* **Cách chơi:**
  1. Game đưa ra một câu hỏi về sự thật lạ đời.
  2. Mỗi người chơi nhập một câu trả lời giả (xạo) nhưng nghe có vẻ thuyết phục trên điện thoại.
  3. Màn hình TV tổng hợp câu trả lời thật và các câu trả lời giả.
  4. Mọi người bình chọn xem đâu là sự thật. Chọn đúng được điểm, lừa được người khác chọn câu trả lời của mình cũng được điểm.

### 🎰 Game 4: Bingo Gia Đình (Family Loto)
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

- [ ] **Giai đoạn 1:** Dựng Server Socket.IO cơ bản & Luồng kết nối Room Code.
- [ ] **Giai đoạn 2:** Phát triển Game 2 (Tri Thức Gia Đình - Quiz Trivia) để hoàn thiện luồng gửi/nhận dữ liệu.
- [ ] **Giai đoạn 3:** Phát triển Game 1 (Tam Sao Thất Bản) tích hợp HTML5 Canvas.
- [ ] **Giai đoạn 4:** Tối ưu hóa UI/UX cho thiết bị di động và màn hình TV cỡ lớn.
- [ ] **Giai đoạn 5:** Deploy hệ thống lên môi trường Internet (Vercel / Render) để chơi từ xa.
Hiển thị Hồ_sơ_Dự_án_Web_Game_Gia_Đình.md.