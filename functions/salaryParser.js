// 급여 텍스트 → USD 월급 숫자 파싱 공용 유틸
// functions/index.js (트리거)와 scripts/backfill-salary.js (로컬 백필)이 공유

function parseSalaryText(text) {
  if (!text || typeof text !== "string") return null;
  if (/원|동/.test(text)) return null;
  if (/만|천|백만/.test(text)) return null;
  if (/연봉|년/.test(text)) return null;
  if (/협의|무관|면접|결정|negotiable|tbd/i.test(text)) return null;
  if (!/USD|\$/i.test(text)) return null;

  const nums = [...text.matchAll(/[\d,]+/g)]
    .map((m) => parseFloat(m[0].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (nums.length === 0) return null;
  return Math.min(...nums);
}

module.exports = { parseSalaryText };
