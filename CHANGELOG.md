# Changelog

## 0.1.11 — 2026-06-13

- Fixed signature help parameter indexing for calls containing commas inside string literals
- Fixed array-member hover parameter indexing for calls containing commas inside string literals

## 0.1.10 — 2026-06-13

- Updated `OKS_fnc_Chat` IntelliSense metadata to include `_RadioRange`, `_LocalRange`, and `_TargetSide`
- Updated `OKS_fnc_ChatGlobal` IntelliSense metadata to match runtime signature
- Corrected chat usage examples for side-targeted global calls

## 0.1.0 — 2026-03-13

- Initial release
- Hover tooltips for OKS/GOL/GW framework function names
- Array-member hover showing parameter docs by position
- Signature help (parameter hints) on `[` and `,`
- Autocomplete for `OKS_fnc_*` and `GW_*_fnc_*` functions
- Statement-boundary aware bracket scanning (`;` stops cross-statement matching)
