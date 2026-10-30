// GET /api/status → 지금 실시간 API로 동작하는지, 연습 모드인지 점검용 (키 값은 내보내지 않음)
const { status } = require("../lib/places");

module.exports = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(await status());
  } catch (e) {
    res.status(500).json({ error: "상태를 확인하지 못했어요." });
  }
};
