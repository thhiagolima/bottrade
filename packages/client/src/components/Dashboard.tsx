import { useStore } from '../store/useStore'
import TopBar from './TopBar'
import AppSidebar from './AppSidebar'
import PairDetail from './PairDetail'
import CompareView from './CompareView'
import SettingsPage from './SettingsPage'
import TradesPage from './TradesPage'
import PaperPage from './PaperPage'
import BacktestPage from './BacktestPage'
import AlertsPage from './AlertsPage'
import AdminPage from './AdminPage'

export default function Dashboard() {
  const currentPage = useStore((s) => s.currentPage)

  return (
    <div className="h-screen flex flex-col bg-bg">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        {currentPage === 'dashboard' && <DashboardPage />}
        {(currentPage === 'signals' || currentPage === 'trades') && <TradesPage />}
        {currentPage === 'paper' && <PaperPage />}
        {currentPage === 'backtest' && <BacktestPage />}
        {currentPage === 'settings' && <SettingsPage />}
        {currentPage === 'alerts' && <AlertsPage />}
        {currentPage === 'admin' && <AdminPage />}
      </div>
    </div>
  )
}

/* -- DashboardPage: the existing sidebar + pair detail layout ------ */

function DashboardPage() {
  const pairs = useStore((s) => s.pairs)
  const selectedPair = useStore((s) => s.selectedPair)
  const compareMode = useStore((s) => s.compareMode)
  const comparePairs = useStore((s) => s.comparePairs)
  const mobileSidebarOpen = useStore((s) => s.mobileSidebarOpen)
  const closeMobileSidebar = useStore((s) => s.closeMobileSidebar)
  const tempAnalysis = useStore((s) => s.tempAnalysis)

  const analysis = selectedPair
    ? (pairs[selectedPair] ?? (tempAnalysis?.symbol === selectedPair ? tempAnalysis : null))
    : null

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden cursor-pointer"
          onClick={closeMobileSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${mobileSidebarOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden'}
        md:relative md:flex md:z-auto
      `}>
        <AppSidebar />
      </div>

      {/* Main content */}
      {compareMode && comparePairs.length > 0 ? (
        <CompareView />
      ) : analysis ? (
        <PairDetail analysis={analysis} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted text-sm md:text-base px-4 text-center">
          {compareMode ? 'Selecione pares na sidebar para comparar' : 'Selecione um par na sidebar'}
        </div>
      )}
    </div>
  )
}
