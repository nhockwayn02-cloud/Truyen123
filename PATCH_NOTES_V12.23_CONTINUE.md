# V12.23 – Auto-continue đúng số lượt + báo lý do dừng
- Số lượt viết thêm = đúng số "Auto-continue" đã đặt (client + worker; 18+ không còn bị ép tối thiểu 4).
- Bỏ giới hạn cố định 2 lần chèn diễn biến: số lần chèn tự động, chỉ bị giới hạn bởi số lượt Auto-continue.
- Lượt thất bại (AI trả rỗng, lặp, chèn <120 từ, sai ngôn ngữ, API lỗi) không còn làm vòng lặp dừng hẳn: tính là 1 lượt rồi thử lượt kế.
- Khi chương còn thiếu nhiều (<85% mục tiêu): bỏ câu "không kéo dài để đạt chỉ tiêu", yêu cầu viết tiếp diễn biến mới, không kết chương sớm.
- Lượng từ xin mỗi lần chèn/viết tiếp = phần còn thiếu chia cho số lượt còn lại.
- Chưa đạt mục tiêu: status + chẩn đoán chương ghi rõ lý do dừng (hết lượt, AI trả rỗng, lặp, API lỗi, chạm giới hạn từ...).

# V12.23 – Gợi ý chương sau
- Viết thường: gợi ý chương sau giờ HIỆN ở ô Gợi ý (trước đây chỉ lưu vào biến ẩn autoNextChapterHint nên ô luôn trống).
- Ô trống hoặc vẫn là gợi ý đã dùng cho chương vừa viết -> thay bằng gợi ý mới. Nếu bạn đã tự gõ gợi ý khác trong lúc viết -> giữ nguyên.
- Tạo gợi ý thất bại (API lỗi/AI trả rỗng): xóa gợi ý cũ đã dùng, báo ở status + chẩn đoán chương. Bản nền cũng xóa gợi ý cũ khi thất bại.
- Bản nền: lúc gộp kết quả không ghi đè gợi ý nếu bạn đã gõ gợi ý mới trong lúc job chạy.
