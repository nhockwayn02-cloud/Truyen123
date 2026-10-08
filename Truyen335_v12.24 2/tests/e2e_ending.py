"""E2E V12.24 — viết thường: chương phải CHẠM ĐIỂM KẾT (không chỉ đủ số từ) + nút ➕ Viết Tiếp.
Chạy: python3 tests/e2e_ending.py  (cần playwright + chromium)"""
import http.server, threading, socketserver, os, sys, json, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Q, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", 0), Handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{port}/index.html"

results = []
def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))

ANCHOR = "Cô viết dòng chữ nhỏ rồi tắt đèn."
HINT = "Cô vào phòng và mở tủ ra xem.\nAnh gọi điện báo tin cho cô.\nEnding Anchor: cô viết dòng chữ rồi tắt đèn."
NEXT_HINT = "Chương sau: cô lên tàu đi Hà Nội gặp bà ngoại."

import random
_rng = random.Random(20260707)
_C = list("bcdghklmnpqrstvx"); _V = list("aăâeêioôơuưy"); _T = ["", "n", "m", "ng", "t", "c", "nh"]
def _word():
    return "".join(_rng.choice(_C) + _rng.choice(_V) + _rng.choice(_T) for _ in range(_rng.choice([1, 2, 2, 3])))
def words(n, tag=""):
    """n từ ngẫu nhiên có seed, mỗi lần gọi ra văn bản khác nhau (không tuần hoàn) để không bị bộ lọc chống lặp loại."""
    return " ".join(_word() for _ in range(n))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context()
    ctx.add_init_script("window.__XTA_TEST__=true")
    page = ctx.new_page()
    errs = []
    page.on("dialog", lambda d: d.accept())
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL); page.wait_for_timeout(1200)

    log = []   # (kind, prompt)
    mode = {"finish_says_done": False}
    def kind_of(prompt):
        if "biên tập viên kiểm tra tiến độ chương" in prompt: return "check"
        if "ĐỂ CHẠM ĐIỂM KẾT" in prompt: return "finish"
        if "CHÈN THÊM DIỄN BIẾN" in prompt: return "insert"
        if "MỞ RỘNG CHƯƠNG" in prompt: return "expand"
        if "Bạn đang viết CHƯƠNG THỨ" in prompt: return "main"
        if "Bạn đang VIẾT TIẾP chương" in prompt: return "cont"
        return "other"

    def mock_api(route):
        req = route.request
        try: body = json.loads(req.post_data or "{}")
        except Exception: body = {}
        msgs = body.get("messages", [])
        prompt = "\n".join(m.get("content", "") if isinstance(m.get("content"), str) else "" for m in msgs)
        k = kind_of(prompt)
        log.append((k, prompt))
        def ok(content, fr="stop"):
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"choices": [{"message": {"content": content}, "finish_reason": fr}]}, ensure_ascii=False))
        def sse(content):
            chunks = [content[i:i+120] for i in range(0, len(content), 120)]
            s = "".join("data: " + json.dumps({"choices": [{"delta": {"content": c}}]}, ensure_ascii=False) + "\n\n" for c in chunks)
            s += "data: " + json.dumps({"choices": [{"delta": {}, "finish_reason": "stop"}]}) + "\n\ndata: [DONE]\n\n"
            route.fulfill(status=200, content_type="text/event-stream", body=s)
        def reply(content):
            sse(content) if body.get("stream") else ok(content)
        if k == "check":
            # giả lập AI thật: chỉ "reached" khi điểm kết (ANCHOR) thực sự nằm trong chương được gửi
            body_part = prompt.split("===== CHƯƠNG HIỆN TẠI")[-1]
            ok(json.dumps({"reached": "tắt đèn" in body_part, "missing": "" if "tắt đèn" in body_part else "Anh gọi điện báo tin; cô viết dòng chữ rồi tắt đèn"}, ensure_ascii=False)); return
        if k == "finish":
            reply("[ĐÃ XONG]" if mode["finish_says_done"] else (words(30, "tiep") + ". " + ANCHOR)); return
        if k == "main":
            reply("TIÊU ĐỀ: Đêm mưa\nNỘI DUNG: " + words(440, "mo") + "."); return
        if "QUALITY AUDITOR" in prompt:
            obj = {"score": 95, "verdict": "PASS", "dimensions": {}, "mainEventCount": 1, "namedCharacterCount": 1, "unauthorizedImportantCharacter": False, "knowledgeViolation": False, "retcon": False, "outlineDeviation": False, "hardFailures": [], "warnings": [], "suggestions": []}
            ok(json.dumps(obj, ensure_ascii=False)); return
        if body.get("stream"): sse("Chương này kể về một đêm mưa. Nhân vật chính rời phố cũ."); return
        content = "[]" if ("mảng JSON" in prompt or "MẢNG" in prompt) else "Chương này kể về một đêm mưa. Nhân vật chính rời phố cũ."
        if "JSON" in prompt and "mảng" not in prompt.lower(): content = "{}"
        ok(content)
    page.route("**/chat/completions", mock_api)

    SET = """(h)=>{const s=__xta.state; s.apiEndpoint=%r; s.apiKey='test-key'; s.minChapterWords=100; s.nsfwMode='off'; s.mature=false;
      s.autoContinueEnabled=true; s.autoContinueMax=4; s.spellCheckEnabled=false; s.qualityGateEnabled=false; s.autoSummaryEnabled=false; s.autoSceneEnabled=false;
      s.nextChapterHint=h; document.getElementById('nextChapterHint').value=h; s.directive='';}""" % ("http://127.0.0.1:%d/chat/completions" % port)
    def wait_idle(timeout=60):
        for _ in range(timeout * 2):
            page.wait_for_timeout(500)
            if not page.evaluate("()=>document.getElementById('writeChapterBtn').disabled"): return True
        return False
    def count(k): return len([1 for kk, _ in log if kk == k])
    last = "()=>{const c=__xta.state.chapters[__xta.state.chapters.length-1]; return {n:__xta.state.chapters.length, text:c.text, wc:c.wordCount, brief:c.briefUsed||null, diag:c.updateDiagnostics||[]}}"

    # ---------- 1) Viết chương có gợi ý + Ending Anchor; model dừng sớm (chưa tới kết, chưa đủ từ) ----------
    page.evaluate(SET, HINT)
    page.evaluate("()=>document.getElementById('writeChapterBtn').click()")
    page.wait_for_timeout(800); ok_idle = wait_idle()
    info = page.evaluate(last)
    check("1. Viết xong, nút mở lại", ok_idle and info["n"] == 1, str(info["n"]))
    check("2. Chương chưa tới kết → app tự viết tiếp để CHỐT KẾT (1 lượt)", count("finish") == 1, f"finish={count('finish')}")
    check("3. KHÔNG chèn diễn biến vào giữa khi chưa tới kết", count("insert") == 0 and count("expand") == 0, f"insert={count('insert')} expand={count('expand')}")
    check("4. Chương KẾT ĐÚNG Ending Anchor", info["text"].strip().endswith(ANCHOR), info["text"][-60:])
    check("5. Kiểm tra điểm kết chạy trước và sau khi nối (≥2 lần)", count("check") >= 2, f"check={count('check')}")
    check("6. Chương lưu brief đã dùng (briefUsed) để Viết tiếp sau này biết điểm kết", info["brief"] and "tắt đèn" in info["brief"]["hint"], str(info["brief"])[:80])
    check("7. Lượt chốt kết mang điểm kết + nhịp còn thiếu", any(k == "finish" and "tắt đèn" in p and "Anh gọi điện báo tin" in p for k, p in log))
    check("8. Không còn cảnh báo 'chưa tới điểm kết'", not any("CHƯA TỚI ĐIỂM KẾT" in d for d in info["diag"]), str(info["diag"]))

    # ---------- 2) Nút ➕ Viết Tiếp: chương chưa tới kết; ô Gợi ý lúc này là gợi ý CHƯƠNG SAU (không được dùng) ----------
    page.wait_for_timeout(2500)   # chờ hậu xử lý chương 1 xong
    short_body = words(440, "mo") + "."
    page.evaluate("""(t)=>{const s=__xta.state; const c=s.chapters[s.chapters.length-1]; c.text=t; c.wordCount=440; c.updateDiagnostics=[];
      s.currentChapterIndex=s.chapters.length-1; s.nextChapterHint=%s; document.getElementById('nextChapterHint').value=s.nextChapterHint; }""" % json.dumps(NEXT_HINT, ensure_ascii=False), short_body)
    n0 = len(log)
    page.evaluate("()=>document.getElementById('continueChapterBtn').click()")
    page.wait_for_timeout(1500)
    for _ in range(80):
        if not page.evaluate("()=>document.getElementById('continueChapterBtn').disabled"): break
        page.wait_for_timeout(500)
    page.wait_for_timeout(1500)
    seg = log[n0:]
    fin = [p for k, p in seg if k == "finish"]
    info = page.evaluate(last)
    check("9. Viết Tiếp: chương chưa tới kết → dùng lệnh CHỐT KẾT thay vì viết tự do", len(fin) == 1, str([k for k, _ in seg][:8]))
    check("10. Lệnh chốt kết dùng điểm kết của CHƯƠNG NÀY, không lấy nhầm gợi ý chương sau", fin and "tắt đèn" in fin[0] and "Hà Nội" not in fin[0])
    check("11. Viết Tiếp xong: chương kết đúng Ending Anchor", info["text"].strip().endswith(ANCHOR), info["text"][-60:])
    check("12. Viết Tiếp: không còn cảnh báo thiếu kết", not any("CHƯA TỚI ĐIỂM KẾT" in d for d in info["diag"]), str(info["diag"]))

    # ---------- 3) Viết Tiếp khi chương ĐÃ tới kết: không ép chốt kết, chạy như cũ ----------
    n0 = len(log)
    page.evaluate("()=>document.getElementById('continueChapterBtn').click()")
    page.wait_for_timeout(1500)
    for _ in range(80):
        if not page.evaluate("()=>document.getElementById('continueChapterBtn').disabled"): break
        page.wait_for_timeout(500)
    seg = [k for k, _ in log[n0:]]
    check("13. Chương đã tới kết → Viết Tiếp KHÔNG dùng lệnh chốt kết (viết tự do như trước)", "finish" not in seg and "check" in seg, str(seg[:6]))

    # ---------- 4) Chương cũ không có brief/plan: Viết Tiếp chạy như cũ, không gọi kiểm tra ----------
    page.wait_for_timeout(2500)
    page.evaluate("""()=>{const s=__xta.state; const c=s.chapters[s.chapters.length-1]; delete c.briefUsed; c.plan=''; s.nextChapterHint='Gợi ý khác hoàn toàn của chương sau.'; }""")
    n0 = len(log)
    page.evaluate("()=>document.getElementById('continueChapterBtn').click()")
    page.wait_for_timeout(1500)
    for _ in range(80):
        if not page.evaluate("()=>document.getElementById('continueChapterBtn').disabled"): break
        page.wait_for_timeout(500)
    seg = [k for k, _ in log[n0:]]
    check("14. Chương cũ không lưu brief → Viết Tiếp y như trước (không kiểm tra, không chốt kết)", "check" not in seg and "finish" not in seg, str(seg[:6]))

    # ---------- 5) AI đáp [ĐÃ XONG] ở lượt chốt kết (kiểm tra nhầm) → không nối thêm ----------
    page.wait_for_timeout(2500)
    mode["finish_says_done"] = True
    page.evaluate(SET, HINT)
    page.evaluate("()=>document.getElementById('writeChapterBtn').click()")
    page.wait_for_timeout(800); ok_idle = wait_idle()
    info = page.evaluate(last)
    check("15. AI đáp [ĐÃ XONG] → không lọt [ĐÃ XONG] vào truyện", ok_idle and "ĐÃ XONG" not in info["text"], info["text"][-80:])

    check("16. Không lỗi JS suốt quá trình", not errs, "; ".join(errs)[:200])
    b.close()

bad = [n for n, ok in results if not ok]
print(f"\n{len(results)-len(bad)}/{len(results)} PASS")
sys.exit(1 if bad else 0)
