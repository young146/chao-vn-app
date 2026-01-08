// Firebase 지역명 마이그레이션 스크립트
// "District X (Quận X)" → "QX"
// "지역명 (한글)" → "지역명"

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, updateDoc } = require("firebase/firestore");

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAAtT9gcu8eVQIhQxYEgBTGp2XZ6ghz_NU",
  authDomain: "chaovietnam-login.firebaseapp.com",
  projectId: "chaovietnam-login",
  storageBucket: "chaovietnam-login.firebasestorage.app",
  messagingSenderId: "249390849714",
  appId: "1:249390849714:web:95ae3e7f066b70ffe973ab"
};

// 지역명 변환 매핑
const districtMapping = {
  // 호치민 숫자 지역
  "District 1 (Quận 1)": "Q1",
  "District 2 (Quận 2 / Thủ Đức)": "Q2",
  "District 3 (Quận 3)": "Q3",
  "District 4 (Quận 4)": "Q4",
  "District 5 (Quận 5)": "Q5",
  "District 6 (Quận 6)": "Q6",
  "District 7 (Quận 7)": "Q7",
  "District 8 (Quận 8)": "Q8",
  "District 9 (Quận 9)": "Q9",
  "District 10 (Quận 10)": "Q10",
  "District 11 (Quận 11)": "Q11",
  "District 12 (Quận 12)": "Q12",
  
  // 호치민 기타 지역
  "Bình Thạnh (빈탄)": "Bình Thạnh",
  "Phú Nhuận (푸누언)": "Phú Nhuận",
  "Tân Bình (떤빈)": "Tân Bình",
  "Tân Phú (떤푸)": "Tân Phú",
  "Gò Vấp (고밥)": "Gò Vấp",
  "Bình Tân (빈딴)": "Bình Tân",
  "Thủ Đức (투득)": "Thủ Đức",
  "기타 지역": "기타",
  
  // 하노이
  "Ba Đình (바딘)": "Ba Đình",
  "Hoàn Kiếm (환끼엠)": "Hoàn Kiếm",
  "Đống Đa (동다)": "Đống Đa",
  "Cầu Giấy (까우저이)": "Cầu Giấy",
  "Hai Bà Trưng (하이바쭝)": "Hai Bà Trưng",
  "Hoàng Mai (황마이)": "Hoàng Mai",
  "Thanh Xuân (탄쑤언)": "Thanh Xuân",
  "Tây Hồ (따이호)": "Tây Hồ",
  "Long Biên (롱비엔)": "Long Biên",
  "Nam Từ Liêm (남뜨리엠)": "Nam Từ Liêm",
  "Bắc Từ Liêm (박뜨리엠)": "Bắc Từ Liêm",
  "Hà Đông (하동)": "Hà Đông",
  
  // 다낭
  "Hải Châu (하이쩌우)": "Hải Châu",
  "Thanh Khê (탄케)": "Thanh Khê",
  "Sơn Trà (손짜)": "Sơn Trà",
  "Ngũ Hành Sơn (응우항선)": "Ngũ Hành Sơn",
  "Liên Chiểu (리엔찌에우)": "Liên Chiểu",
  "Cẩm Lệ (깜레)": "Cẩm Lệ",
  "Hòa Vang (화방)": "Hòa Vang",
  
  // 냐짱
  "Vĩnh Hải (빈하이)": "Vĩnh Hải",
  "Vĩnh Phước (빈푹)": "Vĩnh Phước",
  "Phước Long (푹롱)": "Phước Long",
  "Lộc Thọ (록토)": "Lộc Thọ",
  "Vĩnh Nguyên (빈응우옌)": "Vĩnh Nguyên",
  "Phước Tân (푹딴)": "Phước Tân",
  "Phước Hòa (푹화)": "Phước Hòa",
  "Vạn Thạnh (반탄)": "Vạn Thạnh",
};

async function migrateDistricts() {
  console.log("🚀 Firebase 지역명 마이그레이션 시작...\n");
  
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  // XinChaoDanggn 컬렉션 가져오기
  const itemsRef = collection(db, "XinChaoDanggn");
  const snapshot = await getDocs(itemsRef);
  
  console.log(`📦 총 ${snapshot.size}개 상품 발견\n`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  
  for (const docSnap of snapshot.docs) {
    const item = docSnap.data();
    const oldDistrict = item.district;
    
    if (districtMapping[oldDistrict]) {
      const newDistrict = districtMapping[oldDistrict];
      const newLocation = `${item.city} ${newDistrict} ${item.apartment || ''}`.trim();
      
      console.log(`✏️  ${docSnap.id}: "${oldDistrict}" → "${newDistrict}"`);
      
      await updateDoc(doc(db, "danggn_items", docSnap.id), {
        district: newDistrict,
        location: newLocation
      });
      
      updatedCount++;
    } else {
      skippedCount++;
    }
  }
  
  console.log("\n✅ 마이그레이션 완료!");
  console.log(`   - 업데이트: ${updatedCount}개`);
  console.log(`   - 스킵 (이미 새 형식): ${skippedCount}개`);
}

migrateDistricts().catch(console.error);

