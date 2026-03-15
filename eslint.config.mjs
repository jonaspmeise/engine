import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import stylistic from '@stylistic/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@stylistic': stylistic,
    },
    rules: {
      // Ternary formatting (not handled by prettier)
      '@stylistic/multiline-ternary': ['error', 'always'],
    },
  },
  // Disables ESLint rules that conflict with Prettier
  prettierConfig,
];
