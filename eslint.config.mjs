import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default defineConfig([
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'eslint.config.mjs', '**/*.swift'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    plugins: { js },
    extends: ['js/recommended'],
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      'no-empty-pattern': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['server/src/**/*.{js,mjs,cjs,ts}'],
    rules: {
      'no-console': 'error',
    },
  },
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
