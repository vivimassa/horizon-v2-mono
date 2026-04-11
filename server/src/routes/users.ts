import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import { User } from '../models/User.js'

export async function userRoutes(app: FastifyInstance) {
  // ── GET /users/me — get current user from JWT ──
  app.get('/users/me', async (req, reply) => {
    const userId = req.userId
    const user = await User.findById(userId).lean()
    if (!user) return reply.code(404).send({ error: 'User not found' })
    // Strip password hash from response
    const { security, ...rest } = user as any
    const { passwordHash, ...safeSecurity } = security || {}
    return { ...rest, security: safeSecurity }
  })

  // ── PATCH /users/me/profile — update profile fields ──
  app.patch('/users/me/profile', async (req, reply) => {
    const userId = req.userId
    const body = req.body as Record<string, any>

    const update: Record<string, any> = { updatedAt: new Date().toISOString() }
    for (const [key, value] of Object.entries(body)) {
      update[`profile.${key}`] = value
    }

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).lean()
    if (!user) return reply.code(404).send({ error: 'User not found' })
    return { success: true, profile: (user as any).profile }
  })

  // ── PATCH /users/me/security — update security settings ──
  app.patch('/users/me/security', async (req, reply) => {
    const userId = req.userId
    const body = req.body as Record<string, any>

    const update: Record<string, any> = { updatedAt: new Date().toISOString() }

    // Handle password change
    if (body.newPassword) {
      if (typeof body.newPassword !== 'string' || body.newPassword.length < 8) {
        return reply.code(400).send({ error: 'New password must be at least 8 characters' })
      }
      if (body.currentPassword) {
        const current = await User.findById(userId).lean()
        const currentHash = (current as { security?: { passwordHash?: string } } | null)?.security?.passwordHash
        if (currentHash && !(await bcrypt.compare(body.currentPassword, currentHash))) {
          return reply.code(401).send({ error: 'Current password is incorrect' })
        }
      }
      update['security.passwordHash'] = await bcrypt.hash(body.newPassword, 12)
      update['security.lastPasswordChange'] = new Date().toISOString()
    }

    if (body.twoFactorEnabled !== undefined) {
      update['security.twoFactorEnabled'] = body.twoFactorEnabled
    }
    if (body.biometricEnabled !== undefined) {
      update['security.biometricEnabled'] = body.biometricEnabled
    }

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).lean()
    if (!user) return reply.code(404).send({ error: 'User not found' })
    const { passwordHash, ...safeSecurity } = (user as any).security || {}
    return { success: true, security: safeSecurity }
  })

  // ── PATCH /users/me/preferences — update preferences ──
  app.patch('/users/me/preferences', async (req, reply) => {
    const userId = req.userId
    const body = req.body as Record<string, any>

    const update: Record<string, any> = { updatedAt: new Date().toISOString() }
    for (const [key, value] of Object.entries(body)) {
      update[`preferences.${key}`] = value
    }

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).lean()
    if (!user) return reply.code(404).send({ error: 'User not found' })
    return { success: true, preferences: (user as any).preferences }
  })

  // ── PATCH /users/me/notifications — update notification settings ──
  app.patch('/users/me/notifications', async (req, reply) => {
    const userId = req.userId
    const body = req.body as Record<string, any>

    const update: Record<string, any> = { updatedAt: new Date().toISOString() }

    for (const [key, value] of Object.entries(body)) {
      if (key === 'categories' && typeof value === 'object') {
        for (const [cat, enabled] of Object.entries(value)) {
          update[`notifications.categories.${cat}`] = enabled
        }
      } else {
        update[`notifications.${key}`] = value
      }
    }

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).lean()
    if (!user) return reply.code(404).send({ error: 'User not found' })
    return { success: true, notifications: (user as any).notifications }
  })

  // ── PATCH /users/me/display — update display settings ──
  app.patch('/users/me/display', async (req, reply) => {
    const userId = req.userId
    const body = req.body as Record<string, any>

    const update: Record<string, any> = { updatedAt: new Date().toISOString() }
    for (const [key, value] of Object.entries(body)) {
      update[`display.${key}`] = value
    }

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).lean()
    if (!user) return reply.code(404).send({ error: 'User not found' })
    return { success: true, display: (user as any).display }
  })

  // ── DELETE /users/me/sessions/:index — revoke a session ──
  app.delete('/users/me/sessions/:index', async (req, reply) => {
    const userId = req.userId
    const index = parseInt((req.params as any).index, 10)

    const user = await User.findById(userId)
    if (!user) return reply.code(404).send({ error: 'User not found' })

    const sessions = (user as any).security?.sessions || []
    if (index < 0 || index >= sessions.length) return reply.code(400).send({ error: 'Invalid session index' })

    sessions.splice(index, 1)
    ;(user as any).security.sessions = sessions
    ;(user as any).updatedAt = new Date().toISOString()
    await user.save()

    return { success: true, sessions }
  })

  // ── POST /users/me/avatar — upload avatar image ──
  app.post('/users/me/avatar', async (req, reply) => {
    const userId = req.userId

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'No file uploaded' })

    const ext = path.extname(file.filename).toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return reply.code(400).send({ error: 'Only JPG, PNG, or WebP files are allowed' })
    }

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

    const filename = `avatar-${userId}${ext}`
    const filepath = path.join(uploadsDir, filename)
    await pipeline(file.file, fs.createWriteStream(filepath))

    const avatarUrl = `/uploads/${filename}`
    await User.findByIdAndUpdate(userId, {
      $set: { 'profile.avatarUrl': avatarUrl, updatedAt: new Date().toISOString() },
    })

    return { success: true, avatarUrl }
  })

  // ── DELETE /users/me/avatar — remove avatar ──
  app.delete('/users/me/avatar', async (req, reply) => {
    const userId = req.userId
    const user = await User.findById(userId).lean()
    if (!user) return reply.code(404).send({ error: 'User not found' })

    const avatarUrl = (user as any).profile?.avatarUrl
    if (avatarUrl && avatarUrl.startsWith('/uploads/')) {
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const filepath = path.resolve(__dirname, '..', '..', avatarUrl.replace('/uploads/', 'uploads/'))
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
    }

    await User.findByIdAndUpdate(userId, {
      $set: { 'profile.avatarUrl': '', updatedAt: new Date().toISOString() },
    })

    return { success: true }
  })
}
