// Layer 3: 매거진(yellowpage.json) + 라이프플라자(lifeplaza.json) 통합 → "베트남 남부 옐로페이지" 마스터.
// - 전화/이름으로 중복 병합(같은 업체는 phones 합치고 source="both")
// - 주소에서 도시·구군 자동 추출 (검색용)
// - 카테고리(대분류) 통일
// 산출: yellowpage_master.json / .csv  (+ 지역·카테고리 분포 통계)
// 사용: node scripts/yellowpage/build_directory.js
const fs = require('fs');
const path = require('path');
const OUT = 'C:/chao-vn-app/chao-vn-app/.tmp/yellowpage/out';
const mag = JSON.parse(fs.readFileSync(path.join(OUT, 'yellowpage.json'), 'utf8'));
const life = JSON.parse(fs.readFileSync(path.join(OUT, 'lifeplaza.json'), 'utf8'));

// ---------- 전화/이름 키 ----------
function phoneKeys(p) {
  if (!p) return [];
  const out = [];
  for (let part of String(p).split(/[/,;]|및|\n/)) {
    part = part.split('~')[0];
    let d = part.replace(/[^0-9]/g, '');
    if (d.startsWith('84')) d = d.slice(2);
    d = d.replace(/^0+/, '');
    if (d.length >= 8) out.push(d);
  }
  return out;
}
const phonesKeys = arr => (Array.isArray(arr) ? arr : [arr]).flatMap(phoneKeys);
const nameKey = s => (s || '').replace(/\([^)]*\)/g, '').replace(/[\s.,'"·\-_]/g, '').toLowerCase();

// ---------- 주소 → 도시·구군 ----------
const deAccent = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
function parseRegion(addr, hint) {
  const a = deAccent(addr) + ' ' + deAccent(hint || '');
  // 도시(성/직할시) — 구체 지명 우선, 없으면 호치민 기본
  let city = '';
  if (/da nang|danang/.test(a)) city = '다낭';
  else if (/dong nai|bien hoa|nhon trach|long thanh|trang bom|\bdn\b/.test(a)) city = '동나이';
  else if (/binh duong|thuan an|di an|thu dau mot|ben cat|tan uyen|\bbd\b/.test(a)) city = '빈증';
  else if (/vung tau|ba ria|brvt/.test(a)) city = '붕따우';
  else if (/can tho/.test(a)) city = '껀터';
  else if (/nha trang|khanh hoa/.test(a)) city = '나트랑';
  else if (/ha noi|hanoi/.test(a)) city = '하노이';
  else if (/long an|tay ninh|ben tre|tien giang|vinh long|dong thap|an giang|kien giang|soc trang|ca mau|binh phuoc|binh thuan|lam dong|da lat/.test(a)) city = '기타남부';
  else if (/ho chi minh|hochiminh|hcmc|\bhcm\b|sai gon|saigon|pmh|phu my hung|thao dien|quan |dist|district|\bq\.?\s*\d|thu duc|binh thanh|phu nhuan|tan binh|tan phu|go vap|nha be|hoc mon|cu chi|binh chanh|binh tan/.test(a)) city = '호치민';

  // 구군 (호치민 위주)
  let district = '';
  if (city === '호치민' || city === '') {
    let m = a.match(/(?:dist\.?|district|quan|q)\s*\.?\s*(\d{1,2})/) || a.match(/\bd\s*(\d{1,2})\b/) || a.match(/quan\s*(\d{1,2})/);
    if (m) district = `${m[1]}군`;
    else if (/thu duc/.test(a)) district = '투득';
    else if (/binh thanh/.test(a)) district = '빈탄';
    else if (/phu nhuan/.test(a)) district = '푸뉴언';
    else if (/tan binh/.test(a)) district = '탄빈';
    else if (/tan phu/.test(a)) district = '탄푸';
    else if (/go vap/.test(a)) district = '고밥';
    else if (/binh tan/.test(a)) district = '빈떤';
    else if (/nha be/.test(a)) district = '냐베';
    else if (/hoc mon/.test(a)) district = '혹몬';
    else if (/cu chi/.test(a)) district = '꾸찌';
    else if (/binh chanh/.test(a)) district = '빈찬';
    else if (/thao dien|an phu|an khanh/.test(a)) district = '투득';   // 구 2군 지역
    else if (/pmh|phu my hung|tan phong/.test(a)) district = '7군';     // 푸미흥=7군
    if (district && !city) city = '호치민';
  }
  return { city: city || '미상', district };
}

// ---------- 라이프플라자 catName → 대분류 ----------
const LIFE_MAJOR = {
  '여행사':'여가·여행','항공사':'여가·여행','렌트카':'여가·여행','골프':'여가·여행','스포츠':'여가·여행','헬스':'여가·여행','당구':'여가·여행','오락':'여가·여행','가요주점':'여가·여행',
  '학원':'교육','학교':'교육',
  '미용':'미용·마사지','마사지&스파&찜질방':'미용·마사지','이용':'미용·마사지','스킨케어&클리닉':'미용·마사지',
  '치과':'의료','한방&의원':'의료','외과&내과':'의료','안과&안경':'의료','약국':'의료',
  '한식':'음식점·식품','일식':'음식점·식품','중식':'음식점·식품','치킨':'음식점·식품','피자':'음식점·식품','음식기타':'음식점·식품','족발':'음식점·식품','분식':'음식점·식품',
  '떡&빵':'카페·베이커리','카페':'카페·베이커리',
  '마트':'마트·식품','식품':'마트·식품','특산':'마트·식품',
  '생활가전':'생활','생활':'생활','벼룩시장':'생활','애완동물':'생활',
  '침구&가구':'가구·인테리어','인테리어&디자인':'가구·인테리어',
  '건설':'산업·건설·제조','건설사':'산업·건설·제조','자재&설비':'산업·건설·제조','공장/식당설비':'산업·건설·제조','사무&CCTV':'산업·건설·제조',
  '부동산&컨설팅':'부동산','공단분양':'부동산','매매&임대':'부동산',
  '은행':'금융','보험&증권&투자':'금융','송금&환전':'금융',
  '회계':'법무·회계','법무':'법무·회계',
  '광고&인쇄':'광고·디자인',
  '포워딩&이사':'물류·운송',
  '주요기관&단체':'호치민 주요기관',
  '컴퓨터':'컴퓨터·모바일',
  '1군':'기타','7군':'기타','다낭':'기타','남부':'기타','북부':'기타','그외지역':'기타','기타':'기타','기타업체':'기타',
};
// 대분류 → app category (앱/웹 필터용)
const APP_CAT = {
  '호치민 주요기관':'service','종합병원':'health','국제학교':'school','종교':'other','가구·인테리어':'construction',
  '광고·디자인':'design','교육':'education','동문·동호회':'other','금융':'finance','미용·마사지':'beauty',
  '물류·운송':'logistics','법무·회계':'legal','부동산':'realestate','생활':'shopping','음식점·식품':'food',
  '마트·식품':'shopping','카페·베이커리':'cafe','여가·여행':'travel','호텔':'lodging','의료':'health',
  '의료(한방)':'health','컴퓨터·모바일':'it','산업·건설·제조':'manufacturing','광고':'design','기타':'other',
};

// ---------- 라이프플라자 인덱스 ----------
const lifeByPhone = new Map(), lifeByName = new Map();
for (const l of life) {
  for (const k of phonesKeys(l.phones)) (lifeByPhone.get(k) || lifeByPhone.set(k, []).get(k)).push(l);
  const nk = nameKey(l.name); if (nk) (lifeByName.get(nk) || lifeByName.set(nk, []).get(nk)).push(l);
}
const usedLife = new Set();
const uniqPhones = arr => { const seen = new Set(), out = []; for (const p of arr) { const k = phoneKeys(p)[0] || p; if (!seen.has(k)) { seen.add(k); out.push(p); } } return out; };

let master = [];
let nBoth = 0, nMag = 0, nLife = 0;

// 1) 매거진 기준 (라이프플라자와 병합)
for (const m of mag) {
  let hit = null;
  for (const k of phonesKeys(m.phones)) { const arr = lifeByPhone.get(k); if (arr) { hit = arr.find(x => !usedLife.has(x.bcode + '|' + x.postId)) || arr[0]; break; } }
  if (!hit) { const arr = lifeByName.get(nameKey(m.name)); if (arr) hit = arr.find(x => !usedLife.has(x.bcode + '|' + x.postId)) || arr[0]; }
  let phones = [...m.phones];
  let lat = m.lat || null, lng = m.lng || null, address = m.address, sourceUrl = '';
  let crossConfirmed = '';
  if (hit) {
    usedLife.add(hit.bcode + '|' + hit.postId);
    phones = uniqPhones([...m.phones, ...hit.phones]);
    if (!address && hit.address) address = hit.address;
    if (!lat && hit.lat) { lat = hit.lat; lng = hit.lng; }
    sourceUrl = hit.sourceUrl; crossConfirmed = 'Y'; nBoth++;
  } else nMag++;
  const reg = parseRegion(address, m.name);
  master.push({
    category: m.major, appCategory: APP_CAT[m.major] || m.category || 'other',
    name: m.name, name_en: m.name_en || '', contact_person: m.contact_person || '',
    phones, address, city: reg.city, district: reg.district, lat, lng,
    source: 'own', crossConfirmed, confidence: m.confidence, extra: m.extra || '', mag_page: m.mag_page, sourceUrl,
  });
}

// 2) 라이프플라자 단독
for (const l of life) {
  if (usedLife.has(l.bcode + '|' + l.postId)) continue;
  nLife++;
  const major = LIFE_MAJOR[l.catName] || '기타';
  const reg = parseRegion(l.address, l.catName);
  master.push({
    category: major, appCategory: APP_CAT[major] || 'other',
    name: l.name, name_en: '', contact_person: '',
    phones: l.phones, address: l.address, city: reg.city, district: reg.district,
    lat: l.lat || null, lng: l.lng || null,
    source: 'open', crossConfirmed: '', confidence: 'high', extra: '', mag_page: '', sourceUrl: l.sourceUrl,
  });
}

// ---------- 지오코딩 캐시 반영 (주소→좌표). 좌표 없거나 이상치면 채움/교체 ----------
{
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(path.join(OUT, 'geocode_cache.json'), 'utf8')); } catch (_) {}
  const isSuspect = r => r.lat && r.city === '호치민' && (r.lat < 10.3 || r.lat > 11.0 || r.lng < 106.4 || r.lng > 107.0);
  let filled = 0;
  for (const r of master) {
    const g = r.address && cache[r.address];
    if (g && (!(r.lat && r.lng) || isSuspect(r))) { r.lat = g.lat; r.lng = g.lng; filled++; }
    else if (isSuspect(r)) { r.lat = null; r.lng = null; }   // 이상치인데 교체 못하면 무효화
  }
  console.log('지오코딩 좌표 반영:', filled, '건');
}

// ---------- 최종 중복제거 (이름 + 전화 끝8자리 매칭. own 우선, 라이프플라자 내부 중복 제거) ----------
{
  const dmap = new Map(); const out = []; let removed = 0;
  for (const r of master) {
    const nk = nameKey(r.name);
    const ph = [...new Set(r.phones.flatMap(phoneKeys).map(k => k.slice(-8)).filter(Boolean))];
    let foundKey = null;
    if (nk && ph.length) for (const p of ph) { if (dmap.has(nk + '|' + p)) { foundKey = nk + '|' + p; break; } }
    if (foundKey) {
      const prev = dmap.get(foundKey);
      prev.phones = uniqPhones([...prev.phones, ...r.phones]);
      if (!prev.address && r.address) prev.address = r.address;
      if (!prev.lat && r.lat) { prev.lat = r.lat; prev.lng = r.lng; }
      if (!prev.city || prev.city === '미상') { if (r.city && r.city !== '미상') { prev.city = r.city; prev.district = r.district; } }
      if (r.source === 'own') prev.source = 'own';                 // own 우선
      if (r.crossConfirmed === 'Y' || (prev.source === 'own' && r.source === 'open')) prev.crossConfirmed = 'Y';
      removed++; continue;
    }
    if (nk && ph.length) for (const p of ph) if (!dmap.has(nk + '|' + p)) dmap.set(nk + '|' + p, r);
    out.push(r);
  }
  console.log('내부 중복 제거:', removed, '건 →', out.length);
  master = out;
}

// ---------- 정렬: 카테고리별로 출처 섞어 통합 (대분류→도시→구군→이름) ----------
const MAJOR_ORDER = ['호치민 주요기관','종합병원','국제학교','종교','교육','동문·동호회','금융','법무·회계',
  '부동산','가구·인테리어','광고·디자인','산업·건설·제조','물류·운송','컴퓨터·모바일','미용·마사지','의료',
  '음식점·식품','카페·베이커리','마트·식품','생활','여가·여행','호텔','광고','기타'];
const CITY_ORDER = ['호치민','다낭','빈증','동나이','붕따우','나트랑','껀터','하노이','기타남부','미상'];
const oi = (arr, v) => { const i = arr.indexOf(v); return i < 0 ? 999 : i; };
// 대분류 순 → 그 안에서는 업소명 한글 글자순 (도시·구군은 컬럼/필터로만 사용)
master.sort((a, b) =>
  oi(MAJOR_ORDER, a.category) - oi(MAJOR_ORDER, b.category) ||
  (a.name || '').localeCompare(b.name || '', 'ko') ||
  oi(CITY_ORDER, a.city) - oi(CITY_ORDER, b.city));

// ---------- 산출 ----------
fs.writeFileSync(path.join(OUT, 'yellowpage_master.json'), JSON.stringify(master, null, 2));
const esc = v => { const s = String(v == null ? '' : v).replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s; };
const cols = ['city', 'district', 'category', 'name', 'name_en', 'phones', 'address', 'lat', 'lng', 'source', 'crossConfirmed', 'appCategory', 'confidence'];
const rows = [cols.join(',')];
for (const r of master) rows.push(cols.map(c => esc(c === 'phones' ? r.phones.join(' / ') : r[c])).join(','));
fs.writeFileSync(path.join(OUT, 'yellowpage_master.csv'), '﻿' + rows.join('\r\n'));

// ---------- 통계 ----------
const tally = (arr, key) => { const t = {}; for (const r of arr) t[r[key] || '(없음)'] = (t[r[key] || '(없음)'] || 0) + 1; return Object.entries(t).sort((a, b) => b[1] - a[1]); };
console.log('=== 베트남 남부 옐로페이지 마스터 ===');
console.log('총 업체:', master.length, ' (own:', nBoth + nMag, '[교차확인 both', nBoth, '+ 매거진단독', nMag, '] / open:', nLife, ')');
console.log('\n[도시]'); for (const [k, v] of tally(master, 'city')) console.log('  ', k, v);
console.log('\n[구군 상위15]'); tally(master, 'district').slice(0, 15).forEach(([k, v]) => console.log('  ', k || '(미상)', v));
console.log('\n[대분류]'); for (const [k, v] of tally(master, 'category')) console.log('  ', k, v);
console.log('\n좌표 보유:', master.filter(r => r.lat).length, '| 주소 보유:', master.filter(r => r.address).length);
console.log('산출: yellowpage_master.json / yellowpage_master.csv');
