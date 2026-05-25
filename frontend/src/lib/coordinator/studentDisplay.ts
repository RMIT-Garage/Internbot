export const STUDENT_PROFILE_PENDING = 'Student profile pending'

interface StudentDisplayInput {
  studentNumber?: string | null
  displayName?: string | null
  fullName?: string | null
  name?: string | null
  studentId?: string | null
  userId?: string | null
  id?: string | null
  studentProfile?: {
    studentNumber?: string | null
  } | null
}

export function formatStudentDisplay(student: StudentDisplayInput | null | undefined) {
  if (!student) return STUDENT_PROFILE_PENDING

  const studentNumber = firstUsable([
    student.studentNumber,
    student.studentProfile?.studentNumber,
    looksLikeStudentNumber(student.studentId) ? student.studentId : null,
  ])
  if (studentNumber) return studentNumber

  const readableName = firstUsable([student.displayName, student.fullName, student.name])
  if (readableName && !isSeedStudentName(readableName) && !looksLikeRawUserId(readableName)) {
    return readableName
  }

  return STUDENT_PROFILE_PENDING
}

export function formatStudentDisplayFromIds(studentId?: string | null, userId?: string | null) {
  return formatStudentDisplay({ studentId, userId })
}

function firstUsable(values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return null
}

function looksLikeStudentNumber(value?: string | null) {
  return Boolean(value?.trim().match(/^s\d{6,}$/i))
}

function looksLikeRawUserId(value: string) {
  const trimmed = value.trim()
  return /^[A-Za-z0-9_-]{16,}$/.test(trimmed) && !looksLikeStudentNumber(trimmed)
}

function isSeedStudentName(value: string) {
  return /^(test|demo|sample)\s+student\b/i.test(value.trim())
}
