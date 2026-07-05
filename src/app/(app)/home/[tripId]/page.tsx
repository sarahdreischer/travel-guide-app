// Home page for a specific trip — Requirements 5, 6
// Full implementation is handled in a later task.
export default function HomePage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  void params;
  return (
    <main className="p-4">
      <p className="text-gray-500">Home (trip view) — coming soon.</p>
    </main>
  );
}
