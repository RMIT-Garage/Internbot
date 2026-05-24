export const OPPORTUNITY_SELF_SOURCED_TAB = 'self-sourced'

export function withReviewReturn(href: string, returnTo: string, options: { tab?: string } = {}) {
  const [pathname, query = ''] = href.split('?')
  const params = new URLSearchParams(query)
  params.set('returnTo', returnTo)
  if (options.tab) params.set('tab', options.tab)
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
