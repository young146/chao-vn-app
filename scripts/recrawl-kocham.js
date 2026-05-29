#!/usr/bin/env node
/**
 * recrawl-kocham.js
 *
 * 코참 호치민(kocham.kr)과 코참 하노이(kochamvietnam.com) 전수 재크롤링.
 * 각 페이지에서 회사명 + 상세 정보 추출 → WP DB(wp_xinchao_companies) 매칭 → source_url 및 보강 데이터 업데이트.
 *
 * 사용법:
 *   node scripts/recrawl-kocham.js --site both
 *   node scripts/recrawl-kocham.js --site hcm --start 1 --limit 50
 *   node scripts/recrawl-kocham.js --site hanoi --dry-run
 *   node scripts/recrawl-kocham.js --site both --limit 100 --dry-run
 *
 * CLI 옵션:
 *   --site    hanoi | hcm | both  (기본: both)
 *   --start   N                   시작 wr_id / seq (기본: 1)
 *   --limit   N                   최대 스캔 수 (기본: 무제한)
 *   --dry-run                     DB 업데이트 없이 파싱 결과만 출력
 *
 * 환경변수 (.env 파일 또는 shell):
 *   WP_BASE_URL      예: https://chaovietnam.co.kr
 *   WP_USER          WP 관리자 아이디
 *   WP_APP_PASSWORD  WP 앱 비밀번호 (공백 포함 가능)
 *
 * 예상 실행 시간 (throttle 0.5초 기준):
 *   호치민(~3000페이지): 약 30분 ~ 2시간 (빈 페이지 많으면 빠름)
 *   하노이(~1500 seq):   약 15분 ~ 1시간
 *   전체(--site both):   약 45분 ~ 3시간
 *   → --limit 옵션으로 부분 실행 후 --start로 이어서 재시작 가능
 *
 * 로그: RECRAWL_LOG.txt (프로젝트 루트)
 *
 * 요구사항: Node.js 18+ (native fetch 지원)
 */

'use strict';

// ─── .env 로드 (dotenv 없이 직접 파싱) ──────────────────────────────────────
const fs = require('fs');
const path = require('path');

(function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
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
})();

// ─── 설정 ────────────────────────────────────────────────────────────────────
const WP_BASE = (process.env.WP_BASE_URL || 'https://chaovietnam.co.kr').replace(/\/$/, '');
const WP_USER = process.env.WP_USER || '';
const WP_PASS = process.env.WP_APP_PASSWORD || '';

const THROTTLE_MS = 500;     // 코참 사이트 요청 간격 (0.5초 — 호의적 크롤링)
const RETRY_MAX = 3;         // 네트워크 에러 시 최대 재시도 횟수
const RETRY_DELAY_MS = 2000; // 재시도 간격
const TIMEOUT_MS = 15000;    // 페이지 요청 타임아웃

// 연속 빈 페이지 감지 임계값
const HCM_EMPTY_THRESHOLD = 50;    // 호치민: 50개 연속 빈 페이지 → 종료
const HANOI_EMPTY_THRESHOLD = 100; // 하노이: 100개 연속 빈 페이지 → 종료

const LOG_FILE = path.join(__dirname, '..', 'RECRAWL_LOG.txt');

// ─── CLI 파싱 ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let CLI_SITE = 'both';    // hanoi | hcm | both
let CLI_START = 1;        // 시작 ID (1-indexed)
let CLI_LIMIT = Infinity; // 최대 스캔 수
let DRY_RUN = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--site' && args[i + 1]) {
    CLI_SITE = args[++i].toLowerCase();
  } else if (args[i] === '--start' && args[i + 1]) {
    CLI_START = Math.max(1, parseInt(args[++i], 10));
  } else if (args[i] === '--limit' && args[i + 1]) {
    CLI_LIMIT = parseInt(args[++i], 10);
  } else if (args[i] === '--dry-run') {
    DRY_RUN = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
사용법: node scripts/recrawl-kocham.js [옵션]

옵션:
  --site    hanoi | hcm | both   대상 사이트 (기본: both)
  --start   N                    시작 wr_id/seq (기본: 1)
  --limit   N                    최대 스캔 페이지 수
  --dry-run                      DB 업데이트 없이 파싱만

예시:
  # 전체 재크롤링 (실제 DB 업데이트)
  node scripts/recrawl-kocham.js --site both

  # 호치민 10개만 드라이런 (파싱 테스트)
  node scripts/recrawl-kocham.js --site hcm --limit 10 --dry-run

  # 하노이 seq=200부터 이어서
  node scripts/recrawl-kocham.js --site hanoi --start 200
`);
    process.exit(0);
  }
}

if (!['hanoi', 'hcm', 'both'].includes(CLI_SITE)) {
  console.error(`오류: --site는 hanoi | hcm | both 중 하나여야 합니다. 입력값: "${CLI_SITE}"`);
  process.exit(1);
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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

/** HTML 엔티티 디코딩 */
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
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** HTML 태그 제거 + 공백 정리 */
function stripTags(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** 이메일 주소 추출 */
function extractEmails(text) {
  if (!text) return [];
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  return matches ? [...new Set(matches)] : [];
}

/** 창립연도 추출 */
function extractFoundedYear(text) {
  if (!text) return '';
  const m = text.match(/(?:설립|창립|창업|established\s*in|founded\s*in|since)\s*[:：]?\s*([12][0-9]{3})/i)
    || text.match(/([12][0-9]{3})\s*년\s*(?:설립|창립|창업)/i);
  return m ? m[1] : '';
}

/**
 * 회사명 정규화: 매칭 비교에 사용
 * "Co.,Ltd", "VINA", 괄호, 특수문자, 공백 등 제거 후 소문자화
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .replace(/\(주\)|\(유\)|\(사\)/g, '')
    .replace(/\s*co\.?,?\s*ltd\.?/gi, '')
    .replace(/\s*co\.?,?\s*llc\.?/gi, '')
    .replace(/\s*inc\.?/gi, '')
    .replace(/\s*corp\.?/gi, '')
    .replace(/\s*vina\b/gi, '')
    .replace(/\s*vietnam\b/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[()（）\[\]【】]/g, '')
    .replace(/[^\w\s가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ─── 재시도 fetch ─────────────────────────────────────────────────────────────
async function fetchWithRetry(url, options = {}, retries = RETRY_MAX) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      if (attempt === retries) throw e;
      log(`  재시도 ${attempt}/${retries}: ${e.message} — ${url}`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}

// ─── 파서: kocham.kr (호치민) ──────────────────────────────────────────────
/**
 * HTML 구조:
 *   <table class="subtable_list">
 *     <tr><th>Company name</th><td>회사명</td></tr>
 *     <tr><th>General Director</th><td>대표자</td></tr>
 *     <tr><th>Type of business</th><td>업종</td></tr>
 *     <tr><th>Tel</th><td>전화</td></tr>
 *     <tr><th>Area</th><td>HCMC</td></tr>
 *     <tr><th>Address</th><td>주소</td></tr>
 *     <tr><th>E-mail</th><td>이메일</td></tr>
 *     <tr><th>Homepage</th><td>홈페이지</td></tr>
 *     <tr><th>Number of staff</th><td>직원수</td></tr>
 *     <tr><th>Service</th><td>사업내용</td></tr>
 *   </table>
 *
 * 빈 페이지 판별: table.subtable_list 없거나 Company name 값 없음
 */
function parseKochamKrPage(html) {
  const out = {
    company: '', director: '', business_type: '', tel: '',
    area: '', address: '', email: '', homepage: '',
    employees: '', products: '', description: '',
    additional_emails: [], founded_year: '',
    isEmpty: true,
  };

  const tableMatch = html.match(/<table[^>]*class=["'][^"']*subtable_list[^"']*["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return out;

  const tableHtml = tableMatch[1];
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];
    const thMatch = rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    const tdMatch = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    if (!thMatch || !tdMatch) continue;

    const label = stripTags(thMatch[1]).toLowerCase().trim();
    const value = decodeEntities(stripTags(tdMatch[1])).trim();

    if (!value) continue;

    if (label.includes('company name') || label.includes('상호')) {
      out.company = value;
      out.isEmpty = false;
    } else if (label.includes('general director') || label.includes('대표')) {
      out.director = value;
    } else if (label.includes('type of business') || label.includes('업종')) {
      out.business_type = value;
    } else if (label === 'tel') {
      out.tel = value;
    } else if (label === 'area') {
      out.area = value;
    } else if (label === 'address' || label.includes('주소')) {
      out.address = value;
    } else if (label === 'e-mail' || label === 'email') {
      out.email = value;
      extractEmails(value).forEach(e => out.additional_emails.push(e));
    } else if (label === 'homepage' || label.includes('홈페이지')) {
      out.homepage = value;
    } else if (label.includes('number of staff') || label.includes('직원')) {
      out.employees = value;
    } else if (label.includes('service') || label.includes('사업내용') || label.includes('서비스')) {
      out.products = value;
    }
  }

  // 전체 테이블 텍스트에서 추가 이메일 수집
  const allText = decodeEntities(stripTags(tableHtml));
  extractEmails(allText).forEach(e => out.additional_emails.push(e));
  out.additional_emails = [...new Set(out.additional_emails)];
  out.founded_year = extractFoundedYear(allText);

  return out;
}

// ─── 파서: kochamvietnam.com (하노이) ─────────────────────────────────────
/**
 * HTML 구조 (실제 확인):
 *   - <meta property="og:title" content="회사명" />  ← 가장 신뢰성 높음
 *   - <div class="read-title">회사명<span>...</span></div>
 *   - <div class="sub-container"> 내 자유 형식 <p> 태그들:
 *       <p><strong>회사명</strong></p>
 *       <p>업종/업태: ...</p>
 *       <p>Add : 주소</p>
 *       <p>전화 : ...</p>
 *       <p>E-mail : ...</p>
 *       <p>홈페이지 : ...</p>
 *       <p>직원수 : N명</p>
 *       <p>임직원</p>
 *       <p>이름 / 직책</p>
 *       ...
 *       <p>회사소개</p>
 *       <p>소개 텍스트...</p>
 *
 * 인코딩: meta charset=utf-8로 확인됨 (EUC-KR 아님)
 * 빈 페이지 판별: read-title이 없거나 "신규 회원사 소개"와 같이 제목이 목록 제목인 경우
 */
function parseKochamVietnamPage(html) {
  const out = {
    company: '', business_type: '', tel: '', address: '',
    email: '', homepage: '', employees: '', description: '',
    products: '', additional_emails: [], founded_year: '',
    isEmpty: true,
  };

  // ① 회사명: og:title 우선 (가장 안정적)
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitleMatch) {
    const ogName = decodeEntities(ogTitleMatch[1]).trim();
    // og:title이 사이트명이 아닌 경우만 사용
    if (ogName && !ogName.includes('kochamvietnam') && !ogName.includes('코참베트남') && !ogName.includes('Korcham')) {
      out.company = ogName;
      out.isEmpty = false;
    }
  }

  // ② 회사명 폴백: read-title div
  if (!out.company) {
    const titleMatch = html.match(/<div[^>]*class=["'][^"']*read-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (titleMatch) {
      const titleText = decodeEntities(stripTags(titleMatch[1])).trim();
      // 댓글수 "[0]" 등 제거
      const cleaned = titleText.replace(/\[\s*\d+\s*\].*$/, '').trim();
      if (cleaned && cleaned.length > 1 && !/신규\s*회원사\s*소개/i.test(cleaned)) {
        out.company = cleaned;
        out.isEmpty = false;
      }
    }
  }

  if (out.isEmpty) return out;

  // ③ 본문 파싱: .sub-container 내 <p> 태그들
  const subContainerMatch = html.match(/<div[^>]*class=["'][^"']*sub-container[^"']*["'][^>]*>([\s\S]*?)<div[^>]*class=["'][^"']*reply/i)
    || html.match(/<div[^>]*class=["'][^"']*sub-container[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);

  const contentHtml = subContainerMatch ? subContainerMatch[1] : html;

  // <p> 단락 분리
  const paragraphs = contentHtml
    .split(/<\/p>/gi)
    .map(p => {
      // <p> 태그 이후 내용만 추출
      const inner = p.replace(/^[\s\S]*?<p[^>]*>/i, '');
      return decodeEntities(stripTags(inner)).trim();
    })
    .filter(p => p.length > 0 && p !== '&nbsp;' && p !== '\u00a0');

  let inDescription = false;
  let inStaff = false;
  let descLines = [];

  for (const para of paragraphs) {
    // 업종/업태
    if (/업종\s*[\/\|]?\s*업태\s*[:：]/i.test(para)) {
      const m = para.match(/업태\s*[:：]\s*(.+)/i) || para.match(/업종.*[:：]\s*(.+)/i);
      out.business_type = m ? m[1].trim() : para.replace(/.*업태\s*[:：]\s*/i, '').trim();
      inDescription = false;
    }
    // 주소 (Add, 주소, Address)
    else if (/^(?:add|address|주소)\s*[:：]/i.test(para)) {
      out.address = para.replace(/^(?:add|address|주소)\s*[:：]\s*/i, '').trim();
      inDescription = false;
    }
    // 전화 (전화, Tel, Phone)
    else if (/^(?:전화|tel|phone|연락처)\s*[:：]/i.test(para)) {
      out.tel = para.replace(/^(?:전화|tel|phone|연락처)\s*[:：]\s*/i, '').trim();
      inDescription = false;
    }
    // 이메일
    else if (/^e-?mail\s*[:：]/i.test(para)) {
      const m = para.match(/[:：]\s*(.+)/);
      if (m) out.email = m[1].trim();
      extractEmails(para).forEach(e => out.additional_emails.push(e));
      inDescription = false;
    }
    // 홈페이지
    else if (/^(?:홈페이지|homepage|web)\s*[:：]/i.test(para)) {
      const m = para.match(/[:：]\s*(.+)/);
      out.homepage = m ? m[1].trim() : '';
      inDescription = false;
    }
    // 직원수
    else if (/직원\s*수\s*[:：]|지원\s*수\s*[:：]|인원\s*수\s*[:：]|number\s*of\s*(?:staff|employees)/i.test(para)) {
      const m = para.match(/[:：]\s*(.+)/);
      out.employees = m ? m[1].trim() : para.replace(/.*(?:직원수|지원수|인원수|number of (?:staff|employees))\s*[:：]?\s*/i, '').trim();
      inDescription = false;
    }
    // 임직원 섹션 시작
    else if (/^임직원\s*$|^staff\s*$/i.test(para)) {
      inStaff = true;
      inDescription = false;
    }
    // 임직원 섹션 내 이메일 수집
    else if (inStaff && /e-?mail/i.test(para)) {
      extractEmails(para).forEach(e => out.additional_emails.push(e));
    }
    // 회사소개 섹션 시작
    else if (/^회사\s*소개\s*$|^company\s*introduction\s*$/i.test(para)) {
      inDescription = true;
      inStaff = false;
    }
    // 회사소개 본문
    else if (inDescription && para.length > 10) {
      descLines.push(para);
    }
  }

  // 회사소개 없으면 긴 단락에서 추출
  if (descLines.length === 0) {
    for (const para of paragraphs) {
      if (
        para.length > 80
        && !/^(?:tel|fax|add|address|e-?mail|homepage|mobile|web|전화|주소|홈페이지|직원|임직원|업종|업태)/i.test(para)
        && !/^[A-Za-z가-힣\s]+\s*\/\s*[A-Za-z가-힣\s]+$/.test(para) // "이름 / 직책" 패턴 제외
      ) {
        descLines.push(para);
        if (descLines.length >= 5) break;
      }
    }
  }

  out.description = descLines.join('\n').trim();
  out.additional_emails = [...new Set(out.additional_emails)];
  out.founded_year = extractFoundedYear(out.description + ' ' + decodeEntities(stripTags(contentHtml)));

  return out;
}

// ─── WP API: 회사 검색 ────────────────────────────────────────────────────────
/**
 * 회사명으로 WP DB에서 검색.
 * 반환: [{ id, company, area, source_url }, ...] 또는 []
 */
async function searchCompany(name) {
  if (!name) return [];
  const encoded = encodeURIComponent(name);
  const url = `${WP_BASE}/wp-json/xcd/v1/search?q=${encoded}`;
  try {
    const res = await fetch(url, {
      headers: { ...wpAuthHeader() },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    // 응답 형식: { items: [...] } 또는 배열 직접
    return Array.isArray(data) ? data : (data.items || []);
  } catch (e) {
    log(`  searchCompany 오류: ${e.message}`);
    return [];
  }
}

// ─── 매칭 로직 ────────────────────────────────────────────────────────────────
/**
 * DB 검색 결과에서 가장 적합한 회사를 찾는다.
 * 우선순위:
 *   1. 정확 일치 (정규화 후)
 *   2. 부분 일치 (검색 결과 1건이면 자동 채택)
 *   3. 지역 추가 비교 (여러 건일 때)
 * 반환: { matched: true, id, company } 또는 { matched: false }
 */
function findBestMatch(parsedName, dbResults, area) {
  if (!dbResults || dbResults.length === 0) return { matched: false };

  const normParsed = normalizeName(parsedName);

  // 정확 일치 검사
  const exactMatches = dbResults.filter(r => normalizeName(r.company) === normParsed);
  if (exactMatches.length === 1) return { matched: true, ...exactMatches[0] };
  if (exactMatches.length > 1) {
    // 지역 비교로 좁히기
    if (area) {
      const areaLower = area.toLowerCase();
      const areaMatch = exactMatches.find(r => (r.area || '').toLowerCase().includes(areaLower));
      if (areaMatch) return { matched: true, ...areaMatch };
    }
    // 그래도 여러 건이면 첫 번째 (UNMATCHED_MULTI 로그)
    return { matched: true, multiMatch: true, ...exactMatches[0] };
  }

  // 검색 결과 1건이면 부분 일치로 채택
  if (dbResults.length === 1) {
    const normDb = normalizeName(dbResults[0].company);
    // 핵심 단어 겹침 확인
    const words = normParsed.split(/\s+/).filter(w => w.length >= 2);
    const overlap = words.filter(w => normDb.includes(w)).length;
    if (overlap >= 1 || normParsed.includes(normDb) || normDb.includes(normParsed)) {
      return { matched: true, ...dbResults[0] };
    }
  }

  // 여러 건이면 핵심 단어 최대 겹침
  if (dbResults.length > 1) {
    const words = normParsed.split(/\s+/).filter(w => w.length >= 2);
    let best = null;
    let bestScore = 0;
    for (const r of dbResults) {
      const normDb = normalizeName(r.company);
      const score = words.filter(w => normDb.includes(w)).length;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    if (bestScore >= 2) return { matched: true, ...best };
  }

  return { matched: false };
}

// ─── WP API: 회사 업데이트 ────────────────────────────────────────────────────
async function updateCompany(id, payload) {
  if (DRY_RUN) {
    log(`  [DRY-RUN] 업데이트 건너뜀 id=${id}`);
    return true;
  }
  const url = `${WP_BASE}/wp-json/xcd/v1/${id}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...wpAuthHeader(),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`update API 오류: ${res.status} — ${text.slice(0, 200)}`);
  }
  return true;
}

// ─── Phase A: 코참 호치민 (kocham.kr) 전수 스캔 ──────────────────────────────
async function runHCM(stats) {
  log('');
  log('=== Phase A: 코참 호치민 (kocham.kr) 스캔 시작 ===');
  log(`시작 wr_id: ${CLI_START}, 최대: ${CLI_LIMIT === Infinity ? '무제한' : CLI_LIMIT}`);

  let consecutiveEmpty = 0;
  let scanned = 0;
  let wrId = CLI_START;

  while (true) {
    if (scanned >= CLI_LIMIT) {
      log(`[HCM] --limit ${CLI_LIMIT} 도달. 스캔 종료.`);
      break;
    }
    if (consecutiveEmpty >= HCM_EMPTY_THRESHOLD) {
      log(`[HCM] ${HCM_EMPTY_THRESHOLD}개 연속 빈 페이지. 스캔 종료. (마지막 wr_id: ${wrId - 1})`);
      break;
    }

    const url = `https://kocham.kr/theme/inet/sub/detail.php?wr_id=${wrId}`;
    scanned++;
    stats.hcm.scanned++;

    let html;
    try {
      const res = await fetchWithRetry(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
      });
      if (res.status === 404) {
        consecutiveEmpty++;
        wrId++;
        await sleep(THROTTLE_MS);
        continue;
      }
      if (!res.ok) {
        log(`[HCM] [${wrId}] HTTP ${res.status} — 스킵`);
        stats.hcm.errors++;
        consecutiveEmpty++;
        wrId++;
        await sleep(THROTTLE_MS);
        continue;
      }
      html = await res.text();
    } catch (e) {
      log(`[HCM] [${wrId}] 네트워크 오류: ${e.message} — 스킵`);
      stats.hcm.errors++;
      consecutiveEmpty++;
      wrId++;
      await sleep(THROTTLE_MS);
      continue;
    }

    // 파싱
    let parsed;
    try {
      parsed = parseKochamKrPage(html);
    } catch (e) {
      log(`[HCM] [${wrId}] 파싱 오류: ${e.message}`);
      stats.hcm.errors++;
      consecutiveEmpty++;
      wrId++;
      await sleep(THROTTLE_MS);
      continue;
    }

    if (parsed.isEmpty || !parsed.company) {
      consecutiveEmpty++;
      wrId++;
      await sleep(THROTTLE_MS);
      continue;
    }

    // 유효 페이지
    consecutiveEmpty = 0;
    stats.hcm.valid++;

    // DB 매칭
    const dbResults = await searchCompany(parsed.company);
    const match = findBestMatch(parsed.company, dbResults, parsed.area);

    if (!match.matched) {
      log(`[HCM] [${wrId}] UNMATCHED  "${parsed.company}" → ${url}`);
      stats.hcm.unmatched++;
    } else {
      const multiNote = match.multiMatch ? ' (MULTI_MATCH)' : '';
      const payload = {
        company: match.company,
        source_url: url,
        description: parsed.description || '',
        products: parsed.products || '',
        employees: parsed.employees || '',
        additional_emails: parsed.additional_emails.join(', '),
        founded_year: parsed.founded_year || '',
      };

      try {
        await updateCompany(match.id, payload);
        const summary = [
          parsed.employees ? `직원: ${parsed.employees}` : '',
          parsed.products ? `사업: ${parsed.products.slice(0, 30)}...` : '',
        ].filter(Boolean).join(', ');
        log(`[HCM] [${wrId}] OK${multiNote}  "${parsed.company}" → id=${match.id} ${summary}`);
        stats.hcm.matched++;
      } catch (e) {
        log(`[HCM] [${wrId}] UPDATE 오류: ${e.message}`);
        stats.hcm.errors++;
      }
    }

    wrId++;
    await sleep(THROTTLE_MS);
  }

  log(`[HCM] 스캔 완료: 스캔=${stats.hcm.scanned}, 유효=${stats.hcm.valid}, 매칭=${stats.hcm.matched}, 미매칭=${stats.hcm.unmatched}, 오류=${stats.hcm.errors}`);
}

// ─── Phase B: 코참 하노이 (kochamvietnam.com) 전수 스캔 ──────────────────────
async function runHanoi(stats) {
  log('');
  log('=== Phase B: 코참 하노이 (kochamvietnam.com) 스캔 시작 ===');
  log(`시작 seq: ${CLI_START}, 최대: ${CLI_LIMIT === Infinity ? '무제한' : CLI_LIMIT}`);

  let consecutiveEmpty = 0;
  let scanned = 0;
  let seq = CLI_START;

  while (true) {
    if (scanned >= CLI_LIMIT) {
      log(`[HANOI] --limit ${CLI_LIMIT} 도달. 스캔 종료.`);
      break;
    }
    if (consecutiveEmpty >= HANOI_EMPTY_THRESHOLD) {
      log(`[HANOI] ${HANOI_EMPTY_THRESHOLD}개 연속 빈 페이지. 스캔 종료. (마지막 seq: ${seq - 1})`);
      break;
    }

    const url = `https://kochamvietnam.com/board/event/membership/view?seq=${seq}`;
    scanned++;
    stats.hanoi.scanned++;

    let html;
    try {
      const res = await fetchWithRetry(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
      });
      if (res.status === 404) {
        consecutiveEmpty++;
        seq++;
        await sleep(THROTTLE_MS);
        continue;
      }
      if (!res.ok) {
        log(`[HANOI] [${seq}] HTTP ${res.status} — 스킵`);
        stats.hanoi.errors++;
        consecutiveEmpty++;
        seq++;
        await sleep(THROTTLE_MS);
        continue;
      }
      // kochamvietnam.com은 meta charset=utf-8 확인됨 (EUC-KR 아님)
      html = await res.text();
    } catch (e) {
      log(`[HANOI] [${seq}] 네트워크 오류: ${e.message} — 스킵`);
      stats.hanoi.errors++;
      consecutiveEmpty++;
      seq++;
      await sleep(THROTTLE_MS);
      continue;
    }

    // 파싱
    let parsed;
    try {
      parsed = parseKochamVietnamPage(html);
    } catch (e) {
      log(`[HANOI] [${seq}] 파싱 오류: ${e.message}`);
      stats.hanoi.errors++;
      consecutiveEmpty++;
      seq++;
      await sleep(THROTTLE_MS);
      continue;
    }

    if (parsed.isEmpty || !parsed.company) {
      consecutiveEmpty++;
      seq++;
      await sleep(THROTTLE_MS);
      continue;
    }

    // 유효 페이지
    consecutiveEmpty = 0;
    stats.hanoi.valid++;

    // DB 매칭
    const dbResults = await searchCompany(parsed.company);
    const match = findBestMatch(parsed.company, dbResults, '');

    if (!match.matched) {
      log(`[HANOI] [${seq}] UNMATCHED  "${parsed.company}" → ${url}`);
      stats.hanoi.unmatched++;
    } else {
      const multiNote = match.multiMatch ? ' (MULTI_MATCH)' : '';
      const payload = {
        company: match.company,
        source_url: url,
        description: parsed.description || '',
        products: parsed.products || '',
        employees: parsed.employees || '',
        email: parsed.email || '',
        homepage: parsed.homepage || '',
        tel: parsed.tel || '',
        address: parsed.address || '',
        additional_emails: parsed.additional_emails.join(', '),
        founded_year: parsed.founded_year || '',
      };

      try {
        await updateCompany(match.id, payload);
        const summary = [
          parsed.employees ? `직원: ${parsed.employees}` : '',
          parsed.description ? `소개: ${parsed.description.slice(0, 30)}...` : '',
        ].filter(Boolean).join(', ');
        log(`[HANOI] [${seq}] OK${multiNote}  "${parsed.company}" → id=${match.id} ${summary}`);
        stats.hanoi.matched++;
      } catch (e) {
        log(`[HANOI] [${seq}] UPDATE 오류: ${e.message}`);
        stats.hanoi.errors++;
      }
    }

    seq++;
    await sleep(THROTTLE_MS);
  }

  log(`[HANOI] 스캔 완료: 스캔=${stats.hanoi.scanned}, 유효=${stats.hanoi.valid}, 매칭=${stats.hanoi.matched}, 미매칭=${stats.hanoi.unmatched}, 오류=${stats.hanoi.errors}`);
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
async function main() {
  log('=== recrawl-kocham.js 시작 ===');
  log(`모드: site=${CLI_SITE}, start=${CLI_START}, limit=${CLI_LIMIT === Infinity ? '무제한' : CLI_LIMIT}, dry-run=${DRY_RUN}`);
  if (DRY_RUN) log('[DRY-RUN] DB 업데이트를 수행하지 않습니다.');
  if (!WP_USER || !WP_PASS) {
    log('⚠️  WP_USER / WP_APP_PASSWORD 환경변수가 설정되지 않았습니다. DB 매칭은 가능하나 업데이트는 실패할 수 있습니다.');
  }

  const stats = {
    hcm:   { scanned: 0, valid: 0, matched: 0, unmatched: 0, errors: 0 },
    hanoi: { scanned: 0, valid: 0, matched: 0, unmatched: 0, errors: 0 },
  };

  const startTime = Date.now();

  if (CLI_SITE === 'hcm' || CLI_SITE === 'both') {
    await runHCM(stats);
  }

  if (CLI_SITE === 'hanoi' || CLI_SITE === 'both') {
    await runHanoi(stats);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const totalMatched = stats.hcm.matched + stats.hanoi.matched;
  const totalUnmatched = stats.hcm.unmatched + stats.hanoi.unmatched;
  const totalScanned = stats.hcm.scanned + stats.hanoi.scanned;

  log('');
  log('=== 최종 통계 ===');
  log(`총 스캔:     ${totalScanned} (HCM: ${stats.hcm.scanned}, 하노이: ${stats.hanoi.scanned})`);
  log(`유효 페이지: ${stats.hcm.valid + stats.hanoi.valid} (HCM: ${stats.hcm.valid}, 하노이: ${stats.hanoi.valid})`);
  log(`매칭 성공:   ${totalMatched} (HCM: ${stats.hcm.matched}, 하노이: ${stats.hanoi.matched})`);
  log(`미매칭:      ${totalUnmatched} (HCM: ${stats.hcm.unmatched}, 하노이: ${stats.hanoi.unmatched})`);
  log(`오류:        ${stats.hcm.errors + stats.hanoi.errors}`);
  log(`소요 시간:   ${elapsed}초 (${Math.round(elapsed / 60)}분)`);
  log(`로그 파일:   ${LOG_FILE}`);
  log('');
  log('다음 단계:');
  log('  1. RECRAWL_LOG.txt에서 UNMATCHED 항목 확인 → 수동 매칭 또는 신규 등록');
  log('  2. WP 어드민 → 기업 디렉토리 → "검색 인덱스 재구축"');
  log('  3. git push origin main && eas update --channel production --message "재크롤링 완료"');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
