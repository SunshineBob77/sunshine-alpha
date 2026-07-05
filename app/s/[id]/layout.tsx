export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#FBF7EE] flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-[460px]">{children}</div>
    </main>
  );
}
