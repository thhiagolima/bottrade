import { useState, useRef, type ReactNode } from 'react'

interface TooltipProps {
  text: string
  children: ReactNode
  enabled?: boolean
}

export default function Tooltip({ text, children, enabled = true }: TooltipProps) {
  const [show, setShow] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!enabled) return <>{children}</>

  const handleEnter = () => {
    timeout.current = setTimeout(() => setShow(true), 400)
  }

  const handleLeave = () => {
    if (timeout.current) clearTimeout(timeout.current)
    setShow(false)
  }

  return (
    <span className="relative inline-flex" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-card border border-card-border text-xs text-white max-w-[220px] text-center shadow-lg whitespace-normal pointer-events-none animate-fade-in">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-card" />
        </span>
      )}
    </span>
  )
}
