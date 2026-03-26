import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', '.prisma/**', 'build/**', 'migrations/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
];
