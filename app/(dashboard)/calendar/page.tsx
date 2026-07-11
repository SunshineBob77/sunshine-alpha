export default function CalendarPage() {
  return (
    <main className="flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight text-gray-900">
          Calendar
        </h1>

        <section className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-lg text-gray-800 font-semibold mb-2">Calendar is coming soon.</p>
          <p className="text-gray-500">
            Soon you&apos;ll see your upcoming dates and reminders here.
          </p>
        </section>
      </div>
    </main>
  );
}
