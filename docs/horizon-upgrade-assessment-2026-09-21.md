# Can the live theme be upgraded to Horizon 4.2?

**Date:** 2026-09-21 (revised 2026-09-22 after review)
**Answer:** Not as a version bump. Roughly 2/3 of the files Shopify changed are ones we
have modified, and of the remainder a meaningful share depend on 4.2-only APIs.

## Why this came up

Shopify auto-created two themes on 2026-09-21 named `Updated copy of ...`, both on
Horizon 4.2.0. Shopify only auto-updates *unmodified* theme-store themes; when a theme has
been edited it cannot update in place, so it clones instead. It updated two old themes and
left the live theme alone. That behaviour is itself the first answer.

## Versions

| theme | Horizon |
|---|---|
| live (`155646558399`) | **3.5.1** |
| `ona_theme2026/main` (`154676789439`) | **4.1.4** |
| the two auto-created copies | **4.2.0** |

Upstream is open source: https://github.com/Shopify/horizon
Relevant commits: `45c7db5` = v3.5.1 (2026-05-22), `f9aef27` = v4.2.0 (2026-09-18).

## Reproducing the comparison

```sh
git clone --filter=blob:none https://github.com/Shopify/horizon.git
rm -rf /tmp/h351 /tmp/h420          # must be empty, not merely present
mkdir -p /tmp/h351 /tmp/h420
git -C horizon archive 45c7db5 | tar -x -C /tmp/h351   # 3.5.1
git -C horizon archive f9aef27 | tar -x -C /tmp/h420   # 4.2.0
```

`git -C horizon` matters: without it the `archive` calls run against whatever repo you are
standing in, where those commits do not exist. The `mkdir` matters because `tar -C` will
not create the target directories.

The `rm -rf` matters when you reuse this for a later Horizon release. `tar -x` overwrites
the paths present in the new revision but never removes files that the new revision
deleted or renamed, so a leftover extraction silently inflates both the diff and every
file count computed from it. Extract each revision into an empty directory.

For each file Shopify changed, the first test is: does our copy still md5-match pristine
3.5.1? If yes, we have not modified it. **That is necessary but not sufficient** -- see
"the second test" below.

## What the diff shows

Upstream 3.5.1 -> 4.2.0: **321 files modified, 65 added, 2 removed.**

| | count |
|---|---|
| our copy still pristine 3.5.1 | **124** |
| we have modified | **197** |

The 197 break down as 83 blocks, 40 sections, 51 locales, 12 JSON templates, 5 snippets,
3 assets, 2 config, 1 layout. The 12 JSON templates are *store configuration*, not code --
copying upstream's would wipe the homepage, PDP and cart layouts. They must never be taken
from upstream at any version.

Separately, live is only nominally a Horizon theme: **98 of 145 sections** are ONA-prefixed
or legacy (`product-template-2` / `-3`), i.e. 68%.

## The second test: do the 124 actually drop in?

"Unmodified by us" says nothing about whether a file's *dependencies* still exist. Two
dependency classes block it, and they must be checked separately.

**1. Horizon 4.0 replaced the colour system.**

| | `settings.*color_scheme` | `color-custom-*` | `color_palette` in settings_schema |
|---|---|---|---|
| 3.5.1 | 11 variants | 0 | no |
| **live** | 11 variants | 0 | **no** |
| 4.2.0 | **0** | 5 classes | yes |

Example from `snippets/price-filter.liquid`:

```diff
- class="... {% if filter_style == 'horizontal' %} color-{{ settings.popover_color_scheme }}{% endif %}"
+ class="... {% if filter_style == 'horizontal' %} color-custom-popover{% endif %}"
```

**15 of the 124** reference the new palette API in their 4.2 form. Those are hard-blocked.
The other 109 do not, and are individually assessable -- an earlier draft of this document
claimed all 124 were blocked, which was wrong.

**2. New snippets.** 4.2 adds 65 files. Of the 59 palette-free *liquid* files among the
124, **21 render a snippet that does not exist in 3.5.1** (`price-styles`,
`text-block-styles`, `variant-picker-styles`, `checkbox-styles`, `dialog-styles`, and
others).

These 21 are **not automatically blocked**, and an earlier draft of this note was too
strong in implying they were. A missing snippet can simply be copied across with its
caller. What makes them expensive is that the copied snippet has its own dependencies,
which have to be resolved recursively — and the style snippets above are exactly the ones
that tend to reach back into the 4.x colour system, at which point test 1 applies to them
instead. Treat the 21 as "carries an unresolved dependency, cost unknown until traced",
not as "impossible". Tracing them was out of scope here because the conclusion below does
not turn on it; if someone wants a specific cherry-pick from this set, trace that one
file's snippet tree rather than trusting this count.

Net of both tests:

| | count |
|---|---|
| palette-dependent | 15 |
| render a 4.2-only snippet | 21 |
| liquid, no detected dependency | 38 |
| js / css, no detected dependency | 50 |

So ~88 of 124 have no *detected* dependency on a 4.2-only API. That is not the same as
"safe" -- JS modules and CSS custom properties have their own couplings this test does not
cover -- but it is a real, much smaller candidate list than "all 124".

## What 4.2 would actually buy

Mostly right-to-left language support, irrelevant for an AU-only storefront. The functional
fixes and where each lives:

| fix | reachable without touching a modified file? |
|---|---|
| Quick Add JS loads only when enabled | **no** -- see below |
| price filter values wiped mid-edit | no -- `blocks/filters.liquid` (modified, 223 lines) |
| cart drawer/page stale after browser Back | no -- needs the modified cart blocks |
| smaller product-card images, 2-col mobile | no -- needs modified `_product-card-gallery` etc. |
| swatch rows widening rounded cards | no -- `blocks/swatches.liquid` (modified) |
| popup video not playing in Safari | no -- `blocks/popup-link.liquid` (modified) |

An earlier draft called Quick Add a free cherry-pick because all five of its files are
pristine 3.5.1. Applying the second test kills it:

| file | |
|---|---|
| `assets/quick-add.js` | clean |
| `snippets/quick-add-styles.liquid` | clean |
| `snippets/quick-add-modal.liquid` | **palette-dependent** |
| `snippets/quick-add-modal-styles.liquid` | renders `dialog-styles` (4.2-only) |
| `snippets/quick-add.liquid` | renders **9** 4.2-only snippets |

Three of five files have unmet dependencies. There is no free fix in 4.2 for this theme.

Also checked directly: the 21 changed lines in the "pristine" `price-filter.liquid` are
`<bdi>` wrappers and logical CSS (`text-align: end`, `inset-inline-start`) -- RTL, not the
filter bug fix.

## Decision

1. **Live stays on 3.5.1.** The upgrade is gated on a colour-system migration across 197
   modified files, to buy RTL support we do not need, with no fix reachable for free.
2. **Bump `ona_theme2026` 4.1.4 -> 4.2.0 instead.** It is already past the 4.0 colour
   migration, so for that theme this is a genuine version bump rather than a rewrite, and it
   is where 4.2's fixes can realistically land. Victor's call.

   **Not "free", and an earlier draft overstated this.** Being past the colour migration
   establishes API compatibility, nothing more. That theme has **79 of 482 stock files
   modified**, and any overlap between those 79 and the set Shopify changed between 4.1.4
   and 4.2.0 is a manual conflict to resolve and test. The cost is a reviewable merge
   instead of a rewrite -- which is the whole argument for that theme -- but it is not zero,
   and it has not been measured. Measure it the same way as above: diff `f63ddf8` (its base)
   against `f9aef27` (4.2.0) and intersect with our 79.
3. **Do NOT delete the two `Updated copy of ...` themes yet.** An earlier draft recommended
   deleting them on the strength of their names. Checked properly on 2026-09-22, both carry
   ONA code found in no kept theme:
   - `158554456255` (copy of ONA - LIVE 11/05/2026): `ona-collection-template` `9e4c1c12`,
     `ona-product-card` `dfa79d6e`
   - `158554489023` (copy of Store Finder Dev): those two plus `ona-store-finder.js`
     `29b39284`, which exists nowhere else
   They inherit it from their sources, which are themselves unresolved. See the note on
   method below.

The stale-cart-after-Back fix is the one with real customer impact. It arrives with the
2026 theme rather than as a patch to live.

## Measured: what the `ona_theme2026` 4.1.4 -> 4.2.0 bump actually costs

**Measured 2026-10-13** against `ona_theme2026` `origin/main` at `08011ba` (2026-09-28).
Decision 2 above said the cost "has not been measured" and gave the method. This is that
measurement. It is cheaper than the decision assumed.

Same extraction method as the top of this document, with `f63ddf8` (4.1.4) in place of
3.5.1:

```sh
rm -rf /tmp/h414 /tmp/h420 && mkdir -p /tmp/h414 /tmp/h420
git -C horizon archive f63ddf8 | tar -x -C /tmp/h414   # 4.1.4, the theme's base
git -C horizon archive f9aef27 | tar -x -C /tmp/h420   # 4.2.0
```

### Upstream 4.1.4 -> 4.2.0

| | count |
|---|---|
| modified | 204 |
| added | **1** -- `snippets/view-transition-opt-in.liquid` |
| removed | 48 -- **all of them `.cursor/rules/*.mdc`**, Cursor editor config, not theme code |

The 48 removals look alarming in a raw file count and are not: nothing in a storefront
renders them. The real surface is 204 modified files and one new snippet.

### `ona_theme2026` vs pristine 4.1.4

| | count |
|---|---|
| stock files present | 531 |
| pristine | 414 |
| **modified** | **117** (57 locales + 60 code/config) |
| stock files dropped | 0 |
| ONA-authored files | 176 |

This supersedes the "79 of 482 stock files modified" in Decision 2, which was measured on
2026-09-21; `origin/main` has had 17 commits since. Note the collision: 79 also happens to
be the conflict count below, and they are different quantities.

### The intersection -- the actual merge cost

| | count |
|---|---|
| clean drop-in (4.2 changed it, we are pristine) | **125** |
| conflict (we modified it AND 4.2 changed it) | **79** |
| 4.2 changed a file we had dropped | 0 |
| 4.2 removed a file we had modified | 0 |

**57 of the 79 conflicts are `locales/*.json`, and all 57 resolve mechanically.** Flattening
each file to dotted keys and comparing 4.1.4, 4.2.0 and ours three ways:

| | result |
|---|---|
| the 55 non-English locale files | ONA **added** 3,179 keys and **changed or removed none** |
| `locales/en.default.json` | ONA +7, ~0, -0; 4.2 +1, ~0, -1; **0 colliding keys** |
| `locales/en.default.schema.json` | ONA +134, ~0, -0; 4.2 +6, ~0, -0; **0 colliding keys** |

ONA has never edited a string upstream also owns -- every divergence is a new key. So all 57
are a key-level union with no human decision in any of them, including the English ones.
That is worth stating precisely, because "57 of 79 files conflict" reads like the bulk of
the work and is in fact none of it.

Note these files carry both a `/* */` header and `//` line comments, so a plain `json.load`
fails on them; strip both before comparing, or you will conclude the English locales are
unanalysable (they are not).

That leaves **22 files of real code conflict**:

| | files |
|---|---|
| sections | 8 |
| snippets | 7 |
| blocks | 4 |
| layout | 2 |
| config | 1 |

### Where the conflicts actually bite

File-level conflict overstates the work: two edits to the same file collide only if they
touch the same lines. Diffing 4.1.4->4.2.0 and 4.1.4->ours separately and intersecting the
changed line regions (+/-2 lines of context) gives, for the 22:

| file | base lines | 4.2 churn | ONA churn | overlapping lines |
|---|---|---|---|---|
| `blocks/footer-policy-list.liquid` | 217 | 14 | 164 | **23** |
| `sections/header.liquid` | 1768 | 77 | 440 | **5** |
| `layout/password.liquid` | 153 | 23 | 1 | **4** |
| `layout/theme.liquid` | 195 | 23 | 6 | **4** |
| `sections/hero.liquid` | 1487 | 17 | 115 | **1** |
| the other 17 | -- | 222 | 791 | **0** |

**Only 5 files have any line-level overlap at all, and 37 lines in total.** The remaining 17
are same-file-different-region, which `git merge-file` or a three-way merge resolves without
a human deciding anything.

Total upstream churn across all 22: **376 lines**. ONA's divergence in those same files is
1,517 lines, which is why the files conflict at the file level and why none of this should
be attempted by taking upstream's copy wholesale.

### What this means for the decision

Decision 2 stands, and is better supported than when it was written: this is a reviewable
merge, in the order of a day's work, not a rewrite. Concretely:

1. 125 files take upstream's version unchanged.
2. All 57 locale files take upstream's version plus ONA's added keys -- a scripted union,
   measured to have zero colliding keys in any file, English included.
3. 17 code files three-way merge with no human decision.
4. 5 code files need a person: `footer-policy-list`, `header`, `password`, `theme`, `hero`.
   `footer-policy-list.liquid` is the only one where ONA's divergence (164 of 217 lines) is
   large enough that "merge" may really mean "re-apply ONA's intent on top of 4.2".
5. Add `snippets/view-transition-opt-in.liquid`.
6. Ignore the 48 `.cursor/` deletions.

What it buys, from 4.2.0's own release notes: the stale cart drawer/page after a browser
Back (the one with real customer impact, called out above), Quick Add JS loading only when
enabled, smaller product-card images in two-column mobile grids, the price-filter
wipe-mid-edit fix, popup video in Safari, swatch rows widening rounded cards, and the
account popover alignment. The rest is RTL, still irrelevant here.

**Nothing in this changes Decision 1.** This measurement is about the 4.1.4-based theme. The
live theme is still on 3.5.1 and still behind the 4.0 colour-system migration.

## Note on method: a 3-file fingerprint is not a content check

The theme-cleanup work alongside this assessment initially classified themes as
safe-to-delete by comparing `layout/theme.liquid`, `config/settings_data.json` and
`templates/index.json`. Those three files do not contain ONA's own code, so the test
produced both false positives and false negatives -- themes called "byte-identical
duplicates" that held unique `ona-product-card` / `ona-collection-template` builds, and one
theme flagged as risky that was in fact a clean duplicate.

The first correction was to probe ~15 ONA-authored files per theme
(`assets/ona-*`, `sections/ona-*`, `snippets/ona-product-*`, `sections/product-template-2`)
and compare every checksum against *all* themes being kept at once. An incomplete reference
set is as misleading as too few files -- two of the corrections in this work were caused by
comparing against a partial set of kept themes rather than by sampling too few files.

That gave **4 of 18** candidates as clean. **That answer was also wrong**, and a review
caught it: a fixed list of filenames cannot see a customisation in any file it does not
name. The probe is only a faster way to be confident about the files you thought to check.

### What actually works: compare every file

Measured 2026-09-23. Page the complete file list of each candidate and of every kept theme,
and treat a candidate file as covered only when a file with the **same path and the same
`checksumMd5`** exists in at least one kept theme. That is 6,016 files across 10 themes --
tedious, but it is the only method that can support a destructive decision.

Doing that changed the answer again:

| candidate | 15-file probe | full comparison |
|---|---|---|
| `151371677887` Horizon | safe | safe -- `themeStoreId 2481`, and `updatedAt` is 12 seconds after `createdAt`, so it was provably never edited |
| `148713013439` Fabric | safe | safe -- `themeStoreId 3622`, re-downloadable (its editor *settings* would be lost; its code would not) |
| `152420909247` ona_theme/main (stale) | safe | safe -- 681 of 683 files byte-identical to a kept theme |
| `154587398335` ONA Redesign - Horizon base | safe, "zero ONA files" | **NOT SAFE** |

`154587398335` holds four files that exist in no kept theme and in no git commit on any
branch -- `templates/index.json`, `templates/collection.json`, `templates/search.json` and
`config/settings_data.json`. They are theme-editor layout work, which git never sees. The
probe missed them because it looked for `ona-*` filenames and these are stock paths holding
non-stock content. Its `themeStoreId` is null and it was created two days before
`ona_theme2026/main`: it is the redesign's precursor, not a stock theme.

The probe also missed both files that actually differ in `152420909247`, and described it as
having "all 12 ONA files identical" when it has 99 ONA-authored files. It reached the right
verdict there without having established it.

### The criterion has a weakness. It does not bite here, and that was checked.

"Covered if the same path+checksum exists in **any** kept theme" proves every individual
file survives somewhere. It does **not** prove any single kept theme reproduces the
candidate's coherent combination of templates and settings -- 681 files could match one
theme and 2 match another, leaving no theme that actually reproduces the candidate.

Measured, rather than assumed:

| candidate | covered by the union | covered by the best single theme |
|---|---|---|
| `152420909247` ona_theme/main (stale) | 681/683 | **681**/683 (`ona_theme/staging`) |
| `148713013439` Fabric | 180/411 | **180**/411 |
| `151371677887` Horizon | 348/418 | **348**/418 |

Union equals best-single in every case, so no verdict here rests on stitching themes
together. Where a future candidate's two numbers differ, treat the single-theme number as
the real one, or back the candidate up.

Checking that also surfaced something the coverage summary had glossed over.
`152420909247`'s two uncovered files are covered by *nothing*:
`sections/ona-collections-redirect.liquid` (`572e0167`) and `templates/page.location.json`
(`691a08ee`). Both paths exist in `onacoffee_theme` git at commit `621b9ae`, but **no git
blob in either repo matches those checksums** -- so "it is in git" is false of these
versions. That is the same condition that holds back `154587398335`, so it was held back
too, pending the same backup. **Both backups are now done and verified** --
`~/ona-backups/theme-154587398335-unique-2026-09-23/` and
`.../theme-152420909247-unique-2026-09-23/` -- so both are released. The deletion script
re-checks the backups at run time and aborts if any file is missing (tested).

Two things that came out of doing the backups properly:

**The reference set should have been all 48 themes, not 6.** Uniqueness was re-checked
against every theme in the store: `572e0167` and `691a08ee` each appear in exactly one.
The conclusion held, but "unique across the 6 kept themes" was the wrong question --
a file present in some *other* stale theme is still a file we would have been about to
delete twice over.

**Shopify JSON checksums can be verified after all.** Theme JSON is stored minified and
returned pretty-printed, so `md5(returned text)` never matches `checksumMd5`. Re-minifying
with `json.dumps(obj, separators=(',',':'), ensure_ascii=False)` **and escaping `/` as
`\/`** reproduces the stored bytes exactly -- confirmed on all six backed-up JSON files.
This is a stronger check than comparing checksums, because it proves nothing was truncated
in transit. Note it applies to `config/settings_data.json` too, not just `templates/*.json`.

### The stockist flags: a content question that turned out to be moot

`152420909247`'s `page.location.json` disables four stockists -- Black Sugar, KIKU, Mountain
Creek Bakery, Ugly Coffee -- and two of those (KIKU, Mountain Creek) are disabled there and
nowhere else. That looked like deletion would silently un-hide two stockists, which would
be a content decision rather than an engineering one.

It is not. **The live theme does not use this template.** Live's own `page.location.json` is
4,242 B, and the store finder renders from 301 `store_location` metaobjects. Checked against
the live site on 2026-09-23: `/pages/locations` already lists KIKU, Mountain Creek Bakery
and Ugly Coffee. They are visible today. The flags are dead state in a template nothing
reads, and deleting the theme changes nothing a customer sees. Fabric's 231 and Horizon's 70 uncovered files are a different
matter: those are stock files of a different theme family, and the case for deleting those
two rests on `themeStoreId` and re-downloadability, never on coverage.

### The evidence is checked in

The complete manifests are at `docs/theme-manifests-2026-09-23/` -- one TSV per theme,
`checksumMd5<TAB>filename`. Once a theme is deleted the Admin API can no longer answer the
question and the kept themes drift, so the numbers above would become unverifiable. They
are committed so the next person can audit the reasoning rather than re-run it.

**The lesson worth keeping:** every method here that sampled a subset of files gave a
confident wrong answer, and each wrong answer looked exactly as convincing as the right one.
For a decision that destroys data, compare everything, record the evidence, and state the
criterion precisely enough that its weaknesses can be checked.

## What would change the upgrade decision

- A security fix in a later Horizon release (4.2's notes contain none).
- ONA needing RTL locales.
- The `ona_theme2026` migration stalling long enough that live has to be maintained as a
  long-term product rather than a theme being migrated away from.

## Re-running this when a new Horizon lands

Extract the two revisions as above, re-run the md5 comparison, then apply both dependency
tests. The colour check is decisive:

```sh
grep -rho "color-custom-[a-z-]*" <theme>/snippets <theme>/sections <theme>/blocks <theme>/assets | sort -u
grep -c '"color_palette"' <theme>/config/settings_schema.json
```

If live still reports zero for both, the colour blocker still applies.
