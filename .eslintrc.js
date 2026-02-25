/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@assertly/eslint-config'],
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.next',
    '*.js',
    '!.eslintrc.js',
    '!commitlint.config.js',
    '!lint-staged.config.js',
  ],
};
