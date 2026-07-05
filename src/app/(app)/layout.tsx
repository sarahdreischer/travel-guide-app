// (app) route-group layout — auth guard applied via middleware.
// This layout wraps all authenticated pages.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
