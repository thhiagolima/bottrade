import type { EntryCheckResult } from '@bottrade/shared'

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0 text-bull" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0 text-bear" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function EntryChecklist({ check }: { check: EntryCheckResult }) {
  return (
    <div className="border-t border-card-border px-3 py-3 text-xs">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Filtros de entrada</h4>
          <p className="mt-1 text-[11px] text-dim">Validacoes extras antes de considerar uma entrada.</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 font-mono-num text-[10px] font-black ${
          check.allowed ? 'border-bull/25 bg-bull/10 text-bull' : 'border-warn/25 bg-warn/10 text-warn'
        }`}>
          {check.passedCount}/{check.totalCount} filtros - {check.allowed ? 'LIBERADO' : 'BLOQUEADO'}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {check.filters.map((f, i) => (
          <div
            key={i}
            className={`rounded-lg border px-3 py-2 ${
              f.passed ? 'border-bull/15 bg-bull/5' : 'border-card-border/80 bg-bg/25'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5">{f.passed ? <CheckIcon /> : <XIcon />}</span>
              <div className="min-w-0">
                <div className={`font-bold ${f.passed ? 'text-white' : 'text-muted'}`}>{f.name}</div>
                {f.detail && <div className="mt-1 break-words text-[11px] leading-snug text-dim">{f.detail}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
