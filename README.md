# OKS SQF — GOL Framework IntelliSense

VS Code extension providing hover tooltips, parameter hints, and autocomplete for **OKS/GOL SQF framework** functions used in Arma 3 mission development.

## Features

- **Hover Tooltips** — hover over any `OKS_fnc_*` or `GW_*_fnc_*` function name to see full documentation (description, parameters, return value, usage example).
- **Parameter Hints (Array-member hover)** — hover over any element inside `[..., HERE, ...] call/spawn OKS_fnc_Name` to see which parameter you're editing, its type, default value, and description.
- **Signature Help** — type `[` or `,` inside function arguments to get a parameter-hint popup showing all parameters with the active one highlighted.
- **Autocomplete** — start typing `OKS_fnc_` to get completion suggestions for all catalogued functions.

## Supported File Types

`.sqf`, `.ext`, `.hpp`

## Usage

1. Install the extension from the VS Code Marketplace (or from a `.vsix` file).
2. Open any Arma 3 mission or addon workspace containing `.sqf` files.
3. Hover over function names or type inside `[...]` argument arrays to see IntelliSense.

## Requirements

No additional dependencies required. The extension bundles its own function catalog.
