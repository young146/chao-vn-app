/**
 * 일회성 백필: Jobs / candidates 컬렉션에 expiresAt 추가
 *
 * 대상: expiresAt 없고 createdAt 있는 문서 → expiresAt = createdAt + 30일
 * 이미 expiresAt 있으면 건너뜀
 *
 * 실행 방법 (firebase-admin은 functions/에 설치되어 있음):
 *   cd functions
 *   node ../scripts/backfill-expires-at.js
 *
 * 권한: Application Default Credentials 필요
 *   → firebase login && gcloud auth application-default login
 *   또는 서비스 계정 키: GOOGLE_APPLICATION_CREDENTIALS=<path> node ...
 */

const admin = require("../functions/node_modules/firebase-admin");

admin.initializeApp({
  projectId: "chaovietnam-login",
});

const db = admin.firestore();
db.settings({ preferRest: true });

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const COLLECTIONS = ["Jobs", "candidates"];
const BATCH_SIZE = 400; // Firestore 배치 limit 500 이하

async function backfillCollection(colName) {
  console.log(`\n[${colName}] 시작...`);
  const colRef = db.collection(colName);
  const snapshot = await colRef.get();

  let skipped = 0;
  let noCreatedAt = 0;
  let toUpdate = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.expiresAt) {
      skipped++;
      continue;
    }
    if (!data.createdAt) {
      noCreatedAt++;
      console.warn(`  [SKIP] ${docSnap.id} — createdAt 없음`);
      continue;
    }
    // createdAt이 Firestore Timestamp인지 확인
    const createdAtMs =
      typeof data.createdAt.toMillis === "function"
        ? data.createdAt.toMillis()
        : data.createdAt._seconds
        ? data.createdAt._seconds * 1000
        : null;

    if (createdAtMs === null) {
      noCreatedAt++;
      console.warn(`  [SKIP] ${docSnap.id} — createdAt 형식 불명`);
      continue;
    }

    const expiresAt = admin.firestore.Timestamp.fromMillis(createdAtMs + THIRTY_DAYS_MS);
    toUpdate.push({ ref: docSnap.ref, expiresAt });
  }

  console.log(
    `  전체 ${snapshot.size}건 | 업데이트 대상 ${toUpdate.length}건 | ` +
    `이미 있음 ${skipped}건 | createdAt 없음 ${noCreatedAt}건`
  );

  // 배치 단위로 commit
  let committed = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { ref, expiresAt } of chunk) {
      batch.update(ref, { expiresAt });
    }
    await batch.commit();
    committed += chunk.length;
    console.log(`  → ${committed}/${toUpdate.length} 완료`);
  }

  console.log(`[${colName}] 완료 ✅`);
}

(async () => {
  try {
    for (const col of COLLECTIONS) {
      await backfillCollection(col);
    }
    console.log("\n모든 백필 완료 🎉");
    process.exit(0);
  } catch (err) {
    console.error("백필 실패:", err);
    process.exit(1);
  }
})();
