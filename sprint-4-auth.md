# Sprint 4 — JWT Authentication + Operator ID Retrofit

**Estimated time:** 3–4 hours in a single focused block
**Risk level:** Highest blast radius of any sprint — touches every route file and the mobile boot flow
**Do NOT start this sprint unless you have 3+ uninterrupted hours**

---

## Context

This is Session B of the infrastructure hardening plan. Sessions already completed on `main`:

- **Sprint 1** (`80d8e4e`) — ESLint + Prettier + Husky, `@skyhub/eslint-config` shared config
- **Sprint 2** (`c1ce06c`) — `@skyhub/env` Zod validation, server crashes on missing/invalid env
- **Sprint 7** (`2b8c076`) — GitHub Actions CI (Lint + Format Check), EAS config, version bump

**Repo:** `C:\Users\ADMIN\horizon-v2-mono` (git: `vivimassa/horizon-v2-mono`)
**Package namespace:** `@skyhub/*` (NOT `@horizon/*` — CLAUDE.md is stale on this)
**Server port:** `3002` (not 3001 — real `.env` uses 3002)
**Workspaces:** `apps/{mobile,web}`, `packages/{api,ui,types,logic,constants,env,eslint-config}`, `server/`

### What you're building and why

The server currently has:

- `@fastify/jwt` registered but not enforcing anything
- `env.JWT_SECRET` validated (via Sprint 2) — no more `'dev-secret-change-me'` fallback
- A `User` model with `security.passwordHash`, `role`, `operatorId`, `profile.email`, `security.sessions[]`
- A seed user at `_id: 'skyhub-admin-001'` with an **empty passwordHash**
- **Zero** auth routes (no `/auth/login`, no `/auth/refresh`)
- **Zero** auth middleware (no `req.userId`, no `req.operatorId` on requests)
- **313 references** to `'skyhub-admin-001'` or hardcoded operator IDs across **14 route files**

The mobile and web apps have:

- A working API client at `packages/api/src/client.ts` with `setApiBaseUrl()` and a `request()` function
- **No login screen**, **no token storage**, **no auth state**
- The request function does **not** attach an Authorization header

This sprint makes auth real end to end. After this sprint:

- Every protected route requires a Bearer token
- `req.operatorId` and `req.userId` are populated from the JWT on every authenticated request
- All hardcoded `'skyhub-admin-001'` fallbacks are gone
- The mobile app shows a login screen on first launch and auto-logs-in on subsequent launches
- The web app has a matching (simpler) auth provider

### 5-minute warmup (optional but recommended)

Before starting the real work, fix the pre-existing `@skyhub/types` build. This unblocks CI typecheck and the Sprint 7 jobs that were intentionally skipped. Open `packages/types/src/index.ts` and add `.js` extensions to the three relative imports that currently point to `./database`, `./schedule-messaging`, and `./gcs`. Rebuild to verify: `cd packages/types && npm run build`. Then re-enable the `Type Check` and `Build Web` jobs in `.github/workflows/ci.yml`.

---

## Pre-flight — READ THESE FIRST

Do not skip this. The plan's earlier iteration was written without verifying the repo state, and several assumptions were wrong.

1. `CLAUDE.md` (top-level) — the Critical Rules section.
2. `server/src/index.ts` — confirm JWT plugin registration and where to hook middleware.
3. `server/src/models/User.ts` — confirm field paths (security.passwordHash, profile.email, etc.)
4. `server/src/seed-user.ts` — understand the existing seed flow.
5. `server/src/routes/users.ts` — the route file with the most hardcoded `'skyhub-admin-001'` references.
6. `packages/api/src/client.ts` — the `request()` function you'll be modifying.
7. `packages/env/src/server.ts` — the Zod schema that has `JWT_ACCESS_EXPIRY` and `JWT_REFRESH_EXPIRY`.
8. `apps/mobile/app/_layout.tsx` — the root layout where you'll wire the auth boot flow.

Run this grep to see the full scope of the retrofit:

```bash
cd C:/Users/ADMIN/horizon-v2-mono
grep -rn "skyhub-admin-001\|operatorId.*||.*'skyhub'\|(req\.query as any)\.operatorId\|(req\.query as any)\.userId" server/src/routes/ | wc -l
```

You should see roughly 313 matches across these 14 files: `users.ts`, `flights.ts`, `charter.ts`, `city-pairs.ts`, `codeshare.ts`, `fdtl.ts`, `gantt.ts`, `reference.ts`, `rotations.ts`, `scenarios.ts`, `schedule-messages.ts`, `scheduled-flights.ts`, `slots.ts`, `ssim.ts`.

---

## Task breakdown

Use `TaskCreate` to track each phase. Mark each task `in_progress` → `completed` as you work. There are **5 phases**. Do them in order.

### Phase A — Server auth routes (≈ 45 min)

#### A1. Install bcryptjs

```bash
cd server && npm install bcryptjs && npm install -D @types/bcryptjs
```

#### A2. Create `server/src/routes/auth.ts`

Three routes:

- `POST /auth/login` — body `{ email, password }` → `{ accessToken, refreshToken, user }`. Lookup user by `profile.email` (lowercased+trimmed), verify against `security.passwordHash` with `bcrypt.compare`, reject if `isActive === false`, generate tokens via `app.jwt.sign({ userId, operatorId, role }, { expiresIn: env.JWT_ACCESS_EXPIRY })` and a matching refresh token (add `type: 'refresh'`), update `lastLoginUtc`, return user with `security` stripped.
- `POST /auth/refresh` — body `{ refreshToken }`. Verify via `app.jwt.verify`. Check the token `type === 'refresh'`. Re-check user `isActive`. Issue a new pair.
- `POST /auth/set-password` — body `{ userId, password }`. Admin/first-time bootstrap only. Hash with `bcrypt.hash(password, 12)`. Update `security.passwordHash` and `security.lastPasswordChange`. **This route is public tonight**; add real RBAC after Sprint 4.

Use `getServerEnv()` from `@skyhub/env` to read `JWT_ACCESS_EXPIRY` and `JWT_REFRESH_EXPIRY`.

#### A3. Create `server/src/middleware/authenticate.ts`

- Declaration-merge `FastifyRequest` to add `userId: string`, `operatorId: string`, `userRole: string`
- Export `registerAuthMiddleware(app: FastifyInstance)` that:
  - `app.decorateRequest('userId', '')` etc.
  - Adds an `onRequest` hook that skips public paths (`/health`, `/auth/login`, `/auth/refresh`, `/auth/set-password`, `/uploads/*`) and otherwise calls `request.jwtVerify()` and populates the three fields. 401 on failure.

#### A4. Wire it into `server/src/index.ts`

Import and register **after** `@fastify/jwt` but **before** route registration:

```ts
import { authRoutes } from './routes/auth.js'
import { registerAuthMiddleware } from './middleware/authenticate.js'

// ...after await app.register(jwt, { secret: env.JWT_SECRET })
registerAuthMiddleware(app)

// ...in the routes section
await app.register(authRoutes)
```

### Phase B — Retrofit 14 route files (≈ 60–90 min)

This is the biggest phase. You will edit every file listed in the pre-flight grep. **Do it file by file** — don't try to do all 14 at once.

For each route file, replace:

```ts
// OLD
const operatorId = (req.query as any).operatorId || 'skyhub'
const userId = (req.query as any).userId || 'skyhub-admin-001'
```

With:

```ts
// NEW — from JWT
const operatorId = req.operatorId
const userId = req.userId
```

**Special cases:**

- `users.ts` has `/users/me`. Update it to use `req.userId` directly:
  ```ts
  app.get('/users/me', async (req, reply) => {
    const user = await User.findById(req.userId).lean()
    if (!user) return reply.code(404).send({ error: 'User not found' })
    const { security, ...safe } = user as any
    return safe
  })
  ```
- Any route that used `operatorId` as a query param for multi-tenant filtering — verify the new `req.operatorId` is actually used in the Mongo query (not just assigned and discarded).

After each file, run `npx tsx src/index.ts` briefly to make sure it still starts. Kill with Ctrl+C.

**Verification grep after Phase B** — should return 0:

```bash
grep -rn "skyhub-admin-001\|(req\.query as any)\.userId\|operatorId.*||.*'skyhub'" server/src/routes/ | wc -l
```

### Phase C — Seed the admin password (≈ 5 min)

Two options:

**Option 1** — edit `server/src/seed-user.ts` so new runs hash a default password:

```ts
import bcrypt from 'bcryptjs'
// in User.create:
security: {
  passwordHash: await bcrypt.hash('SkyHub2026!', 12),
  lastPasswordChange: new Date().toISOString(),
}
```

Then re-run: `cd server && npx tsx src/seed-user.ts` (only works if the seed script upserts — check it does before running).

**Option 2** — start the server and hit the new `set-password` endpoint:

```bash
curl -X POST http://localhost:3002/auth/set-password \
  -H "Content-Type: application/json" \
  -d '{"userId":"skyhub-admin-001","password":"SkyHub2026!"}'
```

Pick the safer one for your local data. Option 2 never risks overwriting the rest of the user document.

### Phase D — Client API client (≈ 30 min)

#### D1. Update `packages/api/src/client.ts`

Add a callbacks module-level pattern so UI packages don't have to know about token storage:

```ts
let _getAccessToken: (() => string | null) | null = null
let _onAuthFailure: (() => void) | null = null

export function setAuthCallbacks(callbacks: { getAccessToken: () => string | null; onAuthFailure: () => void }) {
  _getAccessToken = callbacks.getAccessToken
  _onAuthFailure = callbacks.onAuthFailure
}
```

In the existing `request()` function, attach the header when a token is available:

```ts
const token = _getAccessToken?.()
if (token) headers['Authorization'] = `Bearer ${token}`
```

And on 401:

```ts
if (res.status === 401 && _onAuthFailure) {
  _onAuthFailure()
  throw new Error('Unauthorized')
}
```

Also add three methods to the `api` object: `login(email, password)`, `refreshToken(rt)`, `setPassword(userId, password)`, `getMe()`. The `getMe` calls `GET /users/me`.

Export `setAuthCallbacks` from `packages/api/src/index.ts`.

### Phase E — Mobile auth (≈ 60 min)

#### E1. Install MMKV

```bash
cd apps/mobile && npx expo install react-native-mmkv
```

#### E2. Create `packages/ui/src/stores/useAuthStore.ts`

Standard Zustand store with `accessToken`, `refreshToken`, `user`, `isAuthenticated`, `isLoading` (starts true), and actions `setTokens`, `setUser`, `logout`, `setLoading`. Export from `packages/ui/src/index.ts`.

#### E3. Create `apps/mobile/src/lib/token-storage.ts`

MMKV-backed helper with `getAccessToken`, `getRefreshToken`, `setTokens`, `clearTokens`. Use namespace `skyhub-auth`.

#### E4. Create `apps/mobile/app/login.tsx`

A login screen built from existing `@skyhub/ui` components — do NOT invent new ones. Use `<Card>`, existing `Button`, existing text primitives. Fields: email, password. On submit: `api.login()` → `tokenStorage.setTokens()` → `useAuthStore.getState().setTokens()` → router navigates to main tabs. Show error state in red below form. Show spinner on button during request.

Default dev credentials for the form placeholder: `admin@skyhub.aero` / `SkyHub2026!`.

#### E5. Wire `apps/mobile/app/_layout.tsx` as auth guard

This is the important bit. At the root layout:

```tsx
const { isAuthenticated, isLoading } = useAuthStore()

useEffect(() => {
  setAuthCallbacks({
    getAccessToken: () => useAuthStore.getState().accessToken,
    onAuthFailure: () => {
      tokenStorage.clearTokens()
      useAuthStore.getState().logout()
    },
  })

  const stored = tokenStorage.getRefreshToken()
  if (stored) {
    api
      .refreshToken(stored)
      .then(({ accessToken, refreshToken }) => {
        tokenStorage.setTokens(accessToken, refreshToken)
        useAuthStore.getState().setTokens(accessToken, refreshToken)
        return api.getMe()
      })
      .then((user) => useAuthStore.getState().setUser(user))
      .catch(() => useAuthStore.getState().logout())
      .finally(() => useAuthStore.getState().setLoading(false))
  } else {
    useAuthStore.getState().setLoading(false)
  }
}, [])

if (isLoading) return <SplashScreen />
if (!isAuthenticated) return <LoginScreen />
return <ExistingTabNavigatorOrSlot />
```

Keep the existing `ThemeProvider` and `UserProvider` wrappers. The auth guard goes inside them.

### Phase F — Web auth (≈ 20 min, lighter)

For the web app: create `apps/web/src/lib/auth-provider.tsx` with the same shape as mobile but using `localStorage` for token persistence. Wrap the existing `RootLayout` children with it. The login screen can be a Next.js page at `apps/web/src/app/login/page.tsx`. Don't over-engineer — web just needs parity with mobile for the same endpoints.

---

## Acceptance criteria

Copy-paste these into your TaskList as individual acceptance tasks. Every one must pass before you commit.

1. `POST /auth/login` with `{"email":"admin@skyhub.aero","password":"SkyHub2026!"}` returns `{ accessToken, refreshToken, user }` (200)
2. `POST /auth/refresh` with a valid refresh token returns a new pair (200)
3. `GET /airports` without a Bearer header returns **401** with a clear error message
4. `GET /airports` with a valid Bearer token returns the airport list (200)
5. `GET /users/me` with a valid Bearer token returns the logged-in user without the `security` field
6. `req.operatorId` is populated on every authenticated request (add a `console.log` in one route, verify, then remove)
7. The retrofit grep returns **0**: `grep -rn "skyhub-admin-001\|(req\.query as any)\.userId" server/src/routes/ | wc -l`
8. Mobile: fresh install shows login screen, successful login navigates to tabs, killing and relaunching the app skips the login screen (refresh-token auto-login works)
9. Mobile: logging out clears MMKV tokens and returns to login
10. Web: same auth parity at the `localStorage` level

## Self-test script

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skyhub.aero","password":"SkyHub2026!"}' | jq -r '.accessToken')
echo "Token: ${TOKEN:0:40}..."

# 2. Authenticated request
curl -s http://localhost:3002/airports \
  -H "Authorization: Bearer $TOKEN" | jq 'length'

# 3. Unauthenticated request blocked
curl -s http://localhost:3002/airports | jq .

# 4. No hardcoded operator IDs remain
grep -rn "skyhub-admin-001\|(req\.query as any)\.userId" server/src/routes/ | wc -l

# 5. Typecheck the server (after Sprint 4's @skyhub/types warmup fix)
cd server && npx tsc --noEmit 2>&1 | head -20
```

## Commit

One commit at the end:

```
infra(sprint-4): JWT auth + login flow + operator ID retrofit
```

Multi-line body should mention:

- New `/auth/{login,refresh,set-password}` routes
- `authenticate.ts` middleware populating `req.{userId,operatorId,userRole}`
- Retrofit of all 14 route files (count in body)
- MMKV token storage + `useAuthStore` + mobile login screen
- Web auth provider parity

## Rollback plan

If something goes catastrophically wrong mid-sprint and the app is broken:

```bash
git stash
git reset --hard origin/main
```

All of tonight's infrastructure (Sprints 1/2/7) is already on `origin/main` so `reset --hard` is safe.

## What this sprint does NOT do

- No password reset flow (email-based) — that's a dedicated follow-up
- No session invalidation on the server side — refresh tokens are stateless JWTs tonight; a `sessions` collection check can be added later
- No rate limiting on `/auth/login` — add `@fastify/rate-limit` in a separate task
- No RBAC on routes — the `role` is on the request but no route enforces it yet. That's Sprint 4b.
- No MFA, no OAuth, no SSO

Those are all valid next steps after Sprint 4 lands.
