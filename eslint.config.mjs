import spechiveConfig from '@spechive/eslint-config';

export default [
  { ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/.next/**'] },
  ...spechiveConfig,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
];
