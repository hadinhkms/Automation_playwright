# AI Prompt Management

## Shared and committed

- `shared/AI_PROMPTS.md`: stable Playwright automation rules.
- `shared/TEST_AUTOMATION_LESSONS.md`: confirmed automation issues and preventive patterns.
- `dashboard/DASHBOARD_AI_PROMPT.md`: canonical Dashboard architecture and workflow rules.
- `dashboard/AI_LESSONS.md`: confirmed Dashboard issues and preventive patterns.

## Personal and ignored

Put individual preferences and recurring personal mistakes under `personal/<name>/`. This directory is ignored by Git except for `.gitkeep`. Do not put credentials, tokens, user data, or private conversation history in shared files.

Personal files are not automatically loaded by every AI tool. Each user should explicitly configure their tool's local instruction/profile entry point to read their own file.

Tool entry points such as `AGENTS.md`, `GEMINI.md`, and `.github/copilot-instructions.md` point directly to the canonical files in this folder. Do not create duplicate prompt files at the repository root or inside `dashboard/`.
