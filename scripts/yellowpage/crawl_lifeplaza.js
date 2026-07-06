// Layer 3: 라이프플라자(vietnamlife.uriweb.kr, 아임웹 지도형 게시판) 옐로페이지 크롤러.
// 각 말단 카테고리 페이지(?sort=TIME&page=N)는 업체 카드를 서버사이드 렌더 → 정규식 파싱.
// 카드: 업소명(.tit) / 주소(.adress) / 전화(tel:) / postId(list_NNN) / 게시판코드(data-bcode)
// 사용: node scripts/yellowpage/crawl_lifeplaza.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'vietnamlife.uriweb.kr';
const OUT = 'C:/chao-vn-app/chao-vn-app/.tmp/yellowpage/out';
fs.mkdirSync(OUT, { recursive: true });

// 카테고리 id → 이름 (홈 nav에서 추출). 뉴스/인터뷰/문의 등 비업체는 제외.
const CATS = {
  17:'금융',18:'맛집',19:'여행',20:'숙박',21:'뷰티',22:'교육',38:'여행사',44:'1군',49:'학원',
  52:'미용',53:'학교',54:'쇼핑',55:'생활가전',56:'마트',57:'의료&건강',58:'치과',76:'항공사',77:'렌트카',
  78:'침구&가구',79:'식품',80:'마사지&스파&찜질방',81:'스킨케어&클리닉',83:'한방&의원',84:'외과&내과',
  85:'안과&안경',90:'부동산&건설',92:'스포츠',93:'건설',94:'골프',95:'헬스',96:'당구',97:'사무&CCTV',
  98:'건설사',99:'인테리어&디자인',100:'자재&설비',101:'가요주점',102:'여가&오락',103:'카페',104:'오락',
  109:'7군',110:'구인구직',113:'생활정보',114:'생활',115:'은행',124:'보험&증권&투자',130:'남부',131:'다낭',
  132:'북부',133:'한식',134:'일식',135:'중식',136:'떡&빵',137:'치킨',138:'피자',139:'음식기타',140:'족발',
  141:'분식',143:'기타',144:'특산',145:'약국',146:'그외지역',147:'이용',148:'송금&환전',150:'회계',151:'법무',
  152:'주요기관&단체',153:'광고&인쇄',154:'포워딩&이사',155:'기타업체',156:'공장/식당설비',157:'컴퓨터',
  158:'벼룩시장',159:'애완동물',162:'부동산&컨설팅',163:'공단분양',166:'매매&임대',167:'구인',168:'구직',191:'업체',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
function get(urlPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: HOST, path: urlPath, method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Language': 'ko' } },
      res => { let d = ''; res.setEncoding('utf8'); res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject); req.setTimeout(20000, () => req.destroy(new Error('timeout'))); req.end();
  });
}

const dec = t => (t || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// 한 페이지 HTML → 업체 카드 배열
function parsePage(html, catId, catName) {
  const out = [];
  // 각 카드 시작 위치(list_NNN + data-bcode)
  const markers = [...html.matchAll(/id="list_(\d+)"\s+data-bcode="([^"]+)"/g)];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i + 1 < markers.length ? markers[i + 1].index : html.length;
    const block = html.slice(start, end);
    const postId = markers[i][1], bcode = markers[i][2];
    const name = dec((block.match(/class="tit">([\s\S]*?)<\/div>/) || [])[1]);
    const address = dec((block.match(/class="adress">([\s\S]*?)<\/p>/) || [])[1]).replace(/<[^>]+>/g, '');
    const phones = [...block.matchAll(/href="tel:([^"]+)"/g)].map(m => dec(m[1])).filter(Boolean);
    const px = (block.match(/_pos_x_temp"\s+value="([^"]*)"/) || [])[1];
    const py = (block.match(/_pos_y_temp"\s+value="([^"]*)"/) || [])[1];
    if (!name) continue;
    out.push({ name, address, phones, postId, bcode, catId, catName,
      lat: py && +py ? +py : null, lng: px && +px ? +px : null,
      sourceUrl: `https://${HOST}/${catId}/?idx=${postId}&bmode=view` });
  }
  return out;
}

(async () => {
  const all = [];
  const seen = new Set();        // bcode|postId
  const catStats = {};
  for (const [idStr, catName] of Object.entries(CATS)) {
    const catId = +idStr;
    let page = 1, pageSigs = new Set(), added = 0;
    while (page <= 60) {
      let html;
      try { html = await get(`/${catId}/?sort=TIME&page=${page}`); }
      catch (e) { console.error('  ! fetch fail', catId, page, e.message); break; }
      const cards = parsePage(html, catId, catName);
      if (cards.length === 0) break;
      // 페이지 시그니처(첫·끝 postId) 반복 시 = 마지막 페이지 초과로 page1 재노출 → 중단
      const sig = cards[0].postId + '-' + cards[cards.length - 1].postId;
      if (pageSigs.has(sig)) break;
      pageSigs.add(sig);
      for (const c of cards) {
        const key = c.bcode + '|' + c.postId;
        if (seen.has(key)) continue;
        seen.add(key); all.push(c); added++;
      }
      page++;
      await sleep(250);
    }
    if (added) { catStats[`${catId} ${catName}`] = added; console.log(`[${catId}] ${catName}: ${added}건 (${page - 1}p)`); }
    await sleep(150);
  }

  // 산출
  fs.writeFileSync(path.join(OUT, 'lifeplaza.json'), JSON.stringify(all, null, 2));
  const esc = v => { const s = String(v == null ? '' : v).replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s; };
  const cols = ['catName', 'name', 'phones', 'address', 'lat', 'lng', 'catId', 'postId', 'sourceUrl'];
  const rows = [cols.join(',')];
  for (const r of all) rows.push(cols.map(c => esc(c === 'phones' ? r.phones.join(' / ') : r[c])).join(','));
  fs.writeFileSync(path.join(OUT, 'lifeplaza.csv'), '﻿' + rows.join('\r\n'));

  console.log('\n=== 라이프플라자 크롤링 완료 ===');
  console.log('총 업체:', all.length, '| 카테고리:', Object.keys(catStats).length);
  console.log('주소 있음:', all.filter(r => r.address).length, '| 좌표 있음:', all.filter(r => r.lat).length);
  console.log('산출: lifeplaza.json , lifeplaza.csv');
})();
