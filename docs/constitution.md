# Sunshine — Constitution & System Architecture
### Version 1.0 (Frozen)

> Sunshine isn't primarily a note-taking app, a calendar, a reminder app, or an AI assistant. It's a memory system whose job is to increase the value of your information over time while preserving your trust.

This is the sentence every future engineer, designer, or team member should read before writing a single line of code. Everything below follows from it.

---

## Versioning Convention

- **v1.0 → First Principles** (this document — frozen)
- **v1.1 →** Clarifications
- **v1.2 →** Small additions
- **v2.0 →** Only if the underlying philosophy genuinely changes

Part I and Part II should almost never change. Part III evolves occasionally. Part IV (the Roadmap) changes constantly and should be tracked separately.

---

## Part I — Constitution
*(Almost never changes. No implementation, no database, no API — just philosophy.)*

### The Four Laws

**Law #1 — Sunshine adapts to your life. You do not adapt to Sunshine.**
The product bends to fit how a person already thinks and speaks. It never forces folders, rigid categories, or a "correct" way to use it.

**Law #2 — Sunshine never asks users to organize what it can confidently organize itself.**
No manual folders, categories, or tags when Sunshine can infer them. If Sunshine can do it confidently, it should — without asking.

**Law #3 — Sunshine always preserves the user's original memory.**
- Never rewrite the original text.
- Never silently "fix" it.
- Never replace it with AI output.
- Enhancements (cleaned notes, summaries, enrichment, connections, computed status) live *alongside* the original, never on top of it.
- This applies beyond text: a voice Drop preserves original audio → verbatim transcript → cleaned note → summary, each a distinct, separately visible layer. Nothing is silently replaced.
- It also applies to time: a Drop whose date has passed is not rewritten — its *status* (upcoming / today / past) is computed, and passing that status is not the same fact as the user completing it.

**Law #4 — Sunshine acts proactively, but never mysteriously.**
Automatic enrichment, automatic reminders, automatic connections — all permitted. But Sunshine always:
- tells you what it did,
- tells you why,
- lets you change or undo it,
- never hides it.

This is broader than "transparency" — it's a commitment to predictable AI behavior. It explains reminder confirmations, enrichment badges, AI summaries, Thread suggestions, and research results as instances of one underlying rule, not five separate features.

### The Guiding Question

> Does this make a Drop more valuable at some point in its lifecycle — while preserving the user's trust?

If yes, a proposed feature likely belongs. If not, it's likely outside the core mission.

### The Decision Engine Principle

> The higher the cost of being wrong, the higher the confidence Sunshine must require before acting automatically.

Researching the wrong restaurant is mildly annoying. Sending an unwanted notification is more intrusive. Connecting two unrelated private memories may be more sensitive still. Every proactive behavior (enrichment, reminders, connections, future behaviors) shares one architecture — score signals, compare to a threshold, then auto-act / suggest / do nothing — but each sets its own trust threshold based on the real cost of a wrong guess.

### The UI Placement Rule

> Confirmed actions may appear on collapsed cards. AI suggestions belong in detail views — except for brief post-capture feedback.

The Lifeline stays a calm, scannable stream of what Sunshine has actually *done* — not a dashboard of what it's merely proposing. A newly captured Drop may briefly show a suggestion (e.g. "Friday detected · Add reminder") immediately after capture; once the session ends or the user scrolls away, that suggestion moves into the detail view only. This rule governs reminders today, and should govern suggested Spaces, possible Thread connections, enrichment suggestions, duplicate detection, and "Research this" prompts going forward.

### "Every Stage Has One Job"

- Capture preserves it.
- Recognize identifies it.
- Understand enriches it.
- Connect relates it.
- Remember keeps it.
- Surface brings it back at the right moment.
- Share demonstrates it to someone new.
- Trust turns a new user into someone who puts more of their life into Sunshine.

---

## Part II — Lifecycle
*(Rarely changes.)*

```
Capture
   ↓
Recognize
   ↓
Understand
   ↓
Connect
   ↓
Remember
   ↓
Surface
   ↓
Share
   ↓
Build Trust
```

**Ask Sunshine floats above this entire lifecycle** as a conversational interface — like Spotlight Search, not a stop on an assembly line. It can create a Drop, retrieve Drops, modify metadata, create reminders, act on a known Drop, or share something. It acts on every stage; it isn't confined to one.

### Stage definitions

- **Capture** — user drops a thought in (voice, text, photo). No forced structure.
- **Recognize** — cheap, local, synchronous entity detection: dates, times, URLs, phone numbers, addresses. No external lookup, no API cost. Runs on every Drop instantly.
- **Understand** — for high-confidence entities, lightweight one-time lookup (hours, maps, website, parking) or living updates for things that change (weather, traffic, flight/shipping status). Confidence-scored, not capability-scored — the test is never "can this be researched," it's "am I highly confident this is correct."
- **Connect** — Sunshine detects relationships between Drops (same vehicle, same trip, same person). Never surfaced to the user as raw "AI connections" — expressed through Threads instead.
- **Remember** — the Drop is kept, original untouched, with enrichment and connections layered alongside it.
- **Surface** — bringing information back at the right moment: the Lifeline, Threads, Ask Sunshine, notifications, widgets, Daily Brief, "Upcoming," lock screen. All different expressions of the same job.
- **Share** — a Drop becomes a demonstration of Sunshine to someone who's never used it. See Part III for the four-stage reception funnel.
- **Build Trust** — the real endpoint, not "Install." Trust causes more Drops, which makes Sunshine more useful, which builds more trust. A flywheel.

### Threads vs. Connections

- **Connections** = the intelligence (AI-detected relationships between Drops).
- **Threads** = the interface (what the user actually sees and interacts with).

Users never see "3 connections found" — they see a Vehicle Thread or an Evening Out Thread that Sunshine quietly assembled. Connections may be inferred dynamically, but a Thread becomes stable once surfaced, accepted, edited, or used — never silently recomputed in a way that could reshuffle what the user sees.

---

## Part III — System Architecture
*(Changes occasionally as features ship.)*

### Entity Detection ("Recognize") — Shipped

Local, synchronous, no API cost. Scope for v1: dates/times (merged into one structure — an ISO timestamp plus a `hasTime` flag, since natural text almost always expresses them together, e.g. "next Tuesday at 3pm"), URLs, phone numbers, clearly-structured addresses. Businesses/products/books/public figures deliberately excluded from this pass — those require real disambiguation and stay in the Understand-stage LLM call.

Stored as a single `captures.entities` jsonb column (mirrors how `space_ids` is already stored) — avoids a proliferation of narrow columns for something still evolving.

### Enrichment Scoring — Roadmap (schema change required)

Simple test before any lookup: *can this be verified in the outside world?* If no (journal entries, gratitude, personal reflections, therapy notes, brainstorms, dreams, emotional voice memos) — leave it alone.

If yes (restaurants, businesses, venues, flights, hotels, addresses, products, books, movies, public events, public figures, recipes, tracking numbers, etc.) — score it:

```
Business              +30
Address               +25
Date/time             +20
Public event          +20
Public person         +20

Journal language      -40
Reflection language    -40
Emotional language     -40
```

Above threshold → automatically enrich. Below → leave alone unless the user explicitly taps "Research this." Real-world limitation observed in testing: the current single-LLM-judgment-call approach is sensitive to phrasing — e.g. "Toni Lynn Washington" (one name) enriched successfully, while "Toni Lynn, Washington" (read as two names by the model) did not. This scoring system is the actual fix, not a narrow patch for punctuation parsing.

**Enrichment layers:**
- Layer 1 (Recognition) — see Entity Detection above.
- Layer 2 (Understanding) — one-time lookup: hours, maps, website, phone, parking.
- Layer 3 (Live Updates) — only for things that naturally change: weather, traffic, flight status, shipping status, scores.

**Cost control:** Drop → extract entities → anything worth enriching? → No: done, zero cost. Yes: one enrichment job, cache results, reuse whenever possible. Many Drops should cost nothing; public information should never be re-researched from scratch once cached.

### Reminder Scoring — Roadmap

**A reminder is not a separate object. A reminder is a behavior attached to a Drop.**

```
reminders
- reminder_id
- drop_id
- remind_at
- status
- delivered_at
- completed_at
- repeat_rule (future)
```

One Drop can have zero or many reminders without complicating the Drop itself.

Reminder-intent is a **separate score from enrichment** — a future date should only trigger an automatic reminder when the Drop reads as an actual commitment, appointment, task, or deadline:

```
Explicit "remind me" language           +100
Specific future date and time            +40
Action verb (call, renew, pay, submit)   +30
Appointment/event language                +30
Deadline language ("by," "due")           +30
Confirmed place/business                  +15

Historical/reporting language            -60
Speculative language                      -40
Copied article/receipt/document           -40
Reflection/journal language               -50
```

- **80+** → create the reminder automatically.
- **50–79** → detected as upcoming; surface a lightweight "Add reminder" suggestion (in the detail view, per the UI Placement Rule — with a brief exception immediately after capture).
- **Below 50** → store the date only, no reminder UI at all.

**Default lead times (v1, context-based, not one flat rule):**
- Timed event/appointment → 1 hour before.
- Deadline/due date → 3 days before.
- Same-day task with no time given → 9:00 AM that day.
- Travel/departure → 2 hours before.

Explicit user instruction always overrides the default (e.g. "remind me three days before dinner").

**Visible and reversible, always** (Law #4 in practice):
> Reminder set for Friday at 6:30 PM · Change · Remove

**Sequencing:** self-reminders (me → me) are buildable now. Reminding *other* people is deliberately deferred — it requires permissions, mute, accepted/pending states, and revocation, all of which belong with Shared Spaces, not before it.

### Ask Sunshine v1 — Roadmap

Not centered on pgvector/semantic search. Entity retrieval is deterministic, explainable, cheaper, and already supported by shipped Entity Detection work. Semantic search is a fallback, not the foundation.

**v1.0 scope:**
- Upcoming-date queries ("what's coming up," "what do I have this week," "anything Friday")
- Past-date queries
- Date-range retrieval
- Address, phone, URL lookup
- Title/body keyword search
- Space filtering
- Creating a Drop through conversation (via the *same* Capture → Recognize → Enrichment → Remember pipeline — no separate "Ask-created Drop" path)
- Opening a returned Drop

**v1.1:** mark complete, move to Space, share, create reminder, basic person/place lookup.

**v1.2:** embeddings/semantic fallback, cross-Drop answers, Thread-aware retrieval, ambiguity resolution using prior context.

**Architecture — intent router before retrieval:**
```
User asks something
        ↓
Classify intent
        ↓
Retrieve | Capture | Act
```

**Retrieval order (cheapest/most certain first):**
1. Exact entity match
2. Structured filters (date range, entity type/value, Space, status)
3. Title/body keyword search
4. Semantic retrieval (fallback only)
5. Ask a clarifying question if confidence remains low

**"What's upcoming" answer format:** grouped by day (Today / Tomorrow / specific date), not a long flat list and not a calendar grid — stays true to "no calendar UI." Each result shows only time (if known), Drop title, one useful secondary line, and a tap target — never the full note unless there's only one result.

**Past ≠ completed:** a Drop's date status (upcoming/today/past) is computed, not rewritten. A passed Drop stops appearing in "what's upcoming," still appears in ordinary search and in queries like "what did I have last week," and remains in its Thread and Space. It is marked completed only if the user actually completes it — a past date is not itself completion.

**Ambiguous dates** (e.g. "Dinner Friday") resolve to a specific date at capture time, while preserving: the original text, the normalized date, and the resolution context (timezone, capture date) — so the meaning never silently shifts later.

### Threads / Thread Memberships — Architectural direction, not yet scoped for build

Replace or extend the current `thread_id`-on-Drop model with a junction table, since a Drop may belong to more than one useful Thread (a Kia maintenance Thread, a July expenses Thread, a Wakefield errands Thread):

```
thread_memberships
- thread_id
- drop_id
- source       (user | AI | rule | import)
- confidence
- status       (suggested | accepted | hidden)
- timestamps
```

Open question to resolve before starting: does this replace `thread_id` outright, or run alongside it during a migration period?

### Share Architecture — Four-Stage Reception Funnel

A shared Drop is often a stranger's very first glimpse of Sunshine — treated as a demonstration, not an advertisement.

1. **Curiosity** (iMessage/link preview) — goal: "that looks interesting," nothing more. Answers in 5 seconds: what is this, who shared it, why open it. Static image only — iMessage previews cannot animate.
2. **Value** (the public Drop page) — goal: "wow, this is actually useful." Show the original Drop + enrichment (maps, research). Content is the hero, no raw URLs, generous whitespace. "Shared by [Name]" always present — never hidden, since attribution is trust context, same as knowing who sent an email — but visually secondary and shrinking in prominence on repeat views.
3. **Discovery** — the "aha" moment: "How did this get all this information?" → Sunshine recognized the entity, found directions, added details, organized it automatically.
4. **Adoption** — only now: "Want Sunshine to do this for everything in your life?" → Learn More / Get Sunshine.

Every shared Drop should quietly answer: what is this, who shared it, why is this useful, how did Sunshine make it better — teaching the product without a tutorial.

---

## Part IV — Roadmap
*(Changes constantly — track as a living backlog, not part of the frozen document.)*

See the separate, continuously-updated roadmap doc for current build-now / soon / later / research items and open questions.
