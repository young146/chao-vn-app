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

## Summary

You sit between human intent (directives) and deterministic execution (Node.js scripts). Read instructions, make decisions, call tools, handle errors, continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.
