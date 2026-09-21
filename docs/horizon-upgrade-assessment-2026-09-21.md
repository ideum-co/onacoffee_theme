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
mkdir -p /tmp/h351 /tmp/h420
git -C horizon archive 45c7db5 | tar -x -C /tmp/h351   # 3.5.1
git -C horizon archive f9aef27 | tar -x -C /tmp/h420   # 4.2.0
```

`git -C horizon` matters: without it the `archive` calls run against whatever repo you are
standing in, where those commits do not exist. The `mkdir` matters because `tar -C` will
not create the target directories.

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

**2. New snippets.** 4.2 adds 65 files. A 4.2 file that renders one of them cannot run on
3.5.1. Of the 59 palette-free *liquid* files among the 124, **21 render a snippet that does
not exist in 3.5.1** (`price-styles`, `text-block-styles`, `variant-picker-styles`,
`checkbox-styles`, `dialog-styles`, and others).

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
   migration, so for that theme this is a genuine version bump, and it is where 4.2's fixes
   land at no cost. Victor's call.
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

## Note on method: a 3-file fingerprint is not a content check

The theme-cleanup work alongside this assessment initially classified themes as
safe-to-delete by comparing `layout/theme.liquid`, `config/settings_data.json` and
`templates/index.json`. Those three files do not contain ONA's own code, so the test
produced both false positives and false negatives -- themes called "byte-identical
duplicates" that held unique `ona-product-card` / `ona-collection-template` builds, and one
theme flagged as risky that was in fact a clean duplicate.

What worked: probe ~15 ONA-authored files per theme
(`assets/ona-*`, `sections/ona-*`, `snippets/ona-product-*`, `sections/product-template-2`)
and compare every checksum against *all* themes being kept at once. An incomplete reference
set is as misleading as too few files -- two of the corrections in this work were caused by
comparing against a partial set of kept themes rather than by sampling too few files.

Of 18 candidates checked that way, **4** had no ONA content of their own.

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
