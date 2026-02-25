/** @type {import('lint-staged').Config} */
module.exports = {
  '*.{ts,tsx,js,jsx}': ['eslint --fix --max-warnings 0', 'prettier --write'],
  '*.{json,md,yaml,yml}': ['prettier --write'],
};
