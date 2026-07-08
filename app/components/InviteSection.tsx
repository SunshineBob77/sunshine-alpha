export default function InviteSection({ name }: { name: string | null }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#FFFBEF] to-[#FEF3D7] ring-1 ring-[#F2C868]/40 p-6">
      <p className="text-sm font-semibold text-[#92400E] mb-3">
        ☀️ {name ? `${name} invited you to Sunshine` : "You're invited to Sunshine"}
      </p>

      <blockquote className="text-sm italic text-[#5B5647] leading-relaxed border-l-2 border-[#F2C868] pl-3 mb-4">
        “I've been using Sunshine to organize my ideas, reminders, and projects. I thought you'd
        enjoy it too — and we can even share ideas and work on things together.”
      </blockquote>

      <p className="text-base font-bold text-[#2A281F] mb-2">
        Never lose another important thought.
      </p>

      <p className="text-sm text-[#5B5647] leading-relaxed mb-3">
        Sunshine is your personal place to capture ideas, reminders, notes, receipts, plans, and
        everything life throws at you. Drop it in, and Sunshine quietly organizes it so it's
        always easy to find.
      </p>

      <p className="text-sm text-[#5B5647] leading-relaxed mb-2">
        But Sunshine is more than personal:
      </p>
      <ul className="list-disc ml-5 mb-3 space-y-1 text-sm text-[#5B5647] leading-relaxed">
        <li>Share ideas with family</li>
        <li>Plan trips together</li>
        <li>Build projects together</li>
        <li>Keep everyone on the same page — no digging through old texts and emails</li>
      </ul>

      <p className="text-sm text-[#5B5647] leading-relaxed mb-4">
        Whether it's a grocery list, a vacation, a business idea, or your next big project —
        Sunshine becomes a place where ideas can grow together.
      </p>

      <a
        href="/?mode=signup"
        className="flex items-center justify-center gap-2 bg-[#1B2340] hover:bg-[#141a30] text-white text-sm font-semibold px-5 py-3.5 rounded-full transition-colors"
      >
        Create Your Free Account
      </a>
      <p className="text-center text-xs text-[#8A8571] mt-2">Takes less than a minute.</p>
    </div>
  );
}
