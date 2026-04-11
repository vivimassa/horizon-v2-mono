import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { getServerEnv } from '@skyhub/env/server'

interface LoginBody {
  email: string
  password: string
}

interface RefreshBody {
  refreshToken: string
}

interface SetPasswordBody {
  userId: string
  password: string
}

interface JwtPayload {
  userId: string
  operatorId: string
  role: string
}

interface RefreshPayload extends JwtPayload {
  type: 'refresh'
}

export async function authRoutes(app: FastifyInstance) {
  const env = getServerEnv()

  // ── POST /auth/login ──
  app.post<{ Body: LoginBody }>('/auth/login', async (req, reply) => {
    const { email, password } = req.body ?? ({} as LoginBody)

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const user = await User.findOne({ 'profile.email': normalizedEmail }).lean()
    if (!user) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }

    const doc = user as unknown as {
      _id: string
      operatorId: string
      role: string
      isActive: boolean
      security?: { passwordHash?: string }
    }

    if (!doc.security?.passwordHash) {
      return reply.code(401).send({ error: 'Account has no password set. Contact administrator.' })
    }

    const valid = await bcrypt.compare(password, doc.security.passwordHash)
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }

    if (doc.isActive === false) {
      return reply.code(403).send({ error: 'Account is deactivated' })
    }

    const payload: JwtPayload = {
      userId: doc._id,
      operatorId: doc.operatorId,
      role: doc.role,
    }

    const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRY })
    const refreshToken = app.jwt.sign({ ...payload, type: 'refresh' } satisfies RefreshPayload, {
      expiresIn: env.JWT_REFRESH_EXPIRY,
    })

    await User.updateOne(
      { _id: doc._id },
      {
        $set: {
          lastLoginUtc: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    )

    const { security: _security, ...safeUser } = user as Record<string, unknown>
    return { accessToken, refreshToken, user: safeUser }
  })

  // ── POST /auth/refresh ──
  app.post<{ Body: RefreshBody }>('/auth/refresh', async (req, reply) => {
    const { refreshToken } = req.body ?? ({} as RefreshBody)

    if (!refreshToken) {
      return reply.code(400).send({ error: 'Refresh token is required' })
    }

    try {
      const decoded = app.jwt.verify<RefreshPayload>(refreshToken)
      if (decoded.type !== 'refresh') {
        return reply.code(401).send({ error: 'Invalid token type' })
      }

      const user = await User.findById(decoded.userId).lean()
      if (!user || (user as { isActive?: boolean }).isActive === false) {
        return reply.code(401).send({ error: 'User not found or deactivated' })
      }

      const payload: JwtPayload = {
        userId: decoded.userId,
        operatorId: decoded.operatorId,
        role: decoded.role,
      }

      const newAccessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_EXPIRY })
      const newRefreshToken = app.jwt.sign({ ...payload, type: 'refresh' } satisfies RefreshPayload, {
        expiresIn: env.JWT_REFRESH_EXPIRY,
      })

      return { accessToken: newAccessToken, refreshToken: newRefreshToken }
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' })
    }
  })

  // ── POST /auth/set-password — admin / first-time bootstrap ──
  app.post<{ Body: SetPasswordBody }>('/auth/set-password', async (req, reply) => {
    const { userId, password } = req.body ?? ({} as SetPasswordBody)

    if (!userId || !password || password.length < 8) {
      return reply.code(400).send({ error: 'userId and password (min 8 chars) are required' })
    }

    const hash = await bcrypt.hash(password, 12)
    const result = await User.updateOne(
      { _id: userId },
      {
        $set: {
          'security.passwordHash': hash,
          'security.lastPasswordChange': new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    )

    if (result.matchedCount === 0) {
      return reply.code(404).send({ error: 'User not found' })
    }

    return { success: true }
  })
}
