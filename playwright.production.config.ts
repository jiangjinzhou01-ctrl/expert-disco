import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testMatch:'production.spec.ts',testIgnore:[],reporter:[['list'],['json',{outputFile:'evidence/production.json'}]],use:{...config.use,baseURL:'http://127.0.0.1:4173'},webServer:{command:'npm run preview -- --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI}});
