import { PrismTheme } from 'prism-react-renderer';
import '../utilities/syntax-colors.css';

export const minimalTheme: PrismTheme = {
    plain: {
        color: 'var(--vscode-editor-foreground)',
        backgroundColor: 'transparent',
    },
    styles: [
        {
            types: ['comment', 'prolog', 'doctype', 'cdata'],
            style: {
                color: 'var(--syntax-comment)',
                fontStyle: 'italic',
            },
        },
        {
            types: ['keyword', 'builtin'],
            style: {
                color: 'var(--syntax-keyword)',
            },
        },
        {
            types: ['function'],
            style: {
                color: 'var(--syntax-entity)',
            },
        },
        {
            types: ['string', 'attr-value'],
            style: {
                color: 'var(--syntax-string)',
            },
        },
        {
            types: ['number'],
            style: {
                color: 'var(--syntax-constant)',
            },
        },
        {
            types: ['punctuation', 'operator'],
            style: {
                color: 'var(--syntax-punctuation)',
            },
        },
        {
            types: ['class-name', 'maybe-class-name'],
            style: {
                color: 'var(--syntax-type)',
            },
        },
    ],
};
