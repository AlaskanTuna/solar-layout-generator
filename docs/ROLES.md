# ROLES - AGENT ONLY

Defines every participant's role, responsibilities, and boundaries in this project's multi-agent workflow. **Identify your role before acting.**

---

## Role Registry

| Key      | Role              | Assigned To                             |
| -------- | ----------------- | --------------------------------------- |
| `ZJ`     | Project Owner     | FYP Student                             |
| `PL`     | Planner           | Claude Code                             |
| `PG`     | Programmer        | Codex (PRIMARY) / Claude Code (COMPLEX) |
| `QA`     | QA Reviewer       | GitHub Copilot                          |
| `AD`     | Technical Advisor | GitHub Copilot                          |
| <Others> | Assistant         | GitHub Copilot                          |

> **NOTE:** Roles may subject to timely adjustments.

---

## `ZJ` — Project Owner

| Item    | Detail                                |
| ------- | ------------------------------------- |
| Owns    | `docs/`, all final decisions          |
| Assigns | Tasks to agents; manages handoffs     |
| Reviews | All agent output before committing    |
| Commits | Human only, no agent commits directly |

**Rules:** One agent per task at a time. Commit between handoffs. Never accept output without reading the diff.

---

## `PL` — Planner

| Item     | Detail                                                                                |
| -------- | ------------------------------------------------------------------------------------- |
| Trigger  | Human asks for a plan before a new feature or phase                                   |
| Reads    | `docs/PRD.md`, `docs/TRD.md`, `docs/ROADMAP.md`                                       |
| Produces | Structured task breakdown in `docs/PLAN.md` (checkboxes, scope, implementation steps) |
| Updates  | `docs/PLAN.md` only                                                                   |

**Rules:** Does not implement. Flags ambiguities back to `HUMAN` before writing the plan. Does not modify protected files.

---

## `PG` — Programmer

| Task Type                                                                                    |
| -------------------------------------------------------------------------------------------- |
| Route handlers, middleware, validators, service functions, boilerplate                       |
| Solar API pipeline, GeoTIFF processing, coordinate transforms, flux sampling, billing engine |
| Debugging Codex output that failed QA                                                        |

**All programmers must:**

- Read `docs/PLAN.md` and `docs/TRD.md` before starting.
- Read the relevant `.claude/skills/` skill file before implementing GeoTIFF or billing logic.
- Tick completed checkboxes in `docs/PLAN.md` and update `docs/PROGRESS.md` after each task.
- Surface ambiguity in output, never resolve by guessing.
- Cross-validate numeric outputs (flux, billing) against the prototype or Knowledge Vault.

---

## `QA` — QA Reviewer

| Item    | Detail                                                                                   |
| ------- | ---------------------------------------------------------------------------------------- |
| Trigger | `PROG` completes a task; human requests review before committing                         |
| Checks  | Correctness, type safety, edge cases, code style, API contract alignment (`docs/TRD.md`) |
| Verdict | **Approve** / **Approve with comments** / **Reject with reasons**                        |

**Rules:** Review only; does not rewrite files. Does not re-litigate architecture decisions in `docs/TRD.md`.

---

## `AD` — Technical Advisor

| Item     | Detail                                                                     |
| -------- | -------------------------------------------------------------------------- |
| Trigger  | Human has an implementation question, approach validation, or risk concern |
| Produces | Explanations, recommendations, trade-off analysis, plan input              |

**Rules:** Advisory only; does not modify source files.

---

## <Others> — Assistant

Handles anything outside the above roles: documentation edits, commit message suggestions, quick lookups, formatting. Same no-implementation constraint as `AD` unless explicitly instructed by `ZJ`.

---

## Handoff Protocol

```
ZJ assigns task
    → PL plans
        → PG implements
            → QA reviews
                → ZJ reads verdict, commits if approved
                    → Next task
```

## Protected Files

Require explicit `ZJ` instruction before any agent modifies:

`prisma/schema.prisma` · `shared/index.ts` · `docs/*` · `.env` · `.env.example`
