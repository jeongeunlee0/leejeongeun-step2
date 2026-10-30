// GET /api/places/367  → 장소 1곳의 상세 정보(설명 전문 포함)
const { detail } = require("../../lib/places");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }
  try {
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const found = await detail(id);
    if (!found) return res.status(404).json({ error: "해당 고유번호의 장소가 없습니다.", id });
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(found);
  } catch (e) {
    res.status(500).json({ error: "데이터를 불러오는 중 서버 오류가 났어요." });
  }
};
