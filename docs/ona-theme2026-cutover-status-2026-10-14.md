# Where we are, and what the `ona_theme2026` cutover has to carry

**Written 2026-10-14 (AEDT).** Companion to
[`horizon-upgrade-assessment-2026-09-21.md`](./horizon-upgrade-assessment-2026-09-21.md),
which decided *which* theme gets upgraded and what the version bump costs. This one is the
state of play on the day, and the gap list the cutover has to close.

Every number below was read from the shop or the repos on 2026-10-14, not carried over from
a previous note. Where something was inferred rather than measured, it says so.

## 1. The three themes that matter

| | theme id | role | lineage | connected to a repo? |
|---|---|---|---|---|
| **Live** | `160335790271` | MAIN | Horizon 3.5.1 lineage, ONA's own `main.css` on top | **No** |
| **2026 theme** | `154676789439` (`ona_theme2026/main`) | UNPUBLISHED | Horizon **4.1.4** | Yes -- `ideum-co/ona_theme2026` |
| PR #46 preview | `160815546559` | UNPUBLISHED | duplicate of live + the PDP CSS fix | no (hand-uploaded) |

Two more to leave alone: `160396837055` (WFG cart contribution draft, awaiting Macarena) and
the two `Updated copy of ...` themes that Decision 3 of the assessment says not to delete.

`ona_theme2026` `origin/main` is `f78e8cf` (2026-09-29) and has not moved since; the shop
theme's `updatedAt` of 2026-10-07T21:04Z is a store-wide touch -- every dormant theme on the
shop carries a timestamp within two minutes of it -- not a theme push. So the shop theme and
the repo are in step.

## 2. What is true today

**The PDP image fix is merged and not deployed.** PR #46 landed as `feee821`. Live's
`assets/main.min.css` is still `3e3e2dcb...` (466,475 bytes, last written 2026-09-29) against
the merged `4fd651d8...` (467,098). Customers still see In Sequence at 307x219 and the drip
boxes at 307x256. The repo's pre-merge CSS is byte-identical to live's, so the deploy is a
one-file replacement that cannot clobber a direct edit. It is blocked only on the connector
policy, which refuses writes to the MAIN theme -- a person has to upload it.

**That fix is legacy-only and has a shelf life.** Checked today: `ona_theme2026` carries no
`.product-top`, no `product-information__media` CSS rule and none of ONA's legacy `main.css`.
Its PDP sizes the product shot from the media column the Horizon way, and a drip-bag box
renders proportionate without help. Nothing to port -- the fix exists to serve the live theme
until the cutover, and dies with it.

**The Water For Good counter is being driven by hand.** `shop.custom.donation_total` was
$9,150 and two days stale this morning; a manual full recompute on mac-studio wrote
**$11,129** at 2026-10-14T02:55:39Z (1,029 orders considered, 0 orphan lines, 0 warnings,
-$3 of refund adjustment), and the live homepage now renders it. The hourly job that should
be doing this is still not deployed: `707d28c` is unpushed and there is no PR for
`feat/wfg-counter-enable-writes`. Until that ships, the number is only as fresh as the last
person who ran the script.

**Live carries edits that exist in no repo.** `templates/index.json` on live was edited at
2026-10-13T02:06:53Z, after the PR #46 preview was duplicated from it -- which is why
publishing that preview would have rolled the homepage back, and why it must not be used as
a deploy route. This is the general shape of the problem: live is not repo-connected, so its
true content is only discoverable by diffing the theme itself.

## 3. The gap that decides the cutover date

**`ona_theme2026` has no Water For Good campaign in it at all.**

Verified three ways today: the repo has no file matching `wfg` or `donation` in `sections/`
or `snippets/`; the 2026 theme's homepage template renders no `ona-donation-counter` section
(live's does, and the section file `sections/ona-donation-counter.liquid`, 2,793 bytes, is
present on live); and a PDP rendered under theme `154676789439` shows no contribution badge.

The campaign runs **1-31 October 2026, inclusive**. So the cutover has exactly two honest
options:

1. **Cut over after 31 October**, and the campaign never has to move; or
2. **Port the campaign first** -- the counter section, the PDP badge, and the cart
   contribution snippet that is still sitting unreviewed in draft theme `160396837055` --
   and accept that the port has to be correct on the first try, because the storefront is
   making a promise about money to customers while it runs.

Publishing the 2026 theme mid-campaign without the port would silently drop a live fundraising
commitment from the storefront. That is the single most important thing on this page.

## 4. Plan

Ordered so that nothing waits on a decision that has not been made yet.

**Now, independent of the cutover**

1. Upload the merged `assets/main.min.css` to theme `160335790271`. One file, verified
   checksums both sides. Re-measure a bag and a box on live afterwards, and check one real
   phone -- the mobile breakpoints were verified from the CSS rules via the CSSOM, never from
   a rendered narrow viewport.
2. Ship the WFG counter job: push `707d28c`, open and merge the PR, pull on mac-studio,
   `pm2 start ecosystem.config.cjs --only ona-wfg-counter` + `pm2 save`. Expect the first run
   to fire immediately on `pm2 start` -- a `cron_restart` process runs once before it
   schedules -- and the staleness alert to fire once, truthfully.
3. Delete preview theme `160815546559` once step 1 is verified.

**Then, the cutover itself**

4. **Bump `ona_theme2026` 4.1.4 -> 4.2.0.** Already measured (PR #47): 125 files drop in
   clean, 57 locale catalogues union with zero colliding keys, 17 more three-way merge with
   no human decision, and **5 files -- 37 lines -- actually need a person**. Roughly a day.
   Do this before the gap analysis, so the gap analysis is run against the theme that will
   actually ship.
5. **Enumerate what live has that the 2026 theme does not.** Live is not repo-connected, so
   this cannot be done from git. Pull the live theme's file list with checksums, diff it
   against the legacy repo at the matching commit to isolate the direct edits, then diff the
   feature inventory against `ona_theme2026`. The WFG campaign is the one gap we already know
   about; the homepage edit of 2026-10-13 proves there are others, and guessing at them is
   how a cutover loses work quietly.
6. **Decide the campaign question from section 3** -- port, or wait for 1 November.
7. **Settings and content.** `config/settings_data.json`, the template JSON files, and
   anything merchant-edited in the theme editor do not travel with a git merge. Shopify stores
   theme JSON minified and returns it pretty-printed, so a checksum comparison across the two
   themes needs normalising first or every file looks changed.
8. **Sign-off on a preview of the real thing**, then publish. Rollback is republishing
   `160335790271`, which stays untouched -- so keep it, and do not reuse its id for anything.

## 5. Decisions needed

- Cut over after the campaign, or port Water For Good into the 2026 theme first? (Section 3.)
- Who uploads the PDP CSS to live -- the connector cannot, by policy.
- Does the WFG counter job ship before the cutover? If the campaign is ported, the job's
  storefront contract has to be re-checked against the 2026 markup; if the cutover waits for
  November, the job only ever serves the legacy theme and the question is whether it is worth
  shipping at all.

## 6. What this does not change

Decision 1 of the assessment stands: **the live theme is not being upgraded to Horizon 4.x.**
Everything above is about replacing it, not patching it.
