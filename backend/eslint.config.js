import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-plugin-prettier';
import regex from 'eslint-plugin-regex';
import security from 'eslint-plugin-security';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
                project: './tsconfig.json'
            }
        },
        plugins: {
            '@typescript-eslint': tseslint,
            prettier,
            'unused-imports': unusedImports,
            security,
            'import': importPlugin,
            regex
        },
        rules: {
            'prettier/prettier': ['error'],
            '@typescript-eslint/no-floating-promises': ['error'],
            '@typescript-eslint/promise-function-async': ['error'],
            '@typescript-eslint/await-thenable': ['error'],
            '@typescript-eslint/no-unnecessary-condition': ['off'],
            '@typescript-eslint/no-non-null-asserted-optional-chain': ['off'],
            '@typescript-eslint/no-extra-non-null-assertion': ['off'],
            '@typescript-eslint/no-confusing-non-null-assertion': ['off'],
            '@typescript-eslint/no-non-null-asserted-nullish-coalescing': ['off'],
            '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, caughtErrors: 'none' }],
            'no-unused-vars': ['off'],
            'no-undef': ['off'],
            'no-empty': ['off'],
            'require-await': ['error'],
            'security/detect-bidi-characters': ['error'],
            'security/detect-buffer-noassert': ['error'],
            'security/detect-child-process': ['error'],
            'security/detect-disable-mustache-escape': ['error'],
            'security/detect-eval-with-expression': ['error'],
            'security/detect-new-buffer': ['error'],
            'security/detect-no-csrf-before-method-override': ['error'],
            'security/detect-non-literal-require': ['error'],
            'security/detect-possible-timing-attacks': ['error'],
            'security/detect-pseudoRandomBytes': ['error'],
            'security/detect-unsafe-regex': ['error'],
            'no-prototype-builtins': ['off'],
            'unused-imports/no-unused-imports': ['error']
        }
    },
    globalIgnores([
        'node_modules/**',
        'dist/**',
        'eslint*',
        'src/swaggerSpecs.ts',
        '@types',
        '.husky/**',
        'jest.config.ts',
        'src/generated/**',
        '**/*.js',
        '**/*test.ts',
        '__mocks__/**',
        '**/swagger/swaggerSpecs.ts',
        '**/*.cjs',
        'prisma.config.ts'
    ])
]);
