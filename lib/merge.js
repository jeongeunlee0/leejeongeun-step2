// 일반정보 행 + 위치정보 행을 '데이터 고유번호' 기준으로 합쳐 화면에서 쓰는 장소 객체로 바꿉니다.
// (CSV 변환 스크립트와 실시간 API 호출이 같은 규칙을 쓰도록 한곳에 둡니다)
const str = v => (v == null ? "" : String(v));

function toPlaces(generalRows, locationRows) {
  const loc = new Map(locationRows.map(x => [str(x["데이터 고유번호"]), x]));
  const places = [];
  for (const x of generalRows) {
    const id = str(x["데이터 고유번호"]), b = loc.get(id);
    if (!id || !b) continue;                         // 두 데이터에 모두 있는 장소만 사용
    const lat = Number(b["위도"]), lng = Number(b["경도"]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    places.push({
      id, name: str(x["장소명"]), lat, lng,
      cat: str(x["분류"]), d1: str(x["디렉토리1"]), d2: str(x["디렉토리2"]), title: str(x["제목"]), sub: str(x["부제목"]),
      author: str(x["저작자"]), topic: str(x["주제"]), content: str(x["내용"]), toc: str(x["목차"]), abs: str(x["초록"]),
      publisher: str(x["발행자"]), date: str(x["발행일"]), type: str(x["자료유형"]), source: str(x["출처"]), page: str(x["출처페이지"]),
      contrib: str(x["기여자"]), refs: str(x["참고문헌"]), link: str(x["링크"]),
      zip: str(b["우편번호"]), addr: str(b["위치"]), crs: str(b["좌표계값"]),
    });
  }
  return places;
}

module.exports = { toPlaces };
