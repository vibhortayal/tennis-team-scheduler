import nextCoreWebVitals from 'eslint-config-next/core-web-vitals.js';
import nextTypescript from 'eslint-config-next/typescript.js';
import prettier from 'eslint-config-prettier';

const eslintConfig = [
  { ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'dist/**', 'coverage/**'] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
];

export default eslintConfig;
