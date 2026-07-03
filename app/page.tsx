export default function Home() {
  return (
    <main className="min-h-screen bg-yellow-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-4">
  🌞 Sunshine
</h1>

      <p className="text-2xl mb-8">
        Welcome, Bob.
      </p>

      <button className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 px-8 rounded-2xl shadow-lg text-xl">
        + Capture
      </button>

      <div className="mt-12 text-center">
        <h2 className="text-2xl font-semibold mb-2">
          Your Vault
        </h2>

        <p className="text-gray-600">
          No captures yet.
        </p>
      </div>
    </main>
  );
}