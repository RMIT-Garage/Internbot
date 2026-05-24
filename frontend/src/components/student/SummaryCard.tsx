// import type { LucideIcon } from 'lucide-react'
// import { StatusBadge } from './StatusBadge'
// import type { SummaryStateCount } from '@/lib/coordinator/mockData'

// interface SummaryCardProps {
//   title: string
//   total: number
//   description: string
//   states: SummaryStateCount[]
//   icon: LucideIcon
// }

// export function SummaryCard({ title, total, description, states, icon: Icon }: SummaryCardProps) {
//   return (
//     <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
//       <div className="flex items-start justify-between gap-4">
//         <div>
//           <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
//           <p className="mt-2 text-3xl font-bold tracking-tight">{total}</p>
//           <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
//         </div>
//         <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">
//           <Icon className="h-5 w-5" />
//         </div>
//       </div>
//       <div className="mt-5 grid gap-2">
//         {states.map((state) => (
//           <div key={state.label} className="flex items-center justify-between gap-3">
//             <StatusBadge status={state.status} />
//             <span className="text-sm font-semibold">{state.count}</span>
//           </div>
//         ))}
//       </div>
//     </section>
//   )
// }
