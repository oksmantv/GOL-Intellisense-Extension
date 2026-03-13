import * as vscode from 'vscode';
import { FunctionCatalog } from './catalog';

/**
 * Provides autocomplete suggestions for OKS/GOL SQF framework functions.
 * Triggers when the user types "OKS_fnc_" or any function name prefix.
 */
export class OksSqfCompletionProvider implements vscode.CompletionItemProvider {
    private items: vscode.CompletionItem[] = [];

    constructor(private catalog: FunctionCatalog) {
        this.buildCompletionItems();
    }

    private buildCompletionItems(): void {
        for (const [name, entry] of Object.entries(this.catalog)) {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);

            // Short detail shown inline
            item.detail = `[${entry.category}]`;

            // Full documentation in the side panel
            const docLines: string[] = [];
            if (entry.description) {
                docLines.push(entry.description);
                docLines.push('');
            }
            if (entry.params.length > 0) {
                docLines.push('**Parameters:**');
                entry.params.forEach((p, i) => {
                    const desc = p.description ? ` — ${p.description}` : '';
                    docLines.push(`${i}: \`${p.name}\` (${p.type})${desc}`);
                });
                docLines.push('');
            }
            if (entry.usage) {
                docLines.push('```sqf');
                docLines.push(entry.usage);
                docLines.push('```');
            }

            const md = new vscode.MarkdownString(docLines.join('\n'));
            md.isTrusted = true;
            item.documentation = md;

            // Insert the full function name
            item.insertText = name;

            // Sort by category then name for logical grouping
            item.sortText = `${entry.category}_${name}`;

            // Make it filterable by prefix and bare name
            const bareName = name.replace(/^(?:OKS|GW_\w+)_fnc_/, '');
            item.filterText = `${name} ${bareName} ${entry.category}`;

            this.items.push(item);
        }
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        // Return all items — VS Code's built-in fuzzy matcher handles filtering
        return this.items;
    }
}
