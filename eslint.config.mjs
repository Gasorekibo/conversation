// // eslint.config.mjs
// import js from '@eslint/js';
// import prettier from 'eslint-plugin-prettier';
// import prettierConfig from 'eslint-config-prettier';

// export default [
//   {
//     files: ['**/*.cjs', '**/*.js'],
//     languageOptions: {
//       sourceType: 'module',
//       globals: {
//         node: true,
//       },
//     },
//     plugins: { prettier },
//     rules: {
//       ...js.configs.recommended.rules,
//       ...prettierConfig.rules,
//       'prettier/prettier': 'error',
//       'no-console': 'off',
//     },
//     ignores: [
//       'node_modules/',
//       'dist/',
//       'build/',
//       'coverage/',
//       '.husky/',
//       'eslint.config.mjs',
//     ],
//   },
// ];

// eslint.config.mjs
import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // Ignore patterns (separate config object)
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', '.husky/'],
  },
  // Main configuration
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
    },
    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
