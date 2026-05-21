/**
 * Apply-to-opportunity flow.
 *
 * The Apply button must hit `POST /api/v1/internships` via the generated
 * `InternshipsService.createInternship` client. On success, the user sees a
 * toast and the card flips to "Applied". On the four documented 409 reasons,
 * the user gets a friendly toast instead of the raw backend message.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const listOpportunitiesMock = vi.fn()
const listInternshipsMock = vi.fn()
const createInternshipMock = vi.fn()
const listSemestersMock = vi.fn()
const getMyProfileMock = vi.fn()

const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('semesterId=sem-1'),
}))

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))

vi.mock('@/lib/api/openapi-client', () => ({
  OpportunitiesService: { listOpportunities: listOpportunitiesMock },
  InternshipsService: {
    listInternships: listInternshipsMock,
    createInternship: createInternshipMock,
  },
  SemestersService: { listSemesters: listSemestersMock },
  UsersService: { getMyProfile: getMyProfileMock },
}))

const { default: OpportunitiesClient } =
  await import('@/app/student/opportunities/OpportunitiesClient')

const PUBLISHED_OPPORTUNITY = {
  id: 'opp-1',
  semesterId: 'sem-1',
  jobTitle: 'Frontend Intern',
  employerName: 'Acme Co',
  type: 'pre_approved',
  status: 'published',
  workMode: 'remote',
  location: 'Melbourne',
  sourceUrl: null,
  applicationCount: 0,
  attachments: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const CREATED_INTERNSHIP_ITEM = {
  id: 'int-1',
  userId: 'user-1',
  opportunityId: 'opp-1',
  studentProgramCode: null,
  opportunityEmployerName: 'Acme Co',
  opportunityJobTitle: 'Frontend Intern',
  opportunityType: 'pre_approved',
  opportunitySourceUrl: null,
  status: 'applied',
  lastSubmittedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
}

function apiConflict(reason: string) {
  return Object.assign(new Error('conflict'), {
    body: { error: { reason } },
  })
}

describe('Student opportunities · Apply button', () => {
  beforeEach(() => {
    listOpportunitiesMock.mockReset()
    listInternshipsMock.mockReset()
    createInternshipMock.mockReset()
    listSemestersMock.mockReset()
    getMyProfileMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()

    listOpportunitiesMock.mockResolvedValue({ items: [PUBLISHED_OPPORTUNITY] })
    listInternshipsMock.mockResolvedValue({ items: [] })
    listSemestersMock.mockResolvedValue({ items: [] })
    getMyProfileMock.mockResolvedValue({ role: 'student', studentProfile: { semesterId: 'sem-1' } })
  })

  it('calls createInternship with the opportunity id on click', async () => {
    createInternshipMock.mockResolvedValue({})
    listInternshipsMock.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({
      items: [CREATED_INTERNSHIP_ITEM],
    })

    const user = userEvent.setup()
    render(<OpportunitiesClient />)

    const applyBtn = await screen.findByRole('button', { name: /^apply$/i })
    await user.click(applyBtn)

    await waitFor(() =>
      expect(createInternshipMock).toHaveBeenCalledWith({ opportunityId: 'opp-1' })
    )
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled())
    expect(toastSuccessMock.mock.calls[0]?.[0]).toMatch(/applied to frontend intern/i)
  })

  it('flips the card to "Applied" after a successful apply', async () => {
    createInternshipMock.mockResolvedValue({})
    listInternshipsMock.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({
      items: [CREATED_INTERNSHIP_ITEM],
    })

    const user = userEvent.setup()
    render(<OpportunitiesClient />)

    await user.click(await screen.findByRole('button', { name: /^apply$/i }))

    await waitFor(() => expect(screen.getByText(/^applied$/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^apply$/i })).not.toBeInTheDocument()
  })

  it('shows the friendly duplicate-application message on 409 duplicate_application', async () => {
    createInternshipMock.mockRejectedValue(apiConflict('duplicate_application'))

    const user = userEvent.setup()
    render(<OpportunitiesClient />)

    await user.click(await screen.findByRole('button', { name: /^apply$/i }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('You have already applied to this opportunity.')
    )
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('explains semester-not-selected on 409 student_has_no_selected_semester', async () => {
    createInternshipMock.mockRejectedValue(apiConflict('student_has_no_selected_semester'))

    const user = userEvent.setup()
    render(<OpportunitiesClient />)

    await user.click(await screen.findByRole('button', { name: /^apply$/i }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Select a semester before applying. Go back and choose one first.'
      )
    )
  })

  it('explains opportunity-not-published on 409 opportunity_not_published', async () => {
    createInternshipMock.mockRejectedValue(apiConflict('opportunity_not_published'))

    const user = userEvent.setup()
    render(<OpportunitiesClient />)

    await user.click(await screen.findByRole('button', { name: /^apply$/i }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'This opportunity is no longer accepting applications.'
      )
    )
  })

  it('explains semester-mismatch on 409 opportunity_semester_mismatch', async () => {
    createInternshipMock.mockRejectedValue(apiConflict('opportunity_semester_mismatch'))

    const user = userEvent.setup()
    render(<OpportunitiesClient />)

    await user.click(await screen.findByRole('button', { name: /^apply$/i }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'This opportunity is not part of your selected semester.'
      )
    )
  })

  it('falls back to the raw error message when reason is unrecognized', async () => {
    createInternshipMock.mockRejectedValue(new Error('Server exploded'))

    const user = userEvent.setup()
    render(<OpportunitiesClient />)

    await user.click(await screen.findByRole('button', { name: /^apply$/i }))

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Server exploded'))
  })
})
