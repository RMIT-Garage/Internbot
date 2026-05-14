import { Download, ShieldAlert, Users, WandSparkles } from 'lucide-react'
import { PendingActionButton } from '@/components/coordinator/PendingActionButton'
import {
  AIInsightCard,
  AnalyticsStrip,
  CoordinatorPageHeader,
  KPIStatCard,
  SurfaceCard,
  TimelineFeed,
} from '@/components/coordinator/Premium'
import { auditLogs, recentActivity } from '@/lib/coordinator/mockData'

export default function CoordinatorAuditsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Institutional Audit Logs"
        title="Audit and Activity Trace"
        description="Searchable system history, actor distribution, anomaly detection, and export-ready compliance events."
        actions={
          <PendingActionButton message="Audit export API integration pending.">
            <Download className="h-4 w-4" />
            Export audit
          </PendingActionButton>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <KPIStatCard
          title="Audit events"
          value={auditLogs.length}
          detail="Visible sample records"
          icon={ShieldAlert}
          tone="red"
          progress={56}
        />
        <KPIStatCard
          title="Active actors"
          value={3}
          detail="Staff, AI, and system"
          icon={Users}
          tone="blue"
          progress={68}
        />
        <KPIStatCard
          title="AI anomalies"
          value={1}
          detail="High severity signal"
          icon={WandSparkles}
          tone="purple"
          progress={22}
        />
      </div>
      <AIInsightCard
        title="AI Anomaly Detection"
        confidence={88}
        insight="The system detected one high-priority compliance anomaly in the contract workflow. No unusual actor distribution patterns were found."
      />
      <AnalyticsStrip
        items={[
          { label: 'Coordinator actions', value: 2, detail: 'Manual staff events', tone: 'blue' },
          { label: 'AI events', value: 1, detail: 'Advisor generated', tone: 'purple' },
          { label: 'System events', value: 1, detail: 'Automated notices', tone: 'green' },
          { label: 'High severity', value: 1, detail: 'Immediate review', tone: 'red' },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">Searchable Logs</h2>
            <p className="text-sm text-slate-500">Recent institutional workflow events.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
                <tr>
                  {['Actor', 'Action', 'Target', 'Severity', 'Timestamp'].map((head) => (
                    <th key={head} className="px-5 py-3">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-bold text-slate-950">{log.actor}</td>
                    <td className="px-5 py-4 text-slate-600">{log.action}</td>
                    <td className="px-5 py-4 text-slate-600">{log.target}</td>
                    <td className="px-5 py-4 font-bold text-red-700">{log.severity}</td>
                    <td className="px-5 py-4 text-slate-500">{log.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
        <SurfaceCard className="p-5">
          <h2 className="font-bold text-slate-950">Activity Timeline</h2>
          <div className="mt-4">
            <TimelineFeed items={recentActivity} />
          </div>
        </SurfaceCard>
      </div>
    </div>
  )
}
