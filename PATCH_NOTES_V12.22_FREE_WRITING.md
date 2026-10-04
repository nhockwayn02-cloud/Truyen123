# V12.22 — Bỏ "chia đoạn làm dày", AI tự do sáng tác thân chương, chỉ khóa Ending Anchor

## Ý tưởng
Gợi ý chương là xương sống. AI được thêm cảnh phụ/thoại/nội tâm/giác quan để chương tự nhiên và dài hơn,
nhưng không phá canon, không mở arc lớn, không đổi hướng truyện. Chỉ Ending Anchor là điểm bắt buộc ở cuối chương.

## Thay đổi
### Bỏ
- `expandChapterInPlace` (worker) và `expandChapterInPlaceClient` (index.html): bước chia chương thành khối ~900 từ, gọi AI viết lại từng khối. Nhanh hơn (ít lượt gọi AI), không còn rủi ro khối viết lại làm lệch đoạn kết.

### Prompt (worker + client)
- Bỏ các câu cấm "không thêm cảnh/biến cố", "không tự tạo ... chỉ để kéo dài".
- Thay bằng quyền tự do rõ ràng + giới hạn: 1–3 sự kiện chính, không phá canon, không arc lớn, không nhân vật quan trọng mới, không lộ thông tin chương sau.
- Mỗi nhịp trong gợi ý = một cảnh đầy đủ; cảnh phụ phải có chuyển biến mới, không lặp, không độn chữ.
- Ending Anchor: chỉ chạm ở đoạn cuối, đủ dài mới kết, viết xong thì dừng hẳn. Câu "KẾT THÚC" không còn khuyến khích kết sớm khi có gợi ý.
- `storyControlPrompt` (dùng chung): thêm dòng "ĐƯỢC TỰ DO ... BÊN TRONG sự kiện chính".

### Cơ chế đạt độ dài mới: "chèn diễn biến trước đoạn kết"
- Trước đây có gợi ý mà chương ngắn thì không viết tiếp (sợ bịa sau cú chốt) → phải dùng bước làm dày.
- Nay: nếu có gợi ý, model đã kết (không bị cắt) mà chương < 95% mục tiêu, hệ thống tách 1–4 đoạn cuối (~150 từ) làm "đoạn kết", nhờ AI viết PHẦN NỐI ở giữa (thêm cảnh phụ, thoại, nội tâm) rồi ghép lại: thân + phần nối + đoạn kết. Ending Anchor luôn nằm cuối, không bị viết đè.
- Tối đa 2 lượt chèn; phần chèn < 120 từ hoặc lặp thì bị bỏ; câu cuối phần chèn cụt thì lùi về câu hoàn chỉnh.
- Nếu model bị cắt giữa chừng (hết token) thì vẫn viết nối như cũ (anchor chưa tới).
- Không có gợi ý: giữ nguyên cách viết tiếp cũ.

### Nhận diện Ending Anchor
- `extractClosingBeat` nhận thêm "Ending Anchor", "anchor kết", "điểm neo kết".

### Giới hạn độ dài
- `chapterWordLimits().hardMax`: 1,15× → 1,4× mục tiêu. Chương tự do dài hơn không bị `trimToWordLimit` cắt mất anchor.

## Không đổi
- Auditor/Quality Gate, Story Control (tối đa 3 sự kiện/4 NV có tên), Knowledge Ledger, No Retcon, rào chắn tuổi 18+, định tuyến model 18+.
- Auditor đã dặn "không đếm scene beat/hành động nhỏ" vào mainEventCount nên cảnh phụ không bị tính là sự kiện chính.

## Test
- `tests/v12_20.test.js`: viết lại 3 test "mở rộng tại chỗ" thành test chèn diễn biến (anchor ở cuối, chèn ≤2 lượt, ≥95% mục tiêu, không vượt hardMax, phần chèn lặp bị bỏ); thêm test nhận diện "Ending Anchor" và hardMax 1,4×.

## Lưu ý khi dùng
- Độ dài mục tiêu nên đặt thực tế cho model của bạn; chương tự do có thể dài/ngắn lệch nhau hơn trước.
- Vì AI tự thêm chi tiết, hãy giữ bước cập nhật Character/World/Timeline sau mỗi chương để bắt chi tiết lệch canon sớm.
- Đây là bản kiểm thử bằng test tự động với model giả lập; chất lượng văn thực tế phụ thuộc model bạn dùng. Nên chạy thử 2–3 chương rồi xem anchor có nằm đúng cuối và có bị độn chữ không.
