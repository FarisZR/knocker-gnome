import js from '@eslint/js';

const baseGlobals = {
    imports: 'readonly',
    log: 'readonly',
    logError: 'readonly',
    print: 'readonly',
    printerr: 'readonly',
    ARGV: 'readonly',
    _: 'readonly',
};

export default [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: baseGlobals,
        },
        rules: {
            indent: ['error', 4, { SwitchCase: 1 }],
            'linebreak-style': ['error', 'unix'],
            quotes: ['error', 'single', { avoidEscape: true }],
            semi: ['error', 'always'],
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrors: 'all',
                caughtErrorsIgnorePattern: '^_',
            }],
            'no-trailing-spaces': 'error',
            'eol-last': ['error', 'always'],
            'no-multiple-empty-lines': ['error', { max: 1 }],
            'comma-dangle': ['error', 'always-multiline'],
            'arrow-parens': ['error', 'as-needed'],
            'prefer-const': 'warn',
            'no-var': 'error',
        },
    },
    {
        files: ['prefs.js'],
        languageOptions: {
            globals: {
                ...baseGlobals,
                Adw: 'readonly',
                Gio: 'readonly',
                Gtk: 'readonly',
            },
        },
    },
    {
        files: ['extension.js', 'knocker*.js'],
        languageOptions: {
            globals: {
                ...baseGlobals,
                GLib: 'readonly',
                GObject: 'readonly',
                Gio: 'readonly',
                console: 'readonly',
            },
        },
    },
];
