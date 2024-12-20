import { PrismTheme } from 'prism-react-renderer';

export const minimalTheme: PrismTheme = {
    plain: {
        color: 'var(--vscode-editor-foreground)',
        backgroundColor: 'transparent',
    },
    styles: [
        {
            types: ['comment', 'prolog', 'doctype', 'cdata'],
            style: {
                color: 'var(--vscode-editor-foreground)',
                opacity: 0.7,
            },
        },
        {
            types: ['punctuation', 'operator'],
            style: {
                color: 'var(--vscode-editor-foreground)',
            },
        },
        {
            types: ['keyword', 'boolean', 'number', 'function', 'builtin'],
            style: {
                color: 'var(--vscode-editor-foreground)',
                opacity: 0.9,
            },
        },
        {
            types: ['string', 'char', 'symbol'],
            style: {
                color: 'var(--vscode-editor-foreground)',
                opacity: 0.8,
            },
        },
    ],
};
