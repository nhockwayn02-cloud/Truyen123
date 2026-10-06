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

# V12.23 – MỞ RỘNG CUỐI (khi vẫn thiếu từ)
- Sau khi hết lượt Auto-continue mà chương vẫn dưới mục tiêu (95% khi có gợi ý, 100% khi không): app nhờ AI VIẾT LẠI TOÀN BỘ chương dài hơn, giữ nguyên thứ tự/sự kiện/thoại/điểm kết, mở rộng mỗi cảnh (ưu tiên cảnh ngắn nhất). Tối đa 2 lần, cả viết thường và viết nền.
- Chỉ nhận bản mới khi dài hơn bản cũ ít nhất 120 từ, không ngắn hơn 90% bản cũ, đúng tiếng Việt; vượt giới hạn tối đa thì cắt. Không đạt thì giữ nguyên bản cũ và ghi lý do vào status/chẩn đoán.
- Hàm dùng chung: buildExpandPrompt, acceptExpandedChapter (shared/core.js); test mới tests/v12_23.test.js.

# V12.23 – Lỗi 404 khi viết nền (Netlify)
- Client: nếu /create-job trả 404, app dò thêm /job-status để báo đúng nguyên nhân (chưa deploy netlify/functions, mở app ngoài domain Netlify hoặc file://, hay chỉ create-job lỗi build). Poll job-status trả 404 thì báo ngay thay vì im lặng chờ.
- create-job: kích hoạt write-chapter-background bằng URL env trước; nếu 404 thử tiếp host của chính request (domain tùy chỉnh khác env.URL). Nếu vẫn 404, lỗi nêu rõ URL đã thử.
- Test mới tests/v12_23_netlify.test.js (4 ca). package.json -> 12.23.0.
