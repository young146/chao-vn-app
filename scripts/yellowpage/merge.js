// Layer 3: 페이지별 OCR JSON 병합 → 정규화 → 중복제거 → 검수용 CSV/JSON 산출.
// 사용: node scripts/yellowpage/merge.js
const fs = require('fs');
const path = require('path');

const OUT = 'C:/chao-vn-app/chao-vn-app/.tmp/yellowpage/out';
const files = fs.readdirSync(OUT).filter(f => /^page_\d+\.json$/.test(f)).sort();

// 섹션 원문 → app 카테고리 매핑
// 한글 키워드 위주 매칭(영문 부분일치 충돌 방지: INSTITUTION의 'IT' 등). 섹션 우선.
function mapCategory(section, name, extra) {
  const s = `${section || ''} ${name || ''} ${extra || ''}`;
  const has = (...k) => k.some(x => s.includes(x));
  // 기관/공공 (섹션 "주요기관") — 가장 먼저
  if (has('주요기관', '대사관', '영사관', '총영사', '한인회', '상공인', '협의회', '여성회', '노인회', '참전')) return 'service';
  if (has('동창회', '동호회')) return 'other';
  if (has('교회', '성당', '사찰', '종교', '선교', '목사', '예배')) return 'other';         // 종교
  if (has('동물병원', '애견', '펫샵', '반려')) return 'health';
  if (has('병원', '의원', '클리닉', '약국', '치과', '한의', '안경', '한방', '의료')) return 'health';
  if (has('국제학교', '유치원', '학교', '학원', '교육', '어학')) return 'education';
  if (has('미용', '헤어', '마사지', '스파', '네일', '뷰티', '피부', '에스테틱')) return 'beauty';
  if (has('물류', '운송', '항공사', '통관', '배송', '창고', '택배', '포워딩')) return 'logistics';
  if (has('법무', '회계', '공증', '세무', '법인', '변호사')) return 'legal';
  if (has('부동산')) return 'realestate';
  if (has('카페', '커피', '베이커리', '제과', '디저트')) return 'cafe';
  if (has('식당', '음식', '맛집', '식품', '주류', '술집', '한식', '치킨', '고기', '뷔페', '레스토랑')) return 'food';
  if (has('숙박', '호텔', '게스트', '리조트', '민박')) return 'lodging';
  if (has('여행', '여가', '골프', '렌트', '관광', '항공권')) return 'travel';
  if (has('컴퓨터', '주변기기', '모바일', '소프트웨어')) return 'it';
  if (has('광고')) return 'design';
  if (has('가구', '인테리어', '건설', '건축', '설비', '보일러', '제조', '산업', '전기', '전자')) return 'construction';
  if (has('금융', '은행', '송금', '보험', '환전')) return 'finance';
  if (has('잡화', '꽃', '선물', '사진', '쇼핑', '마트', '편의')) return 'shopping';
  if (has('디자인')) return 'design';
  return 'other';
}

// 대분류(매거진 섹션) 배정: 잡지페이지별 기본 섹션 + 전환페이지는 항목 키워드로 분리.
// 페이지별 실제 색띠 헤더(OCR section)에서 도출한 매핑.
const MAJOR_PRIMARY = {
  100: '호치민 주요기관', 101: '호치민 주요기관',
  102: '종합병원', 103: '국제학교', 104: '종교',
  105: '가구·인테리어',          // 종교 꼬리 + 가구·인테리어
  106: '교육',                   // 광고·디자인 꼬리 + 교육
  107: '교육', 108: '교육',      // 108: 교육 + 동문·동호회
  109: '동문·동호회', 110: '동문·동호회',
  111: '금융',                   // 금융 + 미용
  112: '미용·마사지',            // 미용 + 물류
  113: '물류·운송',
  114: '법무·회계', 115: '법무·회계', 116: '법무·회계',  // 116: +부동산
  117: '생활', 118: '생활',
  119: '음식점·식품', 120: '음식점·식품', 121: '음식점·식품', 122: '음식점·식품',
  123: '마트·식품', 124: '음식점·식품', 125: '마트·식품',
  126: '여가·여행', 127: '여가·여행',
  128: '의료', 129: '의료',
  130: '산업·건설·제조', 131: '산업·건설·제조', 132: '산업·건설·제조', 133: '산업·건설·제조',
  134: '산업·건설·제조', 135: '산업·건설·제조', 136: '산업·건설·제조', 137: '산업·건설·제조',
  138: '광고', 139: '광고', 140: '광고',
};
function majorCategory(mag, name, extra, section) {
  // 주의: section 은 페이지 내 모든 항목에 동일(여러 하위섹션 나열)하므로 항목 판별에서 제외.
  const s = `${name || ''} ${extra || ''}`;
  const has = (...k) => k.some(x => s.includes(x));
  const relig = () => has('교회', '성당', '사찰', '선교', '목사', '예배', '교구');
  if (mag === 104 || mag === 105) { if (relig()) return '종교'; }
  if (mag === 105 && !relig()) return '가구·인테리어';
  if (mag === 106) return (has('광고', '인쇄', '간판', '홍보', '실사', '현수막')) ? '광고·디자인'
    : (has('디자인') && !has('인테리어')) ? '광고·디자인' : '교육';
  if ((mag === 108 || mag === 110) && has('동문', '동호회', '총동문', '동창', '향우회', '종친', '연합회', '협회', '모임'))
    return '동문·동호회';
  if (mag === 111) return has('미용', '헤어', '마사지', '스킨', '네일', '스파', '뷰티', '피부', '에스테틱') ? '미용·마사지' : '금융';
  if (mag === 112) return has('물류', '운송', '항공', '통관', '화물', '해운', '포워딩', '배송', '특송') ? '물류·운송' : '미용·마사지';
  if (mag === 114) return has('물류', '운송', '화물', '통관', '해운', '특송') ? '물류·운송' : '법무·회계';
  if (mag === 116) return has('부동산') ? '부동산' : '법무·회계';
  if (mag === 124) { if (has('카페', '커피', '베이커리', '제과', '디저트')) return '카페·베이커리'; if (has('마트', '식품', '반찬', '정육', '청과')) return '마트·식품'; return '음식점·식품'; }
  if (mag === 125) return has('여행', '골프', '여가', '렌트', '관광', '스포츠', '항공권') ? '여가·여행' : '마트·식품';
  if (mag === 127) { if (has('호텔', '리조트', '게스트', '레지던스')) return '호텔'; if (has('병원', '약국', '의료', '의원', '클리닉', '치과', '한의', '한방')) return '의료'; return '여가·여행'; }
  if (mag === 129) { if (has('컴퓨터', '모바일', '복합기', '노트북', '프린터', '핸드폰')) return '컴퓨터·모바일'; if (has('한방', '한의')) return '의료(한방)'; return '의료'; }
  return MAJOR_PRIMARY[mag] || '기타';
}

// 전화 정규화: 표시값은 보존, 매칭용 digits 키 생성 (앞 0/+84 제거)
function phoneKey(p) {
  let d = (p || '').replace(/[^0-9]/g, '');
  if (d.startsWith('84')) d = d.slice(2);
  d = d.replace(/^0+/, '');
  return d;
}

// 전환 페이지 대분류 태깅 맵 로드 (major_NN.json: {업소명: 대분류})
const nkeyOf = s => (s || '').replace(/\s+/g, '').toLowerCase();
const majorOverride = {}; // page(num) -> { normalizedName: major }
for (const f of fs.readdirSync(OUT).filter(f => /^major_\d+\.json$/.test(f))) {
  const pg = +f.match(/\d+/)[0];
  try {
    const m = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
    const norm = {};
    for (const [name, major] of Object.entries(m)) norm[nkeyOf(name)] = major;
    majorOverride[pg] = norm;
  } catch (e) { console.error('major parse fail', f, e.message); }
}

const all = [];
let pagesWithData = 0;
let overrideHits = 0, overrideMiss = 0;
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')); }
  catch (e) { console.error('PARSE FAIL', f, e.message); continue; }
  const entries = j.entries || [];
  if (entries.length) pagesWithData++;
  for (const e of entries) {
    const phones = Array.isArray(e.phones) ? e.phones.filter(Boolean) : (e.phones ? [e.phones] : []);
    // 전환 페이지면 태깅 맵 우선, 없으면 결정론적 추정
    let major;
    const ov = majorOverride[j.page];
    if (ov) {
      const hit = ov[nkeyOf(e.name)];
      if (hit) { major = hit; overrideHits++; }
      else { major = majorCategory(j.mag_page, e.name, e.extra, j.section); overrideMiss++; }
    } else {
      major = majorCategory(j.mag_page, e.name, e.extra, j.section);
    }
    all.push({
      major,
      name: (e.name || '').trim(),
      name_en: (e.name_en || '').trim(),
      contact_person: (e.contact_person || '').trim(),
      phones,
      address: (e.address || '').trim(),
      extra: (e.extra || '').trim(),
      section: j.section || '',
      category: mapCategory(j.section, e.name, e.extra),
      page: j.page, mag_page: j.mag_page,
      confidence: e.confidence === 'high' ? 'high' : 'low',
      notes: (e.notes || '').trim(),
      source: 'magazine-561',
      isSponsor: false,
    });
  }
}

// 중복제거: name(공백제거 소문자) + 첫 전화 digits 키
const seen = new Map();
const deduped = [];
let dupCount = 0;
for (const r of all) {
  const nkey = r.name.replace(/\s+/g, '').toLowerCase();
  const pkey = r.phones.map(phoneKey).find(Boolean) || '';
  const key = nkey + '|' + pkey;
  if (seen.has(key)) {
    dupCount++;
    // 더 정보 많은 레코드 유지 (주소/전화 보강)
    const prev = seen.get(key);
    if (!prev.address && r.address) prev.address = r.address;
    if (prev.phones.length < r.phones.length) prev.phones = r.phones;
    continue;
  }
  seen.set(key, r);
  deduped.push(r);
}

// 산출
fs.writeFileSync(path.join(OUT, 'yellowpage.json'), JSON.stringify(deduped, null, 2));

// CSV
const esc = v => {
  const s = String(v == null ? '' : v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};
const cols = ['major', 'name', 'name_en', 'contact_person', 'phones', 'address', 'category', 'section', 'mag_page', 'confidence', 'notes'];
const rows = [cols.join(',')];
for (const r of deduped) {
  rows.push(cols.map(c => esc(c === 'phones' ? r.phones.join(' / ') : r[c])).join(','));
}
fs.writeFileSync(path.join(OUT, 'yellowpage.csv'), '﻿' + rows.join('\r\n'));

// 통계
const byCat = {};
const lowCount = deduped.filter(r => r.confidence === 'low').length;
const noPhone = deduped.filter(r => r.phones.length === 0).length;
const noAddr = deduped.filter(r => !r.address).length;
for (const r of deduped) byCat[r.category] = (byCat[r.category] || 0) + 1;
const byMajor = {};
for (const r of deduped) byMajor[r.major] = (byMajor[r.major] || 0) + 1;

console.log('=== 옐로페이지 병합 결과 ===');
console.log('대분류 분포:');
for (const [k, v] of Object.entries(byMajor).sort((a, b) => b[1] - a[1])) console.log('   ', k, v);
console.log('OCR 페이지(데이터 있음):', pagesWithData, '/ JSON 파일:', files.length);
console.log('원본 항목:', all.length, '| 중복 제거:', dupCount, '| 최종:', deduped.length);
console.log('confidence low:', lowCount, '| 전화 없음:', noPhone, '| 주소 없음:', noAddr);
console.log('카테고리 분포:', JSON.stringify(byCat, null, 0));
console.log('산출: yellowpage.json , yellowpage.csv (', OUT, ')');
