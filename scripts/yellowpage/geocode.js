// Layer 3: 마스터의 "주소O·좌표X" + 좌표 이상치 항목을 OSM Nominatim으로 지오코딩.
// 무료. 초당 1건(정책 준수). 결과는 geocode_cache.json 에 주소키로 누적 → 중단돼도 재개 가능.
// 사용: node scripts/yellowpage/geocode.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = 'C:/chao-vn-app/chao-vn-app/.tmp/yellowpage/out';
const CACHE = path.join(OUT, 'geocode_cache.json');
const LOG = path.join(OUT, 'geocode.log');
const master = JSON.parse(fs.readFileSync(path.join(OUT, 'yellowpage_master.json'), 'utf8'));

const cityEn = { '호치민': 'Ho Chi Minh', '다낭': 'Da Nang', '빈증': 'Binh Duong', '동나이': 'Dong Nai',
  '붕따우': 'Vung Tau', '나트랑': 'Nha Trang', '껀터': 'Can Tho', '하노이': 'Hanoi' };
const isSuspect = r => r.lat && r.city === '호치민' && (r.lat < 10.3 || r.lat > 11.0 || r.lng < 106.4 || r.lng > 107.0);

// 지오코딩 대상: 좌표 없고 주소 있음 + 좌표 이상치
const targets = master.filter(r => r.address && (!(r.lat && r.lng) || isSuspect(r)));

// 주소 → 쿼리 문자열 (한글 제거, 도시 영문 보강, Vietnam 부착)
function buildQuery(r) {
  let a = r.address.replace(/[ㄱ-힝]+/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  a = a.replace(/^[,\s]+|[,\s]+$/g, '');
  const en = cityEn[r.city];
  if (en && !new RegExp(en.replace(/\s/g, '\\s*'), 'i').test(a)) a += ', ' + en;
  if (!/vietnam|việt nam/i.test(a)) a += ', Vietnam';
  return a;
}

let cache = {};
if (fs.existsSync(CACHE)) { try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (_) {} }
const log = m => { const line = `[${new Date().toISOString().slice(11, 19)}] ${m}\n`; fs.appendFileSync(LOG, line); };

const sleep = ms => new Promise(r => setTimeout(r, ms));
function nominatim(q) {
  const url = `/search?format=json&limit=1&countrycodes=vn&q=${encodeURIComponent(q)}`;
  return new Promise((resolve) => {
    const req = https.request({ host: 'nominatim.openstreetmap.org', path: url, method: 'GET',
      headers: { 'User-Agent': 'ChaoVietnam-YellowPages/1.0 (younghan146@gmail.com)', 'Accept-Language': 'en' } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { const j = JSON.parse(d); resolve(j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null); }
        catch (e) { resolve(null); } }); });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => req.destroy());
    req.end();
  });
}

(async () => {
  // 대상 주소(중복 제거) 목록
  const queries = new Map(); // address -> query
  for (const r of targets) if (!queries.has(r.address)) queries.set(r.address, buildQuery(r));
  const list = [...queries.entries()].filter(([addr]) => !(addr in cache));
  log(`지오코딩 시작: 대상주소 ${queries.size} (캐시제외 ${list.length})`);
  let ok = 0, fail = 0, i = 0;
  for (const [addr, q] of list) {
    i++;
    const res = await nominatim(q);
    cache[addr] = res;           // 실패도 null로 기록(재시도 방지)
    if (res) ok++; else fail++;
    if (i % 20 === 0) { fs.writeFileSync(CACHE, JSON.stringify(cache)); log(`진행 ${i}/${list.length} (성공 ${ok} 실패 ${fail})`); }
    await sleep(1100);
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  const found = Object.values(cache).filter(Boolean).length;
  log(`완료. 신규 성공 ${ok} / 실패 ${fail}. 캐시 총 ${Object.keys(cache).length} (좌표확보 ${found})`);
  console.log(`DONE ok=${ok} fail=${fail} cacheTotal=${Object.keys(cache).length} found=${found}`);
})();
