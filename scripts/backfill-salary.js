/**
 * 급여 텍스트 → salaryMinUsdPerMonth 실제 백필 (Jobs만)
 *
 * 파싱 규칙은 functions/salaryParser.js 공용 함수 사용.
 * 변환 가능한 문서만 salaryMinUsdPerMonth를 set (merge).
 * null 유지·SKIP 문서는 절대 건드리지 않음.
 *
 * 실행:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\chao-vn-app\chao-vn-app\service-account.json"
 *   node scripts/backfill-salary.js
 */

const admin = require("../functions/node_modules/firebase-admin");
const { parseSalaryText } = require("../functions/salaryParser");

admin.initializeApp({ projectId: "chaovietnam-login" });
const db = admin.firestore();
db.settings({ preferRest: true });

(async () => {
  const snapshot = await db.collection("Jobs").get();

  let converted = 0;
  let nullKept = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    const existing = Number(data.salaryMinUsdPerMonth);
    if (existing > 0) {
      skipped++;
      continue;
    }

    const parsed = parseSalaryText(data.salary ?? "");

    if (parsed !== null) {
      await docSnap.ref.set({ salaryMinUsdPerMonth: parsed }, { merge: true });
      console.log(`✅ ${docSnap.id} | "${data.salary}" | → ${parsed} 저장`);
      converted++;
    } else {
      nullKept++;
    }
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`변환 완료 ${converted}건 | null 유지 ${nullKept}건 | SKIP ${skipped}건`);
  console.log("─────────────────────────────────────────");
})();
