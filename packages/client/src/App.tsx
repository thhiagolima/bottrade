import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@clerk/react'
import { Toaster } from 'react-hot-toast'
import { useSocket, emitUpdateSettings } from './hooks/useSocket'
import { useStore } from './store/useStore'
import Dashboard from './components/Dashboard'
import AuthPage from './components/AuthPage'
import LandingPage from './components/LandingPage'
import OnboardingWizard from './components/OnboardingWizard'
import ShortcutsHelp from './components/ShortcutsHelp'
import GuidedTour from './components/GuidedTour'
import TermsOfService from './components/TermsOfService'
import PrivacyPolicy from './components/PrivacyPolicy'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  // All hooks MUST be called before any conditional return
  const theme = useStore(s => s.theme)
  const authUser = useStore(s => s.authUser)
  const authLoading = useStore(s => s.authLoading)
  const checkAuth = useStore(s => s.checkAuth)
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const onboardingComplete = useStore(s => s.onboardingComplete)
  const completeOnboarding = useStore(s => s.completeOnboarding)
  const setSettings = useStore(s => s.setSettings)
  const [showAuth, setShowAuth] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  useEffect(() => {
    let cancelled = false

    async function loadAuth() {
      if (!isLoaded) return
      if (!isSignedIn) {
        checkAuth(null)
        return
      }
      const token = await getToken({ skipCache: true })
      if (!cancelled) {
        await checkAuth(token)
      }
    }

    loadAuth()
    return () => { cancelled = true }
  }, [checkAuth, getToken, isLoaded, isSignedIn])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useSocket()

  const toasterConfig = (
    <Toaster position="top-right" toastOptions={{
      style: { background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-card-border)' }
    }} />
  )

  if (!isLoaded || authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-muted font-display">Carregando...</div>
      </div>
    )
  }

  if (authUser && !onboardingComplete) {
    return (
      <>
        {toasterConfig}
        <OnboardingWizard
          userName={authUser.name}
          onComplete={async (config) => {
            const settings = await emitUpdateSettings({
              userMode: config.userMode,
              baseCapital: config.baseCapital,
              leverage: config.leverage,
              favorites: config.favorites,
              pairs: config.favorites,
            })
            setSettings(settings)
            completeOnboarding()
          }}
        />
      </>
    )
  }

  if (authUser) {
    return <AuthenticatedApp toasterConfig={toasterConfig} />
  }

  return (
    <>
      {toasterConfig}
      {/* Landing page always mounted to preserve scroll position */}
      <div style={{ display: (showAuth || showTerms || showPrivacy) ? 'none' : undefined }}>
        <LandingPage
          onSignup={() => { setAuthMode('register'); setShowAuth(true) }}
          onLogin={() => { setAuthMode('login'); setShowAuth(true) }}
          onTerms={() => setShowTerms(true)}
          onPrivacy={() => setShowPrivacy(true)}
        />
      </div>
      {/* Overlays — mounted on top, landing stays in DOM */}
      {showAuth && (
        <AuthPage
          onBack={() => setShowAuth(false)}
          initialMode={authMode}
        />
      )}
      {showTerms && <TermsOfService onBack={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyPolicy onBack={() => setShowPrivacy(false)} />}
    </>
  )
}

function AuthenticatedApp({ toasterConfig }: { toasterConfig: ReactNode }) {
  useKeyboardShortcuts()
  const tourComplete = useStore(s => s.tourComplete)
  const completeTour = useStore(s => s.completeTour)

  return (
    <>
      {toasterConfig}
      <Dashboard />
      <ShortcutsHelp />
      {!tourComplete && <GuidedTour onComplete={completeTour} />}
    </>
  )
}
