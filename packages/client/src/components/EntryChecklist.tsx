import type { EntryCheckResult } from '@bottrade/shared'

function CheckIcon() {
  return (
    <svg className="w-3 h-3 text-bull flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-3 h-3 text-bear flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function EntryChecklist({ check }: { check: EntryCheckResult }) {
  return (
    <div className="border-t border-card-border px-3 py-2 text-xs">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-bold text-muted">FILTROS DE ENTRADA</h4>
        <span className={`font-bold font-mono-num ${check.allowed ? 'text-bull' : 'text-warn'}`}>
          {check.passedCount}/{check.totalCount} filtros
          {check.allowed ? ' — LIBERADO' : ' — BLOQUEADO'}
        </span>
      </div>

      <div className="space-y-0">
        {check.filters.map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 py-0.5">
            {f.passed ? <CheckIcon /> : <XIcon />}
            <span className={`font-bold ${f.passed ? 'text-white' : 'text-muted'}`}>{f.name}</span>
            <span className="text-dim">{f.detail ? `— ${f.detail}` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
