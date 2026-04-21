/**
 * Firestore storage schema for the `users` collection.
 *
 * Zod lives at the infrastructure boundary — it validates what crosses the
 * persistence/domain line. Domain types (entities, value objects) stay pure
 * TypeScript. Timestamps are Firestore `Timestamp` instances at this layer;
 * the mapper in `../mappers/user.ts` converts them to domain `Date` values.
 */

import { z } from 'zod'
import { Timestamp } from 'firebase-admin/firestore'
import {
  onboardingStageValues,
  profileStatusValues,
  programLevelValues,
  programStatusValues,
  roleValues,
  studyLoadValues,
  userStatusValues,
} from '../../../domain/value-objects/user-enums'

const firestoreTimestamp = z.instanceof(Timestamp)

export const academicInfoStorageSchema = z.object({
  programName: z.string().min(1),
  programLevel: z.enum(programLevelValues),
  programStatus: z.enum(programStatusValues).optional(),
  majors: z.array(z.string()).optional(),
  minors: z.array(z.string()).optional(),
  unitsAttempted: z.number().nonnegative(),
  creditUnitsEarned: z.number().nonnegative(),
  gpa: z.number().min(0).max(4),
  currentStudyLoad: z.enum(studyLoadValues),
  notes: z.string().optional(),
  confirmedAt: firestoreTimestamp.optional(),
})

export const studentProfileStorageSchema = z.object({
  studentNumber: z.string().min(1),
  programCode: z.string().optional(),
  phone: z.string().optional(),
  academicInfo: academicInfoStorageSchema.optional(),
  semesterId: z.string().optional(),
  semesterSelectedAt: firestoreTimestamp.optional(),
  profileStatus: z.enum(profileStatusValues),
})

export const userStorageSchema = z.object({
  firebaseUid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().optional(),
  role: z.enum(roleValues),
  status: z.enum(userStatusValues),
  onboardingStage: z.enum(onboardingStageValues),
  studentProfile: studentProfileStorageSchema.optional(),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
  _schemaVersion: z.literal(1),
})

export type UserStorage = z.infer<typeof userStorageSchema>
