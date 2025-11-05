import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import noLowercaseFunctions from './eslint-rules/no-uppercase-functions.mjs';
export default [
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', '.husky/'],
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      prettier,
      local: {
        rules: {
          'no-lowercase-functions': noLowercaseFunctions,
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'local/no-lowercase-functions': 'error',
    },
  },
];
