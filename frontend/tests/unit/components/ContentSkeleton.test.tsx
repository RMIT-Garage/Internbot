import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

import {
  AnalyticsStripSkeleton,
  CardGridSkeleton,
  ContentSkeleton,
  DetailHeroSkeleton,
  KpiCardSkeleton,
  ListRowsSkeleton,
  Skeleton,
  TableRowsSkeleton,
} from '@/components/ui/ContentSkeleton'

describe('Skeleton primitive', () => {
  it('renders an aria-hidden shimmer div with the default classes', () => {
    const { container } = render(<Skeleton />)
    const node = container.firstChild as HTMLElement
    expect(node).toBeInTheDocument()
    expect(node).toHaveAttribute('aria-hidden', 'true')
    expect(node.className).toContain('animate-pulse')
    expect(node.className).toContain('rounded-full')
    expect(node.className).toContain('bg-slate-100')
  })

  it('merges incoming className so callers can override width/height', () => {
    const { container } = render(<Skeleton className="h-12 w-32 bg-slate-200" />)
    const node = container.firstChild as HTMLElement
    expect(node.className).toContain('h-12')
    expect(node.className).toContain('w-32')
    expect(node.className).toContain('bg-slate-200')
    expect(node.className).toContain('animate-pulse')
  })
})

describe('ContentSkeleton', () => {
  it('exposes the live-region attributes and a screen-reader label', () => {
    const { getByText, container } = render(<ContentSkeleton title="Loading dashboard" />)
    expect(getByText('Loading dashboard')).toHaveClass('sr-only')
    const root = container.firstChild as HTMLElement
    expect(root).toHaveAttribute('aria-busy', 'true')
    expect(root).toHaveAttribute('aria-live', 'polite')
  })

  it('renders three KPI placeholders by default', () => {
    const { container } = render(<ContentSkeleton title="Loading" />)
    const kpiGrid = container.querySelector('.grid.gap-4.md\\:grid-cols-3')
    expect(kpiGrid?.children).toHaveLength(3)
  })
})

describe('KpiCardSkeleton', () => {
  it('renders the card frame with a body row and a progress bar', () => {
    const { container } = render(<KpiCardSkeleton />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('rounded-2xl')
    expect(card.className).toContain('border')
    // Two children: the title/value/detail + icon row, and the progress bar
    expect(card.children).toHaveLength(2)
  })

  it('reserves space for the icon block to prevent layout shift', () => {
    const { container } = render(<KpiCardSkeleton />)
    // The icon-block placeholder should be a 10x10 rounded-xl skeleton
    expect(container.querySelector('.h-10.w-10.rounded-xl')).toBeTruthy()
  })
})

describe('AnalyticsStripSkeleton', () => {
  it('renders four tile placeholders', () => {
    const { container } = render(<AnalyticsStripSkeleton />)
    const strip = container.firstChild as HTMLElement
    expect(strip.children).toHaveLength(4)
  })
})

describe('CardGridSkeleton', () => {
  it('renders the requested number of card placeholders', () => {
    const { container, getByText } = render(<CardGridSkeleton count={4} label="Loading cards" />)
    expect(getByText('Loading cards')).toHaveClass('sr-only')
    const grid = container.querySelector('.grid')
    expect(grid?.children).toHaveLength(4)
  })

  it('defaults to 6 cards when count is omitted', () => {
    const { container } = render(<CardGridSkeleton label="Loading cards" />)
    const grid = container.querySelector('.grid')
    expect(grid?.children).toHaveLength(6)
  })
})

describe('ListRowsSkeleton', () => {
  it('renders the requested number of row placeholders', () => {
    const { container, getByText } = render(<ListRowsSkeleton count={3} label="Loading list" />)
    expect(getByText('Loading list')).toHaveClass('sr-only')
    const root = container.firstChild as HTMLElement
    // root has sr-only <p> + N rows
    expect(root.children).toHaveLength(1 + 3)
  })

  it('defaults to 4 rows', () => {
    const { container } = render(<ListRowsSkeleton label="Loading" />)
    const root = container.firstChild as HTMLElement
    expect(root.children).toHaveLength(1 + 4)
  })
})

describe('DetailHeroSkeleton', () => {
  it('renders a hero card and a 4-cell stat grid', () => {
    const { container, getByText } = render(<DetailHeroSkeleton label="Loading detail" />)
    expect(getByText('Loading detail')).toHaveClass('sr-only')
    const statGrid = container.querySelector('.grid.gap-4.md\\:grid-cols-2')
    expect(statGrid?.children).toHaveLength(4)
  })
})

describe('TableRowsSkeleton', () => {
  it('renders the requested number of rows with the right column count', () => {
    const { container } = render(
      <table>
        <TableRowsSkeleton columns={4} rows={3} />
      </table>
    )
    const body = container.querySelector('tbody')
    expect(body).toBeTruthy()
    expect(body?.children).toHaveLength(3)
    body?.querySelectorAll('tr').forEach((row) => {
      expect(row.children).toHaveLength(4)
    })
  })

  it('defaults to 5 rows when rows is omitted', () => {
    const { container } = render(
      <table>
        <TableRowsSkeleton columns={3} />
      </table>
    )
    expect(container.querySelector('tbody')?.children).toHaveLength(5)
  })
})
