const { defineConfig, globalIgnores } = require('eslint/config');
const prettier = require('eslint-plugin-prettier');
const jest = require('eslint-plugin-jest');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

module.exports = defineConfig([
  globalIgnores([
    '**/dist',
    '**/coverage',
    '**/node_modules',
    '**/tmp',
    '**/polyfills.ts',
    '**/test-setup.ts',
    '**/main.ts',
    '**/environment*.ts',
    '**/jest.config.ts'
  ]),
  {
    files: ['src/**/*.ts'],

    ignores: ['**/*.test.ts'],

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['tsconfig.json'],
        createDefaultProgram: true
      }
    },

    plugins: {
      prettier,
      '@typescript-eslint': tsPlugin
    },

    extends: compat.extends(
      'eslint:recommended',
      'plugin:import/recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:import/typescript',
      'plugin:prettier/recommended',
      'plugin:@rxlint/recommended',
      'eslint-config-prettier'
    ),

    settings: {
      'import/internal-regex': '^@dcs-libs/'
    },

    rules: {
      // Rxjs rules
      '@rxlint/no-nested-subscribe': 'error',
      '@rxlint/no-subject-unsubscribe': 'off',
      '@rxlint/no-unsafe-takeuntil': 'error',
      '@rxlint/no-ignored-takewhile-value': 'off',
      '@rxlint/no-implicit-any-catch': 'off',
      '@rxlint/prefer-observer': ['error', { allowNext: true }],

      // ESLint rules
      'no-console': [
        'error',
        {
          allow: ['warn', 'error', 'info']
        }
      ],
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'prettier/prettier': 'error',
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off', // todo: see how to fix if enable
      'no-constant-condition': 'off', // todo: see how to fix if enable

      // Import rules
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            ['internal', 'parent', 'sibling', 'index'],
            ['object', 'type', 'unknown']
          ],
          pathGroups: [
            {
              pattern: '@angular/**',
              group: 'builtin'
            },
            {
              pattern: '@prod-business-cpoc-ui/**',
              group: 'internal'
            }
          ],
          pathGroupsExcludedImportTypes: ['builtin', 'internal'],
          distinctGroup: false,
          'newlines-between': 'always'
        }
      ],
      'import/no-unresolved': 'off',

      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-duplicate-enum-values': 'off',
      '@typescript-eslint/no-this-alias': 'off', // todo: see how to fix if enable
      '@typescript-eslint/no-unsafe-function-type': 'off'
    }
  },
  {
    files: ['**/*.test.ts'],
    plugins: { jest },
    languageOptions: {
      globals: jest.environments.globals.globals,
      parser: tsParser,
      parserOptions: {
        project: ['tsconfig.json'],
        createDefaultProgram: true
      }
    },
    rules: {
      'jest/no-disabled-tests': 'error',
      'no-unused-vars': 'error'
    }
  },
  {
    files: ['e2e/**/*.ts', 'playwright.*.ts', 'regression-tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['tsconfig.json'],
        createDefaultProgram: true
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
]);
