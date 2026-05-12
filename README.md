# Threads Follow-Chéo Bot 🤖

Tự động follow và comment "Đã follow ạ" trên topic **follow chéo** của Threads.

## Cách hoạt động

1. Kết nối vào Chrome mà bạn đang đăng nhập Threads sẵn
2. Vào topic "follow chéo" trên Threads
3. Duyệt qua từng post → kiểm tra xem đã follow tác giả chưa
4. Nếu chưa → **follow** → vào post → **comment "Đã follow ạ"**
5. Lặp lại, cuộn xuống để tải thêm post

---

## Bước 1 — Khởi động Chrome với Remote Debug

**Tắt Chrome hoàn toàn trước**, rồi chạy lệnh này trong Terminal:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/Users/admin/Library/Application Support/Google/Chrome"
```

> Chrome sẽ mở với profile của bạn (đã đăng nhập Threads sẵn).

---

## Bước 2 — Chạy Bot

Mở một Terminal khác, vào thư mục project:

```bash
cd /Users/admin/vietle/PersonalProject/threads
node bot.js
```

---

## Cấu hình (`bot.js` phần CONFIG)

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `maxPosts` | `50` | Số post tối đa mỗi lần chạy |
| `commentText` | `"Đã follow ạ"` | Nội dung comment |
| `delayBetweenPosts` | `4–9 giây` | Delay giữa các post (tránh bị block) |
| `topicUrl` | follow chéo search | URL topic trên Threads |

---

## Lưu ý quan trọng

- ⚠️ **Không giảm delay quá thấp** — Threads có thể detect bot và khóa tài khoản
- 🔄 **Chạy định kỳ** — Chạy 1–2 lần/ngày, mỗi lần 50 post là an toàn nhất
- 💤 **Không chạy 24/7** — Hành vi bất thường sẽ bị flag
