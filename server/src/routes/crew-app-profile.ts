import type { FastifyInstance } from 'fastify'
import { CrewMember } from '../models/CrewMember.js'
import { CrewPassport } from '../models/CrewPassport.js'
import { CrewVisa } from '../models/CrewVisa.js'
import { CrewLicense } from '../models/CrewLicense.js'
import { CrewExpiryDate } from '../models/CrewExpiryDate.js'
import { CrewPhone } from '../models/CrewPhone.js'
import { ExpiryCode } from '../models/ExpiryCode.js'
import { requireCrewAuth } from '../middleware/authenticate-crew.js'

const DAY_MS = 86_400_000

export async function crewAppProfileRoutes(app: FastifyInstance) {
  /**
   * GET /crew-app/me/full-profile
   *
   * Returns the logged-in crew member's full bio for the More tab —
   * identity, contact, employment, plus arrays of passports, visas,
   * licenses, and expiries (with codeLabel resolved against ExpiryCode).
   *
   * NOT synced via WatermelonDB. Refetched on the More screen with
   * react-query (slow-changing, single-shot REST is simpler than schema
   * migration for 5 new tables).
   */
  app.get('/crew-app/me/full-profile', { preHandler: requireCrewAuth }, async (req, reply) => {
    const crewId = req.crewId
    const operatorId = req.crewOperatorId

    const crew = await CrewMember.findOne({ _id: crewId, operatorId }).lean()
    if (!crew) return reply.code(404).send({ error: 'Crew member not found' })

    const [passports, visas, licenses, expiries, phones, expiryCodes] = await Promise.all([
      CrewPassport.find({ operatorId, crewId }).lean(),
      CrewVisa.find({ operatorId, crewId }).lean(),
      CrewLicense.find({ operatorId, crewId }).lean(),
      CrewExpiryDate.find({ operatorId, crewId }).lean(),
      CrewPhone.find({ operatorId, crewId }).sort({ priority: 1 }).lean(),
      ExpiryCode.find({ operatorId }).lean(),
    ])

    const codeById = new Map<string, { code: string; name: string }>()
    for (const c of expiryCodes) {
      codeById.set(c._id as string, { code: c.code, name: c.name })
    }

    const now = Date.now()
    const ratings = new Set<string>()

    return {
      identity: {
        firstName: crew.firstName,
        middleName: crew.middleName ?? null,
        lastName: crew.lastName,
        gender: crew.gender ?? null,
        dateOfBirth: crew.dateOfBirth ?? null,
        nationality: crew.nationality ?? null,
        employeeId: crew.employeeId,
        shortCode: crew.shortCode ?? null,
        photoUrl: crew.photoUrl ?? null,
      },
      employment: {
        contractType: crew.contractType ?? null,
        base: crew.base ?? null,
        position: crew.position ?? null,
        employmentDate: crew.employmentDate ?? null,
        seniority: crew.seniority ?? null,
        seniorityGroup: crew.seniorityGroup ?? 0,
        languages: crew.languages ?? [],
        ratings: [] as string[], // backfilled below
      },
      contact: {
        emailPrimary: crew.emailPrimary ?? null,
        emailSecondary: crew.emailSecondary ?? null,
        phones: phones.map((p) => ({
          id: p._id as string,
          priority: p.priority,
          type: p.type,
          number: p.number,
          smsEnabled: p.smsEnabled,
        })),
        address: {
          line1: crew.addressLine1 ?? null,
          line2: crew.addressLine2 ?? null,
          city: crew.addressCity ?? null,
          state: crew.addressState ?? null,
          zip: crew.addressZip ?? null,
          country: crew.addressCountry ?? null,
        },
        emergency: {
          name: crew.emergencyName ?? null,
          relationship: crew.emergencyRelationship ?? null,
          phone: crew.emergencyPhone ?? null,
        },
      },
      passports: passports.map((p) => ({
        id: p._id as string,
        number: p.number,
        country: p.country,
        nationality: p.nationality ?? null,
        placeOfIssue: p.placeOfIssue ?? null,
        issueDate: p.issueDate ?? null,
        expiry: p.expiry,
        isActive: p.isActive,
      })),
      visas: visas.map((v) => ({
        id: v._id as string,
        country: v.country,
        type: v.type ?? null,
        number: v.number ?? null,
        issueDate: v.issueDate ?? null,
        expiry: v.expiry,
      })),
      licenses: licenses.map((l) => ({
        id: l._id as string,
        number: l.number,
        type: l.type,
        country: l.country ?? null,
        placeOfIssue: l.placeOfIssue ?? null,
        issueDate: l.issueDate ?? null,
        temporary: l.temporary,
      })),
      expiries: expiries.map((e) => {
        const meta = codeById.get(e.expiryCodeId)
        if (e.aircraftType) ratings.add(e.aircraftType)
        const expiryMs = e.expiryDate ? Date.parse(e.expiryDate) : null
        const isExpired = !!(expiryMs && expiryMs < now)
        const daysUntil = expiryMs ? Math.floor((expiryMs - now) / DAY_MS) : null
        return {
          id: e._id as string,
          codeId: e.expiryCodeId,
          codeShort: meta?.code ?? null,
          codeLabel: meta?.name ?? null,
          aircraftType: e.aircraftType || null,
          expiryDate: e.expiryDate ?? null,
          isExpired,
          daysUntil,
        }
      }),
      _ratings: Array.from(ratings).sort(),
    }
  })
}
