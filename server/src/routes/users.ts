import type { FastifyInstance } from 'fastify'
import { User } from '../models/User.js'

export async function userRoutes(app: FastifyInstance) {
  // ── GET /users/me — get current user (hardcoded ID for now, replace with JWT later) ──
  app.get('/users/me', async (req, reply) => {
    const userId = (req.query as any).userId || 'skyhub-admin-001'
    const user = await User.findById(userId).lean()
    if (!user) return reply.code(404).send({ error: 'User not found' })
    // Strip password hash from response
    const { security, ...rest } = user as any
    const { passwordHash, ...safeSecurity } = security || {}
    return { ...rest, security: safeSecurity }
  })

  // ── PATCH /users/me/profile — update profile fields ──
  app.patch('/users/me/profile', async (req, reply) => {
    const userId = (req.query as any).userId || 'skyhub-admin-001'
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
    const userId = (req.query as any).userId || 'skyhub-admin-001'
    const body = req.body as Record<string, any>

    const update: Record<string, any> = { updatedAt: new Date().toISOString() }

    // Handle password change
    if (body.newPassword) {
      // In production: hash the password, verify currentPassword
      update['security.passwordHash'] = `hashed_${body.newPassword}`
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
    const userId = (req.query as any).userId || 'skyhub-admin-001'
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
    const userId = (req.query as any).userId || 'skyhub-admin-001'
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
    const userId = (req.query as any).userId || 'skyhub-admin-001'
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
    const userId = (req.query as any).userId || 'skyhub-admin-001'
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
}
