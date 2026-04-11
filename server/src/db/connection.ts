import mongoose from 'mongoose'

export async function connectDB(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri)
    console.log('\u2713 MongoDB connected:', mongoose.connection.name)
  } catch (err) {
    console.error('\u2717 MongoDB connection failed:', err)
    process.exit(1)
  }
}
