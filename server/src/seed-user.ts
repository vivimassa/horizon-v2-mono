import 'dotenv/config'
import { validateServerEnv } from '@skyhub/env/server'
const env = validateServerEnv()
import { connectDB } from './db/connection.js'
import { User } from './models/User.js'

async function seedUser() {
  await connectDB(env.MONGODB_URI)

  const userId = 'skyhub-admin-001'

  const existing = await User.findById(userId)
  if (existing) {
    console.log('✓ Admin user already exists, skipping seed')
    process.exit(0)
  }

  await User.create({
    _id: userId,
    operatorId: 'skyhub',
    profile: {
      firstName: 'SkyHub',
      lastName: 'Administrator',
      email: 'admin@skyhub.aero',
      phone: '+84 912 345 678',
      officePhone: '+84 28 3847 1234 ext. 100',
      dateOfBirth: '1985-03-15',
      gender: 'Male',
      department: 'OCC',
      employeeId: 'SH-0001',
      avatarUrl: '',
      location: 'SGN — Tan Son Nhat International',
    },
    security: {
      passwordHash: '',
      twoFactorEnabled: false,
      biometricEnabled: false,
      lastPasswordChange: new Date().toISOString(),
      sessions: [
        {
          device: 'MacBook Pro',
          browser: 'Chrome 124',
          location: 'Ho Chi Minh City',
          lastActive: new Date().toISOString(),
          isCurrent: true,
        },
        {
          device: 'iPhone 15',
          browser: 'Safari',
          location: 'Ho Chi Minh City',
          lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          isCurrent: false,
        },
      ],
    },
    preferences: {
      language: 'en',
      timezone: 'Asia/Ho_Chi_Minh',
      dateFormat: 'dd MMM yyyy',
      timeFormat: '24h',
      units: 'metric',
      numberFormat: 'comma',
    },
    notifications: {
      pushEnabled: true,
      emailEnabled: true,
      inAppEnabled: true,
      emailDigest: 'daily',
      quietHoursStart: '',
      quietHoursEnd: '',
      categories: {
        flightUpdates: true,
        crewChanges: true,
        systemAlerts: true,
        maintenance: false,
        reports: false,
      },
    },
    display: {
      textScale: 'default',
      contrast: 1,
      brightness: 50,
      accentColor: '#15803d',
      dynamicBackground: true,
      backgroundPreset: 'aurora',
      colorMode: 'light',
    },
    role: 'administrator',
    isActive: true,
    lastLoginUtc: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  console.log('✓ Seeded admin user: SkyHub Administrator (admin@skyhub.aero)')
  process.exit(0)
}

seedUser().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
