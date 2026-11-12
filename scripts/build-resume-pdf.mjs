// Prints resume.html to public/resume.pdf (and dist/resume.pdf).
// Usage: npm run resume:pdf   — needs Playwright with Chromium installed
// (npm i -D playwright && npx playwright install chromium).
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright not found. Install it with: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const server = await preview({ preview: { port: 4179, strictPort: false }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0] + 'resume.html';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  await page.goto(url);
  await page.waitForSelector('body[data-ready="true"]');
  mkdirSync('public', { recursive: true });
  await page.pdf({ path: 'public/resume.pdf', preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
  if (existsSync('dist')) copyFileSync('public/resume.pdf', 'dist/resume.pdf');
  console.log('Wrote public/resume.pdf');
} finally {
  await browser.close();
  await server.close();
}
