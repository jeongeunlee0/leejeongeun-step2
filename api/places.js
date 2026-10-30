// GET /api/places?q=검색어&cat=분류&d1=디렉토리&sort=id|name
const { list } = require("../lib/places");

const first = v => (Array.isArray(v) ? v[0] : v) || "";

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }
  try {
    const sort = first(req.query.sort) === "name" ? "name" : "id";
    const result = await list({ q: first(req.query.q).slice(0, 100), cat: first(req.query.cat), d1: first(req.query.d1), sort });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: "데이터를 불러오는 중 서버 오류가 났어요." });
  }
};
