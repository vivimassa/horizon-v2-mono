---
name: feature-dev
description: Full feature development workflow for Horizon v2. Research → Plan → Implement → Verify. Use when starting any new feature or module.
---

# Feature Development Workflow

You are implementing a new feature for Horizon v2. Follow this workflow strictly.

## Step 1: Read Project State
Read `HORIZON_PROJECT_STATE.md` to understand current build state, decisions, and conventions.

## Step 2: Research First
Before writing any code:
- Search the codebase for similar patterns: `rg`, `glob`
- Check existing components in `src/components/ui/` and `src/components/common/`
- Check existing logic in `src/logic/`
- Check existing models in `src/models/`
- Check npm/Expo ecosystem for packages that solve this
- Use the `search-first` skill

## Step 3: Plan
Use the `planner` agent to create a phased implementation plan:
- Phase A: Data Layer (MongoDB + WatermelonDB)
- Phase B: API Layer (Fastify routes)
- Phase C: Business Logic (pure functions in src/logic/)
- Phase D: UI Components (React Native with design system)
- Phase E: Integration (sync, navigation, polish)

Save the plan to a file before implementing.

## Step 4: Implement Phase by Phase
For each phase:
1. Write tests first (TDD — use `tdd-guide` agent)
2. Implement minimal code to pass tests
3. Run verification: `turbo build && npx tsc --noEmit && npm test`
4. Commit with conventional format: `feat: add [feature] phase [A/B/C/D/E]`

## Step 5: Review
After all phases complete, run the `code-reviewer` agent on the full diff.

## Step 6: Verify
Run the `verification-loop` skill for comprehensive quality gates.

## Conventions Reminder
- All timestamps UTC (see `horizon-time-law` skill)
- operatorId on every query (see `horizon-db-conventions` skill)
- Design system tokens for all UI (see `horizon-frontend` skill)
- Components under 1000 lines (see `horizon-architecture` skill)
- ICAO standard codes for aircraft/airports
- StyleSheet.create() for all styles
- React.memo on all list items
- Dark mode tested
