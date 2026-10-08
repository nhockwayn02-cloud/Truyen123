// V12.24 — Chương phải CHẠM ĐIỂM KẾT (không chỉ đủ số từ). Test phần dùng chung + viết nền (worker).
// Tái hiện lỗi: chương dừng ở ~4200/5000 từ khi chưa tới kết; viết tiếp lên 5400 từ vẫn chưa tới kết.
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../netlify/functions/write-chapter-background.js"), "utf8");
const mod = { exports: {} };
const sandbox = { module: mod, exports: mod.exports, console, process, Buffer, setTimeout, clearTimeout, URL, AbortController, TextDecoder, TextEncoder,
  require: (n) => (n === "@netlify/blobs" ? { getStore() {}, connectLambda() {} } : require(n)), fetch: async () => { throw new Error("network disabled"); } };
vm.createContext(sandbox);
vm.runInContext(src + "\n;module.exports.__t={getEndingTarget,parseEndingCheck,buildFinishPrompt,buildEndingCheckPrompt,isFinishDoneReply,finishWordBudget,generateOneChapter,ENDING_FINISH_EXTRA};", sandbox);
const T = mod.exports.__t;
let pass = 0, fail = 0; const pending = [];
function t(name, fn) { const ok = () => { console.log("PASS " + name); pass++; }, bad = e => { console.log("FAIL " + name + " — " + e.message); fail++; };
  try { const r = fn(); if (r && r.then) { pending.push(r.then(ok, bad)); return; } ok(); } catch (e) { bad(e); } }

// ---------- phần dùng chung ----------
t("getEndingTarget: ưu tiên cú chốt ghi rõ", () => {
  assert(/tắt đèn/.test(T.getEndingTarget("Cô vào phòng, mở tủ ra xem.\nEnding Anchor: cô viết dòng chữ rồi tắt đèn.", "")));
});
t("getEndingTarget: không có cú chốt → nhịp cuối của gợi ý", () => {
  const e = T.getEndingTarget("Cô vào phòng và mở tủ ra xem đồ.\nAnh gọi điện báo tin cho cô biết.\nCô nhìn ra cửa sổ rất lâu rồi mỉm cười.", "");
  assert(/mỉm cười/.test(e) && !/mở tủ/.test(e));
});
t("getEndingTarget: chỉ có MỆNH LỆNH (không cú chốt) → rỗng, không đoán bừa", () => {
  assert.strictEqual(T.getEndingTarget("", "Giữ giọng văn lạnh, không tả cảnh nóng."), "");
});
t("parseEndingCheck: JSON, JSON lẫn chữ, true/false dạng chữ, rác", () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.parseEndingCheck('{"reached":false,"missing":"A; B"}'))), { reached: false, missing: "A; B" });
  assert.strictEqual(T.parseEndingCheck('Đây: {"reached": true, "missing": ""} xong').reached, true);
  assert.strictEqual(T.parseEndingCheck('{"reached":"false"}').reached, false);
  assert.strictEqual(T.parseEndingCheck("không rõ").reached, null);
  assert.strictEqual(T.parseEndingCheck("").reached, null);
});
t("buildFinishPrompt: có điểm kết, nhịp thiếu, trần từ, lối thoát [ĐÃ XONG]", () => {
  const p = T.buildFinishPrompt({ chapterNumber: 3, wc: 5400, goal: 4750, maxWords: 7000, ending: "Cô tắt đèn.", missing: "Anh xuất hiện; cô quyết định", hint: "g", directive: "", tail: "ĐOẠN_CUỐI_XYZ" });
  assert(/CHẠM ĐIỂM KẾT/.test(p) && /Cô tắt đèn\./.test(p) && /Anh xuất hiện/.test(p) && /1600/.test(p) && /\[ĐÃ XONG\]/.test(p) && /ĐOẠN_CUỐI_XYZ/.test(p));
});
t("finishWordBudget: không âm, luôn ≥ 700 khi còn chỗ, minCap cho phép vượt trần chung", () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.finishWordBudget(5400, 4750, 7000))), { want: 700, cap: 1600 });
  assert.strictEqual(T.finishWordBudget(6990, 4750, 7000, 700).cap, 700);
  assert(T.finishWordBudget(8000, 4750, 7000).want >= 0);
});
t("isFinishDoneReply chỉ nhận câu ngắn [ĐÃ XONG]", () => {
  assert(T.isFinishDoneReply("[ĐÃ XONG]") && T.isFinishDoneReply(" đã xong. "));
  assert(!T.isFinishDoneReply("Cô nói: tôi đã xong việc rồi. ".repeat(10)));
});

// ---------- viết nền (worker) ----------
const pw = (n) => { let x = ""; n = n + 1000; while (n > 0) { x += "bcdglmnpqrstvx"[n % 14] + "ảẹồưếịơ"[Math.floor(n / 14) % 7]; n = Math.floor(n / 70); } return x; };
let _u = 0;
const uniq = (w) => { const out = []; let cnt = 0; while (cnt < w) { const s = []; for (let i = 0; i < 12; i++) s.push(pw(++_u)); out.push("Cô " + s.join(" ") + "."); cnt += 13; } return out.join(" "); };
const mk = (n, w) => Array.from({ length: n }, () => uniq(w)).join("\n\n");
const ANCHOR = "Cô viết dòng chữ nhỏ rồi tắt đèn.";
const HINT = "Cô vào phòng và mở tủ.\nAnh gọi điện báo tin cho cô.\nEnding Anchor: cô viết dòng chữ rồi tắt đèn.";
const job = (extra) => ({ apiEndpoint: "x", apiKey: "k", model: "m", storyState: Object.assign({ chapters: [], characters: [], directive: "", nextChapterHint: HINT, minChapterWords: 1000, autoContinueMax: 4, chapterMatureFocus: "none" }, extra || {}) });
const kind = (p) => /biên tập viên kiểm tra tiến độ chương/.test(p) ? "check" : /VIẾT TIẾP chương \d+ ĐỂ CHẠM ĐIỂM KẾT/.test(p) ? "finish" : /CHÈN THÊM DIỄN BIẾN/.test(p) ? "insert" : /MỞ RỘNG CHƯƠNG/.test(p) ? "expand" : /Lập KẾ HOẠCH cho CHƯƠNG/.test(p) ? "plan" : /Viết TIẾP chương/.test(p) ? "cont" : "main";
const count = (calls, k) => calls.filter(c => c === k).length;

(async () => {
  // A) TÁI HIỆN LỖI: chương dừng ~900/1000 từ, chưa có kết. Check: chưa tới kết → phải "chốt kết" (không chèn vào giữa) → có kết → dừng.
  {
    const calls = []; let checks = 0;
    sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content, k = kind(p); calls.push(k);
      if (k === "check") { checks++; return { text: checks === 1 ? '{"reached":false,"missing":"Anh gọi điện; cô viết dòng chữ"}' : '{"reached":true,"missing":""}', finishReason: "stop" }; }
      if (k === "finish") return { text: mk(2, 120) + "\n\n" + ANCHOR, finishReason: "stop" };
      return { text: mk(8, 100), finishReason: "stop" }; };
    const c = await T.generateOneChapter(job());
    t("A: chương dừng giữa chừng → viết tiếp để CHỐT KẾT (không chèn diễn biến vào giữa)", () => {
      assert(count(calls, "finish") === 1, "số lượt chốt kết: " + count(calls, "finish"));
      assert(count(calls, "insert") === 0 && count(calls, "expand") === 0, "không chèn/mở rộng khi chưa tới kết");
      assert(c.text.trim().endsWith(ANCHOR), "chương phải kết ở Ending Anchor");
      assert(count(calls, "check") === 2, "kiểm tra trước và sau khi nối: " + count(calls, "check"));
    });
    t("A: lượt chốt kết mang điểm kết + nhịp còn thiếu từ bước kiểm tra", () => {
      assert(c.briefUsed && /tắt đèn/.test(c.briefUsed.hint), "chương phải lưu briefUsed");
      assert(!c.autoUpdateIssues.some(x => /CHƯA TỚI ĐIỂM KẾT/.test(x)), "đã tới kết thì không còn cảnh báo thiếu kết");
    });
  }
  // B) Đã tới kết nhưng còn ngắn → vẫn CHÈN vào trước đoạn kết như V12.22 (không đổi)
  {
    const calls = [];
    sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content, k = kind(p); calls.push(k);
      if (k === "check") return { text: '{"reached":true,"missing":""}', finishReason: "stop" };
      if (k === "insert") return { text: mk(3, 100) + " Gió lùa qua khe cửa.", finishReason: "stop" };
      return { text: mk(5, 100) + "\n\n" + ANCHOR, finishReason: "stop" }; };
    const c = await T.generateOneChapter(job());
    t("B: đã có kết mà còn ngắn → chèn diễn biến trước đoạn kết, kết vẫn ở cuối", () => {
      assert(count(calls, "insert") >= 1 && count(calls, "finish") === 0);
      assert(c.text.trim().endsWith(ANCHOR) && c.text.split(ANCHOR).length === 2);
    });
  }
  // C) Đủ số từ nhưng CHƯA tới kết (đúng ca 5400 từ vẫn chưa tới kết): không được dừng chỉ vì đủ từ
  {
    const calls = []; let checks = 0;
    sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content, k = kind(p); calls.push(k);
      if (k === "check") { checks++; return { text: checks === 1 ? '{"reached":false,"missing":"cảnh cuối"}' : '{"reached":true,"missing":""}', finishReason: "stop" }; }
      if (k === "finish") return { text: mk(2, 80) + "\n\n" + ANCHOR, finishReason: "stop" };
      return { text: mk(11, 100), finishReason: "stop" }; };   // ~1140 từ ≥ 95% mục tiêu 1000
    const c = await T.generateOneChapter(job());
    t("C: đủ số từ nhưng chưa tới kết → vẫn viết tiếp để chốt kết", () => {
      assert(count(calls, "finish") === 1, "chốt kết: " + count(calls, "finish"));
      assert(c.text.trim().endsWith(ANCHOR));
    });
  }
  // D) Luôn "chưa tới kết": số lượt bị chặn (autoContinueMax + ENDING_FINISH_EXTRA), không mở rộng, báo rõ lý do
  {
    const calls = [];
    sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content, k = kind(p); calls.push(k);
      if (k === "check") return { text: '{"reached":false,"missing":"nhịp cuối"}', finishReason: "stop" };
      if (k === "finish") return { text: mk(1, 90), finishReason: "stop" };
      return { text: mk(8, 100), finishReason: "stop" }; };
    const c = await T.generateOneChapter(job({ autoContinueMax: 1 }));
    t("D: không bao giờ tới kết → tối đa 1 + ENDING_FINISH_EXTRA lượt, không mở rộng, báo CHƯA TỚI ĐIỂM KẾT", () => {
      assert(count(calls, "finish") <= 1 + T.ENDING_FINISH_EXTRA, "lượt chốt kết: " + count(calls, "finish"));
      assert(count(calls, "expand") === 0, "chưa tới kết thì không mở rộng");
      assert(c.autoUpdateIssues.some(x => /CHƯA TỚI ĐIỂM KẾT.*nhịp cuối/.test(x)), JSON.stringify(c.autoUpdateIssues));
    });
  }
  // E) AI đáp [ĐÃ XONG] ở lượt chốt kết → không nối thêm gì (kiểm tra trước nhận nhầm)
  {
    const calls = []; let checks = 0;
    sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content, k = kind(p); calls.push(k);
      if (k === "check") { checks++; return { text: checks === 1 ? '{"reached":false,"missing":"x"}' : '{"reached":true,"missing":""}', finishReason: "stop" }; }
      if (k === "finish") return { text: "[ĐÃ XONG]", finishReason: "stop" };
      if (k === "insert") return { text: mk(3, 100) + " Gió lùa qua khe cửa.", finishReason: "stop" };
      return { text: mk(5, 100) + "\n\n" + ANCHOR, finishReason: "stop" }; };
    const c = await T.generateOneChapter(job());
    t("E: AI xác nhận [ĐÃ XONG] → không nối thêm sau kết; còn ngắn thì chèn vào trước đoạn kết", () => {
      assert(!/ĐÃ XONG/.test(c.text), "không được lọt [ĐÃ XONG] vào truyện");
      assert(c.text.trim().endsWith(ANCHOR) && c.text.split(ANCHOR).length === 2);
    });
  }
  // F) Bước kiểm tra lỗi/không đọc được → hành vi y như V12.23 (không ép viết thêm)
  {
    const calls = [];
    sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content, k = kind(p); calls.push(k);
      if (k === "check") throw new Error("API lỗi");
      if (k === "insert") return { text: mk(3, 100) + " Gió lùa qua khe cửa.", finishReason: "stop" };
      return { text: mk(5, 100) + "\n\n" + ANCHOR, finishReason: "stop" }; };
    const c = await T.generateOneChapter(job());
    t("F: kiểm tra điểm kết lỗi → coi là 'không biết', chạy như cũ (chèn), không chốt kết bừa", () => {
      assert(count(calls, "finish") === 0 && count(calls, "insert") >= 1);
      assert(c.text.trim().endsWith(ANCHOR));
    });
  }
  // G) Không có gợi ý → không gọi kiểm tra điểm kết, vẫn viết tiếp như cũ
  {
    const calls = [];
    sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content, k = kind(p); calls.push(k); return { text: mk(5, 100), finishReason: "stop" }; };
    await T.generateOneChapter(job({ nextChapterHint: "" }));
    t("G: không gợi ý → không kiểm tra điểm kết, vẫn viết tiếp đến đủ số từ", () => assert(count(calls, "check") === 0 && count(calls, "cont") >= 1));
  }
  await Promise.all(pending);
  console.log(`\n${pass}/${pass + fail} PASS`); process.exit(fail ? 1 : 0);
})();
