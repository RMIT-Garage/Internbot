export type SortDirection = 'asc' | 'desc'

export function getSingleParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key]
  return Array.isArray(value) ? value[0] : value
}

export function matchesParam(value: string, filter?: string) {
  return !filter || filter === 'all' || value === filter
}

export function compareByDate(a: string, b: string, direction: SortDirection) {
  const diff = new Date(a).getTime() - new Date(b).getTime()
  return direction === 'asc' ? diff : -diff
}

export function paginate<Row>(rows: Row[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize

  return {
    rows: rows.slice(start, start + pageSize),
    page: safePage,
    totalPages,
  }
}

export function pageHref(
  searchParams: Record<string, string | string[] | undefined>,
  page: number
) {
  const params = new URLSearchParams()

  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === 'page') {
      return
    }

    const singleValue = Array.isArray(value) ? value[0] : value
    if (singleValue) {
      params.set(key, singleValue)
    }
  })

  params.set('page', String(page))
  return `?${params.toString()}`
}

export function sortHref(
  searchParams: Record<string, string | string[] | undefined>,
  sort: string
) {
  const params = new URLSearchParams()
  const currentSort = getSingleParam(searchParams, 'sort')
  const currentDirection = getSingleParam(searchParams, 'direction')
  const nextDirection = currentSort === sort && currentDirection === 'asc' ? 'desc' : 'asc'

  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === 'page' || key === 'sort' || key === 'direction') {
      return
    }

    const singleValue = Array.isArray(value) ? value[0] : value
    if (singleValue) {
      params.set(key, singleValue)
    }
  })

  params.set('sort', sort)
  params.set('direction', nextDirection)
  return `?${params.toString()}`
}
