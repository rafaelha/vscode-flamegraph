module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true,
        jest: true,
    },
    extends: ['plugin:react/recommended', 'airbnb', 'prettier', 'plugin:prettier/recommended'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 12,
        sourceType: 'module',
    },
    plugins: ['react', '@typescript-eslint', 'prettier'],
    rules: {
        'prettier/prettier': ['error', {}, { usePrettierrc: true }],
        'max-len': [
            'error',
            {
                code: 120,
                ignoreUrls: true,
                ignoreStrings: true,
                ignoreTemplateLiterals: true,
                ignoreRegExpLiterals: true,
            },
        ],
        'import/extensions': 'off',
        'no-underscore-dangle': 'off',
        'no-continue': 'off',
        'no-bitwise': 'off',
        'no-restricted-syntax': 'off',
        'import/prefer-default-export': 'off',
        'class-methods-use-this': 'off',
        'no-param-reassign': 'off',
    },
    settings: {
        'import/resolver': {
            typescript: {},
        },
        'import/core-modules': ['vscode'],
    },
};
