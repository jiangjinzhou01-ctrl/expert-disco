import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:process.env.VITE_BASE ?? './',build:{chunkSizeWarningLimit:1800},test:{include:['src/tests/{unit,integration}/**/*.test.ts'],reporters:['default','json'],outputFile:{json:'evidence/vitest.json'}}});
