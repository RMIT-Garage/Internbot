'use client'

import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Globe, X, Zap } from 'lucide-react'
import type { CheckerResponse } from '../types'

interface ParsedRule {
  id: string
  name: string
  pass: boolean
  evidence: string
  reason: string
}

function parseScratchpad(scratchpad: string): ParsedRule[] {
  return scratchpad
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) return null
      const id = line.slice(0, colonIdx).trim()
      const rest = line.slice(colonIdx + 1).trim()
      const pass = /\bPASS\b/i.test(rest)
      const evidenceMatch = /Evidence:\s*(.+?)(?:\s*\||\s*$)/.exec(rest)
      const reasonMatch = /Reason:\s*(.+?)$/.exec(rest)
      const name = id.replace(/^RULE_\d+_/, '').replace(/_/g, ' ')
      return {
        id,
        name,
        pass,
        evidence: evidenceMatch?.[1]?.trim() ?? '',
        reason: reasonMatch?.[1]?.trim() ?? '',
      }
    })
    .filter((r): r is ParsedRule => r !== null)
}

interface CheckerResultPanelProps {
  result: CheckerResponse | null
  isLoading: boolean
  error: string | null
  feature: 'job-checker' | 'contract-checker'
}

export function CheckerResultPanel({ result, isLoading, error, feature }: CheckerResultPanelProps) {
  const [rulesOpen, setRulesOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-red-700" />
          <span className="text-sm font-semibold text-zinc-900">AI Assessment</span>
          <span className="ml-auto text-xs text-zinc-400">Analysing…</span>
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-7 animate-pulse rounded-xl bg-zinc-100" />
        ))}
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-500">AI Assessment</span>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-400">
          {error ? `AI check unavailable: ${error}` : 'AI assessment not available'}
        </div>
      </div>
    )
  }

  const checkerData = result.structuredData?.type === 'checker' ? result.structuredData.data : null
  if (!checkerData) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-500">AI Assessment</span>
        </div>
        <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-400">
          AI assessment not available
        </div>
      </div>
    )
  }

  const isEligible = checkerData.decision === 'Yes'
  const confidencePct = Math.round(checkerData.confidence * 100)
  const rules = parseScratchpad(checkerData.scratchpad)
  const decisionLabel =
    feature === 'job-checker'
      ? isEligible
        ? 'Eligible'
        : 'Not Eligible'
      : isEligible
        ? 'Compliant'
        : 'Non-Compliant'

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-red-700" />
        <span className="text-sm font-semibold text-zinc-900">AI Assessment</span>
        <span className="ml-auto rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {confidencePct}% confident
        </span>
      </div>

      {/* Decision banner */}
      <div
        className={[
          'flex items-center gap-2 rounded-xl px-4 py-3',
          isEligible ? 'bg-zinc-900' : 'bg-red-700',
        ].join(' ')}
      >
        {isEligible ? (
          <Check className="h-4 w-4 shrink-0 text-white" />
        ) : (
          <X className="h-4 w-4 shrink-0 text-white" />
        )}
        <span className="text-sm font-bold text-white">{decisionLabel}</span>
      </div>

      {/* Summary */}
      {checkerData.summary && (
        <p className="text-sm leading-relaxed text-zinc-600 italic">{checkerData.summary}</p>
      )}

      {/* Rules breakdown */}
      {rules.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-100">
          <button
            onClick={() => setRulesOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs text-zinc-500 transition hover:text-zinc-700"
          >
            <span>{rules.length} rules evaluated</span>
            {rulesOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {rulesOpen && (
            <div className="space-y-2.5 border-t border-zinc-100 bg-zinc-50 px-3 pt-2.5 pb-3">
              {rules.map((rule) => (
                <div key={rule.id} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    {rule.pass ? (
                      <Check className="h-3 w-3 shrink-0 text-zinc-900" />
                    ) : (
                      <X className="h-3 w-3 shrink-0 text-red-700" />
                    )}
                    <span
                      className={[
                        'text-xs font-semibold tracking-wide uppercase',
                        rule.pass ? 'text-zinc-900' : 'text-red-700',
                      ].join(' ')}
                    >
                      {rule.name}
                    </span>
                  </div>
                  {(rule.reason || rule.evidence) && (
                    <p className="ml-5 text-[11px] leading-snug text-zinc-500">
                      {rule.evidence && (
                        <>
                          <span className="font-medium">Evidence:</span> {rule.evidence}
                        </>
                      )}
                      {rule.evidence && rule.reason && ' — '}
                      {rule.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Concerns */}
      {checkerData.concerns.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
          <p className="text-xs font-semibold text-red-700">Concerns</p>
          {checkerData.concerns.map((concern, i) => (
            <p key={i} className="text-xs leading-snug text-red-700">
              {concern}
            </p>
          ))}
        </div>
      )}

      {/* Web sources */}
      {result.webSources && result.webSources.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-zinc-400">Sources used for verification</p>
          {result.webSources.map((s, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <Globe className="mt-0.5 h-3 w-3 shrink-0 text-zinc-300" />
              <a
                href={s.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs leading-snug text-zinc-500 hover:text-zinc-700 hover:underline"
              >
                {s.title}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
