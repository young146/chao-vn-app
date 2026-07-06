// Layer 3: 매거진 OCR(yellowpage.json) ↔ 라이프플라자 크롤링(lifeplaza.json) 비교·보완.
// 조인 키 = 전화번호(정규화). 산출:
//  1) 전화 매칭 = 양쪽에 다 있는 업체(우리 OCR 전화 검증됨) → GPS 좌표 보강
//  2) 매거진 단독 = 우리만 보유
//  3) 라이프플라자 단독 = 우리가 누락(추가 후보)
//  4) 이름 유사·전화 불일치 = OCR 전화 오독 의심(검수 대상)
// 사용: node scripts/yellowpage/compare.js
const fs = require('fs');
const path = require('path');
const OUT = 'C:/chao-vn-app/chao-vn-app/.tmp/yellowpage/out';
const mag = JSON.parse(fs.readFileSync(path.join(OUT, 'yellowpage.json'), 'utf8'));
const life = JSON.parse(fs.readFileSync(path.join(OUT, 'lifeplaza.json'), 'utf8'));

// 한 전화 문자열 → 정규화 키 배열. 한 칸에 여러 번호("A/B", "A,B")거나 범위("...0850~1")일 수 있음.
function phoneKeys(p) {
  if (!p) return [];
  const keys = [];
  for (let part of String(p).split(/[/,;]|및|\n/)) {
    part = part.split('~')[0];                 // 범위 "0850~1" → 기준번호만
    let d = part.replace(/[^0-9]/g, '');
    if (d.startsWith('84')) d = d.slice(2);
    d = d.replace(/^0+/, '');
    if (d.length >= 8) keys.push(d);
  }
  return keys;
}
const phonesKeys = arr => (Array.isArray(arr) ? arr : [arr]).flatMap(phoneKeys);
const nameKey = s => (s || '').replace(/\([^)]*\)/g, '').replace(/[\s.,'"·\-_]/g, '').toLowerCase();

// 라이프플라자 인덱스
const lifeByPhone = new Map();   // phoneKey -> [life]
const lifeByName = new Map();    // nameKey -> [life]
for (const l of life) {
  for (const k of phonesKeys(l.phones)) (lifeByPhone.get(k) || lifeByPhone.set(k, []).get(k)).push(l);
  const nk = nameKey(l.name); if (nk) (lifeByName.get(nk) || lifeByName.set(nk, []).get(nk)).push(l);
}

const matchedLifeKeys = new Set();   // bcode|postId 매칭됨 표시
let phoneMatch = 0, nameMatchPhoneDiff = 0, magOnly = 0, gpsAdded = 0;
const magEnriched = [];
const ocrSuspect = [];               // 이름 같은데 전화 다름 → OCR 의심

for (const m of mag) {
  const pks = phonesKeys(m.phones);
  let hit = null, via = '';
  // 1) 전화 매칭
  for (const k of pks) { const arr = lifeByPhone.get(k); if (arr && arr.length) { hit = arr[0]; via = 'phone'; break; } }
  // 2) 전화 매칭 없으면 이름 매칭
  if (!hit) {
    const arr = lifeByName.get(nameKey(m.name));
    if (arr && arr.length) {
      hit = arr[0]; via = 'name';
      // 이름 같은데 전화 다름 → OCR 의심
      const lpks = phonesKeys(hit.phones);
      if (pks.length && lpks.length && !pks.some(k => lpks.includes(k))) {
        nameMatchPhoneDiff++;
        ocrSuspect.push({ name: m.name, mag_phone: m.phones.join(' / '), life_phone: hit.phones.join(' / '),
          mag_page: m.mag_page, major: m.major, life_addr: hit.address });
      }
    }
  }
  const rec = { ...m };
  if (hit) {
    matchedLifeKeys.add(hit.bcode + '|' + hit.postId);
    rec.matchStatus = via === 'phone' ? 'both(phone)' : 'both(name)';
    if (!rec.address && hit.address) rec.address = hit.address;        // 주소 보강
    if (hit.lat && !rec.lat) { rec.lat = hit.lat; rec.lng = hit.lng; gpsAdded++; }  // 좌표 보강
    rec.lifeplaza_url = hit.sourceUrl;
    if (via === 'phone') phoneMatch++;
  } else { rec.matchStatus = 'magazine-only'; magOnly++; }
  magEnriched.push(rec);
}

// 라이프플라자 단독(우리 매거진에 없음)
const lifeOnly = life.filter(l => !matchedLifeKeys.has(l.bcode + '|' + l.postId));

// 산출 파일
const writeCsv = (file, cols, rows) => {
  const esc = v => { const s = String(v == null ? '' : v).replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s; };
  const out = [cols.join(',')];
  for (const r of rows) out.push(cols.map(c => esc(typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c])).join(','));
  fs.writeFileSync(path.join(OUT, file), '﻿' + out.join('\r\n'));
};

fs.writeFileSync(path.join(OUT, 'magazine_enriched.json'), JSON.stringify(magEnriched, null, 2));
writeCsv('magazine_enriched.csv',
  ['major', 'name', 'phones', 'address', 'lat', 'lng', 'matchStatus', 'mag_page', 'confidence', 'lifeplaza_url'],
  magEnriched.map(r => ({ ...r, phones: r.phones.join(' / ') })));

writeCsv('lifeplaza_only.csv',
  ['catName', 'name', 'phones', 'address', 'lat', 'lng', 'sourceUrl'],
  lifeOnly.map(r => ({ ...r, phones: r.phones.join(' / ') })));

writeCsv('ocr_suspect_phones.csv',
  ['name', 'mag_phone', 'life_phone', 'major', 'mag_page', 'life_addr'], ocrSuspect);

console.log('=== 비교·보완 결과 ===');
console.log('매거진:', mag.length, '| 라이프플라자:', life.length);
console.log('전화 매칭(양쪽 확인됨):', phoneMatch);
console.log('이름만 매칭:', magEnriched.filter(r => r.matchStatus === 'both(name)').length,
  '(그중 전화 불일치=OCR의심:', nameMatchPhoneDiff, ')');
console.log('매거진 단독:', magOnly, '| 라이프플라자 단독(추가후보):', lifeOnly.length);
console.log('GPS 좌표 보강:', gpsAdded, '건');
console.log('\n산출:');
console.log('  magazine_enriched.csv  - 매거진 + 매칭상태 + GPS 보강');
console.log('  lifeplaza_only.csv     - 우리가 누락한', lifeOnly.length, '개 (추가 검토)');
console.log('  ocr_suspect_phones.csv - 전화 OCR 오독 의심', ocrSuspect.length, '건 (검수)');
