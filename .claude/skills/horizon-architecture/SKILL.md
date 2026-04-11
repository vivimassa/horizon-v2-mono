---
name: horizon-architecture
description: Enforce Horizon v2 performance and code quality guardrails on every implementation. MUST be consulted before writing any component that renders a list, handles high-frequency interactions, manages more than 5 pieces of state, or exceeds 500 lines. Trigger on "performance", "slow", "refactor", "split", "store", "zustand", "re-render", "optimization", "architecture", or "FlatList".
---

# Horizon v2 — Architecture & Performance Guardrails

## Component Size Limits (ENFORCED)

| Metric                      | Limit       | Action at Limit                          |
| --------------------------- | ----------- | ---------------------------------------- |
| `.tsx/.jsx` component lines | **400 max** | Split into shell + sub-components + hook |
| `.ts/.js` logic/util lines  | **600 max** | Split into focused modules               |
| useState hooks              | **8 max**   | Extract to Zustand store                 |
| useEffect hooks             | **5 max**   | Consolidate or extract to custom hook    |
| Props                       | **12 max**  | Group into typed objects or use context  |
| Inline computations         | **3 max**   | Extract to useMemo or pure function      |

### Warning Thresholds

- **300 lines (.tsx)**: Plan your split — you're approaching the 400-line limit
- **6 useState**: Start consolidating related state into objects
- **200 lines in a single function**: Extract helper functions

## State Management Tiers

| Complexity                    | Approach                                  | Example                                 |
| ----------------------------- | ----------------------------------------- | --------------------------------------- |
| Single component, 1-3 values  | `useState`                                | Toggle visibility, form input           |
| Single component, 4-10 values | `useReducer` or consolidated state object | Multi-step form                         |
| Shared across 2-3 components  | Props + context                           | Theme, auth user                        |
| Shared across module          | Zustand store (sliced selectors)          | Flight list filters, Gantt viewport     |
| Global app state              | Zustand store                             | Theme, auth, sync status, offline queue |

### Zustand Best Practices

```typescript
// GOOD — sliced selectors prevent unnecessary re-renders
const flights = useFlightStore((s) => s.flights)
const filters = useFlightStore((s) => s.filters)

// BAD — re-renders on ANY store change
const store = useFlightStore()
```

## FlatList Performance (CRITICAL for airline data volumes)

Airlines have 200-1000+ flights/day, 500+ crew members. Lists MUST be optimized.

```typescript
// MANDATORY for any FlatList with >50 items
<FlatList
  data={flights}
  renderItem={renderFlightItem}       // Extracted, not inline
  keyExtractor={keyExtractor}         // Extracted, stable reference
  getItemLayout={getItemLayout}       // Fixed height → skip measurement
  windowSize={5}                      // Render 5 screens worth
  maxToRenderPerBatch={10}            // Batch render limit
  removeClippedSubviews={true}        // Reclaim memory off-screen
  initialNumToRender={15}             // First paint count
/>

// renderItem component MUST be React.memo
const FlightListItem = React.memo(({ item }: { item: Flight }) => {
  // ...
})
```

## Skia Gantt Rendering Rules

All timeline/Gantt rendering uses `@shopify/react-native-skia`. NEVER use View-based absolute positioning for Gantt bars.

- Pan/zoom via `react-native-gesture-handler` + `react-native-reanimated` on UI thread
- Only draw visible rows (virtualization by Y offset calculation)
- Hit-testing via geometric math (point-in-rect), not DOM events
- Draw order is explicit — no z-index issues
- Group transforms for pan/zoom applied once to container, not per-bar

## Offline-First Architecture

### Data Flow

```
User Action → Local Write (WatermelonDB/SQLite)
                 ↓
            Immediate UI update (optimistic)
                 ↓
            Queue for sync (when online)
                 ↓
            Push to server → Validate → Write to MongoDB
                 ↓
            Confirm/reject/merge result back to device
```

### Rules

- Every read comes from WatermelonDB FIRST, then refreshes from sync
- Every write goes to WatermelonDB FIRST, then queues for push
- UI must work with only local data (no spinners blocking critical screens)
- Sync status indicator visible but non-blocking
- Conflict resolution defined per data type (see planner agent)

## API Layer Rules (Fastify)

- Every route: auth middleware + Zod schema validation + RBAC check
- Database selection from JWT tenantId (database-per-tenant)
- Response envelope: `{ success: boolean, data: T, error?: string, pagination?: {...} }`
- Timeouts on all external calls (MongoDB, ML API, weather API)
- Error messages safe for client (no stack traces, no internal details)

## MongoDB Document Design

- Embed what you read together (flight + crew + delays = one document)
- Reference what changes independently (crew_members separate from flights)
- `_schemaVersion` on every document for lazy migration
- `syncMeta.updatedAt` indexed for sync protocol queries
- Compound indexes matching primary access patterns

## Import Organization

```typescript
// 1. React / React Native
import React, { useState, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'

// 2. Third-party
import { useNavigation } from '@react-navigation/native'
import { Canvas, Rect } from '@shopify/react-native-skia'

// 3. Internal packages
import { FlightInstance } from '@horizon/models'

// 4. Local
import { useTheme } from '../../stores/useThemeStore'
import { calculateMinRest } from '../../logic/fdtl'
import { FlightCard } from '../common/FlightCard'
```

## Pre-Commit Mental Checklist

Before every commit, verify:

- [ ] No component exceeds 400 lines (.tsx) / 600 lines (.ts)
- [ ] No file has >8 useState hooks
- [ ] FlatList has getItemLayout + React.memo renderItem
- [ ] All Gantt rendering uses Skia, not View
- [ ] Offline reads from WatermelonDB, not API
- [ ] operatorId on every query
- [ ] All timestamps in UTC
- [ ] Dark mode tested
- [ ] No hardcoded colors or font sizes
