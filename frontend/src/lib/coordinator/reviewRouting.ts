export const OPPORTUNITY_SELF_SOURCED_TAB = 'self-sourced'
export const SELF_SOURCED_REVIEW_CONTEXT = 'self-sourced-review'
export const PLACEMENT_PROCESSING_CONTEXT = 'placement-processing'

export function isSelfSourcedOpportunityRecord(input: {
  type: string
  submittedByUserId?: string | null
}) {
  const type = String(input.type).toLowerCase()
  return (type === 'custom' || type === 'self_sourced') && Boolean(input.submittedByUserId)
}

export function opportunityReviewHrefOptions(input: {
  type: string
  submittedByUserId?: string | null
}) {
  if (isSelfSourcedOpportunityRecord(input)) {
    return { tab: OPPORTUNITY_SELF_SOURCED_TAB, context: SELF_SOURCED_REVIEW_CONTEXT }
  }
  return {}
}

export function opportunityReviewHref(
  opportunityId: string,
  returnTo: string,
  input: { type: string; submittedByUserId?: string | null }
) {
  const options = opportunityReviewHrefOptions(input)
  return withReviewReturn(
    `/coordinator/jobs/review?id=${encodeURIComponent(opportunityId)}`,
    returnTo,
    options
  )
}

export function withReviewReturn(
  href: string,
  returnTo: string,
  options: { tab?: string; context?: string } = {}
) {
  const [pathname, query = ''] = href.split('?')
  const params = new URLSearchParams(query)
  params.set('returnTo', returnTo)
  if (options.tab) params.set('tab', options.tab)
  if (options.context) params.set('context', options.context)
  return `${pathname}?${params.toString()}`
}

export function getReviewBackHref(
  searchParams: URLSearchParams | ReadonlyURLSearchParamsLike,
  fallbackHref: string
) {
  const href = normalizeCoordinatorReturnTo(searchParams.get('returnTo')) ?? fallbackHref
  const tab = searchParams.get('tab')

  if (tab && href.startsWith('/coordinator/opportunities')) {
    const [pathname, query = ''] = href.split('?')
    const params = new URLSearchParams(query)
    if (!params.has('tab')) params.set('tab', tab)
    return `${pathname}?${params.toString()}`
  }

  return href
}

function normalizeCoordinatorReturnTo(value: string | null) {
  if (!value || !value.startsWith('/coordinator/') || value.startsWith('//')) return null
  return value
}

interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null
}
