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

# V12.23 – Viết thoải mái hơn để đủ số từ
- Thêm "KẾ HOẠCH ĐỘ DÀI" (shared/core.js: buildLengthPlan, dùng chung client + worker): tách gợi ý thành các nhịp, chia ngân sách từ cho từng nhịp (tổng ≈ 105% mục tiêu, nhịp kết chương ≈ nửa ngân sách), đặt ở cuối prompt.
- Dặn AI: mỗi nhịp phải đủ bối cảnh/hành động/thoại/nội tâm/hệ quả, cấm tóm tắt nhịp thành 1–2 đoạn, chỉ viết nhịp cuối khi đã gần đủ từ, nếu thiếu thì mở rộng phần giữa chứ không kết chương.
- Khi có gợi ý/mệnh lệnh: bỏ ràng buộc "chỉ 1–3 sự kiện chính" (mâu thuẫn với gợi ý nhiều nhịp), thay bằng "đúng các nhịp trong gợi ý, không thêm biến cố lớn ngoài gợi ý".
