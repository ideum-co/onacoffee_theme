# Theme manifests, 2026-09-23

The evidence behind the deletion decisions in
`../horizon-upgrade-assessment-2026-09-21.md`. Checked in so the reasoning can be
audited rather than re-run: once a theme is deleted, the Admin API can no longer
answer the question, and the kept themes drift.

One file per theme, `manifest-<themeId>.tsv`, `<checksumMd5>\t<filename>`, complete
(every file, not a sample). 6,016 files across 10 themes.

## Candidates

| id | name | files |
|---|---|---|
| `148713013439` | Fabric | 411 |
| `151371677887` | Horizon | 418 |
| `152420909247` | ona_theme/main (stale) | 683 |
| `154587398335` | ONA Redesign - Horizon base | — |

## Kept (reference set)

| id | name |
|---|---|
| `155646558399` | live (MAIN) |
| `155642298559` | ONA - PDP promo tags 2026-09-19 (UNPUBLISHED) |
| `153095602367` | ona_theme/main |
| `153055035583` | ona_theme/staging |
| `154445316287` | onacoffee_theme/staging |
| `154676789439` | ona_theme2026/main |

## Reproducing the coverage numbers

A candidate file is *covered* when a file with the same path AND the same
`checksumMd5` exists in a kept theme. Both the union figure and the best-single-theme
figure are worth computing — see the assessment for why they can differ in principle,
and why they do not differ here.

```python
def load(p):
    d = {}
    for line in open(p, encoding='utf-8'):
        ck, _, fn = line.rstrip('\n').partition('\t')
        if fn: d[fn] = ck
    return d
```
