import AppNav from '@/components/AppNav'

// (app) route-group layout — auth guard applied via middleware.
// This layout wraps all authenticated pages with navigation.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <main className="flex-1 pb-20">
        {children}
      </main>
      <AppNav />
    </div>
  )
}
