# Contributing to SkyHub v2

## Branch Protection (set up in GitHub)

After Sprint 7, enable these rules on the `main` branch in GitHub Settings → Branches → Branch protection rules:

- Require status checks to pass before merging
  - Required checks: `Lint`, `Format Check`
- Require pull request reviews before merging (optional but recommended)
- Do not allow bypassing the above settings

Once the pre-existing `@skyhub/types` build is fixed, add `Type Check` and `Build Web` to the required checks.

## Workflow

1. Create a feature branch: `git checkout -b feature/movement-control`
2. Make changes and commit — the Husky pre-commit hook runs `lint-staged`
3. Push and create a PR: `gh pr create`
4. CI runs automatically — fix any failures
5. Merge after checks pass

## Linting & Formatting

The monorepo uses a shared ESLint config at `packages/eslint-config/` plus root Prettier. Every workspace has a `lint` script.

```bash
npm run lint          # lint all workspaces via turbo
npm run format        # prettier --write across the repo
npm run format:check  # prettier --check (used by CI)
```

Pre-commit hook runs `eslint --fix` and `prettier --write` only on staged files (`lint-staged`).

## Environment Variables

All server env vars are validated on startup by `@skyhub/env` using Zod. Missing or invalid vars crash the server immediately with a per-field error. The same validation is available on the client side for `NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL`.

Local developer setup:

1. Copy `server/.env.example` to `server/.env` and fill in real values (MongoDB URI, JWT secret ≥ 32 chars).
2. Create `apps/mobile/.env` with `EXPO_PUBLIC_API_URL=http://localhost:3002` (or your LAN IP).
3. Create `apps/web/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3002`.

All `.env` files are gitignored; only `.env.example` is committed.

## Version Bumping

```bash
./scripts/bump-version.sh patch  # 0.1.0 -> 0.1.1
./scripts/bump-version.sh minor  # 0.1.0 -> 0.2.0
./scripts/bump-version.sh major  # 0.1.0 -> 1.0.0
```

## Building Mobile App

```bash
cd apps/mobile
eas build --profile development --platform ios
eas build --profile development --platform android
```

See `apps/mobile/eas.json` for the dev/preview/production profiles.
