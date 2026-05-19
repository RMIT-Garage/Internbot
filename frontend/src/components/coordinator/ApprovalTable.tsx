import Link from 'next/link'
import type { ReactNode } from 'react'

export interface ApprovalColumn<Row> {
  key: string
  header: ReactNode
  render: (row: Row) => ReactNode
}

interface ApprovalTableProps<Row> {
  rows: Row[]
  columns: ApprovalColumn<Row>[]
  getRowKey: (row: Row) => string
  emptyMessage: string
}

export function ApprovalTable<Row>({
  rows,
  columns,
  getRowKey,
  emptyMessage,
}: ApprovalTableProps<Row>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="whitespace-nowrap px-4 py-3">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="transition hover:bg-slate-50/80">
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-nowrap px-4 py-4 align-middle">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function TableDetailLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-sm font-bold text-red-700 hover:text-red-800">
      View Details
    </Link>
  )
}
