require('dotenv').config({ path: 'C:/xinchao-news-final/daily-news-final/.env' });
const U = process.env.WORDPRESS_USERNAME, P = process.env.WORDPRESS_APP_PASSWORD;
const tok = Buffer.from(`${U}:${P}`).toString('base64');
const base = 'https://chaovietnam.co.kr/wp-json/xcd/v1';
const fs = require('fs');

async function search(q) {
  const r = await fetch(`${base}/search?q=${encodeURIComponent(q)}&_=${Date.now()}`, {
    headers: { Authorization: `Basic ${tok}` }, cache: 'no-store',
  });
  const d = await r.json();
  const arr = Array.isArray(d) ? d : (d.items || d.results || d.companies || []);
  return arr;
}

(async () => {
  const out = [];
  // 하노이 vs 호치민 샘플 비교
  for (const q of ['Dae Lyuk', '123 Viet Nam', 'SEO INCHEON', '제주항공', '동원', 'HS HYOSUNG']) {
    const arr = await search(q);
    const c = arr.find(x => (x.company || '').toLowerCase().includes(q.toLowerCase())) || arr[0];
    if (!c) { out.push(`${q} -> 없음`); continue; }
    out.push(`[${c.source || '?'}] ${c.company}\n   area=${JSON.stringify(c.area)} addr=${JSON.stringify(c.address)}`);
  }
  // 하노이 전체에서 address 길이 통계: 빈 검색으로 페이지 훑기 대신 area=='24' 같은 비정상 패턴 체크
  fs.writeFileSync('_addr_check.out', out.join('\n') + '\n', 'utf8');
})().catch(e => fs.writeFileSync('_addr_check.out', 'ERR ' + e.message + '\n'));
