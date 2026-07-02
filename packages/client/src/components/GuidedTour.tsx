import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'
import type { UserMode } from '@bottrade/shared'

interface TourStep {
  target: string
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right'
  modes: UserMode[]
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'sidebar-pairs',
    title: 'Seus pares favoritos',
    description: 'Seus pares favoritos aparecem aqui. Clique em qualquer par para ver a análise completa em tempo real.',
    position: 'right',
    modes: ['simple', 'trader', 'pro'],
  },
  {
    target: 'sidebar-tabs',
    title: 'Favoritos e Todos',
    description: 'Alterne entre seus Favoritos e Todos os 700+ pares disponíveis na Binance. Use a busca para encontrar rapidamente.',
    position: 'right',
    modes: ['simple', 'trader', 'pro'],
  },
  {
    target: 'price-header',
    title: 'Dados em tempo real',
    description: 'Preço atualizado a cada segundo, mark price, funding rate (taxa que traders pagam), volume 24h e variação.',
    position: 'bottom',
    modes: ['simple', 'trader', 'pro'],
  },
  {
    target: 'signal-panel',
    title: 'Score de Confluência',
    description: 'Nosso algoritmo combina 15 indicadores técnicos em um score de 0 a 100. Acima de 65 = sinal de compra (LONG). Abaixo de 35 = sinal de venda (SHORT). Entre 35-65 = aguardar.',
    position: 'top',
    modes: ['simple', 'trader', 'pro'],
  },
  {
    target: 'risk-panel',
    title: 'Gestão de Risco',
    description: 'Entry (preço de entrada sugerido), Stop Loss (limite de perda) e Take Profit (alvo de lucro) são calculados automaticamente com base na volatilidade real do mercado.',
    position: 'top',
    modes: ['simple', 'trader', 'pro'],
  },
  {
    target: 'indicator-panel',
    title: 'Indicadores Técnicos',
    description: 'Veja cada indicador individualmente: médias móveis, MACD, RSI, Bollinger Bands e mais. Ative ou desative nas Configurações.',
    position: 'left',
    modes: ['trader', 'pro'],
  },
  {
    target: 'nav-signals',
    title: 'Histórico de Sinais',
    description: 'Todos os sinais gerados pelo sistema ficam salvos aqui. Filtre por par, direção e período.',
    position: 'right',
    modes: ['trader', 'pro'],
  },
  {
    target: 'nav-trades',
    title: 'Performance',
    description: 'Acompanhe win rate, equity curve, drawdown máximo e performance por par. Dados reais dos seus trades.',
    position: 'right',
    modes: ['trader', 'pro'],
  },
  {
    target: 'nav-paper',
    title: 'Paper Trading',
    description: 'O sistema simula trades automaticamente em centenas de pares. Valide a estratégia antes de arriscar dinheiro real.',
    position: 'right',
    modes: ['trader', 'pro'],
  },
  {
    target: 'nav-settings',
    title: 'Configurações Avançadas',
    description: 'No modo Pro, ajuste os pesos de cada indicador no score, períodos de cálculo e thresholds de sinal. Personalize o algoritmo para sua estratégia.',
    position: 'right',
    modes: ['pro'],
  },
]

interface GuidedTourProps {
  onComplete: () => void
}

export default function GuidedTour({ onComplete }: GuidedTourProps) {
  const userMode = useStore(s => s.settings?.userMode) || 'trader'
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  // Filter steps by user mode
  const steps = TOUR_STEPS.filter(s => s.modes.includes(userMode as UserMode))
  const step = steps[currentStep]
  const isLastStep = currentStep >= steps.length - 1
  const isFinalModal = currentStep >= steps.length // beyond last step = completion modal

  // Find and measure target element
  useEffect(() => {
    if (isFinalModal || !step) {
      setTargetRect(null)
      return
    }

    const findElement = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect(rect)
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      } else {
        setTargetRect(null)
      }
    }

    // Small delay to let DOM render
    const timer = setTimeout(findElement, 300)

    // Re-measure on resize
    window.addEventListener('resize', findElement)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', findElement)
    }
  }, [currentStep, step, isFinalModal])

  const handleNext = useCallback(() => {
    if (isFinalModal) {
      onComplete()
    } else if (isLastStep) {
      setCurrentStep(steps.length) // show final modal
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }, [isFinalModal, isLastStep, steps.length, onComplete])

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1)
  }, [currentStep])

  const handleSkip = useCallback(() => {
    onComplete()
  }, [onComplete])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip()
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext()
      if (e.key === 'ArrowLeft') handleBack()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSkip, handleNext, handleBack])

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect || !step) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    const MARGIN = 16
    const TOOLTIP_WIDTH = 320

    switch (step.position) {
      case 'right':
        return {
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + MARGIN,
          transform: 'translateY(-50%)',
          maxWidth: TOOLTIP_WIDTH,
        }
      case 'left':
        return {
          top: targetRect.top + targetRect.height / 2,
          right: window.innerWidth - targetRect.left + MARGIN,
          transform: 'translateY(-50%)',
          maxWidth: TOOLTIP_WIDTH,
        }
      case 'bottom':
        return {
          top: targetRect.bottom + MARGIN,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
          maxWidth: TOOLTIP_WIDTH,
        }
      case 'top':
        return {
          bottom: window.innerHeight - targetRect.top + MARGIN,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
          maxWidth: TOOLTIP_WIDTH,
        }
    }
  }

  // Render completion modal
  if (isFinalModal) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <div className="bg-card border border-card-border rounded-xl p-8 max-w-md mx-4 text-center animate-fade-in">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-bull)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold mb-2">Tudo pronto!</h2>
          <p className="text-sm text-muted mb-2">Seu dashboard está monitorando seus pares em tempo real.</p>
          <p className="text-xs text-muted mb-6">
            Dica: pressione{' '}
            <kbd className="px-1.5 py-0.5 bg-bg-elevated border border-card-border rounded text-[10px] font-mono">?</kbd>
            {' '}para ver os atalhos de teclado.
          </p>
          <button
            onClick={onComplete}
            className="px-8 py-3 rounded-lg font-display text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Começar a usar
          </button>
        </div>
      </div>
    )
  }

  if (!step) return null

  // Spotlight cutout dimensions (padding around target)
  const PAD = 8
  const spotlightStyle = targetRect ? {
    top: targetRect.top - PAD,
    left: targetRect.left - PAD,
    width: targetRect.width + PAD * 2,
    height: targetRect.height + PAD * 2,
  } : null

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Dark overlay with spotlight cutout using CSS clip-path */}
      <div
        className="absolute inset-0 transition-all duration-300"
        style={{
          backgroundColor: 'rgba(0,0,0,0.75)',
          clipPath: spotlightStyle
            ? `polygon(
                0% 0%, 0% 100%,
                ${spotlightStyle.left}px 100%,
                ${spotlightStyle.left}px ${spotlightStyle.top}px,
                ${spotlightStyle.left + spotlightStyle.width}px ${spotlightStyle.top}px,
                ${spotlightStyle.left + spotlightStyle.width}px ${spotlightStyle.top + spotlightStyle.height}px,
                ${spotlightStyle.left}px ${spotlightStyle.top + spotlightStyle.height}px,
                ${spotlightStyle.left}px 100%,
                100% 100%, 100% 0%
              )`
            : 'none',
        }}
        onClick={handleSkip}
      />

      {/* Spotlight border glow */}
      {spotlightStyle && (
        <div
          className="absolute rounded-lg border-2 transition-all duration-300 pointer-events-none"
          style={{
            top: spotlightStyle.top,
            left: spotlightStyle.left,
            width: spotlightStyle.width,
            height: spotlightStyle.height,
            borderColor: 'var(--color-accent)',
            boxShadow: '0 0 20px var(--color-accent), inset 0 0 20px rgba(99,102,241,0.1)',
          }}
        />
      )}

      {/* Tooltip balloon */}
      <div
        className="absolute bg-card border border-card-border rounded-xl p-5 shadow-2xl animate-fade-in"
        style={getTooltipStyle()}
      >
        <h3 className="font-display text-sm font-bold mb-1.5" style={{ color: 'var(--color-text)' }}>
          {step.title}
        </h3>
        <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {step.description}
        </p>

        {/* Progress + buttons */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
            {currentStep + 1} de {steps.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSkip}
              className="text-[11px] cursor-pointer transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
            >
              Pular tour
            </button>
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="px-3 py-1.5 text-[11px] rounded-md border cursor-pointer transition-colors"
                style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}
              >
                Voltar
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-1.5 text-[11px] font-semibold rounded-md text-white cursor-pointer transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {isLastStep ? 'Finalizar' : 'Próximo'}
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1 mt-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{
                backgroundColor: i === currentStep
                  ? 'var(--color-accent)'
                  : i < currentStep
                    ? 'var(--color-bull)'
                    : 'var(--color-card-border)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
