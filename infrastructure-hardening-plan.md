# SkyHub v2 — Infrastructure Hardening Plan

**Purpose:** 7 sequential sprints that build the missing infrastructure layers. Each sprint is a self-contained Claude Code prompt. Run them in order — each depends on the previous.

**CRITICAL:** Do NOT skip sprints. Do NOT start feature work until all 7 are complete.

**Repo:** `vivimassa/horizon-v2-mono`

---

## Pre-Flight Checklist (run before Sprint 1)

Before starting, verify the repo is in a clean state:

```bash
cd C:\Users\vivim\horizon-v2-mono
git status          # should be clean
git pull origin main
npm install
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# SPRINT 1 — Linting, Formatting & Git Hygiene

# Estimated time: 30–60 minutes

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Context

Read `.claude/skills/horizon-frontend/SKILL.md` and `CLAUDE.md` before starting.

**Monorepo:** `vivimassa/horizon-v2-mono` (Turborepo)

- `apps/web/` — Next.js + Tailwind CSS
- `apps/mobile/` — Expo + NativeWind
- `server/` — Fastify + MongoDB
- `packages/ui/`, `packages/api/`, `packages/logic/`, `packages/types/`, `packages/constants/`

**Current state:** Zero linting, zero formatting enforcement, zero git hooks. Any code style is accepted. This means every Claude Code agent writes in a different style and nothing catches mistakes before commit.

## Task

### 1. Create shared ESLint config package

Create `packages/eslint-config/` as a new workspace package.

**`packages/eslint-config/package.json`:**

```json
{
  "name": "@skyhub/eslint-config",
  "version": "0.1.0",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-react": "^7.35.0",
    "eslint-plugin-react-hooks": "^4.6.0"
  },
  "peerDependencies": {
    "eslint": "^8.0.0"
  }
}
```

**`packages/eslint-config/index.js`:**

```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier', // must be last — disables rules that conflict with Prettier
  ],
  rules: {
    // TypeScript
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

    // React
    'react/react-in-jsx-scope': 'off', // not needed with React 17+ JSX transform
    'react/prop-types': 'off', // we use TypeScript
    'react-hooks/exhaustive-deps': 'warn',

    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  settings: {
    react: { version: 'detect' },
  },
  ignorePatterns: ['node_modules/', 'dist/', '.next/', '.expo/', '*.config.js', '*.config.ts'],
}
```

### 2. Create shared Prettier config

**Root `prettier.config.js`:**

```js
module.exports = {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 120,
  tabWidth: 2,
  bracketSpacing: true,
  arrowParens: 'always',
}
```

### 3. Add ESLint configs to each workspace

**`apps/web/.eslintrc.js`:**

```js
module.exports = {
  extends: ['@skyhub/eslint-config'],
  env: { browser: true, node: true },
  rules: {
    // web-specific overrides if needed
  },
}
```

**`apps/mobile/.eslintrc.js`:**

```js
module.exports = {
  extends: ['@skyhub/eslint-config'],
  env: { 'react-native/react-native': true },
  rules: {
    // mobile-specific overrides if needed
  },
}
```

**`server/.eslintrc.js`:**

```js
module.exports = {
  extends: ['@skyhub/eslint-config'],
  env: { node: true },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'no-console': 'off', // server logging is fine
  },
}
```

### 4. Install ESLint + Prettier in root

```bash
npm install -D eslint prettier eslint-config-prettier --save-exact -w
```

Add lint scripts to each workspace's `package.json`:

- `apps/web/package.json`: add `"lint": "eslint src/ --ext .ts,.tsx --max-warnings 0"`
- `apps/mobile/package.json`: add `"lint": "eslint app/ src/ --ext .ts,.tsx --max-warnings 0"`
- `server/package.json`: add `"lint": "eslint src/ --ext .ts --max-warnings 0"`

**IMPORTANT:** For the initial run, use `--max-warnings 999` (or just `--max-warnings` with a high number) because existing code will have many warnings. The goal is to set up the tooling, not fix every existing file today. After infrastructure sprints are done, gradually lower the threshold.

### 5. Add Husky + lint-staged for pre-commit hooks

```bash
npm install -D husky lint-staged --save-exact -w
npx husky init
```

**`.husky/pre-commit`:**

```bash
npx lint-staged
```

**Root `package.json` — add:**

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix --max-warnings 50", "prettier --write"],
    "*.{js,json,md}": ["prettier --write"]
  }
}
```

### 6. Add `.nvmrc` at root

```
20
```

### 7. Add `.editorconfig` at root

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

### 8. Add VS Code workspace settings

**`.vscode/settings.json`:**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.workingDirectories": [
    { "directory": "apps/web", "changeProcessCWD": true },
    { "directory": "apps/mobile", "changeProcessCWD": true },
    { "directory": "server", "changeProcessCWD": true }
  ]
}
```

**`.vscode/extensions.json`:**

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "editorconfig.editorconfig"
  ]
}
```

## Acceptance Criteria

1. `npm run lint` at root triggers Turbo to lint all three workspaces
2. `npx prettier --check .` shows formatting status without errors on config files
3. Making a commit with a TypeScript file that has `var x = 1` triggers the pre-commit hook and auto-fixes to `const x = 1`
4. The `.editorconfig` and VS Code settings exist

## Self-Test

```bash
# Verify lint runs without crashing (warnings are OK, errors should be 0 or near 0)
cd apps/web && npx eslint src/ --ext .ts,.tsx 2>&1 | tail -5
cd ../../apps/mobile && npx eslint app/ --ext .ts,.tsx 2>&1 | tail -5
cd ../../server && npx eslint src/ --ext .ts 2>&1 | tail -5

# Verify prettier config is detected
cd ../.. && npx prettier --check "packages/ui/src/theme/colors.ts"

# Verify husky hook exists
cat .husky/pre-commit
```

Commit: `git commit -m "infra(sprint-1): eslint + prettier + husky + editorconfig"`

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# SPRINT 2 — Environment Management

# Estimated time: 30–45 minutes

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Context

Read `CLAUDE.md`, `server/src/index.ts`, and `server/src/db/connection.ts` before starting.

**Current state:** The server reads `MONGODB_URI` and `JWT_SECRET` from `process.env` with no validation. If `JWT_SECRET` is missing, it silently falls back to `'dev-secret-change-me'`. The client API hardcodes `http://localhost:3002` as the base URL. There is no `.env.example`, no env validation, and no way to switch between dev/staging/prod.

## Task

### 1. Create env validation package

Create `packages/env/` as a new workspace package.

**`packages/env/package.json`:**

```json
{
  "name": "@skyhub/env",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

**`packages/env/src/server.ts`:**

```ts
import { z } from 'zod'

const serverEnvSchema = z.object({
  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // Optional — ML API
  ML_API_URL: z.string().url().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let _serverEnv: ServerEnv | null = null

export function validateServerEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv

  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Invalid server environment variables:')
    for (const issue of result.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  _serverEnv = result.data
  return _serverEnv
}

export function getServerEnv(): ServerEnv {
  if (!_serverEnv) throw new Error('Call validateServerEnv() before getServerEnv()')
  return _serverEnv
}
```

**`packages/env/src/client.ts`:**

```ts
import { z } from 'zod'

const clientEnvSchema = z.object({
  API_URL: z.string().url().default('http://localhost:3001'),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

let _clientEnv: ClientEnv | null = null

export function validateClientEnv(raw: Record<string, string | undefined>): ClientEnv {
  if (_clientEnv) return _clientEnv

  const result = clientEnvSchema.safeParse(raw)
  if (!result.success) {
    console.error('❌ Invalid client environment variables:', result.error.issues)
    throw new Error('Invalid client env')
  }

  _clientEnv = result.data
  return _clientEnv
}

export function getClientEnv(): ClientEnv {
  if (!_clientEnv) throw new Error('Call validateClientEnv() before getClientEnv()')
  return _clientEnv
}
```

**`packages/env/src/index.ts`:**

```ts
export { validateServerEnv, getServerEnv, type ServerEnv } from './server'
export { validateClientEnv, getClientEnv, type ClientEnv } from './client'
```

### 2. Wire server to use validated env

**Edit `server/src/index.ts`:**

At the very top (line 1, before any other imports):

```ts
import { validateServerEnv, getServerEnv } from '@skyhub/env'
const env = validateServerEnv()
```

Then replace all `process.env.XXX` usages:

- `process.env.MONGODB_URI` → pass `env.MONGODB_URI` to `connectDB()`
- `process.env.JWT_SECRET || 'dev-secret-change-me'` → `env.JWT_SECRET`
- `Number(process.env.PORT) || 3001` → `env.PORT`
- CORS origin → `env.CORS_ORIGIN`

**Edit `server/src/db/connection.ts`:**

Change signature to accept URI as parameter instead of reading from process.env:

```ts
export async function connectDB(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri)
    console.log('✓ MongoDB connected:', mongoose.connection.name)
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err)
    process.exit(1)
  }
}
```

Then in `server/src/index.ts`, call: `await connectDB(env.MONGODB_URI)`

### 3. Wire mobile app to use validated env

**Edit `apps/mobile/app/(tabs)/_layout.tsx` (or wherever `setApiBaseUrl` is called):**

```ts
import { validateClientEnv } from '@skyhub/env'
import { setApiBaseUrl } from '@skyhub/api'

// Read from Expo's env system
const env = validateClientEnv({
  API_URL: process.env.EXPO_PUBLIC_API_URL,
})
setApiBaseUrl(env.API_URL)
```

### 4. Wire web app to use validated env

In the web app's root layout or provider, add:

```ts
import { validateClientEnv } from '@skyhub/env'
import { setApiBaseUrl } from '@skyhub/api'

const env = validateClientEnv({
  API_URL: process.env.NEXT_PUBLIC_API_URL,
})
setApiBaseUrl(env.API_URL)
```

### 5. Create .env files

**`server/.env`** (gitignored — developer creates locally):

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-here-must-be-at-least-32-characters-long
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
PORT=3001
NODE_ENV=development
CORS_ORIGIN=*
```

**`server/.env.example`** (committed — template):

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/horizon?retryWrites=true
JWT_SECRET=CHANGE_ME_must_be_at_least_32_characters_long
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
PORT=3001
NODE_ENV=development
CORS_ORIGIN=*
```

**`apps/mobile/.env`** (gitignored):

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

**`apps/web/.env.local`** (gitignored):

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 6. Update `.gitignore`

Add to root `.gitignore`:

```
.env
.env.local
.env.*.local
!.env.example
```

### 7. Add `@skyhub/env` to workspace dependencies

In `server/package.json`, `apps/mobile/package.json`, and `apps/web/package.json`, add:

```json
{
  "dependencies": {
    "@skyhub/env": "*"
  }
}
```

Then run `npm install` at root to link the workspace.

## Acceptance Criteria

1. Starting the server WITHOUT a `.env` file crashes immediately with a clear error listing which variables are missing
2. Starting the server with a `JWT_SECRET` shorter than 32 characters crashes with a validation error
3. Starting the server with a valid `.env` file works exactly as before
4. The mobile app reads `EXPO_PUBLIC_API_URL` and passes it to `setApiBaseUrl`
5. `.env` files are gitignored; `.env.example` is committed
6. No `process.env.XXX` remains in `server/src/index.ts` — all access goes through `getServerEnv()`

## Self-Test

```bash
# Test 1: Server crashes without env
cd server && unset MONGODB_URI && npx tsx src/index.ts 2>&1 | head -5
# Expected: "❌ Invalid server environment variables" and exit

# Test 2: Server starts with valid env
cd server && source .env && npx tsx src/index.ts 2>&1 | head -3
# Expected: "✓ MongoDB connected: horizon"

# Test 3: .env is gitignored
git status | grep ".env"
# Expected: nothing shown (files are ignored)

# Test 4: .env.example is tracked
git ls-files | grep ".env.example"
# Expected: server/.env.example
```

Commit: `git commit -m "infra(sprint-2): zod env validation + .env.example + gitignore"`

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# SPRINT 3 — Extract Screen Patterns into Component Library

# Estimated time: 3–4 hours

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Context

Read `.claude/skills/horizon-frontend/SKILL.md` and `CLAUDE.md` sections 1–7 before starting.

Read the theme token files: `packages/ui/src/theme/colors.ts`, `typography.ts`, `spacing.ts`, `shadows.ts`.

**Current state:** There are ~50 mobile screens in `apps/mobile/app/(tabs)/settings/` and several web component shells in `apps/web/src/components/`. They were all built individually, and each one rebuilds the same UI patterns from raw `<View>`, `<Text>`, `<Pressable>` primitives with inline styles. This means:

- Every list screen re-creates: back button + icon badge + title + count + add button + search bar + list
- Every detail screen re-creates: back button + tab bar + edit/save/delete toolbar + field rows
- Fonts are hardcoded as `{ fontSize: 20, fontWeight: '700' }` instead of using typography tokens
- Colors come from `palette.xxx` (good) but with raw inline styles repeated everywhere

**The goal:** Read the BEST existing screens, extract the repeated patterns into shared components in `packages/ui/src/components/`, then refactor the screens to use those shared components.

## Task

### Phase A — Pattern Discovery (READ ONLY — do not edit yet)

Read these 6 files completely. They are the reference screens — the ones that Bro considers correctly built:

1. `apps/mobile/app/(tabs)/settings/airports.tsx` — **list screen with SectionList and country grouping**
2. `apps/mobile/app/(tabs)/settings/carrier-codes.tsx` — **list screen with FlatList**
3. `apps/mobile/app/(tabs)/settings/airport-detail.tsx` — **detail screen with tabs + edit mode**
4. `apps/mobile/app/(tabs)/settings/carrier-code-detail.tsx` — **detail screen with field rows**
5. `apps/mobile/app/(tabs)/settings/activity-codes.tsx` — **list screen with grouped data**
6. `apps/mobile/app/(tabs)/settings/activity-code-detail.tsx` — **detail screen with complex forms**

After reading all 6, identify and document every repeated UI pattern. You WILL find at least these patterns (but look for more):

**Pattern 1: ListScreenHeader**
Every list screen has an identical header block:

- Back chevron (Pressable with ChevronLeft icon, accent color)
- Icon badge (36×36 rounded-lg container with tinted accent background, domain icon inside)
- Title text (20px, bold)
- Subtitle text (15px, secondary — shows count like "42 airports" or "12 / 42 airports" when filtered)
- Add button (accent background, Plus icon + "Add" text, rounded-lg)

**Pattern 2: SearchBar**
Every list screen has a search input:

- Card-colored background with border
- Search icon (16px, tertiary color) on the left
- TextInput filling remaining space
- Sometimes a clear button on the right

**Pattern 3: DetailScreenHeader**
Every detail screen has:

- Back chevron
- Icon badge (same as list header but possibly different icon)
- Title (entity name or code)
- Subtitle (entity type or secondary info)
- Action buttons on the right (Edit/Save/Cancel/Delete)

**Pattern 4: TabBar (detail screens)**
Horizontal scrollable tabs:

- Each tab has an icon + label
- Active tab has accent-colored text + bottom border
- Inactive tabs have secondary text

**Pattern 5: FieldRow**
Detail screens display data in rows:

- Label on the left (12px, secondary, sometimes uppercase)
- Value on the right or below (14–15px, primary)
- Sometimes editable (switches to TextInput when in edit mode)
- Optional icon/badge on the value side

**Pattern 6: SectionGroup**
Both list and detail screens group content:

- Section header with title text (sometimes collapsible with chevron)
- Items within the section

**Pattern 7: ActionToolbar**
Detail screens have a toolbar (usually at bottom or in header):

- Edit button (pencil icon)
- Save button (check icon, accent color, only visible in edit mode)
- Cancel button (X icon, only in edit mode)
- Delete button (trash icon, red, sometimes in a menu)

**Pattern 8: EmptyState**
Shown when list has no items:

- Center-aligned icon
- Title text
- Description text
- Optional action button

**Pattern 9: ListItemRow**
Each item in a list:

- Left section: icon or avatar
- Middle section: title + subtitle + optional badges
- Right section: chevron or status indicator
- Pressable with hover/active state
- Border-bottom divider

### Phase B — Create the Shared Components

For EVERY pattern identified in Phase A, create a component in `packages/ui/src/components/`. The component must:

1. **Match the EXACT visual output** of the best-looking existing screen. Do not redesign — extract.
2. **Use theme tokens** from `packages/ui/src/theme/` for ALL colors, fonts, spacing, shadows.
3. **Accept props** for the variable parts (icon, title, count, onPress, etc.)
4. **Work in both light and dark mode.**
5. **Stay under 200 lines** (these are UI primitives, not features).
6. **Use `useAppTheme()` or `useTheme()`** — whichever the existing screens use. Check the import path.

Here's what to create (minimum — add more if you find additional patterns):

#### B1. `<ListScreenHeader>`

```tsx
// packages/ui/src/components/ListScreenHeader.tsx
interface ListScreenHeaderProps {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
  title: string
  count: number
  filteredCount?: number // if search is active
  countLabel?: string // "airports" | "carriers" | "codes"
  onBack: () => void
  onAdd?: () => void
  addLabel?: string // "Add" by default
  rightAction?: React.ReactNode // custom right side instead of Add button
}
```

Extract the exact layout from `carrier-codes.tsx` lines ~60-80 (the header block with back button, icon badge, title, count, add button). Use `accentTint()` for the icon background.

#### B2. `<SearchBar>`

```tsx
interface SearchBarProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  onClear?: () => void
}
```

Extract from the search input pattern repeated in every list screen.

#### B3. `<DetailScreenHeader>`

```tsx
interface DetailScreenHeaderProps {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
  title: string
  subtitle?: string
  onBack: () => void
  editing?: boolean
  onEdit?: () => void
  onSave?: () => void
  onCancel?: () => void
  onDelete?: () => void
  saving?: boolean
}
```

Extract from `airport-detail.tsx` or `carrier-code-detail.tsx` header area.

#### B4. `<TabBar>`

```tsx
interface Tab {
  key: string
  label: string
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (key: string) => void
}
```

Extract from `airport-detail.tsx` TABS pattern.

#### B5. `<FieldRow>`

```tsx
interface FieldRowProps {
  label: string
  value?: string | number | boolean | null
  editing?: boolean
  onChangeText?: (text: string) => void
  placeholder?: string
  type?: 'text' | 'number' | 'toggle' | 'select' | 'readonly'
  options?: { label: string; value: string }[] // for select type
  suffix?: string // e.g. "ft", "min", "kg"
  icon?: React.ReactNode
}
```

This is critical — every detail screen has dozens of these. Extract from `airport-detail.tsx` or wherever the pattern is cleanest. In view mode, show label + value. In edit mode, show label + TextInput (or Toggle for boolean fields).

#### B6. `<SectionGroupHeader>`

```tsx
interface SectionGroupHeaderProps {
  title: string
  count?: number
  collapsible?: boolean
  collapsed?: boolean
  onToggle?: () => void
  rightAction?: React.ReactNode
}
```

Extract from the SectionList header pattern in `airports.tsx`.

#### B7. `<ListItemRow>`

```tsx
interface ListItemRowProps {
  title: string
  subtitle?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  badges?: React.ReactNode
  onPress?: () => void
  showChevron?: boolean
  borderBottom?: boolean
}
```

Extract from the renderItem pattern that repeats across all list screens.

#### B8. `<Text>` with variant prop

This is the foundation — every other component uses it internally.

```tsx
type TextVariant =
  | 'pageTitle' // 20px, weight 600
  | 'sectionHeading' // 15px, weight 700
  | 'panelHeader' // 15px, weight 500
  | 'body' // 14px, weight 400
  | 'secondary' // 13px, weight 400, secondary color
  | 'fieldLabel' // 12px, weight 600, uppercase
  | 'caption' // 12px, weight 400, secondary color
  | 'badge' // 11px, weight 600
  | 'cardTitle' // 13px, weight 500
  | 'cardDescription' // 11px, weight 400, secondary color
  | 'stat' // 18px, weight 600

interface TextProps extends RNTextProps {
  variant?: TextVariant
  muted?: boolean // force secondary color regardless of variant
}
```

Map each variant to the typography tokens in `packages/ui/src/theme/typography.ts`. Auto-apply `palette.textSecondary` for variants that are inherently muted (secondary, caption, cardDescription).

#### B9. `<Divider>`

Simple horizontal or vertical line using `palette.border`.

#### B10. `<TextInput>` (form input, not search)

Wrap RN TextInput with label, error state, hint text. Use theme tokens for all colors. Height 40px, radius from spacing tokens.

### Phase C — Refactor Screens to Use Shared Components

After creating the components, refactor EXACTLY 4 screens to prove the pattern works:

1. **`airports.tsx`** — replace header block with `<ListScreenHeader>`, search with `<SearchBar>`, section headers with `<SectionGroupHeader>`, row items with `<ListItemRow>`
2. **`carrier-codes.tsx`** — same pattern
3. **`airport-detail.tsx`** — replace header with `<DetailScreenHeader>`, tabs with `<TabBar>`, field rows with `<FieldRow>`
4. **`carrier-code-detail.tsx`** — same pattern

**CRITICAL:** After refactoring, each screen must look EXACTLY the same as before. Pixel-identical. No visual changes. The only change is in the code — shared components instead of inline JSX.

**Do NOT refactor all 50 screens.** Just these 4 as proof-of-concept. Future screens will use the components from the start. Existing screens will be migrated gradually.

### Phase D — Update exports

Export ALL new components from `packages/ui/src/index.ts`. Also export the `<Text>` component — this is the single most important primitive because it eliminates hardcoded font sizes everywhere.

### Phase E — Document the component catalog

Create `packages/ui/COMPONENTS.md`:

```markdown
# SkyHub UI Components

## Screen Scaffolding

- `<ListScreenHeader>` — header for list screens (back + icon + title + count + add)
- `<DetailScreenHeader>` — header for detail screens (back + icon + title + edit/save/delete)
- `<SearchBar>` — search input for list filtering
- `<TabBar>` — horizontal tab switcher for detail screens
- `<ScreenContainer>` — root wrapper with safe area + theme background

## Data Display

- `<FieldRow>` — label + value row, supports edit mode
- `<ListItemRow>` — pressable list item with icon/title/subtitle/chevron
- `<SectionGroupHeader>` — collapsible section header with title + count
- `<StatusChip>` — colored status indicator
- `<Badge>` — small label pill

## Primitives

- `<Text variant="...">` — themed text with typography variants
- `<Card>` — themed container with shadow
- `<Button>` — primary/outline/ghost/destructive
- `<TextInput>` — form input with label + error
- `<SearchInput>` — search-specific input
- `<Divider>` — separator line
- `<Icon>` — Lucide icon wrapper
- `<EmptyState>` — no-data placeholder

## Usage

When building a new list screen:
\`\`\`tsx
<ScreenContainer>
<ListScreenHeader icon={Building2} title="Airports" count={airports.length} onBack={router.back} onAdd={...} />
<SearchBar value={search} onChangeText={setSearch} placeholder="Search..." />
<FlatList data={filtered} renderItem={({ item }) => (
<ListItemRow title={item.name} subtitle={item.icaoCode} onPress={...} showChevron />
)} />
</ScreenContainer>
\`\`\`

When building a new detail screen:
\`\`\`tsx
<ScreenContainer>
<DetailScreenHeader icon={Building2} title={airport.name} onBack={router.back} editing={editing} onEdit={...} onSave={...} />
<TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
<ScrollView>
<FieldRow label="ICAO Code" value={airport.icaoCode} editing={editing} onChangeText={...} />
<FieldRow label="Active" value={airport.isActive} type="toggle" editing={editing} />
</ScrollView>
</ScreenContainer>
\`\`\`
```

## Acceptance Criteria

1. At least 10 shared components created in `packages/ui/src/components/`
2. `airports.tsx` refactored to use shared components — looks identical to before
3. `carrier-codes.tsx` refactored — looks identical
4. `airport-detail.tsx` refactored — looks identical
5. `carrier-code-detail.tsx` refactored — looks identical
6. ALL components exported from `@skyhub/ui`
7. `packages/ui/COMPONENTS.md` documents the catalog with usage examples
8. Zero hardcoded `fontSize: XX` in the 4 refactored screen files — all text uses `<Text variant="...">`
9. Both light and dark mode look correct on all 4 refactored screens

## Self-Test

```bash
# Test 1: No hardcoded font sizes in refactored screens
grep -n "fontSize:" apps/mobile/app/\(tabs\)/settings/airports.tsx | wc -l
# Expected: 0 (all text uses <Text variant="...">)

grep -n "fontSize:" apps/mobile/app/\(tabs\)/settings/carrier-codes.tsx | wc -l
# Expected: 0

# Test 2: Components are exported
node -e "const ui = require('@skyhub/ui'); console.log(Object.keys(ui).filter(k => /^[A-Z]/.test(k)).sort().join(', '))"
# Expected: Badge, Button, Card, DetailScreenHeader, Divider, FieldRow, ... (all components)

# Test 3: Visual verification
# Open airports list, carrier codes list, airport detail, carrier code detail
# Toggle dark mode
# Compare against the BEFORE state — should be pixel-identical
```

Commit: `git commit -m "infra(sprint-3): extract screen patterns into shared component library"`

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# SPRINT 4 — Authentication Flow

# Estimated time: 2–3 hours

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Context

Read `CLAUDE.md`, `server/src/index.ts`, `server/src/models/User.ts`, `server/src/routes/users.ts`, and `packages/env/src/server.ts` before starting.

**Current state:**

- `@fastify/jwt` is already registered in `server/src/index.ts` with the JWT secret
- The `User` model already has `security.passwordHash`, `role`, `operatorId`, `profile.email`, and `sessions[]`
- The `seed-user.ts` creates an admin user with `_id: 'skyhub-admin-001'` and empty `passwordHash`
- ALL existing routes use hardcoded user IDs like `(req.query as any).userId || 'skyhub-admin-001'`
- ALL existing routes use hardcoded operator IDs like `operatorId` query params with no validation
- There is no login endpoint, no token refresh, no auth middleware
- The mobile app has no login screen and no token storage

**What already exists that we build on:**

- JWT plugin registered ✓
- User model with password and role fields ✓
- Environment validation with JWT_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY ✓
- Gluestack form-control, input, button primitives ✓
- Text, TextInput, Button, Card components from Sprint 3 ✓

## Task

### Phase A — Server Auth Routes

#### A1. Install bcrypt

```bash
cd server && npm install bcryptjs && npm install -D @types/bcryptjs
```

#### A2. Create auth route file

**`server/src/routes/auth.ts`:**

```ts
import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { getServerEnv } from '@skyhub/env'

export async function authRoutes(app: FastifyInstance) {
  const env = getServerEnv()

  // ── POST /auth/login ──
  app.post('/auth/login', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string }

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' })
    }

    // Find user by email (nested in profile.email)
    const user = await User.findOne({ 'profile.email': email.toLowerCase().trim() }).lean()
    if (!user) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }

    // Check password
    const passwordHash = (user as any).security?.passwordHash
    if (!passwordHash) {
      return reply.code(401).send({ error: 'Account has no password set. Contact administrator.' })
    }

    const valid = await bcrypt.compare(password, passwordHash)
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }

    if (!(user as any).isActive) {
      return reply.code(403).send({ error: 'Account is deactivated' })
    }

    // Generate tokens
    const payload = {
      userId: (user as any)._id,
      operatorId: (user as any).operatorId,
      role: (user as any).role,
    }

    const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRY })
    const refreshToken = app.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: env.JWT_REFRESH_EXPIRY })

    // Update last login
    await User.updateOne(
      { _id: (user as any)._id },
      { $set: { lastLoginUtc: new Date().toISOString(), updatedAt: new Date().toISOString() } },
    )

    const { security, ...safeUser } = user as any
    return {
      accessToken,
      refreshToken,
      user: safeUser,
    }
  })

  // ── POST /auth/refresh ──
  app.post('/auth/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string }

    if (!refreshToken) {
      return reply.code(400).send({ error: 'Refresh token is required' })
    }

    try {
      const decoded = app.jwt.verify<{ userId: string; operatorId: string; role: string; type: string }>(refreshToken)
      if (decoded.type !== 'refresh') {
        return reply.code(401).send({ error: 'Invalid token type' })
      }

      // Verify user still exists and is active
      const user = await User.findById(decoded.userId).lean()
      if (!user || !(user as any).isActive) {
        return reply.code(401).send({ error: 'User not found or deactivated' })
      }

      const payload = {
        userId: decoded.userId,
        operatorId: decoded.operatorId,
        role: decoded.role,
      }

      const newAccessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRY })
      const newRefreshToken = app.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: env.JWT_REFRESH_EXPIRY })

      return { accessToken: newAccessToken, refreshToken: newRefreshToken }
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' })
    }
  })

  // ── POST /auth/set-password — admin or first-time setup ──
  app.post('/auth/set-password', async (req, reply) => {
    const { userId, password } = req.body as { userId: string; password: string }

    if (!userId || !password || password.length < 8) {
      return reply.code(400).send({ error: 'userId and password (min 8 chars) required' })
    }

    const hash = await bcrypt.hash(password, 12)
    const result = await User.updateOne(
      { _id: userId },
      {
        $set: {
          'security.passwordHash': hash,
          'security.lastPasswordChange': new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    )

    if (result.matchedCount === 0) {
      return reply.code(404).send({ error: 'User not found' })
    }

    return { success: true }
  })
}
```

#### A3. Create auth middleware

**`server/src/middleware/authenticate.ts`:**

```ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

// Extend FastifyRequest to include auth info
declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    operatorId: string
    userRole: string
  }
}

export function registerAuthMiddleware(app: FastifyInstance) {
  // Decorate request with auth fields
  app.decorateRequest('userId', '')
  app.decorateRequest('operatorId', '')
  app.decorateRequest('userRole', '')

  // Hook that runs on every request EXCEPT auth routes and health check
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const publicPaths = ['/health', '/auth/login', '/auth/refresh', '/auth/set-password']

    if (publicPaths.some((p) => request.url.startsWith(p))) {
      return // skip auth for public routes
    }

    try {
      const decoded = await request.jwtVerify<{
        userId: string
        operatorId: string
        role: string
      }>()

      request.userId = decoded.userId
      request.operatorId = decoded.operatorId
      request.userRole = decoded.role
    } catch {
      return reply.code(401).send({ error: 'Unauthorized — invalid or missing token' })
    }
  })
}
```

#### A4. Register auth routes and middleware in server/src/index.ts

Add these imports at the top:

```ts
import { authRoutes } from './routes/auth.js'
import { registerAuthMiddleware } from './middleware/authenticate.js'
```

After the JWT plugin registration and before routes, add:

```ts
registerAuthMiddleware(app)
```

In the routes section, add:

```ts
await app.register(authRoutes)
```

#### A5. Retrofit existing routes to use request.operatorId

This is the critical step. In EVERY existing route file under `server/src/routes/`, replace the pattern:

```ts
// OLD — hardcoded
const operatorId = (req.query as any).operatorId || 'skyhub'
```

With:

```ts
// NEW — from JWT
const operatorId = req.operatorId
```

And replace:

```ts
// OLD — hardcoded user
const userId = (req.query as any).userId || 'skyhub-admin-001'
```

With:

```ts
// NEW — from JWT
const userId = req.userId
```

**Do this in ALL route files:** `flights.ts`, `reference.ts`, `users.ts`, `scheduled-flights.ts`, `ssim.ts`, `scenarios.ts`, `rotations.ts`, `gantt.ts`, `slots.ts`, `codeshare.ts`, `charter.ts`, `fdtl.ts`, `schedule-messages.ts`, `city-pairs.ts`.

**IMPORTANT:** For the `users.ts` routes, the `getMe` endpoint should use `req.userId` instead of a query parameter:

```ts
app.get('/users/me', async (req, reply) => {
  const user = await User.findById(req.userId).lean()
  // ...
})
```

#### A6. Update seed-user.ts to set a password

Edit `server/src/seed-user.ts` to hash a default development password:

```ts
import bcrypt from 'bcryptjs'

// In the User.create call, set:
security: {
  passwordHash: await bcrypt.hash('SkyHub2026!', 12),
  // ... rest stays the same
}
```

### Phase B — Client Auth Store

#### B1. Install MMKV for secure token storage

```bash
cd apps/mobile && npx expo install react-native-mmkv
```

#### B2. Create auth store

**`packages/ui/src/stores/useAuthStore.ts`:**

```ts
import { create } from 'zustand'

interface AuthUser {
  _id: string
  operatorId: string
  role: string
  profile: {
    firstName: string
    lastName: string
    email: string
    avatarUrl: string
  }
}

interface AuthState {
  // State
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  setTokens: (access: string, refresh: string) => void
  setUser: (user: AuthUser) => void
  logout: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true, // starts true — checking stored tokens on app boot

  setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh, isAuthenticated: true }),

  setUser: (user) => set({ user }),

  logout: () =>
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  setLoading: (loading) => set({ isLoading: loading }),
}))
```

Export from `packages/ui/src/index.ts`:

```ts
export { useAuthStore } from './stores/useAuthStore'
```

#### B3. Create token persistence helper (mobile-specific)

**`apps/mobile/src/lib/token-storage.ts`:**

```ts
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV({ id: 'skyhub-auth' })

const KEYS = {
  ACCESS_TOKEN: 'auth.accessToken',
  REFRESH_TOKEN: 'auth.refreshToken',
} as const

export const tokenStorage = {
  getAccessToken: () => storage.getString(KEYS.ACCESS_TOKEN) ?? null,
  getRefreshToken: () => storage.getString(KEYS.REFRESH_TOKEN) ?? null,

  setTokens: (access: string, refresh: string) => {
    storage.set(KEYS.ACCESS_TOKEN, access)
    storage.set(KEYS.REFRESH_TOKEN, refresh)
  },

  clearTokens: () => {
    storage.delete(KEYS.ACCESS_TOKEN)
    storage.delete(KEYS.REFRESH_TOKEN)
  },
}
```

#### B4. Update API client to attach JWT

**Edit `packages/api/src/client.ts`:**

Add a token getter callback and auto-refresh logic:

```ts
let _getAccessToken: (() => string | null) | null = null
let _onTokenRefresh: ((access: string, refresh: string) => void) | null = null
let _onAuthFailure: (() => void) | null = null

export function setAuthCallbacks(callbacks: {
  getAccessToken: () => string | null
  onTokenRefresh: (access: string, refresh: string) => void
  onAuthFailure: () => void
}) {
  _getAccessToken = callbacks.getAccessToken
  _onTokenRefresh = callbacks.onTokenRefresh
  _onAuthFailure = callbacks.onAuthFailure
}
```

Then in the `request()` function, add the Authorization header:

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) }
  if (init?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'

  // Attach JWT if available
  const token = _getAccessToken?.()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${_baseUrl}${path}`, { ...init, headers })

  // Handle 401 — try refresh
  if (res.status === 401 && _onAuthFailure) {
    _onAuthFailure()
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }

  return res.json()
}
```

Also add login and refresh to the `api` object:

```ts
// At the top of the api object
login: (email: string, password: string) =>
  request<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

refreshToken: (refreshToken: string) =>
  request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  }),

setPassword: (userId: string, password: string) =>
  request<{ success: boolean }>('/auth/set-password', {
    method: 'POST',
    body: JSON.stringify({ userId, password }),
  }),
```

Export `setAuthCallbacks` from `packages/api/src/index.ts`.

#### B5. Create login screen (mobile)

**`apps/mobile/app/login.tsx`:**

Create a simple login screen using the Sprint 3 components: `<Card>`, `<Text>`, `<TextInput>`, `<Button>`. Fields: email, password. On submit, call `api.login()`, store tokens with `tokenStorage.setTokens()`, update `useAuthStore`, and navigate to the main tabs.

Design rules:

- Center the card vertically
- SkyHub logo or app name at top (use `<Text variant="pageTitle">SkyHub</Text>`)
- Email and password fields using `<TextInput>`
- "Sign In" primary button using `<Button variant="primary">`
- Error message shown in red below the form if login fails
- Loading spinner on button during request
- Background uses `palette.background`

#### B6. Add auth guard to mobile navigation

**Edit `apps/mobile/app/_layout.tsx`:**

At the root layout level, check `useAuthStore().isAuthenticated`. If false, render the login screen. If true, render the tab navigator. On app boot, check `tokenStorage.getAccessToken()` — if present, try `api.refreshToken()` to validate it. If valid, set the store and proceed. If expired, show login.

```tsx
// Pseudocode for _layout.tsx
const { isAuthenticated, isLoading } = useAuthStore()

// On mount: check stored tokens
useEffect(() => {
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

// Wire up auth callbacks
useEffect(() => {
  setAuthCallbacks({
    getAccessToken: () => useAuthStore.getState().accessToken,
    onTokenRefresh: (a, r) => {
      tokenStorage.setTokens(a, r)
      useAuthStore.getState().setTokens(a, r)
    },
    onAuthFailure: () => {
      tokenStorage.clearTokens()
      useAuthStore.getState().logout()
    },
  })
}, [])

if (isLoading) return <SplashScreen />
if (!isAuthenticated) return <LoginScreen />
return <TabNavigator />
```

#### B7. Wire web app auth (basic)

For the web app (`apps/web/`), add a similar pattern but using `localStorage` for token storage (acceptable for web — MMKV is mobile-only). Create a simple `apps/web/src/lib/auth-provider.tsx` that wraps the app and handles the same flow.

### Phase C — Run seed with password

```bash
cd server
# Re-run seed to update admin user with password hash
npx tsx src/seed-user.ts
```

If the user already exists and you can't re-create, use the set-password endpoint manually after the server starts:

```bash
curl -X POST http://localhost:3001/auth/set-password \
  -H "Content-Type: application/json" \
  -d '{"userId":"skyhub-admin-001","password":"SkyHub2026!"}'
```

## Acceptance Criteria

1. `POST /auth/login` with `{"email":"admin@skyhub.aero","password":"SkyHub2026!"}` returns `{ accessToken, refreshToken, user }`
2. `POST /auth/refresh` with a valid refresh token returns new token pair
3. ALL existing API endpoints return 401 when called without a Bearer token
4. ALL existing API endpoints work correctly when called WITH a valid Bearer token
5. `request.operatorId` is populated from the JWT on every authenticated request
6. The mobile app shows a login screen on first launch
7. After successful login, the app navigates to the main tabs
8. Closing and reopening the app auto-logs-in using the stored refresh token
9. No `getOperatorId()` or `userId || 'skyhub-admin-001'` patterns remain in server route files

## Self-Test

```bash
# Test 1: Login
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skyhub.aero","password":"SkyHub2026!"}' | jq '.accessToken'
# Expected: a JWT string

# Test 2: Authenticated request
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@skyhub.aero","password":"SkyHub2026!"}' | jq -r '.accessToken')

curl -s http://localhost:3001/airports \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
# Expected: number of airports

# Test 3: Unauthenticated request blocked
curl -s http://localhost:3001/airports
# Expected: {"error":"Unauthorized — invalid or missing token"}

# Test 4: No hardcoded operator IDs remain
grep -rn "skyhub-admin-001\|operatorId.*||.*'skyhub'" server/src/routes/ | wc -l
# Expected: 0
```

Commit: `git commit -m "infra(sprint-4): JWT auth + login screen + auth middleware + operator ID retrofit"`

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# SPRINT 5 — API Client & React Query Data Layer

# Estimated time: 1–2 hours

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Context

Read `packages/api/src/client.ts` before starting.

**Current state:** The `@skyhub/api` package has a `request()` function with the JWT interceptor from Sprint 4. The `api` object has methods for every endpoint. But there is no React Query layer — every screen makes raw `api.xxx()` calls and manages loading/error state manually.

**What's needed:** A React Query setup that wraps the existing API methods into hooks with caching, auto-refetching, and optimistic updates.

## Task

### 1. Install React Query in both apps

```bash
cd apps/mobile && npm install @tanstack/react-query
cd ../web && npm install @tanstack/react-query
```

### 2. Create query key factory

**`packages/api/src/query-keys.ts`:**

```ts
export const queryKeys = {
  // Reference data — rarely changes, long staleTime
  airports: {
    all: ['airports'] as const,
    detail: (id: string) => ['airports', id] as const,
  },
  aircraftTypes: {
    all: ['aircraftTypes'] as const,
    detail: (id: string) => ['aircraftTypes', id] as const,
  },
  aircraftRegistrations: {
    all: ['aircraftRegistrations'] as const,
    detail: (id: string) => ['aircraftRegistrations', id] as const,
  },
  countries: {
    all: ['countries'] as const,
  },
  delayCodes: {
    all: ['delayCodes'] as const,
  },
  activityCodes: {
    all: ['activityCodes'] as const,
  },
  crewPositions: {
    all: ['crewPositions'] as const,
  },
  crewGroups: {
    all: ['crewGroups'] as const,
  },
  dutyPatterns: {
    all: ['dutyPatterns'] as const,
  },
  cabinClasses: {
    all: ['cabinClasses'] as const,
  },
  lopaConfigs: {
    all: ['lopaConfigs'] as const,
    byType: (icao: string) => ['lopaConfigs', icao] as const,
  },
  carrierCodes: {
    all: ['carrierCodes'] as const,
  },
  operators: {
    all: ['operators'] as const,
    detail: (id: string) => ['operators', id] as const,
  },

  // Operational data — changes frequently, short staleTime
  flights: {
    all: ['flights'] as const,
    byDate: (from: string, to: string) => ['flights', from, to] as const,
    detail: (id: string) => ['flights', id] as const,
  },
  scheduledFlights: {
    all: ['scheduledFlights'] as const,
    byParams: (params: Record<string, string>) => ['scheduledFlights', params] as const,
  },
  scenarios: {
    all: ['scenarios'] as const,
  },

  // User data
  me: ['me'] as const,

  // FDTL
  fdtl: {
    frameworks: ['fdtl', 'frameworks'] as const,
    scheme: (operatorId: string) => ['fdtl', 'scheme', operatorId] as const,
    rules: (operatorId: string) => ['fdtl', 'rules', operatorId] as const,
    tables: (operatorId: string) => ['fdtl', 'tables', operatorId] as const,
  },

  // Slots
  slots: {
    airports: ['slots', 'airports'] as const,
    series: (airport: string, season: string) => ['slots', 'series', airport, season] as const,
    stats: (airport: string, season: string) => ['slots', 'stats', airport, season] as const,
  },
} as const
```

### 3. Create React Query hooks

**`packages/api/src/hooks.ts`:**

```ts
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { api } from './client'
import { queryKeys } from './query-keys'
import type { AirportRef, AircraftTypeRef, AircraftRegistrationRef, ScheduledFlightRef } from './client'

// ── Stale time constants ──
const REFERENCE_STALE = 5 * 60 * 1000 // 5 min — airports, aircraft types rarely change
const OPERATIONAL_STALE = 30 * 1000 // 30 sec — flights, schedules change often
const USER_STALE = 60 * 1000 // 1 min — user data

// ── Reference data hooks ──

export function useAirports(params?: Parameters<typeof api.getAirports>[0]) {
  return useQuery({
    queryKey: queryKeys.airports.all,
    queryFn: () => api.getAirports(params),
    staleTime: REFERENCE_STALE,
  })
}

export function useAirport(id: string) {
  return useQuery({
    queryKey: queryKeys.airports.detail(id),
    queryFn: () => api.getAirport(id),
    enabled: !!id,
    staleTime: REFERENCE_STALE,
  })
}

export function useAircraftTypes() {
  return useQuery({
    queryKey: queryKeys.aircraftTypes.all,
    queryFn: () => api.getAircraftTypes(),
    staleTime: REFERENCE_STALE,
  })
}

export function useAircraftRegistrations() {
  return useQuery({
    queryKey: queryKeys.aircraftRegistrations.all,
    queryFn: () => api.getAircraftRegistrations(),
    staleTime: REFERENCE_STALE,
  })
}

export function useCountries() {
  return useQuery({
    queryKey: queryKeys.countries.all,
    queryFn: () => api.getCountries(),
    staleTime: REFERENCE_STALE,
  })
}

export function useDelayCodes() {
  return useQuery({
    queryKey: queryKeys.delayCodes.all,
    queryFn: () => api.getDelayCodes(),
    staleTime: REFERENCE_STALE,
  })
}

export function useOperators() {
  return useQuery({
    queryKey: queryKeys.operators.all,
    queryFn: () => api.getOperators(),
    staleTime: REFERENCE_STALE,
  })
}

// ── User hooks ──

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.getMe(),
    staleTime: USER_STALE,
  })
}

// ── Operational data hooks ──

export function useScheduledFlights(params: Parameters<typeof api.getScheduledFlights>[0] = {}) {
  return useQuery({
    queryKey: queryKeys.scheduledFlights.byParams(params as Record<string, string>),
    queryFn: () => api.getScheduledFlights(params),
    staleTime: OPERATIONAL_STALE,
  })
}

export function useScenarios(params: Parameters<typeof api.getScenarios>[0] = {}) {
  return useQuery({
    queryKey: queryKeys.scenarios.all,
    queryFn: () => api.getScenarios(params),
    staleTime: OPERATIONAL_STALE,
  })
}

// ── Mutation hooks (examples — add more as needed) ──

export function useCreateAirport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<AirportRef>) => api.createAirport(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.airports.all }),
  })
}

export function useUpdateAirport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AirportRef> }) => api.updateAirport(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.airports.all })
      qc.invalidateQueries({ queryKey: queryKeys.airports.detail(id) })
    },
  })
}

export function useDeleteAirport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteAirport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.airports.all }),
  })
}
```

### 4. Export hooks and query keys from package

**Edit `packages/api/src/index.ts`** — add:

```ts
export { queryKeys } from './query-keys'
export * from './hooks'
export { setAuthCallbacks } from './client'
```

### 5. Create QueryClient provider

**`packages/ui/src/providers/QueryProvider.tsx`:**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      gcTime: 10 * 60 * 1000, // 10 min garbage collection
    },
    mutations: {
      retry: 0,
    },
  },
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

### 6. Wrap both apps with QueryProvider

**`apps/mobile/app/_layout.tsx`** — wrap the root component with `<QueryProvider>`.

**`apps/web/src/app/layout.tsx`** — wrap the root component with `<QueryProvider>`.

### 7. Update existing screens to use hooks (one example)

Pick ONE existing screen that currently calls `api.getAirports()` directly. Refactor it to use `useAirports()` instead. This serves as the pattern for all future refactoring. Do NOT refactor all screens now — just one as a proof-of-concept.

The pattern:

```tsx
// BEFORE
const [airports, setAirports] = useState([])
const [loading, setLoading] = useState(true)
useEffect(() => {
  api
    .getAirports()
    .then(setAirports)
    .finally(() => setLoading(false))
}, [])

// AFTER
const { data: airports = [], isLoading: loading } = useAirports()
```

## Acceptance Criteria

1. `@tanstack/react-query` is installed in both apps
2. `QueryProvider` wraps both mobile and web root layouts
3. `queryKeys` factory exists with keys for all major data types
4. At least 5 query hooks and 3 mutation hooks exist in `packages/api/src/hooks.ts`
5. All hooks are exported from `@skyhub/api`
6. At least one existing screen is refactored to use a query hook instead of raw `api.xxx()` + useState
7. The refactored screen still works correctly (data loads, displays, no regressions)

## Self-Test

```bash
# Verify imports resolve
cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "query" | head -5
# Expected: no errors related to @tanstack/react-query

# Verify the hook works in a component
# Open the refactored screen in the app — data should load with loading state
```

Commit: `git commit -m "infra(sprint-5): react-query + query keys + hooks + provider"`

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# SPRINT 6 — Navigation Shell & Theme Wiring

# Estimated time: 1–2 hours

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Context

Read `CLAUDE.md` section on navigation, `packages/ui/src/navigation/navData.ts`, and `apps/mobile/app/(tabs)/_layout.tsx` before starting.

**Current state:** The mobile app has a 6-tab Expo Router layout. It has screens inside each tab. But:

- The tab bar is not themed (doesn't use palette colors)
- Stack headers inside tabs are not themed
- There's no consistent screen container pattern (some screens set their own background, some don't)
- No deep linking configuration
- The web app has a BottomDock but no consistent layout wrapper

**What's needed:** A polished navigation shell where tabs, headers, and screen backgrounds all follow the theme system automatically.

## Task

### 1. Theme the mobile tab bar

**Edit `apps/mobile/app/(tabs)/_layout.tsx`:**

The tab bar should use theme colors:

```tsx
import { useTheme } from '@skyhub/ui'

// Inside the Tabs component:
const { palette, accentColor, isDark } = useTheme()

<Tabs
  screenOptions={{
    tabBarActiveTintColor: accentColor,
    tabBarInactiveTintColor: palette.textSecondary,
    tabBarStyle: {
      backgroundColor: palette.background,
      borderTopColor: palette.border,
      borderTopWidth: 0.5,
      height: 56,
      paddingBottom: 4,
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600',
    },
    headerStyle: {
      backgroundColor: palette.background,
      shadowColor: 'transparent',
      elevation: 0,
    },
    headerTintColor: palette.text,
    headerTitleStyle: {
      fontSize: 17,
      fontWeight: '600',
    },
    contentStyle: {
      backgroundColor: palette.background,
    },
  }}
>
```

### 2. Create a ScreenContainer component

**`packages/ui/src/components/ScreenContainer.tsx`:**

```tsx
import { View, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../hooks/useTheme'
import { spacing } from '../theme/spacing'

interface ScreenContainerProps extends ViewProps {
  /** Whether to add safe area padding at bottom (default: true) */
  safeBottom?: boolean
  /** Whether to add horizontal padding (default: true) */
  padded?: boolean
  /** Whether to add top padding (default: true) */
  padTop?: boolean
}

export function ScreenContainer({
  safeBottom = true,
  padded = true,
  padTop = true,
  style,
  children,
  ...props
}: ScreenContainerProps) {
  const { palette } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: palette.background,
          paddingHorizontal: padded ? spacing.pagePaddingX : 0,
          paddingTop: padTop ? spacing.pagePaddingTop : 0,
          paddingBottom: safeBottom ? Math.max(insets.bottom, spacing.pagePaddingBottom) : 0,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  )
}
```

Export from `@skyhub/ui`.

### 3. Theme all stack navigators inside tabs

Each tab has a `_layout.tsx` with a `<Stack>` navigator. Theme them all consistently:

```tsx
import { Stack } from 'expo-router'
import { useTheme } from '@skyhub/ui'

export default function NetworkLayout() {
  const { palette } = useTheme()
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.background },
      }}
    />
  )
}
```

Apply this pattern to ALL tab `_layout.tsx` files: network, flight-ops, ground-ops, crew-ops, settings.

### 4. Update existing mobile screens to use ScreenContainer

For the 3–4 most important/visible screens (e.g., the index screen of each tab), wrap content with `<ScreenContainer>` instead of ad-hoc `<View style={{ flex: 1, backgroundColor: ... }}>`. Do NOT refactor every screen — just enough to establish the pattern.

### 5. Add dark mode toggle

Ensure the settings tab has a working dark mode toggle that calls `useThemeStore().toggleColorMode()`. This should immediately update the entire app's appearance (tab bar, headers, screens, cards).

### 6. Configure deep linking for mobile

**`apps/mobile/app.config.ts`** (or `app.json`):

Add the scheme for deep linking:

```ts
{
  scheme: 'skyhub',
  // Expo Router handles the linking config automatically based on file structure
}
```

### 7. Web app layout consistency

For the web app, ensure `apps/web/src/app/layout.tsx` applies the theme background color to the `<body>` element and that the BottomDock uses theme colors. If there's a sidebar or nav, theme it consistently.

## Acceptance Criteria

1. Tab bar uses `accentColor` for active tab, `palette.textSecondary` for inactive
2. Tab bar background matches `palette.background` in both light and dark mode
3. All stack headers have themed backgrounds, no white headers in dark mode
4. `<ScreenContainer>` component exists and is exported from `@skyhub/ui`
5. At least 3 screens use `<ScreenContainer>` as their root wrapper
6. Dark mode toggle in settings immediately updates the entire navigation chrome
7. No white flashes or mismatched backgrounds when navigating between tabs

## Self-Test

```bash
# Visual test: open the app, toggle dark mode, navigate through all 6 tabs
# Every screen should have a consistent background
# Tab bar should change colors
# Headers should change colors
# No white rectangles should appear anywhere in dark mode
```

Commit: `git commit -m "infra(sprint-6): themed navigation shell + ScreenContainer + dark mode toggle"`

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# SPRINT 7 — CI/CD Pipeline

# Estimated time: 1–2 hours

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Context

**Current state:** No CI/CD. Code is pushed directly to main with no automated checks. No EAS Build configuration. No app versioning strategy.

**What's needed:** GitHub Actions that validate every push, and EAS Build configuration for producing mobile builds.

## Task

### 1. Create GitHub Actions workflow for CI

**`.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: TypeCheck Web
        run: cd apps/web && npx tsc --noEmit
      - name: TypeCheck Server
        run: cd server && npx tsc --noEmit
      - name: TypeCheck Mobile
        run: cd apps/mobile && npx tsc --noEmit

  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Lint Web
        run: cd apps/web && npm run lint
      - name: Lint Server
        run: cd server && npm run lint
      - name: Lint Mobile
        run: cd apps/mobile && npm run lint

  format:
    name: Format Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Check formatting
        run: npx prettier --check "**/*.{ts,tsx,js,json}" --ignore-path .gitignore

  build-web:
    name: Build Web
    runs-on: ubuntu-latest
    needs: [typecheck, lint]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Build
        run: cd apps/web && npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:3001
```

### 2. Create EAS Build configuration

Install EAS CLI:

```bash
npm install -g eas-cli
```

**`apps/mobile/eas.json`:**

```json
{
  "cli": {
    "version": ">= 13.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "http://localhost:3001"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api-staging.skyhub.aero"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.skyhub.aero"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 3. Create version bump script

**`scripts/bump-version.sh`:**

```bash
#!/bin/bash
# Usage: ./scripts/bump-version.sh patch|minor|major

TYPE=${1:-patch}

# Read current version from package.json
CURRENT=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT"

# Split version
IFS='.' read -ra PARTS <<< "$CURRENT"
MAJOR=${PARTS[0]}
MINOR=${PARTS[1]}
PATCH=${PARTS[2]}

case $TYPE in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: bump-version.sh patch|minor|major"; exit 1 ;;
esac

NEW="$MAJOR.$MINOR.$PATCH"
echo "New version: $NEW"

# Update root package.json
node -e "const p=require('./package.json'); p.version='$NEW'; require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2)+'\n')"

echo "✓ Updated to $NEW"
echo "Run: git commit -am 'release: v$NEW' && git tag v$NEW"
```

```bash
chmod +x scripts/bump-version.sh
```

### 4. Add version to root package.json

Edit root `package.json` to include a version:

```json
{
  "version": "0.1.0"
}
```

### 5. Add branch protection reminder

Create **`docs/CONTRIBUTING.md`:**

````markdown
# Contributing to SkyHub v2

## Branch Protection (set up in GitHub)

After this sprint, enable these rules on the `main` branch in GitHub Settings → Branches → Branch protection rules:

- ✅ Require status checks to pass before merging
  - Required checks: `Type Check`, `Lint`, `Format Check`
- ✅ Require pull request reviews before merging (optional but recommended)
- ✅ Do not allow bypassing the above settings

## Workflow

1. Create a feature branch: `git checkout -b feature/movement-control`
2. Make changes and commit
3. Push and create a PR: `gh pr create`
4. CI runs automatically — fix any failures
5. Merge after checks pass

## Version Bumping

```bash
./scripts/bump-version.sh patch  # 0.1.0 → 0.1.1
./scripts/bump-version.sh minor  # 0.1.0 → 0.2.0
./scripts/bump-version.sh major  # 0.1.0 → 1.0.0
```
````

## Building Mobile App

```bash
cd apps/mobile
eas build --profile development --platform ios
eas build --profile development --platform android
```

````

## Acceptance Criteria

1. `.github/workflows/ci.yml` exists and defines typecheck, lint, format check, and web build jobs
2. Pushing to main or opening a PR triggers the CI workflow
3. `eas.json` exists with development, preview, and production build profiles
4. `scripts/bump-version.sh` increments the version in `package.json`
5. `docs/CONTRIBUTING.md` exists with branch protection instructions

## Self-Test

```bash
# Verify CI workflow is valid YAML
cat .github/workflows/ci.yml | python3 -c "import yaml, sys; yaml.safe_load(sys.stdin); print('Valid YAML')"

# Verify EAS config is valid JSON
cat apps/mobile/eas.json | python3 -c "import json, sys; json.load(sys.stdin); print('Valid JSON')"

# Test version bump
./scripts/bump-version.sh patch
cat package.json | grep version
# Expected: "version": "0.1.1"

# Revert for now
git checkout package.json
````

Commit: `git commit -m "infra(sprint-7): github actions CI + EAS build config + version bump + contributing guide"`

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# POST-SPRINT: Update CLAUDE.md

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After all 7 sprints are complete, update `CLAUDE.md` to reflect the new infrastructure:

Add a new section after "Critical Rules":

```markdown
## Infrastructure (completed)

### Auth

- JWT auth on all routes. `request.operatorId` and `request.userId` populated from token.
- Login: `POST /auth/login` with email + password → access + refresh tokens.
- Public routes (no auth required): `/health`, `/auth/login`, `/auth/refresh`, `/auth/set-password`.
- Mobile: tokens stored in MMKV. Web: tokens stored in localStorage.
- Dev credentials: `admin@skyhub.aero` / `SkyHub2026!`

### Data Layer

- React Query wraps all API calls. Use hooks from `@skyhub/api` (e.g. `useAirports()`, `useMe()`).
- Query keys in `packages/api/src/query-keys.ts`. Invalidate after mutations.
- Reference data: 5min staleTime. Operational data: 30sec staleTime.

### Environment

- Server env validated by Zod on startup (`@skyhub/env`). Missing vars crash immediately.
- Mobile: `EXPO_PUBLIC_API_URL` in `.env`. Web: `NEXT_PUBLIC_API_URL` in `.env.local`.
- Never read `process.env` directly — use `getServerEnv()` or `getClientEnv()`.

### Linting

- ESLint + Prettier enforced via Husky pre-commit hook.
- Config in `packages/eslint-config/`. Shared across all workspaces.

### CI/CD

- GitHub Actions: typecheck + lint + format + web build on every push/PR.
- EAS Build: `eas.json` in `apps/mobile/` with dev/preview/prod profiles.
- Version: `./scripts/bump-version.sh patch|minor|major`.
```

Remove or update any outdated references to hardcoded `getOperatorId()` or `userId || 'skyhub-admin-001'`.

---

# Summary — Sprint Dependency Chain

```
Sprint 1 (lint/format)
    ↓
Sprint 2 (env validation)
    ↓
Sprint 3 (component library)
    ↓
Sprint 4 (auth) — depends on Sprint 2 (JWT_SECRET env) and Sprint 3 (login screen components)
    ↓
Sprint 5 (React Query) — depends on Sprint 4 (auth interceptor in API client)
    ↓
Sprint 6 (navigation shell) — depends on Sprint 3 (ScreenContainer, theme) and Sprint 4 (auth guard)
    ↓
Sprint 7 (CI/CD) — depends on Sprint 1 (lint scripts exist to run in CI)
    ↓
Update CLAUDE.md — depends on all sprints
```

Total estimated time: 8–12 hours of Claude Code execution time.

After completion, every future feature prompt benefits from:

- Validated environment
- Authenticated API calls
- Reusable themed components
- Cached data with React Query
- Consistent navigation chrome
- Automated quality checks on every push
