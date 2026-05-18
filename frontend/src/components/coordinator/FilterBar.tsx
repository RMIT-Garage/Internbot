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

export function FilterBar({ selects, search }: FilterBarProps) {
  return (
    <form
      method="get"
      className="sticky top-0 z-10 grid gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:grid-cols-4"
    >
      {search && (
        <label className="grid gap-1 md:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {search.label}
          </span>
          <input
            name={search.name}
            defaultValue={search.value}
            placeholder={search.placeholder}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-red-500"
          />
        </label>
      )}
      {selects.map((select) => (
        <label key={select.name} className="grid gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {select.label}
          </span>
          <select
            name={select.name}
            defaultValue={select.value ?? 'all'}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus:border-red-500"
          >
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="h-10 rounded-xl bg-red-700 px-4 text-sm font-bold text-white transition-colors hover:bg-red-800"
        >
          Apply
        </button>
        <button
          type="reset"
          onClick={() => {
            window.location.href = window.location.pathname
          }}
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
        >
          Reset
        </button>
      </div>
    </form>
  )
}
