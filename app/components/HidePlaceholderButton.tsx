// Visibly disabled placeholder - "Hide for now" has no backing status,
// column, or logic anywhere in the codebase yet (confirmed by search).
// Deliberately native `disabled` (not just styled to look inert) so
// tapping it truly does nothing rather than faking behavior there's
// nothing real to wire up to. Remove this component and wire a real
// button once hidden/hide status actually exists.
export default function HidePlaceholderButton() {
  return (
    <button
      type="button"
      disabled
      aria-label="Hide (coming soon)"
      title="Coming soon"
      className="text-xs font-semibold bg-gray-50 text-gray-400 px-2 py-1.5 rounded-full opacity-60 cursor-not-allowed"
    >
      🙈 Hide
    </button>
  );
}
