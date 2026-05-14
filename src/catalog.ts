import * as fs from 'fs';
import * as path from 'path';

/** Shape of a single parameter in the catalog */
export interface FunctionParam {
    name: string;
    type: string;
    default: string;
    description: string;
}

/** Shape of a single function entry in the catalog */
export interface FunctionEntry {
    category: string;
    description: string;
    params: FunctionParam[];
    returns: string;
    usage: string;
    docs: string;
}

/** The full catalog: function name → entry */
export type FunctionCatalog = Record<string, FunctionEntry>;

let catalog: FunctionCatalog | null = null;

/**
 * Load (or return cached) function catalog from the bundled JSON file.
 * @param extensionPath  The absolute path to the extension's install directory.
 */
export function loadCatalog(extensionPath: string): FunctionCatalog {
    if (catalog) {
        return catalog;
    }

    const jsonPath = path.join(extensionPath, 'data', 'functions.json');
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    catalog = JSON.parse(raw) as FunctionCatalog;
    return catalog;
}

/**
 * Look up a function by name (case-insensitive).
 * Supports both "OKS_fnc_Name" and bare "Name" forms.
 */
export function findFunction(
    cat: FunctionCatalog,
    token: string
): { name: string; entry: FunctionEntry } | undefined {
    // Direct match (case-insensitive)
    for (const [name, entry] of Object.entries(cat)) {
        if (name.toLowerCase() === token.toLowerCase()) {
            return { name, entry };
        }
    }

    // Try prefixing with OKS_fnc_
    const prefixed = `OKS_fnc_${token}`;
    for (const [name, entry] of Object.entries(cat)) {
        if (name.toLowerCase() === prefixed.toLowerCase()) {
            return { name, entry };
        }
    }

    return undefined;
}

/**
 * Get the word (function name) under the cursor position in a line of text.
 * SQF function names contain letters, digits, and underscores.
 */
export function getWordAt(line: string, character: number): string {
    const wordPattern = /[A-Za-z0-9_]+/g;
    let match: RegExpExecArray | null;
    while ((match = wordPattern.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (character >= start && character <= end) {
            return match[0];
        }
    }
    return '';
}

/**
 * Build a Markdown hover string for a function entry.
 */
export function buildHoverMarkdown(name: string, entry: FunctionEntry): string {
    const lines: string[] = [];

    // Header
    lines.push(`### ${name}`);
    lines.push(`**Category:** \`${entry.category}\``);
    lines.push('');

    // Description
    if (entry.description) {
        lines.push(entry.description);
        lines.push('');
    }

    // Parameters table
    if (entry.params.length > 0) {
        lines.push('**Parameters:**');
        lines.push('');
        lines.push('| # | Name | Type | Default | Description |');
        lines.push('|---|------|------|---------|-------------|');
        entry.params.forEach((p, i) => {
            const def = p.default ? `\`${p.default}\`` : '—';
            const desc = p.description || '—';
            lines.push(`| ${i} | \`${p.name}\` | ${p.type} | ${def} | ${desc} |`);
        });
        lines.push('');
    }

    // Returns
    if (entry.returns) {
        lines.push(`**Returns:** ${entry.returns}`);
        lines.push('');
    }

    // Usage example
    if (entry.usage) {
        lines.push('**Example:**');
        lines.push('```sqf');
        lines.push(entry.usage);
        lines.push('```');
        lines.push('');
    }

    // Docs (support both URL links and inline notes)
    if (entry.docs) {
        lines.push('');
        const docs = entry.docs.trim();
        if (/^https?:\/\//i.test(docs)) {
            lines.push(`[View Documentation](${docs})`);
        } else {
            lines.push('**Notes:**');
            lines.push('```text');
            lines.push(docs);
            lines.push('```');
        }
    }

    return lines.join('\n');
}
