import { redirect } from 'next/navigation'

// The demo landing simply enters the trips list.
export default function DemoIndexPage() {
  redirect('/demo/destinations')
}
