"""E2E V12.25 — gợi ý chương sau: có ngữ cảnh truyện, kiểu Tự động, thử lại khi rỗng, hiện dần vào ô.
Chạy: python3 tests/e2e_hint_v1225.py"""
import http.server, threading, socketserver, os, json, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
res = []
def check(n, c, e=""):
    res.append(bool(c)); print(("PASS " if c else "FAIL ") + n + (f" [{e}]" if e else ""))
GOOD = "**Gợi ý ngắn Chương 2:** Lan mở cửa phòng và gặp Minh ở hành lang. " + "Cô nói chuyện với anh về chuyến đi. " * 20
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(); ctx.add_init_script("window.__XTA_TEST__=true")
    page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(f"http://127.0.0.1:{port}/index.html"); page.wait_for_timeout(1200)
    calls = []
    def api(route):
        body = json.loads(route.request.post_data or "{}")
        prompt = "\n".join(m.get("content","") for m in body.get("messages",[]) if isinstance(m.get("content"),str))
        calls.append({"prompt": prompt, "reasoning": body.get("reasoning"), "stream": body.get("stream"), "max": body.get("max_tokens")})
        n = len(calls)
        if n == 1:   # lần 1: model reasoning dùng hết token -> nội dung rỗng
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"choices":[{"message":{"content":""},"finish_reason":"length"}]}))
        else:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"choices":[{"message":{"content":GOOD},"finish_reason":"stop"}]}))
    page.route("**/chat/completions*", api)
    page.route("**/v1/**", api)
    page.evaluate("""()=>{ const state=__xta.state; state.apiEndpoint='https://openrouter.ai/api/v1/chat/completions'; state.apiKey='k'; state.model='m/x'; state.streamingEnabled=false;
      state.storyBible = state.storyBible||{}; state.mainPlot='BỐI CẢNH_DUY_NHẤT_XYZ: thành phố Hải Đảo'; state.nextChapterHint='GỢI Ý CŨ KHÔNG ĐƯỢC LẶP'; }""")
    out = page.evaluate("""async()=>{ try{ return await __xta.generateNextChapterHint('Lan đứng ở hành lang. '.repeat(60),'**Tóm tắt chương:** Lan đứng.',1); }catch(e){ return 'ERR:'+e.message } }""")
    check("trả gợi ý sau khi lần 1 rỗng (tự thử lại)", out.startswith("**Gợi ý ngắn Chương 2"), out[:40])
    check("đã gọi >= 2 lần", len(calls) >= 2, len(calls))
    check("lần 1 gửi reasoning low (OpenRouter)", calls and calls[0]["reasoning"] == {"effort":"low"}, calls[0]["reasoning"] if calls else None)
    check("lần 2 tăng max_tokens", len(calls) > 1 and calls[1]["max"] > calls[0]["max"], [c["max"] for c in calls])
    check("prompt có khối thiết lập/ngữ cảnh truyện", "THIẾT LẬP & NGỮ CẢNH TRUYỆN" in calls[0]["prompt"])
    check("prompt có Cốt truyện của thiết lập", "BỐI CẢNH_DUY_NHẤT_XYZ" in calls[0]["prompt"])
    check("prompt KHÔNG chép gợi ý cũ", "GỢI Ý CŨ KHÔNG ĐƯỢC LẶP" not in calls[0]["prompt"])
    check("kiểu Tự động có trong prompt", "TỰ CHỌN hướng phù hợp nhất" in calls[0]["prompt"])
    check("state.nextChapterHint được khôi phục sau khi dựng ngữ cảnh", page.evaluate("__xta.state.nextChapterHint") == "GỢI Ý CŨ KHÔNG ĐƯỢC LẶP")
    check("ô chọn kiểu mặc định = auto", page.evaluate("document.getElementById('hintStyle').value") in ("auto",), page.evaluate("document.getElementById('hintStyle').value"))
    # lỗi thật được ném ra (không còn nuốt)
    calls.clear()
    page.unroute("**/chat/completions*"); page.unroute("**/v1/**")
    page.route("**/v1/**", lambda r: r.fulfill(status=401, content_type="application/json", body=json.dumps({"error":{"message":"Key sai"}})))
    err = page.evaluate("""async()=>{ try{ await __xta.generateNextChapterHint('abc '.repeat(50),'s',1); return 'NOERR' }catch(e){ return e.message } }""")
    check("lỗi API thật được báo (không rỗng im lặng)", "Key sai" in err, err)
    # streaming: onPartial nhận nội dung dần
    page.unroute("**/v1/**")
    def sse(route):
        parts = ["**Gợi ý ngắn Chương 2:** Lan mở cửa. ", "Cô gặp Minh ở hành lang. " * 30]
        body = "".join("data: " + json.dumps({"choices":[{"delta":{"content":x}}]}) + "\n\n" for x in parts) + "data: [DONE]\n\n"
        route.fulfill(status=200, content_type="text/event-stream", body=body)
    page.route("**/v1/**", sse)
    r = page.evaluate("""async()=>{ __xta.state.streamingEnabled=true; const seen=[]; const out = await __xta.generateNextChapterHint('Lan đứng. '.repeat(60),'s',1,{onPartial:f=>seen.push(f.length)}); return {n:seen.length, out:out.slice(0,25)} }""")
    check("stream: onPartial được gọi nhiều lần", r["n"] >= 2, r)
    check("không lỗi JS trang", not errs, errs[:2])
    b.close()
print("TỔNG:", sum(res), "/", len(res)); raise SystemExit(0 if all(res) else 1)
