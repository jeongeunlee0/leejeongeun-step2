// data/source 의 CSV 2개(CP949)를 '데이터 고유번호' 기준으로 합쳐 data/places.json(UTF-8)을 만듭니다.
// 이 파일은 API 호출이 실패했을 때 보여 주는 '연습 모드' 데이터입니다.
// 사용: node scripts/build-data.js
const fs = require("fs");
const path = require("path");
const { loadCsv } = require("../lib/csv");
const { toPlaces } = require("../lib/merge");

const SRC = path.join(__dirname, "..", "data", "source");
const OUT = path.join(__dirname, "..", "data", "places.json");

const places = toPlaces(loadCsv(SRC, "일반정보"), loadCsv(SRC, "위치정보"));
fs.writeFileSync(OUT, JSON.stringify(places), "utf8");
// 서버 API가 쓰는 파일(data/places.json)과, 화면이 서버에 닿지 못할 때 쓰는 공개 사본(public/data/places.json)
fs.mkdirSync(path.join(__dirname, "..", "public", "data"), { recursive: true });
fs.copyFileSync(OUT, path.join(__dirname, "..", "public", "data", "places.json"));
console.log("data/places.json 생성:", places.length + "건");

