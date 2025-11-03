module.exports = {
  env: { node: true, es2022: true },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
    'plugin:@eslint/js/recommended',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: {
    'no-console': 'warn',
  },
};