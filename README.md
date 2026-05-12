# Threads Follow-Chéo Bot 🤖

Bộ công cụ tự động hóa quá trình "follow chéo" trên Threads để tăng follow hiệu quả và an toàn.

## 🚀 Cách 1: Sử dụng Chrome Extension (Khuyên dùng)

Đây là cách đơn giản nhất, không cần đụng tới Terminal hay cài đặt Node.js.

### Cài đặt:
1. Mở Chrome, truy cập: `chrome://extensions/`
2. Bật **Developer mode** (Góc trên bên phải).
3. Nhấn **Load unpacked** và chọn thư mục: `/Users/admin/vietle/PersonalProject/threads/extension`
4. Extension sẽ xuất hiện trên thanh công cụ với icon Threads ⚡.

### Sử dụng:
1. Mở [threads.com](https://www.threads.com) và đăng nhập tài khoản của bạn.
2. Nhấn vào icon Extension.
3. Chỉnh số lượng follow mong muốn và nội dung comment.
4. Nhấn **▶ Start Bot**.
5. Bạn có thể theo dõi tiến độ trực tiếp trong popup (Stats & Log).

---

## 💻 Cách 2: Sử dụng Script Node.js (Nâng cao)

Dành cho việc chạy bot thông qua CLI với khả năng tùy biến cao hơn.

### Khởi động Chrome Debug:
Chạy script helper để mở Chrome ở chế độ debug:
```bash
bash start-chrome.sh
```

### Chạy Bot:
Mở một tab Terminal mới và chạy:
```bash
node bot.js
```

---

## ⚙️ Cấu hình

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `maxPosts` | `100` | Số post tối đa cho mỗi phiên chạy |
| `commentText` | `"Đã follow ạ"` | Nội dung comment sau khi follow |
| `delayBetweenPosts` | `2–4 giây` | Nghỉ giữa các bài viết (đã tối ưu 40% speed) |
| `wiggleMoves` | `3–7 moves` | Di chuyển chuột ngẫu nhiên để tránh Captcha |

---

## 🛡️ Tính năng An toàn (Anti-Detection)

- **Human-like Delay**: Delay được phân phối ngẫu nhiên (Skewed distribution) giống nhịp độ người thật.
- **Mouse Wiggle**: Tự động di chuyển chuột ngẫu nhiên giữa các thao tác để đánh lừa hệ thống phát hiện bot.
- **In-Feed Action**: Bot không chuyển trang liên tục mà hoạt động trực tiếp trên Feed, sau đó dùng `Back` để quay lại list, giống hành vi thủ công.
- **Random Typing**: Tốc độ gõ comment có các khoảng nghỉ ngẫu nhiên giữa các phím.

## ⚠️ Lưu ý quan trọng

- **Không lạm dụng**: Mặc dù bot đã được tối ưu, Threads vẫn có giới hạn follow/giờ. Nên chạy tối đa 100-200 follow mỗi ngày.
- **Threads.com**: Đảm bảo bạn đang sử dụng domain `.com` mới nhất của Threads.
- **Tương tác lại**: Hãy thỉnh thoảng tương tác thủ công (like, scroll) để tài khoản trông tự nhiên hơn.
