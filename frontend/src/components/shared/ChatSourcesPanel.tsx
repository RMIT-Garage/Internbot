'use client'

import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp, Globe } from 'lucide-react'

export interface ChatSource {
  title: string
  section: string
  sourceUrl?: string
  excerpt?: string
}

export interface WebSource {
  title: string
  uri: string
}

function formatSourceHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function dedupeRagSources(sources: ChatSource[]): ChatSource[] {
  const seen = new Set<string>()
  return sources.filter((source) => {
    const key = `${source.title}|${source.section}|${source.sourceUrl ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function SourceLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-block text-xs text-red-700 hover:underline"
    >
      Open source ({formatSourceHostname(url)})
    </a>
  )
}

interface ChatSourcesPanelProps {
  sources?: ChatSource[]
  webSources?: WebSource[]
  messageId: string
}

export function ChatSourcesPanel({ sources, webSources, messageId }: ChatSourcesPanelProps) {
  const [sourcesOpen, setSourcesOpen] = useState(true)
  const [webOpen, setWebOpen] = useState(false)

  const ragSources = sources ? dedupeRagSources(sources) : []
  const hasRag = ragSources.length > 0
  const hasWeb = (webSources?.length ?? 0) > 0

  if (!hasRag && !hasWeb) return null

  return (
    <div className="flex flex-col gap-2">
      {hasRag && (
        <div className="overflow-hidden rounded-xl border border-zinc-100">
          <button
            type="button"
            onClick={() => setSourcesOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs text-zinc-400 transition hover:text-zinc-600"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3" />
              Sources ({ragSources.length})
            </span>
            {sourcesOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          {sourcesOpen && (
            <ul className="space-y-1.5 border-t border-zinc-100 bg-zinc-50 px-3 pt-2 pb-2.5">
              {ragSources.map((source, index) => (
                <li
                  key={`${messageId}-rag-${index}`}
                  className="rounded-lg border border-zinc-100 bg-white px-3 py-2 text-xs"
                >
                  <p className="font-medium text-zinc-700">{source.title}</p>
                  <p className="text-zinc-400">{source.section}</p>
                  {source.excerpt ? (
                    <p className="mt-1 line-clamp-3 leading-snug text-zinc-500">{source.excerpt}</p>
                  ) : null}
                  {source.sourceUrl ? <SourceLink url={source.sourceUrl} /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasWeb && webSources && (
        <div className="overflow-hidden rounded-xl border border-zinc-100">
          <button
            type="button"
            onClick={() => setWebOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs text-zinc-400 transition hover:text-zinc-600"
          >
            <span className="flex items-center gap-1.5">
              <Globe className="size-3" />
              Web sources ({webSources.length})
            </span>
            {webOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          {webOpen && (
            <ul className="space-y-1.5 border-t border-zinc-100 bg-zinc-50 px-3 pt-2 pb-2.5">
              {webSources.map((source, index) => (
                <li
                  key={`${messageId}-web-${index}`}
                  className="rounded-lg border border-zinc-100 bg-white px-3 py-2 text-xs"
                >
                  <p className="font-medium text-zinc-700">{source.title}</p>
                  <a
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block max-w-full break-all text-red-700 hover:underline"
                  >
                    {source.uri}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
