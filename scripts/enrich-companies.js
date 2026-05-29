#!/usr/bin/env node
/**
 * enrich-companies.js
 *
 * 코참 원본 사이트(kochamvietnam.com / kocham.kr)에서 상세 정보를 크롤링하여
 * WP API를 통해 DB를 보강(enrich)한다.
 *
 * 사용법:
 *   node scripts/enrich-companies.js
 *   node scripts/enrich-companies.js --start 500 --limit 100
 *   node scripts/enrich-companies.js --dry-run   (DB 업데이트 없이 파싱만 테스트)
 *
 * 환경변수 (.env 또는 shell):
 *   WP_BASE_URL      e.g. https://chaovietnam.co.kr   (기본값 아래 참고)
 *   WP_USER          WP 관리자 아이디
 *   WP_APP_PASSWORD  WP 앱 비밀번호 (공백 포함 가능)
 *
 * 요구사항: Node.js 18+ (native fetch 지원)
 */

'use strict';

// ─── .env 로드 (dotenv 없이 직접 파싱) ──────────────────────────────────────
const fs = require('fs');
const path = require('path');

// kocham.kr SSL이 약한 DH 키를 사용해 최신 Node fetch가 ERR_SSL_DH_KEY_TOO_SMALL로 거부함.
// 크롤링 대상 사이트라 보안 레벨을 낮춰 연결 허용 (외부 데이터 읽기 전용).
try {
  const { Agent, setGlobalDispatcher } = require('undici');
  setGlobalDispatcher(new Agent({ connect: { ciphers: 'DEFAULT@SECLEVEL=0' } }));
} catch (_) {}

(function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '.env'),
    // daily-news-final 크리덴셜 우선 (WP 어드민 권한 확인된 계정)
    path.join('C:', 'xinchao-news-final', 'daily-news-final', '.env'),
    path.join(process.env.USERPROFILE || '', 'OneDrive', 'dev-secrets', 'chao-vn-app', 'functions', '.env'),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
})();

// ─── 설정 ────────────────────────────────────────────────────────────────────
const WP_BASE = (process.env.WP_BASE_URL || 'https://chaovietnam.co.kr').replace(/\/$/, '');
const WP_USER = process.env.WP_USER || process.env.WORDPRESS_USERNAME || '';
const WP_PASS = process.env.WP_APP_PASSWORD || process.env.WORDPRESS_APP_PASSWORD || '';
const THROTTLE_MS = 1000;        // 회사당 1초 대기
const BATCH_PER_PAGE = 100;      // WP API 페이지당 회사 수
const LOG_FILE = path.join(__dirname, '..', 'ENRICHMENT_LOG.txt');

// ─── CLI 인수 파싱 ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let CLI_START = 0;
let CLI_LIMIT = Infinity;
let DRY_RUN = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--start' && args[i + 1]) { CLI_START = parseInt(args[++i], 10); }
  if (args[i] === '--limit' && args[i + 1]) { CLI_LIMIT = parseInt(args[++i], 10); }
  if (args[i] === '--dry-run') { DRY_RUN = true; }
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n', 'utf8'); } catch (_) {}
}

function wpAuthHeader() {
  if (!WP_USER || !WP_PASS) return {};
  const encoded = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  return { Authorization: `Basic ${encoded}` };
}

/** HTML 엔티티 디코딩 (기본 집합) */
function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** HTML 태그 제거 */
function stripTags(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** 텍스트에서 YYYY년 패턴으로 창립연도 추출 */
function extractFoundedYear(text) {
  if (!text) return '';
  // 4자리 연도 패턴 (1980~2030)
  const m = text.match(/(?:설립|창립|창업|established in|founded in|since)[\s:]*([12][0-9]{3})/i)
    || text.match(/([12][0-9]{3})\s*년\s*(?:설립|창립|창업)/i)
    || text.match(/\b(19[89][0-9]|20[0-2][0-9])\b/);
  return m ? m[1] : '';
}

/** 이메일 패턴 추출 */
function extractEmails(text) {
  if (!text) return [];
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  return matches ? [...new Set(matches)] : [];
}

// ─── 파서: kocham.kr (호치민) ────────────────────────────────────────────────
// HTML 구조: <table class="subtable_list"><tr><th>Label</th><td>Value</td></tr>...</table>
// Number of staff → employees
// Service → products
// (회사소개 없음 — 자유 텍스트 없음)
function parseKochamKr(html) {
  const result = {
    description: '', products: '', employees: '', country: '',
    mobile: '', additional_emails: [], founded_year: '',
  };

  // table.subtable_list 내용 추출
  const tableMatch = html.match(/<table[^>]*class=["'][^"']*subtable_list[^"']*["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return result;

  const tableHtml = tableMatch[1];

  // <tr> 행마다 th → td 매핑
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];
    const thMatch = rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    const tdMatch = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    if (!thMatch || !tdMatch) continue;

    const label = stripTags(thMatch[1]).toLowerCase().trim();
    const value = decodeEntities(stripTags(tdMatch[1])).trim();

    if (!value) continue;

    if (label.includes('number of staff') || label.includes('직원수') || label.includes('인원')) {
      result.employees = value;
    } else if (label.includes('service') || label.includes('business') || label.includes('제품') || label.includes('서비스')) {
      result.products = value;
    } else if (label.includes('country') || label.includes('국가') || label.includes('법인등록')) {
      result.country = value;
    } else if (label === 'mobile' || label.includes('모바일')) {
      result.mobile = value;
    } else if (label === 'e-mail' || label === 'email') {
      const emails = extractEmails(value);
      result.additional_emails.push(...emails);
    }
  }

  // 전체 텍스트에서 이메일 추가 수집
  const allText = decodeEntities(stripTags(tableHtml));
  const allEmails = extractEmails(allText);
  result.additional_emails.push(...allEmails);
  result.additional_emails = [...new Set(result.additional_emails)];

  // 창립연도
  result.founded_year = extractFoundedYear(allText);

  return result;
}

// ─── 파서: kochamvietnam.com (하노이) ────────────────────────────────────────
// HTML 구조: .content .sub-container 내 자유 형식 <p> 태그들
// "회사소개" 라벨 다음 단락 → description
// "임직원" 라벨 아래 → 임직원 섹션 (Mobile, Email 등 포함)
// "지원수 :" or "직원수 :" → employees
function parseKochamVietnam(html) {
  const result = {
    description: '', products: '', employees: '', country: '',
    mobile: '', additional_emails: [], founded_year: '',
  };

  // 실제 회사 본문만 격리한다.
  // 주의: 바깥 .sub-container에는 LNB 메뉴·시계·작성자(by 관리자) 같은 잡음이 섞여 있으므로
  //       작성자 정보(.info-writing) 블록 "이후"부터 첨부/댓글 영역 "이전"까지만 본문으로 본다.
  //       (이 격리를 안 하면 "by 관리자" 등 게시판 보일러플레이트가 description으로 들어간다.)
  let contentHtml = '';
  const subContainerMatch = html.match(
    /class=["'][^"']*sub-container[^"']*["'][^>]*>([\s\S]*?)(?=<div class=["'][^"']*(?:bd-file|view-bottom|comment|reply|sns|btn-wrap)[^"']*["']|<footer|<\/body)/i
  );
  contentHtml = subContainerMatch ? subContainerMatch[1] : html;

  // 작성자 정보(.info-writing) 줄과 그 앞부분(제목/메뉴 등)을 제거
  const iwPos = contentHtml.search(/class=["'][^"']*info-writing/i);
  if (iwPos >= 0) {
    const closePos = contentHtml.indexOf('</div>', iwPos);
    if (closePos >= 0) contentHtml = contentHtml.slice(closePos + 6);
  }
  // HTML 주석 제거 (<!-- ... -->)
  contentHtml = contentHtml.replace(/<!--[\s\S]*?-->/g, '');

  // 텍스트로 변환
  const allText = decodeEntities(stripTags(contentHtml));

  // 단락 분리 (p 태그 + br 기준)
  const paragraphs = contentHtml
    .split(/<\/?p[^>]*>|<br\s*\/?>/gi)
    .map(p => decodeEntities(stripTags(p)).replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // 섹션 파싱: 한국어 라벨 기반
  let inDescription = false;
  let inProducts = false;
  let descLines = [];
  let productLines = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const lower = para.toLowerCase();

    // 고용인원
    if (/지원수\s*[:：]|직원\s*수\s*[:：]|고용\s*인원\s*[:：]|number of staff|인원\s*[:：]/i.test(para)) {
      const m = para.match(/[:：]\s*(.+)/);
      if (m) result.employees = m[1].trim();
      else result.employees = para.replace(/.*(?:지원수|직원수|고용인원|number of staff|인원)\s*[:：]?\s*/i, '').trim();
      inDescription = false;
      inProducts = false;
    }
    // 법인등록국가
    else if (/법인\s*등록\s*국가\s*[:：]|country\s*[:：]/i.test(para)) {
      const m = para.match(/[:：]\s*(.+)/);
      if (m) result.country = m[1].trim();
      inDescription = false;
      inProducts = false;
    }
    // Mobile
    else if (/^mobile\s*[:：]/i.test(para)) {
      const m = para.match(/[:：]\s*(.+)/);
      if (m) result.mobile = m[1].trim();
      inDescription = false;
      inProducts = false;
    }
    // Email (대표 이외의 임직원 이메일 포함)
    else if (/e-?mail\s*[:：]/i.test(para)) {
      const emails = extractEmails(para);
      result.additional_emails.push(...emails);
      inDescription = false;
      inProducts = false;
    }
    // 회사소개 섹션 시작
    else if (/^회사\s*소개\s*$|^company\s*introduction/i.test(para)) {
      inDescription = true;
      inProducts = false;
    }
    // 공급제품/서비스 섹션 시작
    else if (/공급\s*제품|주요\s*제품|서비스\s*소개|service/i.test(para) && para.length < 30) {
      inProducts = true;
      inDescription = false;
    }
    // 임직원 섹션 — 이하 내용에서 Mobile/Email 파싱
    else if (/^임직원\s*$|^staff/i.test(para)) {
      inDescription = false;
      inProducts = false;
    }
    // 다른 큰 섹션 시작 → 현재 섹션 종료
    else if (para.length < 40 && /^[가-힣A-Z\s]+$/.test(para) && i < paragraphs.length - 1) {
      if (inDescription || inProducts) {
        inDescription = false;
        inProducts = false;
      }
    }
    // 섹션 내 본문
    else if (inDescription && para.length > 3) {
      descLines.push(para);
    }
    else if (inProducts && para.length > 3) {
      productLines.push(para);
    }
  }

  // ⚠️ "회사소개" 라벨이 없으면 description은 비워둔다.
  //    예전엔 여기서 "긴 단락"을 아무거나 긁었는데, 그게 게시판 안내문 같은
  //    쓰레기를 description으로 집어넣는 원인이었다. 부실 페이지는 그냥 빈 값으로 둔다.
  result.description = descLines.join('\n').trim();
  result.products = productLines.join('\n').trim();

  // 이메일 중복 제거
  result.additional_emails = [...new Set(result.additional_emails)];

  // 창립연도
  result.founded_year = extractFoundedYear(allText);

  return result;
}

// ─── WP API: 회사 목록 페이지네이션 ─────────────────────────────────────────
async function fetchCompanyPage(page) {
  const url = `${WP_BASE}/wp-json/xcd/v1/list?page=${page}&per_page=${BATCH_PER_PAGE}&has_source_url=1`;
  const res = await fetch(url, { headers: { ...wpAuthHeader() } });
  if (!res.ok) throw new Error(`list API 오류: ${res.status} ${url}`);
  return res.json();
}

// ─── WP API: 회사 업데이트 ──────────────────────────────────────────────────
async function updateCompany(id, payload) {
  if (DRY_RUN) {
    log(`  [DRY-RUN] 업데이트 건너뜀 id=${id}`);
    return;
  }
  const url = `${WP_BASE}/wp-json/xcd/v1/${id}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...wpAuthHeader(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`update API 오류: ${res.status} — ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ─── 단일 URL 크롤링 및 파싱 ────────────────────────────────────────────────
async function enrichOne(company) {
  const { id, company: name, source_url, enriched_at } = company;

  // 이미 완료된 경우 skip
  if (enriched_at) {
    return { skipped: true };
  }
  if (!source_url) {
    return { skipped: true, reason: 'no source_url' };
  }

  let html;
  try {
    const res = await fetch(source_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return { error: `HTTP ${res.status}` };
    }
    html = await res.text();
  } catch (e) {
    return { error: `fetch 실패: ${e.message}` };
  }

  // 도메인에 따라 파서 선택
  let parsed;
  if (source_url.includes('kocham.kr')) {
    parsed = parseKochamKr(html);
  } else if (source_url.includes('kochamvietnam.com') || source_url.includes('korchamvietnam.com')) {
    parsed = parseKochamVietnam(html);
  } else {
    return { error: `알 수 없는 도메인: ${source_url}` };
  }

  // additional_emails를 쉼표 구분 문자열로 변환
  const additionalEmailsStr = (parsed.additional_emails || []).join(', ');

  const payload = {
    // ⚠️ enrichment 전용 필드만 보낸다. 플러그인 update는 부분 업데이트(요청에 포함된
    //    필드만 갱신)이므로, director/industry/area 등 여기 없는 필드는 기존값이 유지된다.
    //    company는 매칭 키 검증용으로만 동봉 (현재값과 동일하므로 변경 없음).
    company: name,
    description: parsed.description || '',
    products: parsed.products || '',
    employees: parsed.employees || '',
    country: parsed.country || '',
    mobile: parsed.mobile || '',
    additional_emails: additionalEmailsStr,
    founded_year: parsed.founded_year || '',
    enriched_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };

  await updateCompany(id, payload);

  return { ok: true, parsed };
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
async function main() {
  log('=== enrich-companies.js 시작 ===');
  if (DRY_RUN) log('[DRY-RUN 모드] DB 업데이트를 수행하지 않습니다.');
  if (!WP_USER || !WP_PASS) {
    log('⚠️  WP_USER / WP_APP_PASSWORD 환경변수가 설정되지 않았습니다. 인증 없이 진행합니다.');
  }

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalError = 0;
  let allCompanies = [];

  // 1단계: 전체 목록 수집
  log('회사 목록 수집 중...');
  let page = 1;
  while (true) {
    const data = await fetchCompanyPage(page);
    const items = data.items || [];
    if (items.length === 0) break;
    allCompanies.push(...items);
    log(`  페이지 ${page}/${data.total_pages} 로드 완료 (${items.length}건)`);
    if (page >= (data.total_pages || 1)) break;
    page++;
    await sleep(200);
  }

  log(`총 ${allCompanies.length}개 회사 수집 완료`);

  // CLI_START 오프셋 적용 (id 기준이 아닌 인덱스 기준)
  const startIdx = Math.max(0, CLI_START);
  const endIdx = CLI_LIMIT < Infinity
    ? Math.min(allCompanies.length, startIdx + CLI_LIMIT)
    : allCompanies.length;

  const toProcess = allCompanies.slice(startIdx, endIdx);
  log(`처리 대상: ${toProcess.length}개 (인덱스 ${startIdx}~${endIdx - 1})`);

  // 2단계: 순차 처리
  for (let i = 0; i < toProcess.length; i++) {
    const c = toProcess[i];
    const globalIdx = startIdx + i;
    const prefix = `[${globalIdx + 1}/${allCompanies.length}]`;

    let fetched = false;
    try {
      const result = await enrichOne(c);

      if (result.skipped) {
        totalSkipped++;
        if (result.reason) {
          log(`${prefix} SKIP ${c.company} — ${result.reason}`);
        }
      } else if (result.error) {
        totalError++;
        fetched = true;
        log(`${prefix} ERROR ${c.company} — ${result.error}`);
      } else {
        totalUpdated++;
        fetched = true;
        const summary = [];
        if (result.parsed.description) summary.push(`소개 ${result.parsed.description.length}자`);
        if (result.parsed.products) summary.push(`제품 ${result.parsed.products.length}자`);
        if (result.parsed.employees) summary.push(`직원 "${result.parsed.employees}"`);
        if (result.parsed.founded_year) summary.push(`창립 ${result.parsed.founded_year}`);
        log(`${prefix} OK   ${c.company} → ${summary.join(', ') || '(기본 정보만)'}`);
      }
    } catch (e) {
      totalError++;
      fetched = true;
      log(`${prefix} FATAL ${c.company} — ${e.message}`);
    }

    totalProcessed++;

    // source_url fetch가 실제 발생한 경우에만 throttle (스킵 행은 대기 불필요)
    if (fetched && i < toProcess.length - 1) {
      await sleep(THROTTLE_MS);
    }
  }

  log('');
  log('=== 완료 ===');
  log(`처리: ${totalProcessed} / 업데이트: ${totalUpdated} / 스킵: ${totalSkipped} / 오류: ${totalError}`);
  log(`로그 파일: ${LOG_FILE}`);
  log('');
  log('다음 단계:');
  log('  1. WP 어드민 → 기업 디렉토리 → "검색 인덱스 재구축" 클릭');
  log('  2. daily-news-final + chao-vn-app git push + OTA 배포');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
