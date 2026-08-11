# Shopify Theme Check Baseline — 2026-08-11

This report records pre-existing findings on commit `4479eaac09cd9ca22a0a0584346705c3bbe823aa`, before the cart and UI/UX implementation work. These findings are outside the current implementation scope, but must be addressed in a separate technical-debt cycle.

## Baseline totals

- Files reported: 135
- Errors: 5,324
- Warnings: 442
- Informational findings: 0

## Findings by check

| Check | Errors | Warnings |
|---|---:|---:|
| MatchingTranslations | 4,620 | 0 |
| ValidSchema | 567 | 0 |
| ImgWidthAndHeight | 127 | 0 |
| MissingTemplate | 3 | 0 |
| LiquidHTMLSyntaxError | 2 | 0 |
| ParserBlockingScript | 2 | 0 |
| StaticStylesheetAndJavascriptTags | 1 | 0 |
| TranslationKeyExists | 1 | 0 |
| MissingAsset | 1 | 0 |
| DeprecatedFilter | 0 | 137 |
| UnusedAssign | 0 | 85 |
| RemoteAsset | 0 | 69 |
| VariableName | 0 | 56 |
| DeprecatedTag | 0 | 52 |
| UndefinedObject | 0 | 24 |
| PaginationSize | 0 | 7 |
| AssetPreload | 0 | 5 |
| HardcodedRoutes | 0 | 5 |
| DeprecateLazysizes | 0 | 2 |

## Priority order for remediation

1. Fix the two Liquid syntax errors, missing asset, missing templates, and parser-blocking scripts because these may affect runtime behavior.
2. Repair invalid section schemas because they can prevent Theme Editor configuration from loading or saving correctly.
3. Add explicit image dimensions to reduce layout shift.
4. Synchronize locale keys from the authoritative default locale into translated locale files without overwriting existing translations.
5. Replace deprecated Liquid filters/tags and remove undefined or unused variables.
6. Review remote assets and preload findings as a performance phase.

## Reproduction

```bash
shopify theme check --path . --output json --no-color
```

Current UI/UX work is accepted only if it introduces no new finding in a modified or newly created file. The totals may remain non-zero until this debt is addressed separately.
