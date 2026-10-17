# Culvoy Agent Guide

This file defines the repository workflow, engineering rules, and standard operating procedures. It is deliberately free of current Git status, deployment results, task queues, incident notes, and other time-sensitive state.

## 1. Document governance

- `AGENTS.md` is the process and policy source. Keep procedures, invariants, checklists, and reusable commands here.
- `CHANGELOG.md` is the current update and release record. Every meaningful code, configuration, content, migration, deployment, or documentation update gets an entry under `[Unreleased]` before the change is merged.
- `docs/CURRENT-STATE.md` is deprecated. Do not append status to it. Historical content is preserved in `docs/2026-10-17/current-state-archive.md`; new status belongs in `CHANGELOG.md`.
- `docs/YYYY-MM-DD/` contains dated plans, handoffs, evidence, and historical records. A dated document is not an active source of truth unless this guide links to it as a policy.
- `docs/reference/` contains long-lived technical and design references. Update those documents when a rule changes, and record the change in `CHANGELOG.md`.
- Never put current commit SHAs, branch status, deployment results, open task lists, or runtime counters in this file.

## 2. Repository and environment

Culvoy consists of three applications:

| Path | Application | Stack |
| --- | --- | --- |
| `site/` | Public site | Next.js, React, Tailwind CSS, GSAP |
| `api/` | API | NestJS, TypeORM, PostgreSQL, JWT, PayPal |
| `admin-frontend/` | Admin | Vue, Vite, Element Plus, GSAP |

Local development uses Docker Compose:

- Site: `http://localhost:3000`
- Admin: `http://localhost:5173`
- API: `http://localhost:8000`

Production uses the Docker stack behind the host Nginx gateway:

- Site: `https://culvoy.com`
- Admin: `https://admin.culvoy.com`
- API: `https://api.culvoy.com`
- API health: `https://api.culvoy.com/health`

Never point local write operations at production. Never store secrets, database credentials, tokens, or private URLs in the repository.

## 3. Required startup procedure

Before editing, inspect both repositories and read the applicable references:

```bash
git -C E:/workspace/LingTour status --short --branch
git -C E:/workspace/LingTour/admin-frontend status --short --branch
git -C E:/workspace/LingTour log -12 --oneline --decorate
git -C E:/workspace/LingTour/admin-frontend log -12 --oneline --decorate
```

Read, in order:

1. `PRODUCT.md` and `DESIGN.md` when the change affects product behavior or UI.
2. `docs/reference/UI-OVERHAUL-2026.md` and `docs/reference/RESPONSIVE-SPEC.md` for visual work.
3. `AGENTS.md` for process rules.
4. `CHANGELOG.md` for recent decisions and release context.
5. The relevant dated plan or technical reference under `docs/`.
6. `site/AGENTS.md` and `site/CLAUDE.md` for site work.

Protect unrelated tracked and untracked work. Never reset, clean, stash, delete, or overwrite unrelated files to make a task easier.

## 4. Scope and planning

- Treat the user's request as the authorized scope. Resolve routine implementation choices without expanding the product goal.
- Write a dated plan under `docs/YYYY-MM-DD/` before a multi-file feature, schema change, payment change, deployment change, or other work that needs sequencing.
- Keep a plan focused on decisions, affected files, data contracts, validation, rollout, and rollback. Do not use `AGENTS.md` as a plan or status log.
- Preserve existing routes, API contracts, authentication, and historical data unless the approved plan explicitly changes them.
- When documentation and code disagree, verify the current implementation and record the decision in the plan or `CHANGELOG.md` before changing the rule.

## 5. Branches, commits, and the two repositories

Use a short-lived branch named `feature/<topic>`, `fix/<topic>`, `docs/<topic>`, or `chore/<topic>` from the latest `main`. Keep one logical change per pull request and per commit where practical.

Use Conventional Commits:

```text
feat(scope): add a capability
fix(scope): correct a defect
docs(scope): update a process or reference
chore(scope): update tooling or dependencies
refactor(scope): change structure without changing behavior
test(scope): improve verification
deploy(scope): change deployment configuration
```

Rules:

- Use an English, imperative, lowercase subject without a period; keep it within 72 characters.
- Stage exact paths. Do not use `git add .` or `git add -A`.
- Do not commit secrets, `.env` values, database dumps, uploaded media, generated build output, or temporary browser artifacts.
- `admin-frontend/` is an independent Git repository and is also mirrored by the root repository. For admin changes, verify and commit the independent repository first, then commit the matching root paths. Keep the two trees byte-equivalent except for the documented `.vscode/extensions.json` difference.

## 6. Engineering and data rules

- Use strict TypeScript and the existing lint, formatting, and component conventions.
- Follow the existing design system. Preserve horizontal text, mobile touch targets of at least 44px, form controls of at least 16px, keyboard access, visible focus, and reduced-motion behavior.
- Use `useGSAP()` with a scoped root in React and `gsap.context()` with cleanup in Vue. Prefer transforms and opacity over layout animation.
- Keep API amount calculation on the server. Validate ownership, authorization, idempotency, and failure recovery at the API boundary.
- Database migrations are additive by default. Do not rewrite an applied migration. Keep `synchronize: false`.
- Before a migration or production content write, obtain explicit authorization, verify the target, take a timestamped `pg_dump -Fc` backup, and record the backup path in `CHANGELOG.md` after the operation.
- Never run reset, destructive seed, production write, migration, push, or deploy commands without the required authorization and preconditions.

## 7. Verification and CI

Every push and every pull request runs `.github/workflows/ci.yml`. A pull request cannot merge until the required checks pass. The workflow must cover:

- API type-check, test, and build with PostgreSQL 16.
- Site type-check, lint, test, and build.
- Admin type-check and build.
- Documentation whitespace and local-link checks.
- Docker image builds on pushes to `main` after application jobs pass.

Run the relevant local checks before opening or updating a pull request:

```bash
cd site
npx tsc --noEmit --skipLibCheck
npm run lint
npm run test:ci
npm run build

cd ../api
npx tsc --noEmit --skipLibCheck
npm test -- --runInBand
npm run build

cd ../admin-frontend
npm run build
```

For documentation-only changes, run `git diff --check` and the repository Markdown-link check. Do not claim a check passed unless it actually ran. Record meaningful verification in the relevant `[Unreleased]` entry.

## 8. Versioning

The project follows Semantic Versioning and uses Git tags as the release version source. The released baseline is `1.0.0`; unreleased work accumulates under `[Unreleased]` in `CHANGELOG.md`.

- `MAJOR`: incompatible public API, data, authentication, or deployment contract change.
- `MINOR`: backward-compatible product capability or public feature.
- `PATCH`: backward-compatible bug fix, security fix, documentation, dependency, or operational correction.
- Pre-release versions use `-alpha.N`, `-beta.N`, or `-rc.N` only when the release is intentionally incomplete.
- Release tags use `vX.Y.Z`, for example `v1.1.0`. Do not use deployment timestamps as the product version.
- A version may be released only from a green `main` commit with a matching `CHANGELOG.md` release section.

## 9. Update procedure

For every meaningful update:

1. Add or update the entry under `CHANGELOG.md` → `[Unreleased]` before implementation or documentation changes are merged.
2. Describe user-visible behavior, affected applications, migrations, compatibility, and validation. Keep factual details tied to the exact commit or workflow run when available.
3. Implement the change in a focused branch and preserve unrelated work.
4. Run the relevant local checks.
5. Open or update the pull request and wait for the complete CI workflow.
6. Merge only after required checks pass and review conditions are satisfied.
7. After merge, keep the final verification and operational result in the corresponding `CHANGELOG.md` entry. Do not create a parallel current-state log.

## 10. Release procedure

A release and a production deployment are separate actions. A release never grants deployment permission.

1. Confirm the intended version from the change categories and update `[Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`.
2. Merge the release commit to `main` and wait for the complete CI workflow, including the Docker build.
3. Create the root repository tag `vX.Y.Z` on the verified `main` commit. The tag establishes the release version; do not move it.
4. Create the GitHub Release from `vX.Y.Z` after the complete CI passes. Its notes must identify the root SHA, independent admin SHA, checks, completed scope, and unimplemented plans. A source-only release must state `Not deployed`; never claim production smoke tests or migrations occurred.
5. When production deployment is separately authorized, dispatch `Deploy LingTour Docker Stack` manually. Never deploy from a normal push or Release event. Confirm the intended version and actual deployed SHA match; the existing deploy script follows the configured branch rather than a release tag.
6. After a deployment, verify the deployed root SHA, container status, API health, public site, admin, and changed user flows. Record the deploy run, migrations, backup, smoke tests, and rollback reference in `CHANGELOG.md`. A failed deployment does not justify moving an already published tag.

The deploy script is the only production deployment path. It may run database migrations, so deployment authorization includes migration authorization. Do not bypass it with ad hoc container or server commands.

## 11. Rollback procedure

- Code rollback redeploys the previous verified Git SHA through the same deployment path.
- Data rollback uses the verified pre-deploy database backup and requires writes to stop first. Applied migrations are not assumed reversible.
- Record the reason, selected version or SHA, backup, commands used, verification, and final result in `CHANGELOG.md`.
- Never rewrite an old release entry to hide a failure. Add a correction or rollback note with the date and exact evidence.

## 12. Documentation quality

- Use `DSG` rules for Chinese technical documentation: clear hierarchy, short paragraphs, consistent Chinese-English spacing, and precise numbers.
- Keep headings within four levels and use one topic per paragraph.
- Link to the current process source and release record rather than duplicating operational truth.
- Run `git diff --check` for every documentation change.
