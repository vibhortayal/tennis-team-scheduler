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
    },
  },
];

export default eslintConfig;
