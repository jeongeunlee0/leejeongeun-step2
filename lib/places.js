// API 함수들이 함께 쓰는 조회 로직 (api 폴더 밖이라 별도 함수로 배포되지 않습니다)
const { getDataset, envStatus } = require("./source");

const SEARCH_FIELDS = ["name", "title", "topic", "addr", "content", "abs", "cat", "d1", "d2", "author"];
const haystacks = new WeakMap();   // 데이터가 바뀌지 않는 동안 검색용 문자열을 재사용
function hayOf(places) {
  let h = haystacks.get(places);
  if (!h) { h = new Map(places.map(p => [p.id, SEARCH_FIELDS.map(f => p[f] || "").join("\n").toLowerCase()])); haystacks.set(places, h); }
  return h;
}

// 목록용 요약 (설명 전문은 상세 API에서만 내려줍니다)
function light(p) {
  const text = String(p.content || "").replace(/\s+/g, " ").trim();
  return {
    id: p.id, name: p.name, lat: p.lat, lng: p.lng, cat: p.cat, d1: p.d1, d2: p.d2,
    title: p.title, addr: p.addr, len: String(p.content || "").length,
    summary: text.length > 260 ? text.slice(0, 260) + "…" : text,
  };
}

async function list({ q = "", cat = "", d1 = "", sort = "id" }) {
  const ds = await getDataset(), hay = hayOf(ds.places);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let r = ds.places.filter(p => (!cat || p.cat === cat) && (!d1 || p.d1 === d1) && terms.every(t => hay.get(p.id).includes(t)));
  if (sort === "name") r = r.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return { mode: ds.mode, reason: ds.reason, total: ds.places.length, count: r.length, items: r.map(light) };
}

async function detail(id) {
  const ds = await getDataset();
  const p = ds.places.find(x => x.id === String(id));
  return p ? { mode: ds.mode, reason: ds.reason, place: p } : null;
}

async function status() {
  const ds = await getDataset();
  return { mode: ds.mode, reason: ds.reason, total: ds.places.length, env: envStatus() };   // 키 '값'은 절대 내보내지 않고 설정 여부(true/false)만 알려줍니다
}

module.exports = { list, detail, status };
