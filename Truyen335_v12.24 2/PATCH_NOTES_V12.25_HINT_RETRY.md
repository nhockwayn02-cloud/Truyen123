# V12.25 – Gợi ý chương sau luôn có khi viết xong
- generateNextChapterHint: thử tối đa 3 lần khi AI trả rỗng/lỗi (lần 2 tăng token, lần 3 chuyển sang model chính nếu đang dùng model 18+). Trước đây model reasoning dùng hết token để "nghĩ" nên nội dung cuối rỗng và không được thử lại.
- Không nuốt lỗi nữa: status/chẩn đoán chương hiện lý do thật (API lỗi, rỗng...).
- Gợi ý đã tạo nhưng ô đang có nội dung bạn tự sửa -> báo rõ thay vì im lặng.
- Đường "Viết tiếp" cũng báo lý do khi tạo gợi ý thất bại.

## V12.25b – Gợi ý Tự động + nhanh hơn
- Kiểu gợi ý mới "Tự động (theo truyện & thiết lập)" – mặc định (truyện cũ chuyển sang Tự động một lần). AI tự chọn hướng theo mạch truyện, thể loại, story bible, arc/dàn ý, nhịp các chương gần đây, mức 18+.
- Gợi ý giờ nhận NGỮ CẢNH TRUYỆN như lúc viết chương (buildContextBlock: story bible, style, arc, dàn ý, thẻ nhân vật, địa điểm, vật phẩm, 3 tóm tắt gần). Brief cũ được tạm xóa để AI không chép lại gợi ý cũ. Giới hạn ~7000 ký tự.
- Nhanh hơn: gợi ý chạy SONG SONG với tóm tắt (không chờ); stream và hiện DẦN vào ô Gợi ý (không đè nếu bạn đang gõ/sửa ô); OpenRouter gửi reasoning effort "low" (tự bỏ nếu endpoint trả 400).
- Model 18+ vẫn tự chọn theo nội dung chương + cài đặt nsfwMode/modelNsfw.
- Test mới: tests/e2e_hint_v1225.py (13 ca).
