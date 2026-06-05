'use client'

interface FilterOption {
  label: string
  value: string
}

interface FilterSelect {
  name: string
  label: string
  value?: string
  options: FilterOption[]
}

interface FilterBarProps {
  selects: FilterSelect[]
  search?: {
    name: string
    label: string
    placeholder: string
    value?: string
  }
}

const fieldLabelClass = 'text-xs font-bold tracking-wide text-slate-500 uppercase'
const controlClass =
  'h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm transition-colors outline-none focus:border-red-500'

export function FilterBar({ selects, search }: FilterBarProps) {
  return (
    <form
      method="get"
      className="sticky top-0 z-10 space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
        {search && (
          <label className="grid min-w-0 gap-1 sm:col-span-2 xl:col-span-5">
            <span className={fieldLabelClass}>{search.label}</span>
            <input
              name={search.name}
              defaultValue={search.value}
              placeholder={search.placeholder}
              className={controlClass}
            />
          </label>
        )}
        {selects.map((select) => (
          <label key={select.name} className="grid min-w-0 gap-1 xl:col-span-2">
            <span className={fieldLabelClass}>{select.label}</span>
            <select
              name={select.name}
              defaultValue={select.value ?? 'all'}
              className={controlClass}
            >
              {select.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 sm:justify-end">
        <button
          type="submit"
          className="h-10 shrink-0 rounded-xl bg-red-700 px-4 text-sm font-bold text-white transition-colors hover:bg-red-800"
        >
          Apply
        </button>
        <button
          type="reset"
          onClick={() => {
            window.location.href = window.location.pathname
          }}
          className="inline-flex h-10 shrink-0 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
        >
          Reset
        </button>
      </div>
    </form>
  )
}
