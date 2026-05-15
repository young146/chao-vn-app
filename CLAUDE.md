# Agent Instructions

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

## 🚨 MANDATORY: Read This File First

**Every agent, every new conversation, without exception:**
1. This file (`GEMINI.md` / `CLAUDE.md` / `AGENTS.md`) MUST be read and fully internalized before any work begins.
2. If you are starting a new session or have just been initialized, your very first action must be to read this file.
3. Confirm internally that you have read and understood all rules before responding to any request.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

## The 3-Layer Architecture

**Layer 1: Directive (What to do)**
- Basically just SOPs written in Markdown, live in `directives/`
- Define the goals, inputs, tools/scripts to use, outputs, and edge cases
- Natural language instructions, like you'd give a mid-level employee

**Layer 2: Orchestration (Decision making)**
- This is you. Your job: intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings
- You're the glue between intent and execution. E.g you don't try scraping websites yourself—you read `directives/scrape_website.md` and come up with inputs/outputs and then run `scripts/crawler.js`

**Layer 3: Execution (Doing the work)**
- Deterministic Node.js/Next.js scripts in `scripts/` and core logic in `lib/`
- Environment variables, api tokens, etc are stored in `.env`
- Handle API calls, data processing, file operations, database interactions
- Reliable, testable, fast. Use scripts instead of manual work. Commented well.

**Why this works:** if you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. The solution is push complexity into deterministic code. That way you just focus on decision-making.

## Operating Principles

**1. Check for tools first**
Before writing a script, check `scripts/` and `lib/` per your directive. Only create new scripts if none exist.

**2. Self-anneal when things break**
- Read error message and stack trace
- Fix the script and test it again (unless it uses paid tokens/credits/etc—in which case you check w user first)
- Update the directive with what you learned (API limits, timing, edge cases)
- Example: you hit an API rate limit → you then look into API → find a batch endpoint that would fix → rewrite script to accommodate → test → update directive.

**3. Update directives as you learn**
Directives are living documents. When you discover API constraints, better approaches, common errors, or timing expectations—update the directive. But don't create or overwrite directives without asking unless explicitly told to. Directives are your instruction set and must be preserved (and improved upon over time, not extemporaneously used and then discarded).

**4. ⛔ NEVER touch code beyond what was explicitly requested**
- **Only modify files and lines that are directly required to fulfill the user's specific request.**
- Do NOT "improve", refactor, clean up, or adjust any surrounding code that was not part of the request—even if it looks like it could be better.
- Every unrelated change risks introducing new bugs. One fix should never cause another problem.
- **If you believe additional changes are necessary beyond what was asked, you MUST explain why and get explicit approval from the user before making those changes.**
- When in doubt: do less, ask first.

**5. ✅ Self-check after every task (no exceptions)**
- After completing any task—small edit or large refactor—run the self-check protocol defined in `directives/AGENT_WORKFLOW.md` and report the results to the user.
- Use the mandatory report format: 변경 요약 / 자체점검 결과 (A~F) / 사용자 확인 필요 사항 / 다음 단계 제안.
- If a check fails, fix it and re-check before reporting. Never hide failures.
- Skipping self-check is not allowed unless the user explicitly approves in advance.

**6. 🔍 Always explain root cause + fix in plain language**
사용자가 비전문가일 수 있다는 전제로, 모든 버그 수정·문제 해결 작업을 보고할 때 다음 형식을 따른다:

- **원인(Root Cause)**: 왜 그 문제가 발생했는지 — 단순히 "X가 잘못됐음"이 아니라 *왜 그게 잘못된 동작을 일으키는지* 메커니즘을 설명. 예: "AsyncStorage I/O가 100~500ms 걸리는데 그 동안 UI 스레드가 막혀서 멈춘 것처럼 보임"
- **수정(Fix)**: 그 원인을 해결하기 위해 *구체적으로 무엇을 바꿨는지* 코드 스니펫과 함께 제시. "→" 화살표로 결과(어떻게 동작이 바뀌는지) 명시
- **요약 표**: 원인이 2개 이상이면 마지막에 `증상 | 원인 | 해결` 표로 한눈에 정리

WHY:
- 사용자가 단순히 "수정 완료"를 원하는 게 아니라 *시스템이 왜 그렇게 동작하는지* 이해하길 원함
- 같은 부류의 문제가 다음에 또 생길 때 사용자가 스스로 진단할 수 있게 됨
- "수정했습니다"만으로는 신뢰가 쌓이지 않음 — 메커니즘 설명이 검증 가능성을 줌

How to apply:
- 단순 typo 수정, 색상 변경 등 기계적 작업에는 적용 안 해도 됨
- 버그 수정, 동작 이상 해결, 플랫폼별 차이 해결 등 *원인 분석이 필요한 작업*에는 항상 적용
- 기술 용어가 불가피할 때는 비유나 짧은 풀이를 함께 제시 (예: "Modal이 상태바 아래에서 시작 = 화면 위쪽 좌표가 어긋난 채 그려짐")

## Self-annealing loop

Errors are learning opportunities. When something breaks:
1. Fix it
2. Update the tool
3. Test tool, make sure it works
4. Update directive to include new flow
5. System is now stronger

## File Organization

**Deliverables vs Intermediates:**
- **Deliverables**: Google Sheets, Google Slides, or other cloud-based outputs that the user can access / Published WordPress posts.
- **Intermediates**: Temporary files needed during processing

**Directory structure:**
- `app/` - Next.js App Router (Backend/Admin/API)
- `scripts/` - Utility scripts for automation and scheduled tasks
- `lib/` - Core logic (crawling, translating, generating images)
- `directives/` - SOPs in Markdown (the instruction set)
- `wordpress-plugin/` - Display logic for the WordPress site
- `.env` - Environment variables and API keys

**Key principle:** Local files are only for processing. Deliverables live in cloud services (Google Sheets, Slides, etc.) where the user can access them. Everything in `.tmp/` can be deleted and regenerated.

## Deployment Rules (MANDATORY)

### 앱 배포 워크플로우 (chao-vn-app)

이 프로젝트는 출시된 앱이다. 코드 수정 후 반드시 아래 순서를 따른다:

**Step 1 — Git push (코드 저장)**
```bash
git push origin main
```

**Step 2 — OTA 업데이트 (앱 사용자에게 전달)**
```bash
eas update --channel production --message "변경 내용 설명"
```

**⛔ 절대 금지:**
- `eas update --branch main` — 앱스토어 사용자에게 전달되지 않음
- `eas update --channel main` — 동일한 이유로 금지
- channel을 생략한 `eas update` — 기본값이 main이 될 수 있음

**왜 `production` 채널인가:**
- `eas.json`에 `"channel": "production"` 으로 빌드된 앱바이너리만 앱스토어에 출시됨
- 앱은 자신이 빌드될 때 지정된 채널의 업데이트만 수신함
- `main` EAS 브랜치로 보낸 업데이트는 개발용 빌드에만 전달되고, 실제 사용자에게는 도달하지 않음

**WordPress 플러그인 배포:**
- `wp-plugins/` 하위 파일은 git push 후 FTP로 직접 서버에 업로드 (사용자가 직접 처리)
- 대상 경로: 서버 `wp-content/plugins/chaovn-firebase-auth/`

## Summary

You sit between human intent (directives) and deterministic execution (Node.js scripts). Read instructions, make decisions, call tools, handle errors, continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.
