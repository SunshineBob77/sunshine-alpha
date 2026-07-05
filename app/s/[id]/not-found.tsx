export default function ShareNotFound() {
  return (
    <>
      <div className="flex flex-col items-center text-center mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-4xl">🌞</span>
          <span className="text-3xl font-bold text-gray-900">sunshine</span>
        </div>
        <p className="text-gray-500">Remember everything. Live more.</p>
      </div>

      <div className="bg-white rounded-3xl ring-1 ring-black/5 shadow-sm p-7 text-center">
        <p className="text-lg font-semibold text-gray-900 mb-2">
          This memory couldn't be found
        </p>
        <p className="text-gray-500 mb-6">
          The link may have expired or been typed incorrectly.
        </p>

        <a
          href="/"
          className="block w-full bg-gradient-to-r from-amber-400 to-orange-300 hover:from-amber-500 hover:to-orange-400 text-gray-900 font-bold py-4 px-6 rounded-2xl shadow-md shadow-amber-200/60 text-lg transition-all"
        >
          View in Sunshine
        </a>
      </div>
    </>
  );
}
