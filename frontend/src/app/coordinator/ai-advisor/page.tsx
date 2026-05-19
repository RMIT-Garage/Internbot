import Link from 'next/link'
import { BrainCircuit, CheckCircle2, FileWarning, Gauge, Layers3, WandSparkles } from 'lucide-react'
import {
  AICommandCard,
  AIInsightCard,
  AnalyticsStrip,
  CoordinatorPageHeader,
  KPIStatCard,
  SurfaceCard,
  TimelineFeed,
} from '@/components/coordinator/Premium'
import {
  aiAdvisorReports,
  aiComplianceChecks,
  auditLogs,
  recentActivity,
} from '@/lib/coordinator/mockData'

export default function CoordinatorAIAdvisorPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="AI Insights"
        title="Institutional Intelligence Center"
        description="Batch review signals, compliance analysis, suitability scoring, and anomaly detection for internship governance workflows."
        actions={
          <>
            <Link
              href="/coordinator/contracts?status=flagged"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Flagged contracts
            </Link>
            <Link
              href="/coordinator/audits"
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            >
              Review activity trace
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard
          title="Suitability average"
          value="88%"
          detail="Across active submissions"
          icon={Gauge}
          tone="charcoal"
          progress={88}
        />
        <KPIStatCard
          title="Flagged contracts"
          value="6"
          detail="High-priority review queue"
          icon={FileWarning}
          tone="red"
          progress={32}
        />
        <KPIStatCard
          title="Auto-cleared checks"
          value="41"
          detail="Low-risk institutional checks"
          icon={CheckCircle2}
          tone="neutral"
          progress={78}
        />
        <KPIStatCard
          title="Batch candidates"
          value="14"
          detail="Ready for assisted review"
          icon={Layers3}
          tone="red"
          progress={54}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Backend integration pending: no coordinator AI review endpoint is available in the
            current workflow API. Advisory output below is frontend-only until backend support is
            published.
          </div>
          <AIInsightCard
            title="Executive AI Summary"
            confidence={93}
            insight="The current review cycle is healthy, but contract compliance and remote supervision remain the dominant risk clusters. Batch low-risk approvals can reduce queue pressure by an estimated 22%."
          />

          <div className="grid gap-4 lg:grid-cols-3">
            {aiAdvisorReports.map((report) => (
              <AICommandCard
                key={report.id}
                title={report.title}
                description={report.description}
                metric={`${report.confidence}%`}
              />
            ))}
          </div>

          <SurfaceCard className="overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-950">Compliance Analysis</h2>
              <p className="text-sm text-slate-500">
                Institutional checks ranked by AI confidence and workflow risk.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {aiComplianceChecks.map((check) => (
                <div
                  key={check.label}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)_120px] sm:items-center"
                >
                  <p className="font-bold text-slate-950">{check.label}</p>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-red-700"
                      style={{ width: `${check.score}%` }}
                    />
                  </div>
                  <p className="text-sm font-semibold text-slate-600">{check.trend}</p>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <aside className="space-y-6">
          <AnalyticsStrip
            items={[
              { label: 'AI alerts', value: 7, detail: 'Open signals', tone: 'red' },
              { label: 'High risk', value: 2, detail: 'Immediate review', tone: 'red' },
              { label: 'Low risk', value: 18, detail: 'Batch candidates', tone: 'charcoal' },
              {
                label: 'Audit links',
                value: auditLogs.length,
                detail: 'Traceable events',
                tone: 'neutral',
              },
            ]}
          />
          <SurfaceCard className="p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-950">
              <WandSparkles className="h-5 w-5 text-red-700" />
              Recommendation Feed
            </h2>
            <div className="mt-4">
              <TimelineFeed items={recentActivity} />
            </div>
          </SurfaceCard>
          <SurfaceCard className="p-5">
            <BrainCircuit className="h-5 w-5 text-red-700" />
            <h2 className="mt-4 font-bold text-slate-950">Batch Review Tools</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              API-backed batch approvals can later connect here once institutional sign-off and
              audit controls are ready.
            </p>
          </SurfaceCard>
        </aside>
      </div>
    </div>
  )
}
