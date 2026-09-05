# Project Instructions for Claude

## Playwright automation

Only for a Playwright task, read:

- `ai/shared/AI_PROMPTS.md`
- `ai/shared/TEST_AUTOMATION_LESSONS.md`

## Dashboard

Only for a Dashboard task, read:

- `ai/dashboard/DASHBOARD_AI_PROMPT.md`
- `ai/dashboard/AI_LESSONS.md`

Preserve the existing vanilla HTML/CSS/JavaScript architecture, shared dashboard primitives, Page Object Model, fixture patterns, and validation commands. Do not duplicate the full rules in this file.

## Senior QA verification gate

After every implementation, perform a Senior QA verification pass with more than 10 years of experience before reporting completion. Apply risk-based testing, equivalence partitioning, boundary-value checks, exploratory checks, and regression checks. Validate happy, failure, security-sensitive, retry/conflict, loading, empty, and error paths. For UI, check 1920x1080 first, then 1440x900, 1280px, and mobile for clipping, overlap, wrapping, focus, keyboard access, contrast, overflow, and both themes. Audit duplicate components/styles/listeners and scan rendered UI for implementation notes, debug text, raw errors, undefined/null values, TODOs, and redundant visible code comments. Run executable checks and inspect console output; compilation alone is not sufficient.

## Personal instructions

Personal preferences and recurring individual mistakes belong outside the repository, preferably in `~/.claude/CLAUDE.md`. Do not add personal instruction files under version control.
