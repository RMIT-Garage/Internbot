#!/usr/bin/env tsx
/**
 * Real-flow dev seed (HTTP only — no application / Firestore layer).
 *
 * Signs in pre-existing Firebase Auth accounts (one coordinator, one
 * student) via the Firebase Auth REST API, then walks the same paths a
 * real client would over HTTP to populate a wide variety of dev state
 * for UI work.
 *
 * Final seeded state (idempotent — re-runs converge on this):
 *   - 1 active semester (2026-S1 / INTE2710)
 *   - 1 student (profile complete, enrolled), 1 coordinator
 *   - Opportunities: 4 pre_approved published, 1 pre_approved draft,
 *     1 student-custom pending_verification, 1 student-custom verified+published
 *   - Internships: 1 applied, 1 offer_approved, 1 offer_changes_requested,
 *     1 rejected (each on its own opportunity to avoid duplicate-application)
 *   - 1 ticket opened by the student
 *
 * Each ensure-step is idempotent: it reads the current state via list/get
 * endpoints, skips writes when state already matches the target, and
 * advances state machines one transition at a time. Re-running the seed is
 * a no-op once everything converges.
 *
 * Safety (refuses to run otherwise):
 *   - SEED_API_BASE_URL must NOT contain "prod" (case-insensitive)
 *   - SEED_API_BASE_URL must contain "dev" OR SEED_FORCE=yes is set
 *
 * Required env vars:
 *   SEED_API_BASE_URL       e.g., https://internbot-dev-ae3a3.web.app
 *   SEED_FIREBASE_API_KEY   Firebase Web API key for the dev project
 *   SEED_COORD_EMAIL        existing dev coordinator account
 *   SEED_COORD_PASSWORD
 *   SEED_STUDENT_EMAIL      existing dev student account
 *   SEED_STUDENT_PASSWORD
 *
 * Optional:
 *   SEED_FORCE=yes          bypass the "must contain dev" URL guard
 *   SEED_SEMESTER_CODE      default: 2026-S1
 *   SEED_COURSE_CODE        default: INTE2710
 *
 * Usage:
 *   SEED_API_BASE_URL=https://internbot-dev-ae3a3.web.app \
 *   SEED_FIREBASE_API_KEY=AIza... \
 *   SEED_COORD_EMAIL=... SEED_COORD_PASSWORD=... \
 *   SEED_STUDENT_EMAIL=... SEED_STUDENT_PASSWORD=... \
 *     pnpm --filter backend run seed
 */

// --- config ---------------------------------------------------------------

interface SeedConfig {
  apiBaseUrl: string
  firebaseApiKey: string
  storageBucket: string
  coordEmail: string
  coordPassword: string
  studentEmail: string
  studentPassword: string
  semesterCode: string
  courseCode: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function loadConfigOrThrow(): SeedConfig {
  const apiBaseUrl = requireEnv('SEED_API_BASE_URL').replace(/\/+$/, '')
  const lower = apiBaseUrl.toLowerCase()

  if (lower.includes('prod')) {
    throw new Error(
      `Refusing to seed: SEED_API_BASE_URL="${apiBaseUrl}" looks like production. ` +
        `This script will not target a URL containing "prod".`
    )
  }
  if (!lower.includes('dev') && process.env.SEED_FORCE !== 'yes') {
    throw new Error(
      `Refusing to seed: SEED_API_BASE_URL="${apiBaseUrl}" does not contain "dev". ` +
        `Set SEED_FORCE=yes only if you are certain this is a dev environment.`
    )
  }

  return {
    apiBaseUrl,
    firebaseApiKey: requireEnv('SEED_FIREBASE_API_KEY'),
    storageBucket: process.env.SEED_STORAGE_BUCKET ?? 'internbot-dev-ae3a3-storage',
    coordEmail: requireEnv('SEED_COORD_EMAIL'),
    coordPassword: requireEnv('SEED_COORD_PASSWORD'),
    studentEmail: requireEnv('SEED_STUDENT_EMAIL'),
    studentPassword: requireEnv('SEED_STUDENT_PASSWORD'),
    semesterCode: process.env.SEED_SEMESTER_CODE ?? '2026-S1',
    courseCode: process.env.SEED_COURSE_CODE ?? 'INTE2710',
  }
}

// --- Firebase Auth REST sign-in -------------------------------------------

async function signInWithPassword(
  apiKey: string,
  email: string,
  password: string
): Promise<string> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(body)}`)
  }
  const idToken = body['idToken']
  if (typeof idToken !== 'string') {
    throw new Error(`Sign-in for ${email} returned no idToken`)
  }
  return idToken
}

// --- API client -----------------------------------------------------------

interface ApiClient {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
  patch<T>(path: string, body: unknown): Promise<T>
  put<T>(path: string, body: unknown): Promise<T>
}

function makeApiClient(baseUrl: string, idToken: string): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const init: RequestInit = {
      method,
      headers: {
        authorization: `Bearer ${idToken}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
    }
    if (body !== undefined) init.body = JSON.stringify(body)
    const res = await fetch(`${baseUrl}${path}`, init)
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 600)}`)
    }
    if (text.length === 0) return undefined as T
    return JSON.parse(text) as T
  }
  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    put: (path, body) => request('PUT', path, body),
  }
}

// --- Response shapes (only fields the seed reads) -------------------------

interface UserResponse {
  id: string
  role: 'student' | 'coordinator'
  email: string
  studentProfile?: {
    studentNumber: string
    profileStatus: 'incomplete' | 'complete'
    programCode?: string | null
    semesterId?: string | null
    academicInfo?: { gpa: number; programLevel: string } | null
  }
}

interface SemesterResponse {
  id: string
  semesterCode: string
  courseCode: string
  status: 'draft' | 'active' | 'archived'
}

interface OpportunityResponse {
  id: string
  semesterId: string
  type: 'pre_approved' | 'custom'
  status: 'draft' | 'pending_verification' | 'published' | 'rejected' | 'archived'
  employerName: string
  jobTitle: string
  sourceUrl?: string | null
}

interface InternshipResponse {
  id: string
  userId: string
  opportunityId: string
  status:
    | 'applied'
    | 'offer_pending_review'
    | 'offer_approved'
    | 'offer_changes_requested'
    | 'rejected'
    | 'withdrawn'
  opportunityEmployerName?: string
  opportunityJobTitle?: string
  attachmentUploadPathPrefix: string
  attachments: Array<{
    id: string
    fileName: string
    contentType: string
    uploadedAt: string
    uploadStatus: 'uploading' | 'finalized'
  }>
}

interface TicketResponse {
  id: string
  subject: string
  status: string
}

type ListResponse<T> = { items: T[] }

// --- helpers --------------------------------------------------------------

function isoZ(d: Date): string {
  // Backend timestamp regex rejects fractional seconds; strip them.
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function studentNumberFromEmail(email: string): string {
  const local = email.split('@')[0]
  if (!local) throw new Error(`Cannot derive student number from email: ${email}`)
  return local
}

// --- ensure: profile, semester, enrolment ---------------------------------

async function ensureStudentProfileComplete(
  studentApi: ApiClient,
  student: UserResponse
): Promise<void> {
  if (student.studentProfile?.profileStatus === 'complete') {
    process.stdout.write('  ↪ student profile already complete\n')
    return
  }
  process.stdout.write('  ↪ PATCH /users/me to complete student profile\n')
  await studentApi.patch<UserResponse>('/api/v1/users/me', {
    studentProfile: {
      studentNumber: studentNumberFromEmail(student.email),
      programCode: 'BP096',
      phone: '+61400000000',
      academicInfo: {
        programName: 'Bachelor of Software Engineering (Professional)',
        programLevel: 'undergraduate',
        unitsAttempted: 192,
        creditUnitsEarned: 168,
        gpa: 3.2,
        currentStudyLoad: 'full_time',
        programStatus: 'active_in_program',
        majors: ['Software Engineering'],
      },
    },
  })
}

async function ensureActiveSemester(
  coordApi: ApiClient,
  semesterCode: string,
  courseCode: string
): Promise<SemesterResponse> {
  const list = await coordApi.get<ListResponse<SemesterResponse>>('/api/v1/semesters?limit=50')
  const existing = list.items.find(
    (s) => s.semesterCode === semesterCode && s.courseCode === courseCode
  )
  if (existing) {
    process.stdout.write(
      `  ↪ semester ${semesterCode}/${courseCode} exists (id=${existing.id}, status=${existing.status})\n`
    )
    if (existing.status === 'active') return existing
    process.stdout.write(`  ↪ transitioning semester ${existing.id} → active\n`)
    await coordApi.post(`/api/v1/semesters/${existing.id}/transitions`, { to: 'active' })
    return { ...existing, status: 'active' }
  }
  process.stdout.write(`  ↪ creating semester ${semesterCode}/${courseCode}\n`)
  const dayMs = 24 * 60 * 60 * 1000
  const now = Date.now()
  return coordApi.post<SemesterResponse>('/api/v1/semesters', {
    semesterCode,
    courseCode,
    displayName: `Seeded ${semesterCode} / ${courseCode}`,
    status: 'active',
    enrolmentOpenAt: isoZ(new Date(now - 1 * dayMs)),
    enrolmentCloseAt: isoZ(new Date(now + 60 * dayMs)),
  })
}

async function ensureStudentEnrolled(studentApi: ApiClient, semesterId: string): Promise<void> {
  const me = await studentApi.get<UserResponse>('/api/v1/users/me')
  if (me.studentProfile?.semesterId === semesterId) {
    process.stdout.write('  ↪ student already enrolled\n')
    return
  }
  process.stdout.write(`  ↪ PUT /users/me/semester-selection → ${semesterId}\n`)
  await studentApi.put('/api/v1/users/me/semester-selection', { semesterId })
}

// --- ensure: opportunities ------------------------------------------------

interface CoordOpportunitySpec {
  employerName: string
  jobTitle: string
  sourceSlug: string
  targetStatus: 'published' | 'draft' | 'archived'
  workMode?: 'onsite' | 'hybrid' | 'remote'
  location?: string
}

async function findOpportunityByEmployer(
  api: ApiClient,
  employerName: string
): Promise<OpportunityResponse | undefined> {
  // The opportunities listing filters by status; we walk all known statuses
  // so we can find a seeded opportunity in any state for idempotency.
  const statuses = ['draft', 'pending_verification', 'published', 'rejected', 'archived']
  for (const status of statuses) {
    const list = await api.get<ListResponse<OpportunityResponse>>(
      `/api/v1/opportunities?status=${status}&limit=50`
    )
    const found = list.items.find((o) => o.employerName === employerName)
    if (found) return found
  }
  return undefined
}

async function ensureCoordOpportunity(
  coordApi: ApiClient,
  semesterId: string,
  spec: CoordOpportunitySpec
): Promise<OpportunityResponse> {
  let opp = await findOpportunityByEmployer(coordApi, spec.employerName)
  if (!opp) {
    process.stdout.write(`  ↪ creating coord opportunity "${spec.employerName}" (draft)\n`)
    opp = await coordApi.post<OpportunityResponse>('/api/v1/opportunities', {
      semesterId,
      type: 'pre_approved',
      employerName: spec.employerName,
      jobTitle: spec.jobTitle,
      descriptionText: `Seeded "${spec.employerName}" placement. 12-week duration.`,
      workMode: spec.workMode ?? 'hybrid',
      location: spec.location ?? 'Melbourne, VIC',
      sourceUrl: `https://careerhub.rmit.edu.au/jobs/${spec.sourceSlug}`,
    })
  }

  // Walk to target status one transition at a time. The opportunity state
  // machine is draft → published → archived (one-way per transition).
  if (opp.status === spec.targetStatus) {
    process.stdout.write(`  ↪ "${spec.employerName}" already ${opp.status}\n`)
    return opp
  }
  if (opp.status === 'draft' && spec.targetStatus === 'published') {
    process.stdout.write(`  ↪ publishing "${spec.employerName}"\n`)
    await coordApi.post(`/api/v1/opportunities/${opp.id}/transitions`, {
      to: 'published',
      comment: 'Seeded — publishing.',
    })
    return { ...opp, status: 'published' }
  }
  if (opp.status === 'draft' && spec.targetStatus === 'archived') {
    process.stdout.write(`  ↪ publishing → archiving "${spec.employerName}"\n`)
    await coordApi.post(`/api/v1/opportunities/${opp.id}/transitions`, {
      to: 'published',
      comment: 'Seeded — intermediate publish.',
    })
    await coordApi.post(`/api/v1/opportunities/${opp.id}/transitions`, {
      to: 'archived',
      comment: 'Seeded — archiving for coverage.',
    })
    return { ...opp, status: 'archived' }
  }
  if (opp.status === 'published' && spec.targetStatus === 'archived') {
    process.stdout.write(`  ↪ archiving "${spec.employerName}"\n`)
    await coordApi.post(`/api/v1/opportunities/${opp.id}/transitions`, {
      to: 'archived',
      comment: 'Seeded — archiving.',
    })
    return { ...opp, status: 'archived' }
  }
  process.stdout.write(
    `  ⚠ cannot drive "${spec.employerName}" from ${opp.status} → ${spec.targetStatus}; leaving as-is\n`
  )
  return opp
}

interface StudentCustomOpportunitySpec {
  employerName: string
  jobTitle: string
  targetStatus: 'pending_verification' | 'published' | 'rejected'
}

async function ensureStudentCustomOpportunity(
  studentApi: ApiClient,
  coordApi: ApiClient,
  spec: StudentCustomOpportunitySpec
): Promise<OpportunityResponse> {
  let opp = await findOpportunityByEmployer(studentApi, spec.employerName)
  if (!opp) {
    process.stdout.write(`  ↪ creating student custom opportunity "${spec.employerName}"\n`)
    opp = await studentApi.post<OpportunityResponse>('/api/v1/opportunities', {
      type: 'custom',
      employerName: spec.employerName,
      jobTitle: spec.jobTitle,
      descriptionText: `Seeded student-submitted opportunity from "${spec.employerName}".`,
      workMode: 'remote',
      location: 'Remote',
      sourceUrl: `https://example.com/${spec.employerName.toLowerCase().replace(/\W+/g, '-')}`,
    })
  }

  if (opp.status === spec.targetStatus) {
    process.stdout.write(`  ↪ "${spec.employerName}" already ${opp.status}\n`)
    return opp
  }
  if (opp.status === 'pending_verification' && spec.targetStatus === 'published') {
    process.stdout.write(`  ↪ coord verifies + approves "${spec.employerName}"\n`)
    await coordApi.post(`/api/v1/opportunities/${opp.id}/verifications`, {
      decision: 'approved',
      comment: 'Seeded — coordinator approval.',
    })
    return { ...opp, status: 'published' }
  }
  if (opp.status === 'pending_verification' && spec.targetStatus === 'rejected') {
    process.stdout.write(`  ↪ coord rejects "${spec.employerName}"\n`)
    await coordApi.post(`/api/v1/opportunities/${opp.id}/verifications`, {
      decision: 'rejected',
      comment: 'Seeded — coordinator rejection.',
    })
    return { ...opp, status: 'rejected' }
  }
  process.stdout.write(
    `  ⚠ cannot drive "${spec.employerName}" from ${opp.status} → ${spec.targetStatus}; leaving as-is\n`
  )
  return opp
}

// --- ensure: offer attachment (real upload via Firebase Storage REST) -----

/**
 * Minimal valid PDF used as the seeded offer letter. The Storage rule only
 * checks `contentType` is a non-empty string and `size < 25MB`, but using
 * real PDF bytes means coordinators clicking the download link in the UI
 * during dev work actually see a viewable document instead of a corrupt file.
 */
const TINY_PDF_BYTES: ArrayBuffer = (() => {
  const pdf =
    '%PDF-1.1\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 144 144]/Resources<<>>>>endobj\n' +
    'xref\n' +
    '0 4\n' +
    '0000000000 65535 f \n' +
    '0000000010 00000 n \n' +
    '0000000056 00000 n \n' +
    '0000000102 00000 n \n' +
    'trailer<</Size 4/Root 1 0 R>>\n' +
    'startxref\n' +
    '160\n' +
    '%%EOF\n'
  const bytes = new TextEncoder().encode(pdf)
  const out = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(out).set(bytes)
  return out
})()

interface UploadIntentResponse {
  attachmentId: string
  filePath: string
  uploadUrl: string
  uploadExpiresAt: string
  contentType: string
}

/**
 * How long to poll waiting for the storage `OBJECT_FINALIZE` event to flip
 * the pre-written attachment subdoc from `uploading` → `finalized`. In
 * production this round-trip is typically sub-second; the wider window
 * tolerates Pub/Sub redelivery and cold-start latency on the worker.
 */
const FINALIZE_POLL_TIMEOUT_MS = 30_000
const FINALIZE_POLL_INTERVAL_MS = 1_000

async function waitForFinalized(
  studentApi: ApiClient,
  internshipId: string,
  attachmentId: string
): Promise<void> {
  const deadline = Date.now() + FINALIZE_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const internship = await studentApi.get<InternshipResponse>(
      `/api/v1/internships/${internshipId}`
    )
    const attachment = internship.attachments.find((a) => a.id === attachmentId)
    if (attachment?.uploadStatus === 'finalized') return
    await new Promise((resolve) => setTimeout(resolve, FINALIZE_POLL_INTERVAL_MS))
  }
  throw new Error(
    `Attachment ${attachmentId} on internship ${internshipId} did not transition ` +
      `to 'finalized' within ${FINALIZE_POLL_TIMEOUT_MS}ms. The OBJECT_FINALIZE ` +
      `event handler may not be deployed or the Eventarc trigger has not been ` +
      `provisioned for this environment.`
  )
}

async function uploadOfferAttachmentIfMissing(
  studentApi: ApiClient,
  internshipId: string
): Promise<void> {
  const internship = await studentApi.get<InternshipResponse>(`/api/v1/internships/${internshipId}`)
  const alreadyFinalized = internship.attachments.find((a) => a.uploadStatus === 'finalized')
  if (alreadyFinalized) {
    process.stdout.write(`  ↪ ${internshipId}: offer attachment already finalized\n`)
    return
  }

  // Backend-mediated upload flow: backend mints a V4 signed PUT URL after
  // running domain authz. The signed URL itself authorizes the upload — no
  // Firebase Auth on the PUT, no Storage rules, no cross-service IAM. The
  // intent endpoint pre-writes the attachment subdoc in `uploading` state;
  // the Cloud Storage OBJECT_FINALIZE event flips it to `finalized` after
  // the upload lands. Offer submission requires at least one `finalized`
  // attachment, so we poll until the event handler catches up.
  process.stdout.write(`  ↪ ${internshipId}: requesting upload intent from backend\n`)
  const intent = await studentApi.post<UploadIntentResponse>(
    `/api/v1/internships/${internshipId}/attachments/upload-intents`,
    { fileName: 'offer-letter.pdf', contentType: 'application/pdf' }
  )

  process.stdout.write(`  ↪ ${internshipId}: PUT bytes to signed Cloud Storage URL\n`)
  const putRes = await fetch(intent.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'application/pdf' },
    body: TINY_PDF_BYTES,
  })
  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '')
    throw new Error(
      `Signed-URL upload failed for ${intent.filePath}: HTTP ${putRes.status} ${text.slice(0, 400)}`
    )
  }

  process.stdout.write(
    `  ↪ ${internshipId}: waiting for OBJECT_FINALIZE worker to mark attachment finalized\n`
  )
  await waitForFinalized(studentApi, internshipId, intent.attachmentId)
  process.stdout.write(`  ↪ ${internshipId}: uploaded (attachmentId=${intent.attachmentId})\n`)
}

// --- ensure: internships --------------------------------------------------

async function ensureInternship(
  studentApi: ApiClient,
  studentId: string,
  opportunityId: string
): Promise<InternshipResponse> {
  const list = await studentApi.get<ListResponse<InternshipResponse>>(
    `/api/v1/internships?userId=${encodeURIComponent(studentId)}&limit=50`
  )
  const existing = list.items.find((i) => i.opportunityId === opportunityId)
  if (existing) return existing
  process.stdout.write(`  ↪ applying to ${opportunityId}\n`)
  return studentApi.post<InternshipResponse>('/api/v1/internships', { opportunityId })
}

type InternshipTarget =
  | 'applied'
  | 'offer_pending_review'
  | 'offer_approved'
  | 'offer_changes_requested'
  | 'rejected'

async function driveInternshipTo(
  studentApi: ApiClient,
  coordApi: ApiClient,
  internshipId: string,
  target: InternshipTarget
): Promise<InternshipResponse> {
  // Refetch authoritative state; the cached `internship` returned by
  // ensureInternship may be stale across iterations.
  let current = await studentApi.get<InternshipResponse>(`/api/v1/internships/${internshipId}`)
  if (current.status === target) {
    process.stdout.write(`  ↪ internship ${internshipId} already ${current.status}\n`)
    return current
  }

  const dayMs = 24 * 60 * 60 * 1000
  const now = Date.now()
  const offerBody = {
    offerDate: isoZ(new Date(now - 7 * dayMs)),
    startDate: isoZ(new Date(now + 14 * dayMs)),
    endDate: isoZ(new Date(now + 14 * dayMs + 84 * dayMs)),
  }

  if (current.status === 'applied' && target !== 'applied') {
    await uploadOfferAttachmentIfMissing(studentApi, internshipId)
    process.stdout.write(`  ↪ ${internshipId}: submit offer\n`)
    await studentApi.post(`/api/v1/internships/${internshipId}/offer-submissions`, offerBody)
    current = await studentApi.get<InternshipResponse>(`/api/v1/internships/${internshipId}`)
  }
  if (current.status === 'offer_pending_review' && target === 'offer_approved') {
    process.stdout.write(`  ↪ ${internshipId}: coord approves offer\n`)
    await coordApi.post(`/api/v1/internships/${internshipId}/decisions`, {
      decision: 'approved',
      comment: 'Seeded — approving offer.',
    })
  } else if (current.status === 'offer_pending_review' && target === 'offer_changes_requested') {
    process.stdout.write(`  ↪ ${internshipId}: coord requests changes\n`)
    await coordApi.post(`/api/v1/internships/${internshipId}/decisions`, {
      decision: 'changes_requested',
      comment: 'Seeded — requesting changes.',
    })
  } else if (current.status === 'offer_pending_review' && target === 'rejected') {
    process.stdout.write(`  ↪ ${internshipId}: coord rejects offer\n`)
    await coordApi.post(`/api/v1/internships/${internshipId}/decisions`, {
      decision: 'rejected',
      comment: 'Seeded — rejecting offer.',
    })
  }
  return studentApi.get<InternshipResponse>(`/api/v1/internships/${internshipId}`)
}

// --- ensure: ticket -------------------------------------------------------

async function ensureSeedTicket(
  studentApi: ApiClient,
  subject: string,
  body: string,
  category: string
): Promise<TicketResponse> {
  const list = await studentApi.get<ListResponse<TicketResponse>>('/api/v1/tickets?limit=50')
  const existing = list.items.find((t) => t.subject === subject)
  if (existing) {
    process.stdout.write(`  ↪ ticket "${subject}" already exists (${existing.status})\n`)
    return existing
  }
  process.stdout.write(`  ↪ creating ticket "${subject}"\n`)
  return studentApi.post<TicketResponse>('/api/v1/tickets', { subject, body, category })
}

// --- verify final state ---------------------------------------------------

async function verifyFinalState(
  studentApi: ApiClient,
  coordApi: ApiClient,
  expected: {
    studentId: string
    semesterId: string
    coordOpportunityCount: number
    internshipsByStatus: Record<string, number>
    ticketCount: number
  }
): Promise<void> {
  const student = await studentApi.get<UserResponse>('/api/v1/users/me')
  if (student.studentProfile?.profileStatus !== 'complete') {
    throw new Error(
      `verify: student profileStatus expected "complete", got "${student.studentProfile?.profileStatus}"`
    )
  }
  if (student.studentProfile?.semesterId !== expected.semesterId) {
    throw new Error(
      `verify: student semesterId expected "${expected.semesterId}", got "${student.studentProfile?.semesterId}"`
    )
  }

  const opportunities = await coordApi.get<ListResponse<OpportunityResponse>>(
    '/api/v1/opportunities?limit=100'
  )
  const seedOpps = opportunities.items.filter((o) => o.employerName.includes('(seed)'))
  if (seedOpps.length < expected.coordOpportunityCount) {
    throw new Error(
      `verify: seed opportunities expected ≥ ${expected.coordOpportunityCount}, got ${seedOpps.length}`
    )
  }

  const internships = await studentApi.get<ListResponse<InternshipResponse>>(
    `/api/v1/internships?userId=${encodeURIComponent(expected.studentId)}&limit=50`
  )
  for (const [status, count] of Object.entries(expected.internshipsByStatus)) {
    const got = internships.items.filter((i) => i.status === status).length
    if (got < count) {
      process.stdout.write(
        `  ⚠ verify: internships with status="${status}" expected ≥ ${count}, got ${got} ` +
          `(likely blocked by storage-rule 403 on offer-attachment upload)\n`
      )
    }
  }
  const byStatus = internships.items.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1
    return acc
  }, {})
  process.stdout.write(`  ℹ internship statuses observed: ${JSON.stringify(byStatus)}\n`)

  const tickets = await studentApi.get<ListResponse<TicketResponse>>('/api/v1/tickets?limit=50')
  if (tickets.items.length < expected.ticketCount) {
    throw new Error(
      `verify: tickets expected ≥ ${expected.ticketCount}, got ${tickets.items.length}`
    )
  }

  process.stdout.write('  ✓ verifyFinalState: all assertions passed\n')
}

// --- main -----------------------------------------------------------------

async function main(): Promise<void> {
  const config = loadConfigOrThrow()
  process.stdout.write(`▶ target: ${config.apiBaseUrl}\n`)

  process.stdout.write('▶ signing in coordinator + student\n')
  const [coordTok, studentTok] = await Promise.all([
    signInWithPassword(config.firebaseApiKey, config.coordEmail, config.coordPassword),
    signInWithPassword(config.firebaseApiKey, config.studentEmail, config.studentPassword),
  ])
  const coordApi = makeApiClient(config.apiBaseUrl, coordTok)
  const studentApi = makeApiClient(config.apiBaseUrl, studentTok)

  process.stdout.write('▶ JIT-bootstrapping platform users\n')
  const [coord, student] = await Promise.all([
    coordApi.get<UserResponse>('/api/v1/users/me'),
    studentApi.get<UserResponse>('/api/v1/users/me'),
  ])
  if (coord.role !== 'coordinator') {
    throw new Error(
      `Expected ${config.coordEmail} role=coordinator, got role=${coord.role}. Has this account been promoted?`
    )
  }
  if (student.role !== 'student') {
    throw new Error(`Expected ${config.studentEmail} role=student, got role=${student.role}.`)
  }

  process.stdout.write('▶ student profile\n')
  await ensureStudentProfileComplete(studentApi, student)

  process.stdout.write('▶ active semester\n')
  const semester = await ensureActiveSemester(coordApi, config.semesterCode, config.courseCode)

  process.stdout.write('▶ student semester enrolment\n')
  await ensureStudentEnrolled(studentApi, semester.id)

  process.stdout.write('▶ coordinator opportunities (4 published, 1 draft)\n')
  const acme = await ensureCoordOpportunity(coordApi, semester.id, {
    employerName: 'Acme Robotics (seed)',
    jobTitle: 'Software Engineering Intern',
    sourceSlug: 'seed-2026-acme',
    targetStatus: 'published',
  })
  const beta = await ensureCoordOpportunity(coordApi, semester.id, {
    employerName: 'BetaCorp Analytics (seed)',
    jobTitle: 'Data Engineering Intern',
    sourceSlug: 'seed-2026-beta',
    targetStatus: 'published',
    workMode: 'onsite',
    location: 'Sydney, NSW',
  })
  const gamma = await ensureCoordOpportunity(coordApi, semester.id, {
    employerName: 'GammaInc Cloud (seed)',
    jobTitle: 'DevOps Intern',
    sourceSlug: 'seed-2026-gamma',
    targetStatus: 'published',
    workMode: 'remote',
    location: 'Remote',
  })
  const delta = await ensureCoordOpportunity(coordApi, semester.id, {
    employerName: 'DeltaCo Mobile (seed)',
    jobTitle: 'iOS Engineering Intern',
    sourceSlug: 'seed-2026-delta',
    targetStatus: 'published',
  })
  const epsilon = await ensureCoordOpportunity(coordApi, semester.id, {
    employerName: 'EpsilonX Draft (seed)',
    jobTitle: 'Backend Intern (Unpublished)',
    sourceSlug: 'seed-2026-epsilon',
    targetStatus: 'draft',
  })

  process.stdout.write('▶ student-custom opportunities (1 published, 1 pending)\n')
  const customApproved = await ensureStudentCustomOpportunity(studentApi, coordApi, {
    employerName: 'Student Custom Approved (seed)',
    jobTitle: 'Self-Proposed Placement',
    targetStatus: 'published',
  })
  const customPending = await ensureStudentCustomOpportunity(studentApi, coordApi, {
    employerName: 'Student Custom Pending (seed)',
    jobTitle: 'Self-Proposed Placement (Awaiting Review)',
    targetStatus: 'pending_verification',
  })

  process.stdout.write('▶ internships in 4 states\n')
  const intApplied = await ensureInternship(studentApi, student.id, acme.id)
  await driveInternshipTo(studentApi, coordApi, intApplied.id, 'applied')

  const intApproved = await ensureInternship(studentApi, student.id, beta.id)
  await driveInternshipTo(studentApi, coordApi, intApproved.id, 'offer_approved')

  const intChanges = await ensureInternship(studentApi, student.id, gamma.id)
  await driveInternshipTo(studentApi, coordApi, intChanges.id, 'offer_changes_requested')

  const intRejected = await ensureInternship(studentApi, student.id, delta.id)
  await driveInternshipTo(studentApi, coordApi, intRejected.id, 'rejected')

  process.stdout.write('▶ student support ticket\n')
  const ticket = await ensureSeedTicket(
    studentApi,
    'Seed: Question about study load requirement',
    'Seeded ticket — student is asking about whether part-time study qualifies for placement credit.',
    'eligibility'
  )

  process.stdout.write('▶ verifying final state\n')
  await verifyFinalState(studentApi, coordApi, {
    studentId: student.id,
    semesterId: semester.id,
    coordOpportunityCount: 7,
    internshipsByStatus: {
      applied: 1,
      offer_approved: 1,
      offer_changes_requested: 1,
      rejected: 1,
    },
    ticketCount: 1,
  })

  process.stdout.write('\n✓ seed complete\n')
  process.stdout.write(`  coordinator  → users/${coord.id} (${coord.email})\n`)
  process.stdout.write(`  student      → users/${student.id} (${student.email})\n`)
  process.stdout.write(`  semester     → semesters/${semester.id} (${semester.semesterCode})\n`)
  process.stdout.write(
    `  opportunity  → opportunities/${acme.id}             (pre_approved, published)\n`
  )
  process.stdout.write(
    `  opportunity  → opportunities/${beta.id}             (pre_approved, published)\n`
  )
  process.stdout.write(
    `  opportunity  → opportunities/${gamma.id}            (pre_approved, published)\n`
  )
  process.stdout.write(
    `  opportunity  → opportunities/${delta.id}            (pre_approved, published)\n`
  )
  process.stdout.write(
    `  opportunity  → opportunities/${epsilon.id}          (pre_approved, draft)\n`
  )
  process.stdout.write(
    `  opportunity  → opportunities/${customApproved.id}   (custom, published)\n`
  )
  process.stdout.write(
    `  opportunity  → opportunities/${customPending.id}    (custom, pending_verification)\n`
  )
  // Re-fetch actual internship statuses for the summary — they may be
  // "applied" instead of the target if Storage 403s blocked offer submission.
  const finalStatuses = await Promise.all(
    [intApplied, intApproved, intChanges, intRejected].map((i) =>
      studentApi.get<InternshipResponse>(`/api/v1/internships/${i.id}`)
    )
  )
  for (const i of finalStatuses) {
    process.stdout.write(`  internship   → internships/${i.id} (${i.status})\n`)
  }
  process.stdout.write(`  ticket       → tickets/${ticket.id}\n`)
}

void main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write('Seed failed: ' + message + '\n')
  if (err instanceof Error && err.stack !== undefined) {
    process.stderr.write(err.stack + '\n')
  }
  process.exitCode = 1
})
