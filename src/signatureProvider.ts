import * as vscode from 'vscode';
import { FunctionCatalog, FunctionEntry } from './catalog';
import { findLastUnmatchedBracket, countCommasAtDepthZero, textFromCurrentStatement, textUntilStatementEnd } from './hoverProvider';

/**
 * Provides signature help (parameter hints) for OKS/GOL SQF framework functions.
 *
 * In SQF, function calls look like:
 *   [param1, param2, param3] call OKS_fnc_FunctionName
 *   [param1, param2, param3] spawn OKS_fnc_FunctionName
 *
 * This provider detects when the cursor is inside the [...] bracket block
 * preceding a `call/spawn OKS_fnc_*` and shows parameter hints for the
 * current argument position (based on comma count).
 */
export class OksSqfSignatureHelpProvider implements vscode.SignatureHelpProvider {
    constructor(private catalog: FunctionCatalog) {}

    provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.SignatureHelpContext
    ): vscode.ProviderResult<vscode.SignatureHelp> {
        // Collect text from current line and a few lines ahead to find the call/spawn
        const maxLookAhead = 5;
        const lineNum = position.line;
        const endLine = Math.min(lineNum + maxLookAhead, document.lineCount - 1);

        let fullText = '';
        for (let i = lineNum; i <= endLine; i++) {
            fullText += document.lineAt(i).text + '\n';
        }

        // Also look at text from the current line up to cursor
        const textUpToCursor = document.lineAt(lineNum).text.substring(0, position.character);

        // Also scan backwards to find the opening bracket
        let textBeforeCursor = '';
        const lookBack = Math.max(0, lineNum - 15);
        for (let i = lookBack; i <= lineNum; i++) {
            if (i === lineNum) {
                textBeforeCursor += document.lineAt(i).text.substring(0, position.character);
            } else {
                textBeforeCursor += document.lineAt(i).text + '\n';
            }
        }

        // Find the function name from the surrounding context
        // Truncate at the current statement's end so we don't cross `;`
        const afterCursor = textUntilStatementEnd(fullText.substring(textUpToCursor.length));
        // Matches OKS_fnc_* and GW_*_fnc_* patterns.
        const fnMatch = afterCursor.match(
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

        // Find the outer‐most unmatched '[' — the call/spawn argument list
        // Strip prior statements so bracket search stays in the current one
        const stmtBefore = textFromCurrentStatement(textBeforeCursor);
        const outerBracketPos = findLastUnmatchedBracket(stmtBefore);
        if (outerBracketPos < 0) {
            return undefined;
        }

        // Count commas from the outer bracket to cursor, skipping nested brackets
        const activeParam = countCommasAtDepthZero(
            stmtBefore.substring(outerBracketPos + 1)
        );

        // Build signature
        const sig = this.buildSignature(fnName, entry);
        const help = new vscode.SignatureHelp();
        help.signatures = [sig];
        help.activeSignature = 0;
        help.activeParameter = Math.min(activeParam, entry.params.length - 1);

        return help;
    }

    private findEntry(fnName: string): FunctionEntry | undefined {
        for (const [name, entry] of Object.entries(this.catalog)) {
            if (name.toLowerCase() === fnName.toLowerCase()) {
                return entry;
            }
        }
        return undefined;
    }

    private buildSignature(fnName: string, entry: FunctionEntry): vscode.SignatureInformation {
        // Build the signature label: [_param1, _param2, ...] call OKS_fnc_Name
        const paramLabels = entry.params.map(p => p.name);
        const label = `[${paramLabels.join(', ')}] call ${fnName}`;

        const sig = new vscode.SignatureInformation(label);

        // Description
        const descMd = new vscode.MarkdownString();
        if (entry.description) {
            descMd.appendText(entry.description);
        }
        sig.documentation = descMd;

        // Parameter information
        sig.parameters = entry.params.map(p => {
            const paramInfo = new vscode.ParameterInformation(p.name);
            const parts: string[] = [];
            parts.push(`**\`${p.name}\`** (${p.type})`);
            if (p.default) {
                parts.push(`Default: \`${p.default}\``);
            }
            if (p.description) {
                parts.push(p.description);
            }
            const md = new vscode.MarkdownString(parts.join('  \n'));
            md.isTrusted = true;
            paramInfo.documentation = md;
            return paramInfo;
        });

        return sig;
    }
}
