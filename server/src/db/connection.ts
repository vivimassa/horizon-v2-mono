import mongoose from 'mongoose'

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set')
  }

  try {
    await mongoose.connect(uri)
    console.log('✓ MongoDB connected:', mongoose.connection.name)
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err)
    process.exit(1)
  }
}
