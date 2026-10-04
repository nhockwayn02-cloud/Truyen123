// V12.20 — test: từ lỗi ghép, câu cuối bị cụt, chương bám gợi ý (không bịa thêm sau cú chốt)
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../netlify/functions/write-chapter-background.js"), "utf8");
const mod = { exports: {} };
const sandbox = { module: mod, exports: mod.exports, console, process, Buffer, setTimeout, clearTimeout, URL, AbortController, TextDecoder, TextEncoder,
  require: (n) => (n === "@netlify/blobs" ? { getStore() {}, connectLambda() {} } : require(n)), fetch: async () => { throw new Error("network disabled"); } };
vm.createContext(sandbox);
vm.runInContext(src + "\n;module.exports.__t={findStrayWords,locateWordSentences,acceptWordFix,endsCleanly,trimToLastSentence,extractClosingBeat,trimToWordLimit,generateOneChapter};", sandbox);
const T = mod.exports.__t;
let pass = 0, fail = 0; const pending = [];
function t(name, fn) { const ok = () => { console.log("PASS " + name); pass++; }, bad = e => { console.log("FAIL " + name + " — " + e.message); fail++; };
  try { const r = fn(); if (r && r.then) { pending.push(r.then(ok, bad)); return; } ok(); } catch (e) { bad(e); } }

t("findStrayWords bắt từ CÓ DẤU bị ghép lỗi, không báo nhầm tiếng Việt thật", () => {
  const bad = Array.from(T.findStrayWords("Giọng mươititude, bọcampo, bănnton."));
  assert.deepStrictEqual(bad.sort(), ["bănnton", "bọcampo", "mươititude"].sort());
  const ok = Array.from(T.findStrayWords("Nguyễn Hằng nghiêng người, khuỷu tay chuyển nghiệp, quyết nguyệt, thương, thuở, giường, ngoằn ngoèo, uỵch, oằn, ngoáy, quán café."));
  assert.deepStrictEqual(ok, []);
});
t("trimToWordLimit cắt ở câu hoàn chỉnh dù đoạn dài hơn 180 từ", () => {
  const sent = "Anh bước đi chậm rãi qua hành lang dài và tối. ";
  const text = sent.repeat(60) + "Rồi anh dừng lại";
  const r = T.trimToWordLimit(text, 300);
  assert(r.trimmed && /[.!?…]$/.test(r.text), "phải kết thúc bằng dấu câu: " + r.text.slice(-30));
});
t("endsCleanly / trimToLastSentence", () => {
  assert.strictEqual(T.endsCleanly("Cô đi. Rồi cô"), false);
  assert.strictEqual(T.endsCleanly("Cô nói: “Đi thôi.”"), true);
  const r = T.trimToLastSentence("Câu một khá dài để đủ tỉ lệ giữ lại. Câu hai cũng vậy nè. Rồi cô", 0.5);
  assert(r.cut && r.text.endsWith("vậy nè."));
});
t("extractClosingBeat lấy đúng dòng cú chốt", () => {
  assert(/tắt đèn/.test(T.extractClosingBeat("Cô vào phòng.\nCú chốt cuối chương: cô viết dòng chữ rồi tắt đèn.")));
  assert.strictEqual(T.extractClosingBeat("Cô vào phòng, mở tủ."), "");
});
t("acceptWordFix: nhận câu sửa đúng, từ chối câu còn từ lỗi / bịa thêm", () => {
  const o = "Anh nhìn bọcampo rồi cười khẽ với cô.";
  assert(T.acceptWordFix(o, "Anh nhìn tập hồ sơ rồi cười khẽ với cô.", ["bọcampo"]));
  assert(!T.acceptWordFix(o, "Anh nhìn bọcampo rồi cười khẽ với cô.", ["bọcampo"]));
  assert(!T.acceptWordFix(o, "Một câu hoàn toàn khác không liên quan gì đến câu gốc ở trên.", ["bọcampo"]));
});

const words = (n, tag) => Array.from({ length: n }, (_, i) => `${tag}${i % 7}`).join(" ");
const para = (n) => { const out = []; for (let i = 0; out.join(" ").split(/\s+/).length < n; i++) out.push(`Buổi ${i} cô đi qua con phố số ${i * 7} và nghe tiếng gió thổi ${i % 5} lần.`); return out.join(" "); };
function job(extra) { return { apiEndpoint: "x", apiKey: "k", model: "m", storyState: Object.assign({ chapters: [], characters: [], directive: "", nextChapterHint: "", minChapterWords: 500, autoContinueMax: 4, chapterMatureFocus: "none" }, extra || {}) }; }

(async () => {
  // Có gợi ý: văn bản ngắn hơn mục tiêu nhưng KHÔNG được gọi "Viết TIẾP"
  let calls = []; sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content; calls.push(p); return { text: para(150), finishReason: "stop" }; };
  const c1 = await T.generateOneChapter(job({ nextChapterHint: "Cô vào phòng, mở tủ.\nCú chốt cuối chương: cô viết dòng chữ rồi tắt đèn." }));
  t("Có gợi ý + model tự dừng → KHÔNG tự viết tiếp để đủ số từ", () => {
    assert(!calls.some(p => /Viết TIẾP chương/.test(p)), "không được có lượt viết tiếp");
    assert(calls.filter(p => !/MỞ RỘNG ĐOẠN/.test(p)).length === 1, "chỉ 1 lượt viết chính");
    assert(/CÚ CHỐT BẮT BUỘC/.test(calls[0]) && /tắt đèn/.test(calls[0]), "prompt phải khóa cú chốt ở cuối");
  });
  // Có gợi ý + chương ngắn: MỞ RỘNG TẠI CHỖ, giữ nguyên đoạn kết
  calls = [];
  const base = para(150).split(". ");
  const orig = base.join(". ") + "\n\nCô viết dòng chữ nhỏ rồi tắt đèn.";
  sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content; calls.push(p);
    if (/MỞ RỘNG ĐOẠN/.test(p)) { const src = p.split("===== ĐOẠN GỐC CẦN MỞ RỘNG =====")[1].split("===== HẾT ĐOẠN GỐC")[0].trim(); return { text: src.replace(/\. /g, ". Ánh đèn hắt lên tường, hơi lạnh phả vào gáy cô. "), finishReason: "stop" }; }
    return { text: orig, finishReason: "stop" }; };
  const cx = await T.generateOneChapter(job({ nextChapterHint: "Cô vào phòng.\nCú chốt cuối chương: cô viết dòng chữ rồi tắt đèn." }));
  t("Có gợi ý + chương ngắn → mở rộng tại chỗ, đoạn kết giữ nguyên, không viết nối", () => {
    assert(calls.some(p => /MỞ RỘNG ĐOẠN/.test(p)), "phải có lượt mở rộng");
    assert(!calls.some(p => /Viết TIẾP chương/.test(p)));
    assert(cx.wordCount > 300, "dài hơn bản gốc: " + cx.wordCount);
    assert(/Cô viết dòng chữ nhỏ rồi tắt đèn\.$/.test(cx.text));
    assert(cx.autoUpdateIssues.some(x => /Đã mở rộng chương/.test(x)));
  });
  // Chương dài 2867 từ, mục tiêu 4500: mở rộng theo nhiều đoạn, ra gần mục tiêu, giữ cú chốt
  const big = para(2860) + "\n\nCô viết dòng chữ nhỏ rồi tắt đèn."; const bigParas = [];
  { const ss = big.split(". "); for (let i = 0; i < ss.length; i += 6) bigParas.push(ss.slice(i, i + 6).join(". ")); }
  const bigText = bigParas.join("\n\n"); let chunkCalls = 0;
  sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content;
    if (/MỞ RỘNG ĐOẠN/.test(p)) { chunkCalls++; const src = p.split("===== ĐOẠN GỐC CẦN MỞ RỘNG =====")[1].split("===== HẾT ĐOẠN GỐC")[0].trim(); const w = src.split(/\s+/).length; const tw = Number((p.match(/thành khoảng (\d+) từ/) || [])[1]); const filler = " Ánh đèn hắt lên tường, hơi lạnh phả vào gáy cô, tiếng bước chân vang khẽ."; let o = src; const ps = o.split("\n\n"); let k = 0; while (o.split(/\s+/).length < tw * 0.95) { const m = ps.length > 1 ? ps.length - 1 : 1; ps[k % m] = ps[k % m] + filler; o = ps.join("\n\n"); k++; if (k > 400) break; } return { text: o, finishReason: "stop" }; }
    return { text: bigText, finishReason: "stop" }; };
  const cb = await T.generateOneChapter(job({ minChapterWords: 4500, nextChapterHint: "Cô vào phòng.\nCú chốt cuối chương: cô viết dòng chữ rồi tắt đèn." }));
  t("Chương 2867 từ, mục tiêu 4500 → mở rộng theo nhiều đoạn, đạt >=90% mục tiêu, giữ cú chốt", () => {
    assert(chunkCalls >= 3, "phải chia nhiều đoạn: " + chunkCalls); // V12.21: khối ~900 từ nên 2867 từ -> 3 khối
    assert(cb.wordCount >= 4050 && cb.wordCount <= 5175, "số từ: " + cb.wordCount);
    assert(/tắt đèn\.$/.test(cb.text));
  });
  // Mở rộng làm đổi đoạn kết -> bị từ chối, giữ bản gốc
  sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content;
    if (/MỞ RỘNG ĐOẠN/.test(p)) return { text: para(500) + "\n\nSáng hôm sau một nhân vật lạ xuất hiện ở cổng và mọi chuyện bắt đầu một cuộc rượt đuổi mới.", finishReason: "stop" };
    return { text: orig, finishReason: "stop" }; };
  const cy = await T.generateOneChapter(job({ nextChapterHint: "Cô vào phòng.\nCú chốt cuối chương: cô viết dòng chữ rồi tắt đèn." }));
  t("Mở rộng làm đổi đoạn kết (bịa thêm) → bị từ chối, giữ bản gốc", () => {
    assert(/tắt đèn\.$/.test(cy.text)); assert(cy.autoUpdateIssues.some(x => /Mở rộng chương không đạt/.test(x)));
  });
  sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content; calls.push(p); return { text: para(150), finishReason: "stop" }; };
  // Không gợi ý: vẫn viết tiếp như cũ
  calls = []; await T.generateOneChapter(job());
  t("Không gợi ý → vẫn viết tiếp đến đủ số từ như cũ", () => assert(calls.some(p => /Viết TIẾP chương/.test(p))));
  // Có gợi ý + bị cắt (length): được viết tiếp, và lệnh viết tiếp mang theo gợi ý + cú chốt
  calls = []; let n = 0;
  sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content; calls.push(p); n++; return n === 1 ? { text: para(150), finishReason: "length" } : { text: para(400) + " Cô viết dòng chữ rồi tắt đèn.", finishReason: "stop" }; };
  await T.generateOneChapter(job({ nextChapterHint: "Cô vào phòng.\nCú chốt cuối chương: cô viết dòng chữ rồi tắt đèn." }));
  t("Có gợi ý + bị cắt giữa chừng → viết tiếp kèm gợi ý và cú chốt", () => {
    const cont = calls.find(p => /Viết TIẾP chương/.test(p)); assert(cont, "phải có lượt viết tiếp");
    assert(/KẾ HOẠCH CỦA NGƯỜI DÙNG/.test(cont) && /CÚ CHỐT CUỐI CHƯƠNG/.test(cont));
  });
  // Câu cuối cụt → AI khép chương
  calls = []; n = 0;
  sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content; calls.push(p); n++;
    if (/bị CỤT giữa câu/.test(p)) return { text: "mím môi rồi tắt đèn.", finishReason: "stop" };
    return { text: para(150) + " Cô kéo tập da đen ra, viết thêm một dòng chữ nhỏ. Rồi cô", finishReason: "stop" }; };
  const c4 = await T.generateOneChapter(job({ nextChapterHint: "Cô viết chữ." }));
  t("Câu cuối bị cụt → được khép bằng câu hoàn chỉnh", () => { assert(/Rồi cô mím môi rồi tắt đèn\.$/.test(c4.text), c4.text.slice(-60)); assert(c4.autoUpdateIssues.some(x => /bị cụt/.test(x))); });
  // Cụt và AI khép lỗi → lùi về câu hoàn chỉnh
  sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content; if (/bị CỤT giữa câu/.test(p)) throw new Error("lỗi mạng"); return { text: para(150) + " Rồi cô", finishReason: "stop" }; };
  const c5 = await T.generateOneChapter(job({ nextChapterHint: "Cô viết chữ." }));
  t("Cụt và AI khép thất bại → lùi về câu hoàn chỉnh gần nhất", () => assert(/[.!?…]$/.test(c5.text) && !/Rồi cô$/.test(c5.text)));
  // Tự sửa từ lỗi
  sandbox.callWithRetry = async (a) => { const p = a.messages[a.messages.length - 1].content;
    if (/LỖI SINH CHỮ/.test(p)) return { text: "1|Anh nhìn tập hồ sơ rồi cười khẽ với cô.", finishReason: "stop" };
    return { text: para(150) + " Anh nhìn bọcampo rồi cười khẽ với cô. Cửa đóng lại.", finishReason: "stop" }; };
  const c6 = await T.generateOneChapter(job({ nextChapterHint: "Anh cười." }));
  t("Từ lỗi 'bọcampo' được AI sửa tại chỗ, phần còn lại giữ nguyên", () => { assert(!/bọcampo/.test(c6.text)); assert(/Anh nhìn tập hồ sơ rồi cười khẽ với cô\./.test(c6.text)); assert(c6.autoUpdateIssues.some(x => /tự sửa 1 từ lỗi/.test(x))); });
  await Promise.all(pending);
  console.log(`\n${pass}/${pass + fail} PASS`); process.exit(fail ? 1 : 0);
})();
