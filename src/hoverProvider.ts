import * as vscode from 'vscode';
import { FunctionCatalog, FunctionEntry, findFunction, getWordAt, buildHoverMarkdown } from './catalog';

/**
 * Provides hover tooltips for OKS/GOL SQF framework functions.
 *
 * Two modes:
 * 1. **Function‐name hover** — hover over `OKS_fnc_Name` to see full docs.
 * 2. **Array‐member hover** — hover over any element inside
 *    `[..., HERE, ...] call/spawn OKS_fnc_Name` to see the matching
 *    parameter description for that position.
 */
export class OksSqfHoverProvider implements vscode.HoverProvider {
    constructor(private catalog: FunctionCatalog) {}

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        // --- 1. Try array member hover first (more specific) ------------------
        const arrayHover = this.provideArrayMemberHover(document, position);
        if (arrayHover) {
            return arrayHover;
        }

        // --- 2. Function name hover -------------------------------------------
        const line = document.lineAt(position.line).text;
        const word = getWordAt(line, position.character);

        if (word) {
            const result = findFunction(this.catalog, word);
            if (result) {
                const md = new vscode.MarkdownString(buildHoverMarkdown(result.name, result.entry));
                md.isTrusted = true;
                md.supportHtml = true;
                return new vscode.Hover(md);
            }
        }

        return undefined;
    }

    /* ------------------------------------------------------------------ */
    /*  Array‐member hover: detect cursor inside [...] call/spawn block   */
    /* ------------------------------------------------------------------ */
    private provideArrayMemberHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.Hover | undefined {
        // Gather text before cursor (scan up to 50 lines back)
        const lookBack = Math.max(0, position.line - 50);
        let textBeforeCursor = '';
        for (let i = lookBack; i <= position.line; i++) {
            if (i === position.line) {
                textBeforeCursor += document.lineAt(i).text.substring(0, position.character);
            } else {
                textBeforeCursor += document.lineAt(i).text + '\n';
            }
        }

        // Strip prior statements so bracket search stays in the current one
        const stmtBefore = textFromCurrentStatement(textBeforeCursor);

        // Find the position of the LAST unmatched '[' — that's the opening
        // bracket of the call/spawn argument list we care about.
        const outerBracketPos = findLastUnmatchedBracket(stmtBefore);
        if (outerBracketPos < 0) {
            return undefined;
        }

        // Gather text after cursor (scan up to 50 lines forward)
        const lookAhead = Math.min(position.line + 50, document.lineCount - 1);
        let textAfterCursor = document.lineAt(position.line).text.substring(position.character);
        for (let i = position.line + 1; i <= lookAhead; i++) {
            textAfterCursor += '\n' + document.lineAt(i).text;
        }

        // Truncate at the current statement's end so we don't cross `;`
        const stmtAfter = textUntilStatementEnd(textAfterCursor);

        // Find `] call/spawn FnName` or `] remoteExec["FnName"]` in current statement
        // Matches OKS_fnc_* and GW_*_fnc_* patterns.
        const fnMatch = stmtAfter.match(
            /\]\s*(?:(?:call|spawn)\s+((?:OKS|GW_\w+)_fnc_\w+)|remoteExec(?:Call)?\s*\[\s*"((?:OKS|GW_\w+)_fnc_\w+)")/i
        );
        if (!fnMatch) {
            return undefined;
        }

        const fnName = fnMatch[1] || fnMatch[2];
        const entry = this.findEntry(fnName);
        if (!entry || entry.params.length === 0) {
            return undefined;
        }

        // Count commas from the outer bracket to cursor, skipping nested brackets
        const paramIndex = countCommasAtDepthZero(
            stmtBefore.substring(outerBracketPos + 1)
        );

        if (paramIndex >= entry.params.length) {
            // Beyond declared params — no hover
            return undefined;
        }

        const p = entry.params[paramIndex];
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        // Short, focused output: param position, name, type, and description
        md.appendMarkdown(
            `**${fnName}** — param **${paramIndex}** / \`${p.name}\` *(${p.type})*`
        );
        if (p.default) {
            md.appendMarkdown(` — default: \`${p.default}\``);
        }
        md.appendMarkdown('\n\n');
        if (p.description) {
            md.appendMarkdown(p.description);
        }

        // Append function-level docs (notes) if present
        if (entry.docs) {
            const docs = entry.docs.trim();
            md.appendMarkdown(`\n\n---\n\n**Notes:**\n\`\`\`text\n${docs}\n\`\`\``);
        }

        return new vscode.Hover(md);
    }

    private findEntry(fnName: string): FunctionEntry | undefined {
        for (const [name, entry] of Object.entries(this.catalog)) {
            if (name.toLowerCase() === fnName.toLowerCase()) {
                return entry;
            }
        }
        return undefined;
    }
}

/* ====================================================================== */
/*  Shared bracket‐parsing helpers                                        */
/* ====================================================================== */

/**
 * Walk `text` and return the character index of the last `[` that has
 * NOT been closed by a matching `]`.  Returns -1 if none found.
 *
 * A `;` at bracket depth 0 is treated as a statement boundary — any
 * unmatched brackets from before that point are discarded so the search
 * stays inside the current statement.
 *
 * Example: `someCode(); [a, [b]` → returns index of the second `[`
 * (first statement is ignored because of the `;` boundary).
 */
export function findLastUnmatchedBracket(text: string): number {
    // Stack of positions of unmatched '['
    const stack: number[] = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '[') {
            stack.push(i);
        } else if (text[i] === ']') {
            if (stack.length > 0) {
                stack.pop();
            }
        } else if (text[i] === ';' && stack.length === 0) {
            // Statement boundary at bracket depth 0 — brackets before
            // this point belong to a prior statement and are irrelevant.
            // (Stack is already empty for well-formed code, but clear
            // defensively in case of malformed input.)
            stack.length = 0;
        }
    }
    // The LAST entry in the stack is the inner‐most unmatched '[',
    // but we want the OUTER‐most one (first entry) — that's the one
    // that will be closed by the `]` before `call/spawn`.
    return stack.length > 0 ? stack[0] : -1;
}

/**
 * Return the portion of `text` after the last `;` that sits at
 * bracket-depth 0.  This strips prior statements so that bracket /
 * comma scanning stays inside the current statement.
 */
export function textFromCurrentStatement(text: string): string {
    let depth = 0;
    let lastBoundary = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '[') { depth++; }
        else if (text[i] === ']') { if (depth > 0) { depth--; } }
        else if (text[i] === ';' && depth === 0) {
            lastBoundary = i + 1;
        }
    }
    return text.substring(lastBoundary);
}

/**
 * Return the portion of `text` before the first `;` that sits at
 * bracket-depth 0.  If no such `;` exists the full text is returned.
 * This prevents the forward scan from crossing into the next statement.
 */
export function textUntilStatementEnd(text: string): string {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '[') { depth++; }
        else if (text[i] === ']') { if (depth > 0) { depth--; } }
        else if (text[i] === ';' && depth === 0) {
            return text.substring(0, i);
        }
    }
    return text;
}

/**
 * Count commas in `text` that appear at bracket‐depth 0 (i.e. not inside
 * any nested `[...]`).  This gives the 0‐based param index.
 */
export function countCommasAtDepthZero(text: string): number {
    let count = 0;
    let depth = 0;
    for (const ch of text) {
        if (ch === '[') { depth++; }
        else if (ch === ']') { depth--; }
        else if (ch === ',' && depth === 0) { count++; }
    }
    return count;
}
