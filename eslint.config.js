import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
export default ts.config({ignores:['public/assets/basis/**','.vite-cache/**','dist/**','node_modules/**','playwright-report/**','test-results/**','evidence/**']},js.configs.recommended,...ts.configs.recommended,{files:['**/*.{ts,tsx,js,mjs}'],languageOptions:{globals:{...globals.browser,...globals.node}},rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}});
