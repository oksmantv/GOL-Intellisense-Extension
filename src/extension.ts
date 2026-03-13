import * as vscode from 'vscode';
import { loadCatalog } from './catalog';
import { OksSqfHoverProvider } from './hoverProvider';
import { OksSqfCompletionProvider } from './completionProvider';
import { OksSqfSignatureHelpProvider } from './signatureProvider';

/** Document selector for SQF and related Arma config files */
const SQF_SELECTOR: vscode.DocumentSelector = [
    { language: 'sqf' },
    { pattern: '**/*.sqf' },
    { pattern: '**/*.ext' },
    { pattern: '**/*.hpp' }
];

export function activate(context: vscode.ExtensionContext): void {
    const catalog = loadCatalog(context.extensionPath);
    const functionCount = Object.keys(catalog).length;

    // Register Hover Provider
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(SQF_SELECTOR, new OksSqfHoverProvider(catalog))
    );

    // Register Completion Provider
    // Trigger on underscore (for OKS_fnc_ prefix typing) and letters
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            SQF_SELECTOR,
            new OksSqfCompletionProvider(catalog),
            '_'  // trigger character
        )
    );

    // Register Signature Help Provider
    // Trigger on [ (start of params) and , (next param)
    context.subscriptions.push(
        vscode.languages.registerSignatureHelpProvider(
            SQF_SELECTOR,
            new OksSqfSignatureHelpProvider(catalog),
            {
                triggerCharacters: ['[', ','],
                retriggerCharacters: [',']
            }
        )
    );

    console.log(`OKS SQF extension activated — ${functionCount} functions loaded.`);
}

export function deactivate(): void {
    // Nothing to clean up
}
