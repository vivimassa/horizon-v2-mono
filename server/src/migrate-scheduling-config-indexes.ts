// Drop the legacy `operatorId` unique index on operatorSchedulingConfig so
// per-user config rows can coexist with the operator default. New composite
// index (operatorId, userId) unique is created automatically by the model.
//
//   tsx src/migrate-scheduling-config-indexes.ts

import 'dotenv/config'
import mongoose from 'mongoose'
import { OperatorSchedulingConfig } from './models/OperatorSchedulingConfig.js'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)
  const coll = OperatorSchedulingConfig.collection

  const existing = await coll.indexes()
  console.log('Existing indexes:')
  for (const i of existing) console.log(`  ${i.name} :: ${JSON.stringify(i.key)} unique=${i.unique ?? false}`)

  // Drop the old single-field operatorId unique index if present.
  const legacy = existing.find((i) => i.unique === true && JSON.stringify(i.key) === JSON.stringify({ operatorId: 1 }))
  if (legacy?.name) {
    console.log(`\nDropping legacy index: ${legacy.name}`)
    await coll.dropIndex(legacy.name)
  } else {
    console.log('\nNo legacy operatorId unique index to drop.')
  }

  // Ensure composite (operatorId, userId) unique is present.
  await OperatorSchedulingConfig.syncIndexes()
  const after = await coll.indexes()
  console.log('\nFinal indexes:')
  for (const i of after) console.log(`  ${i.name} :: ${JSON.stringify(i.key)} unique=${i.unique ?? false}`)

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
