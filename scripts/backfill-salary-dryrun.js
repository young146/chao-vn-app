/**
 * 급여 텍스트 → salaryMinUsdPerMonth 변환 DRY-RUN (읽기 전용)
 *
 * DB 쓰기 없음 — 콘솔 출력만.
 *
 * 실행:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\chao-vn-app\chao-vn-app\service-account.json"
 *   node scripts/backfill-salary-dryrun.js
 */

const admin = require("../functions/node_modules/firebase-admin");

admin.initializeApp({ projectId: "chaovietnam-login" });
const db = admin.firestore();
db.settings({ preferRest: true });

/**
 * salary 텍스트에서 USD 월급 숫자를 추출한다.
 *
 * 변환 조건 (AND):
 *   ① "USD" 또는 "$" 포함
 *   ② "연봉", "년" 미포함 (연봉 표기 제외)
 *
 * null 유지 조건 (아래 중 하나라도 해당):
 *   - "원", "동" 포함 (KRW / VND)
 *   - "만", "천", "백만" 등 한국어 수 단위 포함
 *   - "연봉", "년" 포함
 *   - "협의", "면접", "결정", "무관", "negotiable", "tbd" 등
 *   - 빈 값 또는 숫자 없음
 *
 * 숫자가 여러 개(범위)면 최솟값 반환.
 */
function parseSalary(text) {
  if (!text || typeof text !== "string") return null;

  // null 유지 키워드
  if (/원|동/.test(text)) return null;
  if (/만|천|백만/.test(text)) return null;
  if (/연봉|년/.test(text)) return null;
  if (/협의|무관|면접|결정|negotiable|tbd/i.test(text)) return null;

  // USD/$ 포함 여부 확인 (대소문자 무시)
  if (!/USD|\$/i.test(text)) return null;

  // 숫자 추출 (콤마 제거 후 파싱)
  const nums = [...text.matchAll(/[\d,]+/g)]
    .map((m) => parseFloat(m[0].replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (nums.length === 0) return null;
  return Math.min(...nums);
}

(async () => {
  const snapshot = await db.collection("Jobs").get();

  let totalCount = 0;
  let willConvert = 0;
  let willNull = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    totalCount++;
    const data = docSnap.data();
    const id = docSnap.id;

    // 이미 숫자로 채워진 경우 → SKIP
    const existing = Number(data.salaryMinUsdPerMonth);
    if (existing > 0) {
      console.log(`${id} | (already ${existing}) | → SKIP`);
      skipped++;
      continue;
    }

    const salaryRaw = data.salary ?? "";
    const parsed = parseSalary(salaryRaw);

    if (parsed !== null) {
      console.log(`${id} | "${salaryRaw}" | → ${parsed}`);
      willConvert++;
    } else {
      const display = salaryRaw ? `"${salaryRaw}"` : "(없음)";
      console.log(`${id} | ${display} | → null (변환 안 함)`);
      willNull++;
    }
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`전체 ${totalCount}건 | 변환예정 ${willConvert}건 | null유지 ${willNull}건 | 이미숫자라SKIP ${skipped}건`);
  console.log("─────────────────────────────────────────");
  console.log("※ DRY-RUN — DB 변경 없음");
})();
