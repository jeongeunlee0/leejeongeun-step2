// 데이터 공급원: 공공데이터포털 오픈 API(실시간) → 실패하면 1단계 파일 데이터(연습 모드)
//
// 환경변수 (Vercel 환경변수 / 로컬 .env.local 에만 넣습니다. 코드·GitHub에는 절대 넣지 않습니다)
//   JEJU_CULTURE_INFO_KEY       제주역사문화일반정보 API 인증키
//   JEJU_CULTURE_LOCATION_KEY   제주역사문화위치정보 API 인증키
//   JEJU_CULTURE_INFO_URL       일반정보 API 요청 주소 (키를 뺀 '?' 앞부분)
//   JEJU_CULTURE_LOCATION_URL   위치정보 API 요청 주소 (키를 뺀 '?' 앞부분)
// 요청 주소는 공공데이터포털 마이페이지 > 개발계정 > 상세보기(Swagger)에서 확인합니다.
const fallbackPlaces = require("../data/places.json");
const { toPlaces } = require("./merge");

const TTL_OK = 10 * 60 * 1000;      // 성공한 결과는 10분간 재사용
const TTL_FAIL = 60 * 1000;         // 실패하면 1분 뒤 다시 시도
const TIMEOUT = 8000;
let cache = null;

class SourceError extends Error {}  // 화면에 보여 줘도 안전한 메시지만 담습니다 (키·주소 값은 넣지 않음)

// 데이터포털은 '인코딩 키'와 '디코딩 키'를 모두 주므로, 어느 쪽을 넣어도 한 번만 인코딩되게 맞춥니다.
const normalizeKey = k => { const s = String(k || "").trim(); try { return s.includes("%") ? decodeURIComponent(s) : s; } catch (e) { return s; } };

async function fetchRows(label, baseUrl, key) {
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    let u;
    try { u = new URL(baseUrl); } catch (e) { throw new SourceError(label + " 요청 주소 형식이 올바르지 않아요"); }
    u.searchParams.set("page", String(page));
    u.searchParams.set("perPage", "1000");
    u.searchParams.set("serviceKey", normalizeKey(key));
    let res;
    try { res = await fetch(u, { signal: AbortSignal.timeout(TIMEOUT), headers: { Accept: "application/json" } }); }
    catch (e) { throw new SourceError(label + " API에 연결하지 못했어요(시간 초과 또는 네트워크 오류)"); }
    if (!res.ok) throw new SourceError(label + " API가 오류를 돌려줬어요 (HTTP " + res.status + ")");
    let body;
    try { body = await res.json(); } catch (e) { throw new SourceError(label + " API 응답이 JSON 형식이 아니에요"); }
    if (!body || !Array.isArray(body.data)) throw new SourceError(label + " API 응답 형식이 예상과 달라요");
    rows.push(...body.data);
    if (!body.totalCount || rows.length >= body.totalCount || body.data.length === 0) break;
  }
  if (!rows.length) throw new SourceError(label + " API가 빈 결과를 돌려줬어요");
  return rows;
}

async function loadLive() {
  const env = process.env;
  const need = [];
  if (!env.JEJU_CULTURE_INFO_KEY) need.push("JEJU_CULTURE_INFO_KEY");
  if (!env.JEJU_CULTURE_LOCATION_KEY) need.push("JEJU_CULTURE_LOCATION_KEY");
  if (!env.JEJU_CULTURE_INFO_URL) need.push("JEJU_CULTURE_INFO_URL");
  if (!env.JEJU_CULTURE_LOCATION_URL) need.push("JEJU_CULTURE_LOCATION_URL");
  if (need.length) throw new SourceError("환경변수가 설정되지 않았어요: " + need.join(", "));
  const [info, loc] = await Promise.all([
    fetchRows("일반정보", env.JEJU_CULTURE_INFO_URL, env.JEJU_CULTURE_INFO_KEY),
    fetchRows("위치정보", env.JEJU_CULTURE_LOCATION_URL, env.JEJU_CULTURE_LOCATION_KEY),
  ]);
  const places = toPlaces(info, loc);
  if (!places.length) throw new SourceError("두 API의 '데이터 고유번호'가 서로 맞는 장소가 없어요");
  return places;
}

async function getDataset() {
  const now = Date.now();
  if (cache && cache.until > now) return cache;
  try {
    cache = { mode: "live", reason: "", places: await loadLive(), until: now + TTL_OK };
  } catch (e) {
    const reason = e instanceof SourceError ? e.message : "알 수 없는 오류로 API를 쓰지 못했어요";
    cache = { mode: "practice", reason, places: fallbackPlaces, until: now + TTL_FAIL };
  }
  return cache;
}

function envStatus() {
  const e = process.env;
  return {
    JEJU_CULTURE_INFO_KEY: Boolean(e.JEJU_CULTURE_INFO_KEY), JEJU_CULTURE_LOCATION_KEY: Boolean(e.JEJU_CULTURE_LOCATION_KEY),
    JEJU_CULTURE_INFO_URL: Boolean(e.JEJU_CULTURE_INFO_URL), JEJU_CULTURE_LOCATION_URL: Boolean(e.JEJU_CULTURE_LOCATION_URL),
  };
}

const resetCache = () => { cache = null; };   // 테스트용

module.exports = { getDataset, envStatus, resetCache };
