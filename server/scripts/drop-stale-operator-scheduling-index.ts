import mongoose from 'mongoose'
import { config } from 'dotenv'
config()

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri, { dbName: 'test' })
  const coll = mongoose.connection.db!.collection('operatorSchedulingConfig')
  const indexes = await coll.indexes()
  console.log(
    'Before:',
    indexes.map((i) => i.name),
  )
  const stale = indexes.find((i) => i.name === 'operatorId_1')
  if (stale) {
    await coll.dropIndex('operatorId_1')
    console.log('Dropped operatorId_1')
  } else {
    console.log('No stale operatorId_1 index found')
  }
  const after = await coll.indexes()
  console.log(
    'After:',
    after.map((i) => i.name),
  )
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
