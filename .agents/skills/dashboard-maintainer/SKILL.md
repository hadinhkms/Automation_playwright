---
name: dashboard-maintainer
description: Build, refactor, review, or debug this repository's Dashboard while preserving its shared UI system, editor behavior, and accumulated framework lessons.
---

# Dashboard Maintainer

Before acting on a dashboard task, read these files completely:

1. `ai/dashboard/DASHBOARD_AI_PROMPT.md` for the canonical architecture, workflow, and acceptance criteria.
2. `ai/dashboard/AI_LESSONS.md` for confirmed failures and preventive rules learned from previous work.

Treat those files as repository requirements. Preserve existing backend routes and business behavior unless the user explicitly asks to change them. Reuse or extend shared layout, header, panel, responsive, and code-editor primitives before creating feature-specific structures.

After a confirmed new dashboard defect is understood, update `ai/dashboard/AI_LESSONS.md` only when the root cause, correct pattern, and regression check are known. Consolidate duplicate lessons instead of growing the file with repeated observations.

If the task changes Playwright tests, also read and follow `ai/shared/AI_PROMPTS.md` and `ai/shared/TEST_AUTOMATION_LESSONS.md` before editing them.
