# V12.24 – Chương phải CHẠM ĐIỂM KẾT (không chỉ đủ số từ) — viết thường + viết nền

## Triệu chứng
Có gợi ý + điểm kết (Ending Anchor) nhưng chương dừng ở ~4200/5000 từ khi chưa tới kết; bấm ➕ Viết Tiếp lên ~5400 từ vẫn chưa tới kết.

## Nguyên nhân (đã đọc code xác nhận)
1. Vòng Auto-continue (client `autoContinueUntilDone` và worker `generateOneChapter`) chỉ so SỐ TỪ; đủ 95% mục tiêu là dừng dù chưa viết tới điểm kết.
2. Chế độ "chèn diễn biến" (V12.22) giả định "model tự dừng = đã viết xong đoạn kết", rồi chèn vào TRƯỚC 4 đoạn cuối. Khi model dừng sớm (chưa tới kết) thì 4 đoạn đó chỉ là giữa truyện → chèn thêm chữ nhưng chương không bao giờ tới kết.
3. Nhánh viết tiếp thường ở client không mang gợi ý/điểm kết (chỉ có "KHÔNG kết chương sớm").
4. Nút ➕ Viết Tiếp: prompt cố định "1500–2500 từ", không có điểm kết; và `buildContextBlock()` chèn `state.nextChapterHint` dưới nhãn "GỢI Ý CHO CHƯƠNG NÀY" — nhưng sau khi chương viết xong ô đó đã là gợi ý chương SAU → AI bị kéo sang nội dung chương sau.

## Thay đổi
- `shared/core.js` (dùng chung client + worker): `getEndingTarget`, `buildEndingCheckPrompt`, `parseEndingCheck`, `buildFinishPrompt`, `finishWordBudget`, `isFinishDoneReply`, hằng `ENDING_FINISH_EXTRA = 2`.
- Mỗi vòng viết tiếp: hỏi AI (1 lệnh JSON nhỏ) "chương đã tới điểm kết chưa?".
  - CHƯA tới kết → chế độ CHỐT KẾT: viết tiếp các nhịp còn thiếu theo đúng thứ tự tới điểm kết rồi dừng (không chèn vào giữa). Đủ số từ mà chưa tới kết vẫn tiếp tục.
  - Đã tới kết mà còn ngắn → chèn diễn biến trước đoạn kết (như V12.22).
  - Không kiểm tra được / không có điểm kết → chạy y như V12.23.
- Chưa tới kết được thêm tối đa 2 lượt "chốt kết" NGOÀI số lượt Auto-continue (chỉ khi chưa tới kết). AI đáp `[ĐÃ XONG]` = kiểm tra nhầm → không nối thêm.
- Chưa tới kết thì KHÔNG chạy "Mở rộng cuối" (viết lại dài hơn không giúp tới kết). Báo rõ "CHƯƠNG CHƯA TỚI ĐIỂM KẾT — còn thiếu: …" ở status + chẩn đoán chương (viết nền: ở cảnh báo chương).
- Lượt chốt kết chấp nhận phần nối ≥ 12 từ (trước đây < 40 từ bị coi là lặp).
- Chương lưu `briefUsed` {hint, directive} lúc viết (client + worker). Nút ➕ Viết Tiếp dùng brief/điểm kết của CHÍNH chương đó (chương cũ chưa có: lấy dòng "Kết chương" trong kế hoạch; không có gì thì chạy như cũ), và dựng ngữ cảnh bằng brief của chương đó thay vì gợi ý chương sau. Viết Tiếp xong tự kiểm tra lại và báo "đã tới điểm kết" hay "còn thiếu …".
- Test mới: tests/v12_24.test.js (15), tests/e2e_ending.py (16). Test cũ v12_20 chỉ cập nhật bộ lọc đếm lượt (lượt kiểm tra điểm kết không phải lượt viết chính).

## Lưu ý
- Thêm 1–2 lệnh AI nhỏ (max 400 token) mỗi chương có gợi ý; không tính vào số lượt Auto-continue.
- Điểm kết lấy từ: cú chốt ghi rõ (Ending Anchor / kết chương / cú chốt…) > nhịp cuối của ô Gợi ý. MỆNH LỆNH chỉ được dùng khi có cú chốt ghi rõ.
