// node docs/redesign/shot-live.mjs <route> <out.png> [waitMs] [width] [height] [reduce]
// Real-time screenshot through the installed Chrome, so Motion and CSS animations run as they would for a person.
import puppeteer from 'puppeteer-core'
const [route, out, waitMs = '9000', width = '1440', height = '1400', reduce = ''] = process.argv.slice(2)
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars'] })
const page = await browser.newPage()
await page.setViewport({ width: +width, height: +height, deviceScaleFactor: 1 })
if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await page.goto('http://localhost:5174' + route, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, +waitMs))
await page.screenshot({ path: out, fullPage: false })
await browser.close()
console.log('wrote', out)
