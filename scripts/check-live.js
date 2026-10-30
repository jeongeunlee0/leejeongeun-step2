// 실제 공공데이터포털 API가 동작하는지 점검합니다. 사용: npm run check:live
// .env.local 의 값을 읽어 호출하며, 키·요청 주소 '값'은 화면에 출력하지 않습니다(설정 여부와 응답 모양만 알려 줍니다).
const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    const v = m[2].replace(/^['"]|['"]$/g, "");
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, "..", ".env.local"));

const { getDataset, envStatus, urls, normalizeKey } = require("../lib/source");

async function probe(label, base, keyKey) {
  const key = process.env[keyKey];
  if (!key) return console.log("  - " + label + ": " + keyKey + " 가 비어 있어 건너뜀");
  try {
    const u = new URL(base); u.searchParams.set("page", "1"); u.searchParams.set("perPage", "1"); u.searchParams.set("serviceKey", normalizeKey(key));
    const res = await fetch(u, { signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    console.log("  - " + label + ": HTTP " + res.status + " (" + (res.headers.get("content-type") || "?") + ")");
    let portal = ""; try { const j = JSON.parse(text); if (j && j.msg) portal = " (포털 응답: " + String(j.msg).slice(0, 80) + ")"; } catch (e) {}
    if (res.status === 401 || res.status === 403) return console.log("    인증키가 틀렸거나 아직 반영 전일 수 있어요" + portal + " → 마이페이지에서 승인 상태와 키를 확인하세요. 발급 직후엔 1시간가량 걸릴 수 있어요");
    if (!res.ok) return console.log("    요청 주소를 확인하세요" + portal);
    try {
      const j = JSON.parse(text);
      console.log("    응답 최상위 키:", Object.keys(j).join(", "));
      const row = Array.isArray(j.data) && j.data[0];
      if (row) console.log("    첫 행의 열 이름:", Object.keys(row).join(", "));
      else console.log("    data 배열이 없거나 비어 있어요 → lib/source.js 의 fetchRows 를 응답 모양에 맞게 고쳐야 할 수 있어요");
    } catch (e) { console.log("    JSON이 아닌 응답이에요 (앞 80자):", text.slice(0, 80).replace(/\s+/g, " ")); }
  } catch (e) { console.log("  - " + label + ": 연결 실패 (" + (e.name === "TimeoutError" ? "시간 초과" : "네트워크 오류") + ")"); }
}

(async () => {
  console.log("환경변수 설정 여부:", JSON.stringify(envStatus()));
  const ds = await getDataset();
  if (ds.mode === "live") {
    console.log("\n✅ 실시간 모드(live) 성공 — 장소 " + ds.places.length + "곳, 첫 장소: " + ds.places[0].name);
    return;
  }
  console.log("\n🟠 연습 모드(practice) — 이유: " + ds.reason);
  console.log("\n진단(값은 숨김):");
  const u = urls();
  await probe("일반정보", u.info, "JEJU_CULTURE_INFO_KEY");
  await probe("위치정보", u.location, "JEJU_CULTURE_LOCATION_KEY");
  process.exitCode = 1;
})();
