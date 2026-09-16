# Home page sections — baseline, the 25-section ceiling, and how to roll back

Last verified against the live theme on **2026-09-16**.

## Why this file exists

`templates/index.json` in git had drifted badly from the live site: **10,926 bytes in git
vs 21,615 live**. Four completed section migrations existed *only* on the live theme and
were not in version control at all. Anyone deploying the home page from this repo would
have silently reverted them.

That gap is closed by the same commit that adds this file. Keep it closed: the home page
layout is edited in the Shopify theme editor, so **git goes stale every time someone
moves a section**. Re-sync before any deploy that touches `templates/index.json`.

## Shopify caps a JSON template at 25 sections

This is a hard platform limit, not a theme setting. The error surfaces as:

```
sections: must have a maximum of 25
order:    must have a maximum of 25
```

**The home page was sitting at exactly 25/25.** That is the single most important fact
for anyone planning home page work: *nothing can be added until something is removed.*

A trap worth knowing: `themeFilesUpsert` **swallows this validation error**. It returns
`upsertedThemeFiles: []` with an empty `userErrors` array and the file simply does not
change. `themeFilesCopy` reports the same failure properly. If a template write appears
to succeed but the checksum never changes, this is why — verify the checksum after every
template write rather than trusting the mutation response.

## Baseline: the 25 sections as they were live on 2026-09-16

Committed verbatim in `templates/index.json`, md5 `88734d13fea3f51027830cfb7483ad75`.

| # | Section key | Type | State |
|---|---|---|---|
| 1 | `1625134640d9c801e4` | ona-banner-slider | on (4 of 6 slides disabled) |
| 2 | `divider_gNYWcT` | ona-divider | on — blank spacer |
| 3 | `donation_counter_DVC8Fr` | ona-donation-counter | **off** — Water for Good |
| 4 | `logo_and_text_bjicP3` | ona-logo-and-text | **off** — Water for Good |
| 5 | `collection_8fCQfM` | ona-featured-collection | on — Milk Based |
| 6 | `divider_exKiyW` | ona-divider | **off** — see removals |
| 7 | `native_divider_test` | divider | on — *migrated* |
| 8 | `divider_37TUkT` | ona-divider | on — "Our bestseller" label |
| 9 | `featured_product_JdNP9G` | ona-featured-product | on — Raspberry Candy |
| 10 | `divider_RcKHRW` | ona-divider | on — blank spacer |
| 11 | `slideshow_jMtJtt` | ona-slideshow | on — single Filter image |
| 12 | `divider_Edm3tb` | ona-divider | on — blank spacer |
| 13 | `collection_z8ipDA` | ona-featured-collection | on — Filter |
| 14 | `divider_nQ4pGx` | ona-divider | on — blank spacer |
| 15 | `slideshow_tPXjmj` | ona-slideshow | **off** — replaced by #16 |
| 16 | `native_slideshow_test` | slideshow | on — *migrated* |
| 17 | `collection_E7w7cJ` | ona-featured-collection | on — Espresso |
| 18 | `divider_CyDYrj` | ona-divider | on — blank spacer |
| 19 | `divider_qMTmqi` | ona-divider | on — see removals |
| 20 | `image_and_text_hmdyWz` | ona-image-and-text | **off** — replaced by #21 |
| 21 | `native_media_content_test` | media-with-content | on — *migrated* |
| 22 | `16251350682ad0f3f9` | ona-two-images | on — Shop Merch / Shop Gear |
| 23 | `image_and_text_1625134802` | ona-image-and-text | on — Locations |
| 24 | `7044f586-0700-4d42-9edf-a2954f4dc2fe` | ona-newsletter | **off** — replaced by #25 |
| 25 | `native_newsletter_test` | section + email-signup | on — *migrated* |

### The four already-migrated sections

Sections 7, 16, 21 and 25 are native replacements for 6, 15, 20 and 24. The pattern used
was: disable the legacy section, place the native one beside it, keep the legacy copy as
an in-template rollback. **They are still named `*_test` but they are live, not tests.**
Renaming them is safe and overdue.

Note the cost of that pattern: each rollback copy consumes one of the 25 slots. Four
migrations means four slots spent on sections nobody sees.

## Removals made on 2026-09-16

Four blank spacer dividers, removed to free capacity for the section port. **None carried
a label, a line, or any content** — they were pure vertical space, and the sections that
replaced them bring their own padding. Removed on the **draft theme only** at time of
writing; the live theme still has all 25.

Two were approved first (`divider_qMTmqi`, `divider_exKiyW`), then two more
(`divider_nQ4pGx`, `divider_CyDYrj`) once it was clear the port needed four slots, not two.

### `divider_qMTmqi` — was position 19, enabled

Removed because it was the second of **two identical blank spacers back to back**
(`divider_CyDYrj` at 18, `divider_qMTmqi` at 19), i.e. 120px of empty space in a row.
`divider_CyDYrj` was later removed too, in the second pass below.

```json
"divider_qMTmqi": {
  "type": "ona-divider",
  "settings": {
    "label": "", "label_size": 1.5, "label_color": "#000000",
    "show_line": false, "line_color": "#000000",
    "line_thickness": 2, "line_width": 100,
    "padding_top": 30, "padding_bottom": 30
  }
}
```

### `divider_exKiyW` — was position 6, already disabled

Removed because it was already switched off and `native_divider_test` had replaced it.

```json
"divider_exKiyW": {
  "type": "ona-divider",
  "settings": {
    "label": "", "label_size": 1.5, "label_color": "#000000",
    "show_line": true, "line_color": "#000000",
    "line_thickness": 2, "line_width": 90,
    "padding_top": 30, "padding_bottom": 40
  },
  "disabled": true
}
```

### `divider_nQ4pGx` — was position 14, enabled

Sat between the Filter product grid and the slideshow. The slideshow is full-bleed, so it
now meets the grid's own bottom padding directly.

```json
"divider_nQ4pGx": {
  "type": "ona-divider",
  "settings": {
    "label": "", "label_size": 1.5, "label_color": "#000000",
    "show_line": false, "line_color": "#000000",
    "line_thickness": 2, "line_width": 100,
    "padding_top": 30, "padding_bottom": 30
  }
}
```

### `divider_CyDYrj` — was position 18, enabled

Sat between the Espresso grid and the wholesale media block. Identical settings to
`divider_nQ4pGx` above.

```json
"divider_CyDYrj": {
  "type": "ona-divider",
  "settings": {
    "label": "", "label_size": 1.5, "label_color": "#000000",
    "show_line": false, "line_color": "#000000",
    "line_thickness": 2, "line_width": 100,
    "padding_top": 30, "padding_bottom": 30
  }
}
```

## What went onto the home page in exchange

**Learn with ONA** and **Press quotes**, ported from `ona_theme2026`. Net result: 25 → 23
sections, so there are now **two spare slots** against the ceiling.

Two links in the Learn tiles were broken in the source and were fixed during the port:

| Tile | Was | Now |
|---|---|---|
| Barista Courses | `shopify://blogs/news-1` — the empty News blog, 0 articles | `shopify://pages/barista-courses` |
| Brewing Guides | `/pages/brewing-guides` — **404** | `shopify://blogs/brewguides` |

### Club invite / Club benefits were deliberately NOT placed

Both sections are ported and present in the theme (`sections/club-invite.liquid`,
`sections/club-benefits.liquid`, plus `snippets/club-invite-typography-style.liquid` and
19 editor labels), but they are not on the home page. Three reasons:

1. The copy says **"ONA Coffee Club"** in three places — body, button label, and a
   testimonial byline. The club has since been rebranded **ONA Brew Club**.
2. `club-invite`'s three feature bullets are all the same placeholder string,
   "Freshly roasted" — unfinished content carried over from the 2026 draft.
3. The `brew-club-single-origin-subscription` collection currently has **0 products**, so
   there is nothing to link to under the new brand.

When the Brew Club copy and products are ready this is a theme-editor job — add the two
sections and fill in the settings. No re-porting needed.

## Other fixes made in the same draft theme

- **`snippets/media.liquid`** — guarded the aspect-ratio divide. The live home page renders
  `padding-top: Liquid error (snippets/media line 74): divided by 0%;` into the HTML today.
  Four divide sites were vulnerable, not just the one named in the error. Note the trap:
  defaulting the ratio to `1` *looks* correct but turns the empty media box into a
  full-width square — roughly 1,400px of blank page. The fix emits **no** `padding-top`
  when the ratio is unusable, so the box collapses.
- **`layout/theme.liquid`** — the YouTube iframe API was loading on every page even though
  the home page contains no video. Now injected only when a player is present.
- **Locations copy** — "With 4 ONA flagship cafés" corrected to **5**. There are six
  flagships including ONA Dubai, but the sentence is scoped "all across Australia" and
  Dubai is not; five is the accurate figure for that sentence. If the copy should mention
  Dubai, the sentence needs rewriting rather than just renumbering.

## How to roll back

**Easiest — theme editor.** Add a Divider section at the position in the table above and
copy the settings from the JSON blocks. Nothing else is needed; these sections hold no
content, only spacing.

**Exact — git.** `templates/index.json` on `main` is the byte-exact 25-section baseline.
Restore the whole home page with:

```bash
git show <commit-that-added-this-file>:templates/index.json > templates/index.json
```

then push that file to the target theme and **verify the checksum came back as
`88734d13fea3f51027830cfb7483ad75`** — do not trust the mutation's response alone.

**Careful:** restoring the full baseline also restores all 25 sections, which puts the
template back at the ceiling. If new sections have been added since, the write will fail
with the `maximum of 25` error above.

## Freeing more capacity

The home page has **eight divider sections, and only one carries a label** ("Our
bestseller"). The other seven are pure spacing. Native sections control their own spacing
through `padding-block-start` / `padding-block-end`, so converting those seven to section
padding would release up to **seven slots** without deleting any content — enough for the
collection carousel, story video and coffee quiz.

That is the cheapest capacity available and it should happen before any further section
ports.
