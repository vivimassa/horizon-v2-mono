---
name: search-first
description: Research-before-coding workflow for Horizon v2. Before writing any custom utility, component, or integration — search the existing codebase, npm, and Expo ecosystem for existing solutions. Trigger when starting a new feature or adding a dependency.
---

# Search First — Research Before You Code

Before writing custom code, systematically search for existing solutions.

## When to Activate

- Starting a new feature that likely has existing solutions
- Adding a dependency or integration
- About to write a utility, helper, or abstraction
- Before creating a new UI component (check `src/components/ui/` first)

## Search Order

### 1. Search the Codebase

```bash
# Does this already exist in our repo?
rg "functionName\|ClassName\|keyword" apps/ packages/ --include="*.ts" --include="*.tsx"

# Check existing UI primitives
ls src/components/ui/
ls src/components/common/

# Check existing logic functions
ls src/logic/

# Check existing Zustand stores
ls src/stores/

# Check existing WatermelonDB models
ls src/models/
```

### 2. Search Shared Packages

```bash
# Check what's already in our monorepo packages
ls packages/
cat packages/shared/src/index.ts  # If exists
```

### 3. Search npm / Expo Ecosystem

For React Native, prefer packages with:

- Expo SDK compatibility (check `expo install` support)
- Active maintenance (updated within 6 months)
- No native module requirements (or compatible with development builds)
- TypeScript types included

**Priority packages for common needs:**

| Need             | Package                                 | Notes                            |
| ---------------- | --------------------------------------- | -------------------------------- |
| Date/time        | `date-fns`                              | Tree-shakeable, UTC-friendly     |
| Validation       | `zod`                                   | Shared between client and server |
| HTTP client      | Built-in `fetch`                        | No extra dep needed in RN        |
| State management | `zustand`                               | Already in stack                 |
| Local DB         | `@nozbe/watermelondb`                   | Already in stack                 |
| Charts           | `victory-native` or `react-native-skia` | Skia preferred for Gantt         |
| Maps             | `react-native-maps`                     | For world map view               |
| Gestures         | `react-native-gesture-handler`          | Already in stack                 |
| Animations       | `react-native-reanimated`               | Already in stack                 |
| Icons            | `lucide-react-native`                   | Design system standard           |
| Forms            | Manual with Zod                         | No form library needed           |

### 4. Check Expo Compatibility

```bash
# Verify package works with Expo
npx expo install <package-name>  # Uses compatible version
npx expo doctor                   # Check for issues
```

## Decision Matrix

| Signal                                   | Action                                         |
| ---------------------------------------- | ---------------------------------------------- |
| Already exists in our codebase           | **Reuse** — import and use                     |
| Exact match, Expo-compatible, maintained | **Adopt** — `npx expo install`                 |
| Partial match, good foundation           | **Extend** — install + thin wrapper            |
| Nothing suitable                         | **Build** — write custom, informed by research |

## Anti-Patterns

- Writing a date utility when `date-fns` exists
- Creating a custom validation layer when `zod` is already in the stack
- Building a gesture system when `react-native-gesture-handler` is standard
- Reimplementing FlatList optimization when built-in props handle it
- Installing a heavy package for one small function (check bundle size)

## Expo-Specific Gotchas

- **No native modules in Expo Go** — If a package needs native code, use development builds
- **Expo SDK version lock** — All Expo packages must match the SDK version
- **Metro resolution** — Some npm packages don't work with Metro bundler (check first)
- **Hermes compatibility** — Some packages need Hermes-specific polyfills
