import { useState } from 'react'
import { SignIn, SignUp } from '@clerk/react'

interface AuthPageProps {
  onBack?: () => void
  initialMode?: 'login' | 'register'
}

const clerkAppearance = {
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full',
    card: 'bg-card border border-card-border shadow-none rounded-lg',
    headerTitle: 'text-white font-display',
    headerSubtitle: 'text-muted',
    socialButtonsBlockButton: 'bg-bg border-card-border text-white hover:bg-card-hover',
    formFieldLabel: 'text-muted',
    formFieldInput: 'bg-bg border-card-border text-white focus:border-accent',
    footerActionText: 'text-muted',
    footerActionLink: 'text-accent hover:text-accent/80',
    formButtonPrimary: 'bg-accent hover:bg-accent/90 text-white',
  },
}

export default function AuthPage({ onBack, initialMode = 'login' }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {onBack && (
          <button onClick={onBack} className="mb-4 text-sm text-muted hover:text-white transition-colors flex items-center gap-1">
            <span>&larr;</span> Voltar
          </button>
        )}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-white">
            Bottrade<span className="text-accent">.</span>
          </h1>
          <p className="text-muted mt-2 text-sm">
            Dashboard inteligente para trading de criptomoedas
          </p>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6">
          <div className="flex mb-6 border-b border-card-border">
            <button onClick={() => setMode('login')}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${mode === 'login' ? 'text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}>
              Entrar
            </button>
            <button onClick={() => setMode('register')}
              className={`flex-1 pb-3 text-sm font-medium transition-colors ${mode === 'register' ? 'text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}>
              Criar conta
            </button>
          </div>

          {mode === 'login' ? (
            <SignIn
              routing="hash"
              appearance={clerkAppearance}
              signUpUrl="#/sign-up"
              afterSignInUrl="/"
            />
          ) : (
            <SignUp
              routing="hash"
              appearance={clerkAppearance}
              signInUrl="#/sign-in"
              afterSignUpUrl="/"
            />
          )}
        </div>
      </div>
    </div>
  )
}
