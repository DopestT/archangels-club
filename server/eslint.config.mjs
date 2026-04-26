import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      // Existing codebase uses `any` intentionally in DB helpers
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Allow require() in config/setup files
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
);
