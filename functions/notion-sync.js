/**
 * notion-sync.js
 * Firebase → Notion CRM 동기화 유틸리티
 *
 * Notion DB 속성명과 타입은 사용자가 직접 확인한 스키마 기준 (2026-03-22)
 */

const { Client } = require("@notionhq/client");

function getClient() {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN 환경변수가 설정되지 않았습니다.");
  return new Client({ auth: token });
}

// ─── 속성 빌더 ──────────────────────────────────────────────────────────────

const textProp    = (v) => (!v && v !== 0) ? null : { rich_text: [{ text: { content: String(v).substring(0, 2000) } }] };
const titleProp   = (v) => ({ title: [{ text: { content: String(v || "").substring(0, 2000) } }] });
const selectProp  = (v) => (!v ? null : { select: { name: String(v) } });
const multiSelectProp = (arr) => (!arr || arr.length === 0) ? null : { multi_select: arr.map(v => ({ name: String(v) })) };
const numberProp  = (v) => (v === null || v === undefined || isNaN(Number(v))) ? null : { number: Number(v) };
const checkboxProp = (v) => ({ checkbox: Boolean(v) });
const emailProp   = (v) => (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ? { email: v.trim() } : null;
const phoneProp   = (v) => (!v ? null : { phone_number: String(v) });
const dateProp    = (v) => (!v ? null : { date: { start: String(v) } });
const statusProp  = (v) => (!v ? null : { status: { name: String(v) } });

// null/undefined 필드 제거
function buildProperties(propMap) {
  const result = {};
  for (const [key, value] of Object.entries(propMap)) {
    if (value !== null && value !== undefined) result[key] = value;
  }
  return result;
}

// ─── 매핑 테이블 ─────────────────────────────────────────────────────────────

// 앱 industry 값 → Notion 업종 select 옵션
const INDUSTRY_MAP = {
  "식당/요리":   "서비스",
  "IT/개발":    "IT",
  "제조/생산":   "제조",
  "무역/물류":   "물류",
  "교육/강사":   "서비스",
  "서비스/판매":  "서비스",
  "사무/관리":   "서비스",
  "건설/인테리어": "기타",
  "미용/뷰티":   "서비스",
  "통역/번역":   "기타",
  "기타":       "기타",
};

// 앱 city 값 → Notion 근무 권역 select 옵션
const CITY_TO_REGION = {
  "하노이": "북부", "박닌": "북부",
  "호치민": "남부", "빈증": "남부", "동나이": "남부", "붕따우": "남부",
  "다낭": "중부",  "냐짱": "중부",
};

// 앱 employmentType → Notion 고용 형태 select 옵션
const EMP_TYPE_MAP = {
  "정규직": "정규", "계약직": "계약", "파트타임": "파트타임",
  "인턴": "계약", "프리랜서": "협의", "협의": "협의",
};

// 앱 status → Notion 구인 상태 status 옵션
const JOB_STATUS_MAP = {
  "모집중": "모집중", "일시중지": "일시중지", "마감": "마감",
  "마감임박": "모집중", // 임박은 모집중으로
};

// ─── Notion 검색 (firebaseId 기준) ──────────────────────────────────────────

async function findPageByFirebaseId(notion, databaseId, firebaseId) {
  try {
    const res = await notion.databases.query({
      database_id: databaseId,
      filter: { property: "firebaseId", rich_text: { equals: firebaseId } },
    });
    return res.results.length > 0 ? res.results[0].id : null;
  } catch (err) {
    console.error("Notion 검색 실패:", err.message);
    return null;
  }
}

// ============================================================
// 🏢 Jobs → Notion 구인 DB 업서트
// ============================================================

async function upsertJobToNotion(jobId, data) {
  const notion = getClient();
  const databaseId = process.env.NOTION_JOBS_DB_ID;
  if (!databaseId) throw new Error("NOTION_JOBS_DB_ID 환경변수 없음");

  const norm = data.normalized || {};
  const crm  = data.crm || {};

  // 연락처 처리
  const rawContact  = data.contact || "";
  const isEmail     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawContact.trim());
  const contactEmail = norm.contactEmail || (isEmail ? rawContact.trim() : null);
  const contactPhone = norm.contactPhone || (!isEmail && rawContact ? rawContact : null);

  // 업종 매핑
  const industrySelect = norm.industryTrack || INDUSTRY_MAP[data.industry] || "기타";

  // 직무군 (normalized.jobTracks 우선, 없으면 industrySelect 단일)
  const jobTracks = norm.jobTracks && norm.jobTracks.length > 0
    ? norm.jobTracks
    : [industrySelect];

  // 근무 권역
  const workRegion = norm.workRegion || CITY_TO_REGION[data.city] || null;
  const workLocation = norm.workLocationText || [data.city, data.district].filter(Boolean).join(" ") || null;

  // 고용 형태
  const empType = norm.employmentTypeNormalized || EMP_TYPE_MAP[data.employmentType] || null;

  // 급여
  const salaryMin = norm.salaryMinUsdPerMonth ?? null;
  const salaryMax = norm.salaryMaxUsdPerMonth ?? null;
  const exchangeRate = norm.exchangeRateVndPerUsd ?? 25000;

  // 구인 상태 (status 타입)
  const jobStatus = JOB_STATUS_MAP[data.status] || "모집중";

  const properties = buildProperties({
    // ── 식별 ──
    "firebaseId":                textProp(jobId),
    "작성 언어":                  selectProp(data.sourceLanguage || "ko"),

    // ── 기본 정보 ──
    "포지션/채용명":               titleProp(data.title || "(제목 없음)"),
    "회사/업소명":                textProp(norm.companyName || ""),
    "업종":                      selectProp(industrySelect),
    "직무군":                    multiSelectProp(jobTracks),

    // ── 근무지 ──
    "근무지(지역)":               textProp(workLocation),
    "근무 권역":                  selectProp(workRegion),

    // ── 고용 ──
    "고용 형태":                  selectProp(empType),

    // ── 업무 내용 ──
    "담당 업무":                  textProp(data.description || ""),
    "경력 요건":                  textProp(data.requirements || ""),

    // ── 급여 ──
    "급여(USD/월) 최소":           numberProp(salaryMin),
    "급여(USD/월) 최대":           numberProp(salaryMax),
    "환율(VND/USD)":              numberProp(exchangeRate),

    // ── 연락처 ──
    "이메일":                    emailProp(contactEmail),
    "연락처":                    phoneProp(contactPhone),

    // ── 파이프라인 (status 타입) ──
    "구인 상태":                  statusProp(jobStatus),

    // ── CRM 운영 필드 ──
    "관리자 수정 필요":             checkboxProp(crm.adminNeedsReview || false),
    "관리자 수정 가능(최종 문구)":   textProp(crm.adminOverrideMessage || ""),
  });

  console.log(`📋 [JobSync] ${jobId} 업서트 시작`);
  const existingId = await findPageByFirebaseId(notion, databaseId, jobId);

  if (existingId) {
    await notion.pages.update({ page_id: existingId, properties });
    console.log(`✅ [JobSync] ${jobId} 업데이트 완료`);
  } else {
    await notion.pages.create({ parent: { database_id: databaseId }, properties });
    console.log(`✅ [JobSync] ${jobId} 신규 생성 완료`);
  }
}

// ============================================================
// 👤 candidates → Notion 구직자 DB 업서트
// ============================================================

// 구직자 지원 상태 → Notion status 옵션 (지원 상태 — status 타입)
const CANDIDATE_STATUS_MAP = {
  "신규 등록":       "신규 등록",
  "이력서 확인 필요": "이력서 확인 필요",
  "AI 추천 생성":    "AI 추천 생성",
  "추천안 검토":     "추천안 검토",
  "추천안 발송":     "추천안 발송",
  "진행중":         "진행중",
  "완료":           "완료",
};

async function upsertCandidateToNotion(candidateId, data) {
  const notion = getClient();
  const databaseId = process.env.NOTION_CANDIDATES_DB_ID;
  if (!databaseId) throw new Error("NOTION_CANDIDATES_DB_ID 환경변수 없음");

  const profile        = data.profile || {};
  const language       = data.language || {};
  const career         = data.career || {};
  const workEligibility = data.workEligibility || {};
  const compensation   = data.compensation || {};
  const crm            = data.crm || {};
  const ai             = data.ai || {};

  const crmStatus = CANDIDATE_STATUS_MAP[crm.status] || "신규 등록";

  const properties = buildProperties({
    // ── 식별 ──
    "firebaseId":               textProp(candidateId),
    "작성 언어":                 selectProp(data.sourceLanguage || "ko"),

    // ── 기본 정보 ──
    "이름":                     titleProp(profile.name || "(이름 없음)"),
    "국적":                     selectProp(profile.nationality || ""),

    // ── 연락처 ──
    "이메일":                   emailProp(profile.contactEmail),
    "연락처":                   phoneProp(profile.contactPhone || ""),
    "취업 희망 지역":             textProp(profile.jobDesiredLocationText || ""),

    // ── 언어 능력 ──
    "한국어 수준":               selectProp(language.koreanLevel || ""),
    "베트남어 수준":             selectProp(language.vietnameseLevel || ""),
    "영어 수준":                 selectProp(language.englishLevel || ""),

    // ── 경력/직무 ──
    "희망 직무":                 multiSelectProp(career.desiredJobTracks || []),
    "경력(년)":                  numberProp(career.experienceYears ?? null),
    "학력":                     selectProp(career.education || ""),
    "보유 기술/자격증":           textProp(career.skillsCertsText || ""),

    // ── 비자/스케줄 ──
    "비자 상태":                 selectProp(workEligibility.visaStatus || ""),
    "근무 가능 시작일":           dateProp(workEligibility.availableStartDate || null),

    // ── 급여 ──
    "희망 급여(USD/월)":          numberProp(compensation.desiredUsdPerMonth ?? null),
    "환율(VND/USD)":             numberProp(compensation.exchangeRateVndPerUsd ?? 25000),

    // ── 파이프라인 (status 타입) ──
    "지원 상태":                 statusProp(crmStatus),

    // ── CRM 운영 필드 ──
    "관리자 수정 필요":            checkboxProp(crm.adminNeedsReview || false),
    "관리자 수정 가능(최종 문구)":  textProp(crm.adminOverrideMessage || ""),

    // ── AI 분석 결과 ──
    "AI 요약(핵심 5줄)":         textProp(ai.summaryKo || ""),
    "핵심 역량(키워드)":          multiSelectProp(ai.coreCompetencies || []),
    "추천 트랙":                 multiSelectProp(ai.recommendedTrack || []),
    "추천 권역":                 selectProp(ai.recommendedRegion || ""),
    "추천 지역 Top3":            textProp(ai.recommendedTopRegionsText || ""),
    "추천 점수(0-100)":          numberProp(ai.score ?? null),
    "추천 등급":                 selectProp(ai.grade || ""),
    "추천 근거 요약":             textProp(ai.rationaleKo || ""),
    "리스크/확인 필요":           textProp(ai.risksKo || ""),
    "마지막 AI 분석일":           dateProp(crm.lastAiAnalyzedAt || null),
    "추천안 발송일":              dateProp(crm.sentAt || null),
  });

  console.log(`👤 [CandidateSync] ${candidateId} 업서트 시작`);
  const existingId = await findPageByFirebaseId(notion, databaseId, candidateId);

  if (existingId) {
    await notion.pages.update({ page_id: existingId, properties });
    console.log(`✅ [CandidateSync] ${candidateId} 업데이트 완료`);
  } else {
    await notion.pages.create({ parent: { database_id: databaseId }, properties });
    console.log(`✅ [CandidateSync] ${candidateId} 신규 생성 완료`);
  }
}

module.exports = { upsertJobToNotion, upsertCandidateToNotion };
