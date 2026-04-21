import { z } from 'zod'

export const crewMemberCreateSchema = z
  .object({
    employeeId: z.string().min(1, 'Employee ID required'),
    firstName: z.string().min(1, 'First name required'),
    lastName: z.string().min(1, 'Last name required'),
    middleName: z.string().nullable().optional(),
    shortCode: z.string().nullable().optional(),
    gender: z.enum(['male', 'female', 'other']).nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),
    nationality: z.string().nullable().optional(),
    base: z.string().nullable().optional(),
    position: z.string().nullable().optional(),
    status: z.enum(['active', 'inactive', 'suspended', 'terminated']).optional(),
    employmentDate: z.string().nullable().optional(),
  })
  .strict()

export const crewMemberUpdateSchema = z
  .object({
    employeeId: z.string().min(1),
    firstName: z.string().min(1),
    middleName: z.string().nullable(),
    lastName: z.string().min(1),
    shortCode: z.string().nullable(),
    gender: z.enum(['male', 'female', 'other']).nullable(),
    dateOfBirth: z.string().nullable(),
    nationality: z.string().nullable(),
    base: z.string().nullable(),
    position: z.string().nullable(),
    status: z.enum(['active', 'inactive', 'suspended', 'terminated']),
    employmentDate: z.string().nullable(),
    exitDate: z.string().nullable(),
    exitReason: z.string().nullable(),
    contractType: z.string().nullable(),
    seniority: z.number().nullable(),
    seniorityGroup: z.number(),
    languages: z.array(z.string()),
    apisAlias: z.string().nullable(),
    countryOfResidence: z.string().nullable(),
    residencePermitNo: z.string().nullable(),
    emailPrimary: z.string().nullable(),
    emailSecondary: z.string().nullable(),
    addressLine1: z.string().nullable(),
    addressLine2: z.string().nullable(),
    addressCity: z.string().nullable(),
    addressState: z.string().nullable(),
    addressZip: z.string().nullable(),
    addressCountry: z.string().nullable(),
    emergencyName: z.string().nullable(),
    emergencyRelationship: z.string().nullable(),
    emergencyPhone: z.string().nullable(),
    noAccommodationAirports: z.array(z.string()),
    transportRequired: z.boolean(),
    hotelAtHomeBase: z.boolean(),
    travelTimeMinutes: z.number().nullable(),
    payrollNumber: z.string().nullable(),
    minGuarantee: z.string().nullable(),
    flyWithSeniorUntil: z.string().nullable(),
    doNotScheduleAltPosition: z.string().nullable(),
    standbyExempted: z.boolean(),
    crewUnderTraining: z.boolean(),
    noDomesticFlights: z.boolean(),
    noInternationalFlights: z.boolean(),
    maxLayoverStops: z.number().nullable(),
    photoUrl: z.string().nullable(),
    isScheduleVisible: z.boolean(),
    hrNotes: z.string().nullable(),
  })
  .partial()
  .strict()

export const phoneSchema = z
  .object({
    priority: z.number().int().min(1).optional(),
    type: z.string().min(1),
    number: z.string().min(1),
    smsEnabled: z.boolean().optional(),
  })
  .strict()

export const passportSchema = z
  .object({
    number: z.string().min(1),
    country: z.string().min(1),
    nationality: z.string().nullable().optional(),
    placeOfIssue: z.string().nullable().optional(),
    issueDate: z.string().nullable().optional(),
    expiry: z.string().min(1),
    isActive: z.boolean().optional(),
  })
  .strict()

export const licenseSchema = z
  .object({
    number: z.string().min(1),
    type: z.string().min(1),
    country: z.string().nullable().optional(),
    placeOfIssue: z.string().nullable().optional(),
    issueDate: z.string().nullable().optional(),
    temporary: z.boolean().optional(),
  })
  .strict()

export const visaSchema = z
  .object({
    country: z.string().min(1),
    type: z.string().nullable().optional(),
    number: z.string().nullable().optional(),
    issueDate: z.string().nullable().optional(),
    expiry: z.string().min(1),
  })
  .strict()

export const qualificationSchema = z
  .object({
    base: z.string().nullable().optional(),
    aircraftType: z.string().min(1),
    position: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().nullable().optional(),
    isPrimary: z.boolean().optional(),
    acFamilyQualified: z.boolean().optional(),
    trainingQuals: z.array(z.string()).optional(),
  })
  .strict()

export const qualificationUpdateSchema = qualificationSchema.partial().strict()

export const blockHoursSchema = z
  .object({
    aircraftType: z.string().min(1),
    position: z.string().min(1),
    blockHours: z.string().nullable().optional(),
    trainingHours: z.string().nullable().optional(),
    firstFlight: z.string().nullable().optional(),
    lastFlight: z.string().nullable().optional(),
  })
  .strict()

export const onOffPatternSchema = z
  .object({
    patternType: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().nullable().optional(),
    startingDay: z.number().int().optional(),
  })
  .strict()

export const airportRestrictionSchema = z
  .object({
    airport: z.string().min(1),
    type: z.enum(['RESTRICTED', 'PREFERRED']),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
  })
  .strict()

export const pairingSchema = z
  .object({
    type: z.enum(['Same', 'Not same']),
    what: z.enum(['Flights', 'Offs']),
    pairedCrewId: z.string().min(1),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
  })
  .strict()

export const rulesetSchema = z
  .object({
    name: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().nullable().optional(),
  })
  .strict()

export const groupAssignmentSchema = z
  .object({
    groupId: z.string().min(1),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
  })
  .strict()

export const expiryDateUpdateSchema = z
  .object({
    expiryDate: z.string().nullable().optional(),
    lastDone: z.string().nullable().optional(),
    baseMonth: z.string().nullable().optional(),
    nextPlanned: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
