# Project Context for Gemini

@./AGENTS.md

Load only the canonical documents required by the task:

- Playwright test task: `ai/shared/AI_PROMPTS.md`, `ai/shared/TEST_AUTOMATION_LESSONS.md`, and `.ai/knowledge/qa/`.
- Dashboard task: `ai/dashboard/DASHBOARD_AI_PROMPT.md` and `ai/dashboard/AI_LESSONS.md`.
- Unrelated task: do not load either group.

Keep detailed Dashboard rules in the imported canonical documents rather than duplicating them here. If those documents change during an active Gemini CLI session, run `/memory refresh` before continuing.
