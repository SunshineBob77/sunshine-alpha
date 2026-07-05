export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/50 to-white flex flex-col items-center p-8">
      <div className="w-full max-w-lg">{children}</div>
    </main>
  );
}
