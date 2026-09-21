# Can the live theme be upgraded to Horizon 4.2?

**Date:** 2026-09-21
**Answer:** No, not as an incremental upgrade. The blocker is Horizon 4.0's colour-palette
rewrite, not the volume of ONA customisation.

## Why this came up

Shopify auto-created two themes on 2026-09-21 named `Updated copy of ...`, both on
Horizon 4.2.0. Shopify only auto-updates *unmodified* theme-store themes; when a theme has
been edited it cannot update in place, so it clones instead. It updated two old, untouched
themes and left the live theme alone. That behaviour is itself the first answer: the live
theme is too modified for Shopify to update it.

## Versions

| theme | Horizon |
|---|---|
| live (`155646558399`) | **3.5.1** |
| `ona_theme2026/main` (`154676789439`) | **4.1.4** |
| the two auto-created copies | **4.2.0** |

Upstream is open source: https://github.com/Shopify/horizon
Relevant commits: `45c7db5` = v3.5.1 (2026-05-22), `f9aef27` = v4.2.0 (2026-09-18).

## Method

Extracted both upstream revisions and compared them to the live theme file by file:

```
git clone --filter=blob:none https://github.com/Shopify/horizon.git
git archive 45c7db5 | tar -x -C /tmp/h351     # 3.5.1
git archive f9aef27 | tar -x -C /tmp/h420     # 4.2.0
```

For each file Shopify changed, the test was: does ONA's copy still md5-match pristine
3.5.1? If yes, upstream's 4.2 version is a drop-in. If no, ONA modified it and it needs a
real merge.

## What the diff shows

Upstream 3.5.1 -> 4.2.0: **321 files modified, 65 added, 2 removed.**

Of the 321 modified:

| | count |
|---|---|
| ONA's copy still pristine 3.5.1 ("safe") | **124** |
| ONA has modified | **197** |

The 197 break down as 83 blocks, 40 sections, 51 locales, 12 JSON templates, 5 snippets,
3 assets, 2 config, 1 layout. Note the 12 JSON templates are *store configuration*, not
code -- copying upstream's would wipe the homepage, PDP and cart layouts. They must never
be taken from upstream regardless of version.

Separately, the live theme is only nominally a Horizon theme: **98 of 145 sections** are
ONA-prefixed or legacy (`product-template-2` / `-3`), i.e. 68%.

## The actual blocker: Horizon 4.0 replaced the colour system

This is the finding that matters, and it is not visible from the release notes.

| | `settings.*color_scheme` | `color-custom-*` | `color_palette` in settings_schema |
|---|---|---|---|
| 3.5.1 | 11 variants | 0 | no |
| **ONA live** | 11 variants | 0 | **no** |
| 4.2.0 | **0** | 5 classes | yes |

Every 4.2 file resolves colours through `color-custom-*` classes and a `color_palette`
setting that does not exist in the live theme. Example, from `snippets/price-filter.liquid`:

```diff
- class="... {% if filter_style == 'horizontal' %} color-{{ settings.popover_color_scheme }}{% endif %}"
+ class="... {% if filter_style == 'horizontal' %} color-custom-popover{% endif %}"
```

`color-custom-popover` is referenced by 8 files in 4.2.0 and by **zero** files in either
3.5.1 or the live theme. Dropping in a 4.2 snippet yields colour classes that resolve to
nothing -- unstyled popovers, filters and swatches.

So "byte-identical to 3.5.1, therefore safe to replace" is the wrong test. It establishes
that *we* did not modify the file. It says nothing about whether the file's dependencies
still exist. The 124 "safe" files are not independently upgradable; they are 124 files that
assume a colour system this theme does not have.

## What 4.2 would actually buy us

Mostly right-to-left language support, which is irrelevant for an AU-only storefront. The
functional fixes, and where each one lives:

| fix | reachable from safe files? |
|---|---|
| Quick Add JS loads only when enabled | **yes** -- all 5 files are pristine |
| price filter values wiped mid-edit | no -- lives in `blocks/filters.liquid` (modified, 223 lines changed) |
| cart drawer/page stale after browser Back | no -- needs the modified cart blocks |
| smaller product-card images, 2-col mobile | no -- needs modified `_product-card-gallery` etc. |
| swatch rows widening rounded cards | no -- lives in `blocks/swatches.liquid` (modified) |
| popup video not playing in Safari | no -- lives in `blocks/popup-link.liquid` (modified) |

Checked directly: the 21 changed lines in the "safe" `price-filter.liquid` are `<bdi>`
wrappers and logical CSS (`text-align: end`, `inset-inline-start`) -- RTL, not the filter
bug fix.

Exactly one fix is free, and it is a JS-loading optimisation.

## Decision

1. **Live stays on 3.5.1.** The upgrade is gated on a colour-system migration touching 197
   files, to buy RTL support we do not need. One free fix does not justify a theme PR on
   the storefront.
2. **Bump `ona_theme2026` 4.1.4 -> 4.2.0 instead.** It is already past the 4.0 colour
   migration, so for that theme this genuinely is a small version bump, and it is where
   4.2's fixes land for free. Victor's call.
3. **Delete the two `Updated copy of ...` themes.** They are unmodified stock updates of
   themes already slated for deletion and contain no ONA work. Shopify will regenerate them
   if it ever matters.

The stale-cart-after-Back fix is the one with real customer impact. It arrives with the
2026 theme rather than as a patch to live.

## What would change this decision

- A security fix in a later Horizon release (4.2's notes contain none).
- ONA needing RTL locales.
- The `ona_theme2026` migration stalling long enough that live has to be maintained as a
  long-term product rather than a theme being migrated away from.

## Reproducing this

The comparison is cheap to re-run when a new Horizon version lands -- extract the two
revisions as above and re-run the md5 comparison against the live theme. The colour-system
check is the decisive one:

```
grep -rho "color-custom-[a-z-]*" <theme>/snippets <theme>/sections <theme>/blocks <theme>/assets | sort -u
grep -c '"color_palette"' <theme>/config/settings_schema.json
```

If the live theme still reports zero for both, the same blocker applies.
