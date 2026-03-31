---
name: horizon-db-conventions
description: Database conventions for Horizon v2 MongoDB Atlas + WatermelonDB. Consult before creating any collection, model, query, or index. Covers ICAO codes, operatorId enforcement, document design, sync protocol, and multi-tenancy rules.
---

# Horizon v2 — Database Conventions

## Multi-Tenancy: Database-Per-Tenant

Each airline gets its own MongoDB database within the same Atlas cluster.
- Connection routing from JWT `tenantId` → database selection in middleware
- NEVER accept tenantId from request body/params — always from JWT
- WatermelonDB on device is per-user, per-tenant (switching tenants clears local data)

## ICAO Code Standards

**V2 uses industry-standard codes everywhere. No custom abbreviations.**

| Entity | Format | Example | Storage |
|--------|--------|---------|---------|
| Aircraft type | ICAO type designator | `A320`, `A321`, `A333` | String field |
| Airport | ICAO code | `VVTS`, `VVNB`, `EGLL` | String field |
| Airport (display) | IATA code | `SGN`, `HAN`, `LHR` | Separate field |
| Airline | ICAO code | `VJC` | operatorId |
| Airline (display) | IATA code | `VJ` | Separate field |

**v1 lesson:** v1 stored aircraft types as `'320'` not `'A320'`, creating a permanent mapping layer. NEVER do this. Store the standard code.

## MongoDB Document Design

### Core Principle: Embed What You Read Together

| Pattern | When | Example |
|---------|------|---------|
| Embed | Read together, update together | Crew list inside flight_instance |
| Embed | Child doesn't exist independently | Delay records inside flight |
| Reference | Entity has its own lifecycle | crew_members (exist independently of flights) |
| Reference | Would cause 16MB document limit | Full duty history (use crew_duty_log collection) |

### Mandatory Fields on Every Document

```typescript
{
  "_id": "...",                    // MongoDB ObjectId or composite key
  "_schemaVersion": 2,             // For lazy migration
  "operatorId": "vietjet",         // Tenant identifier (redundant with DB-per-tenant but defense-in-depth)
  "syncMeta": {
    "updatedAt": 1743500000000,    // UTC ms — indexed for sync protocol
    "version": 3                   // Optimistic concurrency — reject stale pushes
  }
}
```

### Key Collections

| Collection | Document Shape | Sync Direction |
|-----------|---------------|----------------|
| `flight_instances` | Flight + crew + delays + weather embedded | Bidirectional |
| `crew_members` | Crew + qualifications + FDTL state embedded | Server→Device |
| `pairings` | Pairing + all legs embedded | Server→Device |
| `disruption_events` | Disruption + resolutions + cascade embedded | Bidirectional |
| `aircraft` | Tail + maintenance status + config embedded | Server→Device |
| `airports` | Airport + runways + curfews | Server→Device (reference) |
| `crew_duty_log` | One doc per duty period (referenced by crewId) | Server→Device |
| `operator_settings` | Airline config, accent color, FDTL rules | Server→Device |

### Indexing Rules

1. **Every collection**: Index on `syncMeta.updatedAt` for sync protocol
2. **Every query pattern**: Create a compound index matching the filter + sort
3. **operatorId first** in compound indexes (even with DB-per-tenant, for future flexibility)
4. **Text indexes** only where full-text search is needed (crew name search)
5. **TTL indexes** on ephemeral data (weather observations: 72h, sync logs: 30d)

```javascript
// Standard index pattern
db.flight_instances.createIndex({ "operatorId": 1, "operatingDate": 1 })
db.flight_instances.createIndex({ "operatorId": 1, "tail.registration": 1, "operatingDate": 1 })
db.flight_instances.createIndex({ "syncMeta.updatedAt": 1 })
```

## WatermelonDB Model Rules

### Field Naming
- Snake_case in WatermelonDB columns: `std_utc`, `operator_id`, `flight_number`
- CamelCase in TypeScript decorators: `stdUtc`, `operatorId`, `flightNumber`

### Mandatory Fields on Every Model
```typescript
@field('operator_id')        operatorId
@field('_schema_version')    schemaVersion
@date('synced_at')           syncedAt
@date('local_modified_at')   localModifiedAt
```

### Associations
```typescript
static associations = {
  crew_assignments: { type: 'has_many', foreignKey: 'flight_instance_id' },
}
```

### Query Rules
```typescript
// CORRECT — always filter by operatorId
const flights = await database.get<FlightInstance>('flight_instances')
  .query(Q.where('operator_id', operatorId), Q.where('operating_date', date))
  .fetch()

// WRONG — no operatorId filter
const flights = await database.get<FlightInstance>('flight_instances')
  .query(Q.where('operating_date', date))
  .fetch()
```

## Sync Protocol Data Classification

| Category | Direction | Offline Write? | Conflict Strategy |
|----------|-----------|---------------|-------------------|
| Reference | Server→Device | No | Server always wins |
| Schedule | Server→Device | No | Server always wins |
| Operational | Bidirectional | Yes | Field-level merge |
| Personal | Bidirectional | Yes | Last-write-wins |
| Disruption | Bidirectional | Yes | Merge + escalate conflicts |

## Mongoose Schema Template

```typescript
import { Schema, model } from 'mongoose'

const flightInstanceSchema = new Schema({
  _schemaVersion: { type: Number, default: 1 },
  operatorId: { type: String, required: true, index: true },
  flightNumber: { type: String, required: true },
  operatingDate: { type: String, required: true }, // YYYY-MM-DD
  dep: {
    icao: { type: String, required: true },
    iata: { type: String },
  },
  arr: {
    icao: { type: String, required: true },
    iata: { type: String },
  },
  schedule: {
    stdUtc: { type: Number, required: true }, // UTC ms
    staUtc: { type: Number, required: true },
  },
  actual: {
    atdUtc: { type: Number, default: null },
    ataUtc: { type: Number, default: null },
  },
  tail: {
    registration: String,
    icaoType: String, // A320, A321, A333 — standard codes
  },
  crew: [{ crewId: String, role: String, name: String }],
  delays: [{ code: String, minutes: Number, reason: String, recordedBy: String, at: Number }],
  status: { type: String, enum: ['scheduled', 'departed', 'airborne', 'arrived', 'cancelled'], default: 'scheduled' },
  syncMeta: {
    updatedAt: { type: Number, default: Date.now },
    version: { type: Number, default: 1 },
  },
}, { timestamps: false }) // We manage our own timestamps in UTC

flightInstanceSchema.index({ operatorId: 1, operatingDate: 1 })
flightInstanceSchema.index({ 'syncMeta.updatedAt': 1 })

export const FlightInstance = model('FlightInstance', flightInstanceSchema)
```
