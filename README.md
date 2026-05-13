# Threads Chéo Follow Bot (Extension)

Công cụ tự động hóa giúp tăng Follow trên Threads bằng cách tự động Follow và Comment vào các bài viết trong chủ đề "Chéo Follow".

## 🚀 Hướng dẫn cài đặt cho Người dùng

Nếu bạn nhận được tệp ZIP từ Admin, hãy làm theo các bước sau:

1. **Giải nén** tệp ZIP ra một thư mục trên máy tính.
2. Mở Chrome và truy cập: `chrome://extensions/`
3. Bật **Developer Mode** (Chế độ nhà phát triển) ở góc trên bên phải.
4. Chọn **Load unpacked** (Tải tiện ích đã giải nén).
5. Tìm đến thư mục `extension` vừa giải nén và nhấn **Select Folder**.
6. Ghim (Pin) tiện ích lên thanh công cụ, mở lên và nhập **Mã kích hoạt** để bắt đầu.

---

## 📦 Cách đóng gói để gửi cho khách hàng

1. Vào thư mục dự án.
2. Nén toàn bộ nội dung bên trong thư mục `extension/` thành tệp `ThreadsBot.zip`.
3. Gửi tệp này cho khách hàng kèm theo hướng dẫn ở trên.

---

## 🌍 Cách đưa lên Chrome Web Store (Public)

1. Truy cập [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole/).
2. Thanh toán phí 5$ cho Google (nếu là lần đầu).
3. Tạo "New Item" và tải tệp `ThreadsBot.zip` lên.
4. Điền mô tả, tải ảnh Screenshots (tỉ lệ 1280x800 hoặc 640x400).
5. Nhấn **Submit for Review** và đợi Google phê duyệt.

---

## 🔐 Bảo mật và Chống bẻ khóa (Security)

Vì JavaScript có thể bị đọc dễ dàng, bạn **BẮT BUỘC** phải làm rối mã (Obfuscate) trước khi gửi cho khách hàng:

1. Truy cập [javascript-obfuscator.org](https://obfuscator.io/)
2. Lần lượt dán code của `background.js` và `content.js` vào để làm rối.
3. Tải đoạn code đã bị làm rối về và thay thế vào thư mục `extension`.
4. Sau đó mới tiến hành nén ZIP để gửi cho khách.

Việc này sẽ khiến người dùng không thể đọc hiểu logic bên trong để tự ý bẻ khóa hoặc chỉnh sửa code của bạn.

---
**Phát triển bởi Stev.en Lee**
