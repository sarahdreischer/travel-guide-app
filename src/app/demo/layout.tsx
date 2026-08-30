import SideNav from '@/components/SideNav'
import AppNav from '@/components/AppNav'

/**
 * /demo route-group layout — a login-free mirror of the (app) layout.
 * No auth, no DB. Navigation links are prefixed with /demo.
 */

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <SideNav basePath="/demo" />
      <div className="main-panel">
        {children}
        <AppNav basePath="/demo" />
      </div>
    </div>
  )
}
