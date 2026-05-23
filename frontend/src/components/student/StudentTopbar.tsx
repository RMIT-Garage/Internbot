'use client'

import Link from 'next/link'
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  User,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ComponentType } from 'react'

import { useAuth } from '@/hooks/useAuth'
import {
  InternshipsService,
  OpportunitiesService,
  SemestersService,
} from '@/lib/api/openapi-client'
import type {
  InternshipListItemResponse,
  OpportunityResponse,
  SemesterResponse,
} from '@/lib/api/openapi-client'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'Pages' | 'Opportunities' | 'My Applications' | 'Semesters'

type SearchResult = {
  id: string
  category: Category
  title: string
  subtitle: string
  href: string
  Icon: ComponentType<{ className?: string }>
}

// ─── Recent searches (localStorage) ──────────────────────────────────────────

const RECENT_KEY = 'student_search_recent'
const MAX_RECENT = 5

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveRecentSearch(term: string) {
  const prev = getRecentSearches().filter((s) => s.toLowerCase() !== term.toLowerCase())
  localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...prev].slice(0, MAX_RECENT)))
}

function removeRecentSearch(term: string) {
  const updated = getRecentSearches().filter((s) => s !== term)
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
}

// ─── Highlight matching text ──────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-slate-900">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── Static nav pages ─────────────────────────────────────────────────────────

const NAV_PAGES: SearchResult[] = [
  {
    id: 'dashboard',
    category: 'Pages',
    title: 'Dashboard',
    subtitle: 'Your student overview',
    href: '/student/dashboard',
    Icon: LayoutDashboard,
  },
  {
    id: 'self-sourced',
    category: 'Pages',
    title: 'Self-Sourced Internships',
    subtitle: 'Submit your own internship',
    href: '/student/self-sourced-internships',
    Icon: BriefcaseBusiness,
  },
  {
    id: 'applications',
    category: 'Pages',
    title: 'Applications',
    subtitle: 'Your internship applications',
    href: '/student/applications',
    Icon: FileCheck2,
  },
  {
    id: 'semesters',
    category: 'Pages',
    title: 'Semesters',
    subtitle: 'Select or view your semester',
    href: '/student/semesters',
    Icon: CalendarDays,
  },
  {
    id: 'opportunities',
    category: 'Pages',
    title: 'Opportunities',
    subtitle: 'Browse available internships',
    href: '/student/opportunities',
    Icon: GraduationCap,
  },
  {
    id: 'notifications',
    category: 'Pages',
    title: 'Notifications',
    subtitle: 'Your alerts and updates',
    href: '/student/notifications',
    Icon: Bell,
  },
]

const CATEGORY_ORDER: Category[] = ['Pages', 'Opportunities', 'My Applications', 'Semesters']
const CATEGORY_ICONS: Record<Category, ComponentType<{ className?: string }>> = {
  Pages: LayoutDashboard,
  Opportunities: GraduationCap,
  'My Applications': FileCheck2,
  Semesters: CalendarDays,
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StudentTopbar() {
  const router = useRouter()
  const { user, signOut } = useAuth()

  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const [opportunities, setOpportunities] = useState<OpportunityResponse[]>([])
  const [internships, setInternships] = useState<InternshipListItemResponse[]>([])
  const [semesters, setSemesters] = useState<SemesterResponse[]>([])

  const fetchedRef = useRef(false)
  const fetchingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load recents from localStorage on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(-1)
  }, [query])

  // Lazy-load all data sources on first focus
  const handleFocus = useCallback(async () => {
    setShowDropdown(true)
    if (fetchedRef.current || fetchingRef.current) return

    fetchingRef.current = true
    setLoading(true)

    const [oppsResult, internshipsResult, semestersResult] = await Promise.allSettled([
      OpportunitiesService.listOpportunities(undefined, ['published'], undefined, 100),
      InternshipsService.listInternships(),
      SemestersService.listSemesters(),
    ])

    if (oppsResult.status === 'fulfilled') setOpportunities(oppsResult.value.items)
    if (internshipsResult.status === 'fulfilled') setInternships(internshipsResult.value.items)
    if (semestersResult.status === 'fulfilled') setSemesters(semestersResult.value.items)

    fetchedRef.current = true
    fetchingRef.current = false
    setLoading(false)
  }, [])

  // Position the portaled dropdown imperatively — avoids the inline-style lint rule
  // and correctly escapes all overflow-hidden ancestors
  useEffect(() => {
    if (!showDropdown) return

    const position = () => {
      if (!formRef.current || !dropdownRef.current) return
      const rect = formRef.current.getBoundingClientRect()
      const el = dropdownRef.current
      el.style.top = `${rect.bottom + 6}px`
      el.style.left = `${rect.left}px`
      el.style.width = `${rect.width}px`
    }

    // rAF lets the portal mount before we read its ref
    const frame = requestAnimationFrame(position)
    window.addEventListener('resize', position)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', position)
    }
  }, [showDropdown])

  // Close on outside click — must check both the input container AND the portaled dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const inContainer = containerRef.current?.contains(target)
      const inDropdown = dropdownRef.current?.contains(target)
      if (!inContainer && !inDropdown) {
        setShowDropdown(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Memoised filtered results
  const q = query.trim().toLowerCase()

  const grouped = useMemo((): Partial<Record<Category, SearchResult[]>> => {
    if (!q) return {}

    const pages = NAV_PAGES.filter(
      (p) => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)
    ).slice(0, 3)

    const opps: SearchResult[] = opportunities
      .filter(
        (o) => o.employerName.toLowerCase().includes(q) || o.jobTitle.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .map((o) => ({
        id: o.id,
        category: 'Opportunities' as Category,
        title: o.jobTitle,
        subtitle: o.employerName,
        href: `/student/opportunities?q=${encodeURIComponent(o.employerName)}`,
        Icon: GraduationCap,
      }))

    const apps: SearchResult[] = internships
      .filter(
        (i) =>
          i.opportunityEmployerName.toLowerCase().includes(q) ||
          i.opportunityJobTitle.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .map((i) => ({
        id: i.id,
        category: 'My Applications' as Category,
        title: i.opportunityJobTitle,
        subtitle: i.opportunityEmployerName,
        href: '/student/self-sourced-internships',
        Icon: FileCheck2,
      }))

    const sems: SearchResult[] = semesters
      .filter(
        (s) =>
          s.semesterCode.toLowerCase().includes(q) ||
          s.courseCode.toLowerCase().includes(q) ||
          s.displayName.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .map((s) => ({
        id: s.id,
        category: 'Semesters' as Category,
        title: s.displayName,
        subtitle: `${s.semesterCode} · ${s.courseCode}`,
        href: '/student/semesters',
        Icon: CalendarDays,
      }))

    return { Pages: pages, Opportunities: opps, 'My Applications': apps, Semesters: sems }
  }, [q, opportunities, internships, semesters])

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => CATEGORY_ORDER.flatMap((c) => grouped[c] ?? []), [grouped])

  const hasResults = flatResults.length > 0
  const dropdownOpen = showDropdown && (q.length > 0 || recentSearches.length > 0)

  // ── Navigation helpers ──────────────────────────────────────────────────────

  const navigate = useCallback(
    (href: string, searchTerm?: string) => {
      if (searchTerm) {
        saveRecentSearch(searchTerm)
        setRecentSearches(getRecentSearches())
      }
      router.push(href)
      setQuery('')
      setShowDropdown(false)
      setActiveIndex(-1)
    },
    [router]
  )

  const handleSearch = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!query.trim()) return
      // Keyboard-selected item takes priority, else auto-select first result
      const target = activeIndex >= 0 ? flatResults[activeIndex] : flatResults[0]
      if (target) {
        navigate(target.href, query.trim())
      } else {
        navigate(`/student/opportunities?q=${encodeURIComponent(query.trim())}`, query.trim())
      }
    },
    [query, activeIndex, flatResults, navigate]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!dropdownOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, -1))
      } else if (e.key === 'Escape') {
        setQuery('')
        setShowDropdown(false)
        setActiveIndex(-1)
        inputRef.current?.blur()
      }
    },
    [dropdownOpen, flatResults.length]
  )

  const handleSignOut = useCallback(async () => {
    await signOut()
    router.push('/login')
  }, [signOut, router])

  // ── Render ──────────────────────────────────────────────────────────────────

  // Track global index across categories for keyboard highlight
  let globalIndex = -1

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur xl:px-6">
      {/* SEARCH */}
      <div ref={containerRef} className="flex min-w-0 flex-1 items-center gap-3">
        <form
          ref={formRef}
          onSubmit={handleSearch}
          className="relative hidden w-full max-w-md md:block"
        >
          {/* Input bar */}
          <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm transition focus-within:border-red-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-red-100">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              placeholder="Search anything..."
              autoComplete="off"
              className="flex-1 bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
            />
            {query && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery('')
                  setActiveIndex(-1)
                  inputRef.current?.focus()
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition hover:bg-slate-300"
                aria-label="Clear"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Dropdown — portaled to body so overflow-hidden ancestors don't clip it */}
          {dropdownOpen &&
            createPortal(
              <div
                ref={dropdownRef}
                className="fixed z-[9999] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
              >
                {/* Recent searches — shown when no query */}
                {!q && recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                        Recent Searches
                      </span>
                    </div>
                    <ul>
                      {recentSearches.map((term) => (
                        <li key={term}>
                          <div className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50">
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setQuery(term)
                                inputRef.current?.focus()
                              }}
                              className="flex flex-1 items-center gap-3 text-left"
                            >
                              <Clock className="h-4 w-4 shrink-0 text-slate-300" />
                              <span className="text-sm text-slate-700">{term}</span>
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                removeRecentSearch(term)
                                setRecentSearches(getRecentSearches())
                              }}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                              aria-label={`Remove ${term}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Results while typing */}
                {q &&
                  (loading ? (
                    <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-400">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-red-500" />
                      Searching...
                    </div>
                  ) : hasResults ? (
                    CATEGORY_ORDER.map((category) => {
                      const items = grouped[category]
                      if (!items?.length) return null
                      const CatIcon = CATEGORY_ICONS[category]

                      return (
                        <div key={category}>
                          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-1.5">
                            <CatIcon className="h-3 w-3 text-slate-400" />
                            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                              {category}
                            </span>
                          </div>
                          <ul>
                            {items.map((result) => {
                              globalIndex++
                              const isActive = globalIndex === activeIndex
                              return (
                                <li key={result.id}>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => navigate(result.href, query.trim())}
                                    onMouseEnter={() => setActiveIndex(globalIndex)}
                                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                                      isActive ? 'bg-red-50' : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <div
                                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${isActive ? 'bg-red-100' : 'bg-red-50'}`}
                                    >
                                      <result.Icon className="h-4 w-4 text-red-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm text-slate-600">
                                        <Highlight text={result.title} query={query.trim()} />
                                      </p>
                                      <p className="truncate text-xs text-slate-400">
                                        <Highlight text={result.subtitle} query={query.trim()} />
                                      </p>
                                    </div>
                                    {isActive && (
                                      <span className="text-[10px] text-slate-400">↵</span>
                                    )}
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })
                  ) : (
                    <div className="px-4 py-4 text-sm text-slate-400">
                      No results for &ldquo;{query}&rdquo;
                    </div>
                  ))}

                {/* Footer */}
                {q && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
                    <p className="text-[11px] text-slate-400">
                      ↑↓ navigate &nbsp;·&nbsp; ↵ select &nbsp;·&nbsp; esc clear
                    </p>
                  </div>
                )}
              </div>,
              document.body
            )}
        </form>
      </div>

      {/* ACTIONS */}
      <div className="flex items-center gap-2">
        <Link
          href="/student/courses"
          className="hidden h-9 items-center gap-2 rounded-xl bg-red-700 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-red-800 sm:inline-flex"
        >
          <Plus className="h-3.5 w-3.5" />
          Browse
        </Link>

        <Link
          href="/student/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-600" />
        </Link>
        <Link
          href="/student/profile"
          className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 md:flex"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-900">Student</p>
            <p className="truncate text-[11px] text-slate-500">{user?.email ?? 'Student portal'}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
