import TripForm from '@/components/forms/TripForm'

export default function NewTripPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Add Travel Destination</h1>
      <TripForm />
    </main>
  )
}
