// TODO: Upgrade to ESLint 10 + @eslint/js 10 once eslint-plugin-import-x
// adds support (current peer dep is eslint ^8.57.0 || ^9.0.0).
// typescript-eslint@8.56+ and eslint-config-prettier already support ESLint 10.
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import { importX } from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: {
      'import-x': importX,
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
    },
  },
  {
    files: ['**/apps/*/src/**/*.ts', '**/packages/nestjs-common/src/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
