// node docs/redesign/shot-mac.mjs <url-or-route> <out.png> [waitMs] [width] [height] [reduce] [fullPage]
// macOS twin of shot-live.mjs: real-time screenshot through the installed Chrome. A bare route is served from the dev server.
import puppeteer from 'puppeteer-core'
const [target, out, waitMs = '9000', width = '1440', height = '1400', reduce = '', full = ''] = process.argv.slice(2)
const url = target.startsWith('http') || target.startsWith('file:') ? target : 'http://localhost:5173' + target
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--hide-scrollbars'] })
const page = await browser.newPage()
await page.setViewport({ width: +width, height: +height, deviceScaleFactor: 1 })
if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await page.goto(url, { waitUntil: 'load' })
await new Promise((r) => setTimeout(r, +waitMs))
await page.screenshot({ path: out, fullPage: !!full })
await browser.close()
console.log('wrote', out)
