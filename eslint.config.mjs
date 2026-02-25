import assertlyConfig from '@assertly/eslint-config';

export default [
  { ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/.next/**'] },
  ...assertlyConfig,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
];
