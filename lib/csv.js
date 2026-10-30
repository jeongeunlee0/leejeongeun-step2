// CP949(EUC-KR)로 저장된 공공데이터포털 CSV를 읽어 {열이름: 값} 행 배열로 바꿉니다.
const fs = require("fs");
const path = require("path");

function parseCsv(t) {
  const rows = []; let r = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { r.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; r.push(f); f = ""; rows.push(r); r = []; }
    else f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  return rows.filter(x => x.length > 1);
}

// dir 안에서 파일명에 name 이 들어 있는 CSV를 찾아 읽습니다.
function loadCsv(dir, name) {
  const file = fs.readdirSync(dir).find(n => n.includes(name) && n.endsWith(".csv"));
  if (!file) throw new Error(name + " CSV를 찾지 못했어요: " + dir);
  const rows = parseCsv(new TextDecoder("euc-kr").decode(fs.readFileSync(path.join(dir, file))));
  const head = rows.shift();
  return rows.map(r => Object.fromEntries(head.map((k, i) => [k, r[i]])));
}

module.exports = { loadCsv };
