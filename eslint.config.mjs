import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = [
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'dist/**', 'coverage/**'] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      // Initialization-style setState calls inside useEffect are intentional here.
      'react-hooks/set-state-in-effect': 'off',
      // Allow intentionally-unused args/vars when prefixed with an underscore.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
];

export default eslintConfig;
