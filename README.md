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

## 🛠 Cấu trúc dự án
- `extension/manifest.json`: Cấu hình chính của Extension.
- `extension/background.js`: Xử lý logic chạy ngầm, quản lý bản quyền.
- `extension/content.js`: Thực hiện hành động trên trang Threads.com (Follow, Comment).
- `extension/popup.html/css/js`: Giao diện điều khiển của người dùng.
- `extension/icons/`: Chứa các biểu tượng thương hiệu.

---
**Phát triển bởi Stev.en Lee**
