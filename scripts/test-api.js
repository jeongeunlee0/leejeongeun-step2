// 서버 API 점검: 가짜 공공데이터포털 서버(mock)를 띄워 '실시간 모드'와 '연습 모드' 전환을 확인합니다.
// 실제 인증키는 쓰지 않습니다.   사용: node scripts/test-api.js
const http = require("http");
const path = require("path");
const { loadCsv } = require("../lib/csv");

const SRC = path.join(__dirname, "..", "data", "source");
// 실제 API처럼 숫자로 보이는 값은 숫자로, 빈 값은 null 로 돌려줍니다 (자료형이 달라도 병합이 맞는지 확인)
const typed = rows => rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === "" ? null : (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v)])));
const INFO = typed(loadCsv(SRC, "일반정보")), LOC = typed(loadCsv(SRC, "위치정보"));
const MOCK_KEY = "fake+key/for+test==";    // 테스트 전용 가짜 값 (일부러 특수문자 포함: 인코딩 처리 확인)
const MAX_PER_PAGE = 50;                   // 한 번에 다 주지 않는 경우에도 여러 쪽을 모두 받아오는지 확인
let mode = "ok";

// 공공데이터포털 공개 명세(infuser.odcloud.kr/oas/docs)와 같은 모양으로 응답: { page, perPage, totalCount, currentCount, matchCount, data }
const mock = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  res.setHeader("Content-Type", "application/json");
  if (!u.searchParams.get("serviceKey")) { res.statusCode = 401; return res.end(JSON.stringify({ code: -401, msg: "인증키는 필수 항목 입니다." })); }
  if (u.searchParams.get("serviceKey") !== MOCK_KEY) { res.statusCode = 401; return res.end(JSON.stringify({ code: -4, msg: "등록되지 않은 인증키 입니다." })); }
  if (mode === "html") { res.setHeader("Content-Type", "text/html"); return res.end("<html>점검 중</html>"); }
  if (mode === "shape") return res.end(JSON.stringify({ hello: "world" }));
  const rows = u.pathname === "/info" ? INFO : LOC;
  const page = +u.searchParams.get("page") || 1, per = Math.min(+u.searchParams.get("perPage") || 10, MAX_PER_PAGE);
  const data = rows.slice((page - 1) * per, page * per);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ currentCount: data.length, data, matchCount: rows.length, page, perPage: per, totalCount: rows.length }));
});

let fails = 0;
const check = (cond, msg) => { console.log((cond ? "  ✓ " : "  ✗ ") + msg); if (!cond) fails++; };
const setEnv = o => { for (const k of ["JEJU_CULTURE_INFO_KEY", "JEJU_CULTURE_LOCATION_KEY", "JEJU_CULTURE_INFO_URL", "JEJU_CULTURE_LOCATION_URL"]) delete process.env[k]; Object.assign(process.env, o); };

async function main() {
  await new Promise(r => mock.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + mock.address().port;
  const good = { JEJU_CULTURE_INFO_KEY: MOCK_KEY, JEJU_CULTURE_LOCATION_KEY: encodeURIComponent(MOCK_KEY), JEJU_CULTURE_INFO_URL: base + "/info", JEJU_CULTURE_LOCATION_URL: base + "/loc" };
  const src = require("../lib/source"), places = require("../lib/places");
  const fallback = require("../data/places.json");

  console.log("1) 환경변수 없음 → 연습 모드");
  setEnv({}); src.resetCache();
  let r = await places.list({});
  check(r.mode === "practice" && r.total === 120, "mode=practice, 120건");
  check(/JEJU_CULTURE_INFO_KEY/.test(r.reason), "이유에 빠진 환경변수 이름이 나온다");

  console.log("2) 올바른 키 + 요청 주소 → 실시간 모드 (한쪽은 인코딩 키, 한쪽은 디코딩 키)");
  setEnv(good); src.resetCache();
  r = await places.list({});
  check(r.mode === "live" && r.total === 120, "mode=live, 120건");
  const d = await places.detail("367");
  check(d && d.mode === "live" && JSON.stringify(d.place) === JSON.stringify(fallback.find(p => p.id === "367")), "상세 데이터가 파일 데이터와 동일");
  check((await places.list({ q: "오름" })).count === 22 && (await places.list({ cat: "민속" })).count === 57, "검색·분류 결과 동일(오름 22, 민속 57)");
  check((await places.status()).env.JEJU_CULTURE_INFO_KEY === true && !JSON.stringify(await places.status()).includes(MOCK_KEY), "status 는 설정 여부만 알리고 키 값은 내보내지 않는다");

  console.log("3) 잘못된 키 → 401 → 연습 모드");
  setEnv({ ...good, JEJU_CULTURE_INFO_KEY: "WRONG" }); src.resetCache();
  r = await places.list({});
  check(r.mode === "practice" && /401/.test(r.reason) && !r.reason.includes("WRONG"), "연습 모드 + HTTP 401 안내, 키 값 미노출");
  check(/등록되지 않은 인증키/.test(r.reason), "포털의 안내 문구(등록되지 않은 인증키)를 이유에 보여 준다");

  console.log("3-1) 요청 주소 환경변수를 비워 두면 공식 명세의 기본 주소를 쓴다");
  setEnv({ JEJU_CULTURE_INFO_KEY: MOCK_KEY, JEJU_CULTURE_LOCATION_KEY: MOCK_KEY });
  const u = src.urls();
  check(/^https:\/\/api\.odcloud\.kr\/api\/15109587\/v1\/uddi:56c2b3a4-/.test(u.info) && /^https:\/\/api\.odcloud\.kr\/api\/15109570\/v1\/uddi:8781448b-/.test(u.location), "기본 주소 = 명세의 일반정보·위치정보 주소");

  console.log("4) API 서버 다운 → 연습 모드");
  setEnv({ ...good, JEJU_CULTURE_INFO_URL: "http://127.0.0.1:1/info" }); src.resetCache();
  r = await places.list({});
  check(r.mode === "practice" && /연결하지 못/.test(r.reason), "연결 실패 안내");

  console.log("5) 응답이 JSON이 아니거나 모양이 다름 → 연습 모드");
  setEnv(good); mode = "html"; src.resetCache();
  r = await places.list({}); check(r.mode === "practice" && /JSON/.test(r.reason), "HTML 응답 처리");
  mode = "shape"; src.resetCache();
  r = await places.list({}); check(r.mode === "practice" && /형식/.test(r.reason), "예상과 다른 JSON 처리");
  mode = "ok";

  console.log("6) 실패한 직후 정상화 → 1분 대기 없이 테스트에서 캐시 초기화하면 실시간 복귀");
  src.resetCache(); r = await places.list({});
  check(r.mode === "live", "다시 live");

  mock.close();
  console.log(fails ? "\n실패 " + fails + "건" : "\n모든 점검 통과");
  process.exit(fails ? 1 : 0);
}
main();
