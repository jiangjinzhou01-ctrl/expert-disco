import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testMatch:'production.spec.ts',testIgnore:[],reporter:[['list'],['json',{outputFile:'evidence/production.json'}]],use:{...config.use,video:{mode:'on',size:{width:640,height:360}},baseURL:'http://127.0.0.1:4180'},webServer:{command:'npm run preview -- --port 4180',url:'http://127.0.0.1:4180',reuseExistingServer:!process.env.CI}});
