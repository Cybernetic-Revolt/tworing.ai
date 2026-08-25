# TwoRing — Site Completion Plan

*Reviewed 2026-06-21. Goal: a genuinely "fully working," self-serve, well-designed site — a
prospect can find → understand → sign up → get onboarded, and a customer can run their own
account (team, settings, password) without the founder touching a database.*

**Guiding test for "done":** the founder never has to open `/admin` or SSH for anything a
customer should be able to do themselves.

Legend — Effort: **S** ≤1h · **M** a few hours · **L** a day+ · Status: ✅ done · ✍️ drafted
(this session, not yet shipped) · ⬜ to do · ⚠️ decision needed.

---

## Already solid (this session — the base the plan builds on)
- ✅ Security hardened: session revocation (sessionEpoch + live DB re-check), SSRF guard on
  webhooks, CSV-injection fix, security headers, OAuth CSRF binding, HS256 pinning.
- ✅ Multi-tenant isolation verified clean (no cross-tenant/IDOR).
- ✅ Trades re-vertical (hero, industries, compliance chip, "founder direct"), meta/OG.
- ✅ Pricing framing (CAD callout, guarantee anchor) + included-minutes bump.
- ✅ Brand system unified, two-tier portal header, active-tab nav, logo animation.

---

## Phase 1 — Make it a *working* funnel + self-serve account (the essentials)

1. **Signup funnel `/start`** — ✅ **SHIPPED & live.** Trial-request form (business, name,
   email, phone, trade, city) → stores a `Signup` row + emails the founder (reply-to the
   prospect). Success/error states, on-brand. **Rewire every "Start free" CTA** (header, hero,
   4 pricing tiers, final CTA) from `#demo` → `/start`. *Fixes the review's #1 blocker: today
   ad clicks have nowhere to convert.* Effort: **S** (finish rewiring + deploy).
2. **Self-serve Team & permissions `/app/team`** — ✅ **SHIPPED & live.** Owners/admins
   invite teammates (email + temp password + role), change roles, remove — with guardrails
   (can't demote/remove the last owner, can't change your own role, only owners grant owner,
   each change bumps sessionEpoch to revoke stale sessions). Add **Team** to nav. Effort: **S**.
3. **Password reset (forgot password)** — ✅ **SHIPPED & live.** Today a teammate who forgets is
   locked out (only re-invite works). Build: `PasswordReset` model (token, expiry) → "forgot
   password" link on login → emailed reset link → set-new-password page → bump sessionEpoch.
   Effort: **M**.
4. **Self-serve Business Settings `/app/settings`** — ✅ **SHIPPED & live.** Owner edits business name, timezone,
   **notify email** (closes the long-pending item), **transfer/human number**, average job
   value, Google review URL, and business hours (fold in or link `calendar/settings`). Moves
   ops off the engineer console. Owner/Admin gated. Effort: **M**.

## Phase 2 — Design & UX polish ("look and be designed")

5. **Portal IA / nav declutter** — ✅ **SHIPPED & live.** Account/Team/Business
   Settings/Connections grouped under one top-nav **Settings** entry with a shared sub-tab bar
   (Business · Team · Connections · Account); top nav keeps the daily-use views.
6. **New-customer onboarding checklist** — ✅ **SHIPPED & live.** Dashboard "finish setting up"
   card (forward number → set hours → connect calendar → set job value); completion derived
   from real data, auto-hides when done, owner/admin only, never on the demo org.
7. **Login / auth screen polish** — ✅ **SHIPPED & live.** Display-serif heading, emerald
   primary button, brand focus rings, inline "Forgot?" link, Start-free cross-link.
8. **Landing conversion fixes (from the readiness review)** — ✅ **SHIPPED & live.** Trades-first
   demo labels, concrete guarantee wording, bigger header CTA, conservative ROI defaults +
   slider a11y, Jobber sync (beta) surfaced honestly in features + FAQ.
9. **Design QA pass** — ✅ **SHIPPED & live.** Two-agent audit of every public + portal page;
   fixed: focus rings (landing nav/footer, auth logos, legal shell, calendar-settings inputs),
   emerald checkbox accents, display-serif on /forgot + /reset, leads-table radius, and 375px
   overflow in calendar-settings hours/booking grids.

## Phase 3 — Trust & credibility (from the credibility review)

10. **Honest founder/about element** — ✅ **SHIPPED & live.** "One founder, in Alberta"
    section between FAQ and final CTA with a real contact (message@bilco.ca mailto) — no
    invented names, photos, or testimonials.
11. **Compliance developed beyond a chip** — ✅ **SHIPPED & live.** `/security` page with only
    code-verifiable claims (data in Canada, CASL STOP/START handling, session revocation,
    encrypted tokens, signed webhooks, self-serve export); hero chip + footer link to it;
    added to sitemap.

## Phase 4 — Close the operational integrations (owner-self-serve)

12. **Inbound Google Calendar sync** (task #9), **connect demo Google** (#10), **Jobber
    live-test + Client→Request** (#11) — ⬜ finish so integrations are trustworthy before the
    guarantee leans on them. Effort: **L**.

---

## Decisions I need from you
- **⚠️ Trial leads destination:** the `/start` form currently emails `message@bilco.ca`
  (known-working). Confirm, or give the bilcoworks.com address.
- **⚠️ Canadian demo number:** swapping a demo line to a 403/587/825 Alberta number needs a new
  VoIP.ms DID (small monthly cost). Do it, or just relabel the existing lines to trades for now?
- **⚠️ Sequencing:** recommend shipping **Phase 1** immediately (it's the working-site
  essentials, and #1–#2 are already drafted), then Phase 2, etc. OK to proceed on approval?

## Recommended order
Phase 1 (1→2→3→4) → Phase 2 (6, 7, 8, 5, 9) → Phase 3 → Phase 4. Ship after each item.
