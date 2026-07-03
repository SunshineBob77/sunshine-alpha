export default function DailyBrief() {
  return (
    <section className="bg-white rounded-2xl shadow p-6 text-left mb-8">
      <p className="italic text-lg mb-6">"Good morning, Sunshine."</p>

      <h3 className="font-bold text-xl mb-2">🎯 Today's Focus</h3>
      <ul className="list-disc ml-6 mb-6">
        <li>Build Sunshine Alpha</li>
        <li>Create Shared Spaces</li>
        <li>Test Capture and Vault</li>
        <li>Continue ADG Scotland Landing Page</li>
        <li>Evaluate Atlas opportunities</li>
      </ul>

      <h3 className="font-bold text-xl mb-2">🌟 Yesterday's Win</h3>
      <p className="mb-6">
        Sunshine moved from idea mode into real working software.
      </p>

      <h3 className="font-bold text-xl mb-2">💡 AI Insight</h3>
      <p>
        Shared Spaces may become Sunshine's biggest differentiator: not just
        shared files, but shared understanding.
      </p>
    </section>
  );
}