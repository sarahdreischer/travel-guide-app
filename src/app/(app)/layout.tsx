import AppNav from '@/components/AppNav'
import SideNav from '@/components/SideNav'

/**
 * (app) route-group layout — auth guard applied via middleware.
 * Renders a side nav on desktop (900px+) and a bottom nav on mobile.
 * The main-panel wrapper contains the scrollable page content.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <SideNav />
      <div className="main-panel">
        {children}
        <AppNav />
      </div>
    </div>
  )
}
