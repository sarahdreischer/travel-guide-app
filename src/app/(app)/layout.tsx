import AppNav from '@/components/AppNav'

// (app) route-group layout — auth guard applied via middleware.
// This layout wraps all authenticated pages with navigation.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <main className="app-layout-main">
        {children}
      </main>
      <AppNav />
    </div>
  )
}
