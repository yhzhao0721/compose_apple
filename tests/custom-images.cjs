// Run with Playwright installed; optionally set CHROME_PATH to a local Chrome executable.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const filename = path.join(root, decodeURIComponent(req.url === '/' ? '/index.html' : req.url));
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.m4a': 'audio/mp4' };
  fs.readFile(filename, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' });
    res.end(error ? '' : data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      let matter;
      Object.defineProperty(window, 'Matter', { get: () => matter, set: value => {
        matter = value;
        const create = value.Engine.create;
        value.Engine.create = (...args) => (window.testEngine = create(...args));
      } });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => !document.getElementById('image-inputs').disabled);
    const files = fs.readdirSync(path.join(root, 'assets/characters')).filter(name => name.endsWith('.jpg')).slice(0, 12).map(name => path.join(root, 'assets/characters', name));
    const choose = async (selector, selection) => {
      await page.locator(selector).setInputFiles(selection);
      await page.waitForFunction(() => !document.getElementById('image-inputs').disabled);
    };
    const lineup = () => page.locator('#lineup img').evaluateAll(images => images.map(image => image.src));
    const restart = async () => {
      await page.locator('#restart-button').click();
      await page.getByRole('button', { name: '确认换一局', exact: true }).click();
    };
    await choose('#process-images', files.slice(0, 8));
    assert.match(await page.locator('#image-settings-status').textContent(), /至少选择 9 张/);
    await choose('#process-images', files.slice(0, 9));
    await page.getByRole('button', { name: '开始游戏', exact: true }).click();
    assert.equal(new Set((await lineup()).slice(0, 9)).size, 9);
    assert.ok((await lineup()).slice(0, 9).every(src => src.startsWith('data:image/png')));
    assert.ok(decodeURIComponent((await lineup())[9]).endsWith('苹果乐.jpg'));
    const existing = await lineup();
    await choose('#process-images', files);
    await choose('#final-image', [{ name: '我的终点.png', mimeType: 'image/jpeg', buffer: fs.readFileSync(files[11]) }]);
    assert.deepEqual(await lineup(), existing, 'editing settings must preserve current round');
    await restart();
    const finalSrc = await page.locator('#target-image').getAttribute('src');
    assert.equal(await page.locator('#target-name').textContent(), '我的终点');
    const seen = new Set(), orders = new Set();
    for (let i = 0; i < 30; i++) {
      const images = await lineup();
      assert.equal(images.length, 10);
      assert.equal(new Set(images.slice(0, 9)).size, 9);
      assert.equal(images[9], finalSrc);
      images.slice(0, 9).forEach(src => seen.add(src)); orders.add(images.slice(0, 9).join(','));
      await restart();
    }
    assert.equal(seen.size, 12, 'all uploaded process images participate');
    assert.ok(orders.size > 1, 'shuffle must vary between rounds');
    const beforeFailure = await lineup();
    await choose('#process-images', [...files.slice(0, 8).map(file => ({ name: path.basename(file), mimeType: 'image/jpeg', buffer: fs.readFileSync(file) })), { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') }]);
    assert.match(await page.locator('#image-settings-status').textContent(), /读取失败/);
    assert.deepEqual(await lineup(), beforeFailure);
    await choose('#final-image', [{ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') }]);
    assert.match(await page.locator('#image-settings-status').textContent(), /已保留之前的设置/);
    await restart();
    assert.equal((await lineup())[9], finalSrc);
    await page.evaluate(() => {
      for (const x of [220, 300]) {
        const body = Matter.Bodies.circle(x, 500, 91, { label: 'fruit' });
        body.game = { level: 8, born: testEngine.timing.timestamp, merging: false };
        Matter.Composite.add(testEngine.world, body);
      }
    });
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('合成我的终点啦'));
    assert.equal(await page.evaluate(() => Matter.Composite.allBodies(testEngine.world).filter(b => b.game?.level === 9).length), 1);
    await page.locator('#pause-button').click();
    await page.locator('#restore-images').click();
    assert.equal((await lineup())[9], finalSrc, 'restore must not change the current round');
    await restart();
    assert.ok((await lineup()).every(src => !src.startsWith('data:')));
    // Final-only customization retains the built-in process pool.
    await choose('#final-image', files.slice(0, 1));
    await restart();
    assert.ok((await lineup()).slice(0, 9).every(src => !src.startsWith('data:')));
    assert.ok((await lineup())[9].startsWith('data:'));
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no overflow at ${width}px`);
    }
    if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });
    await page.reload();
    await page.getByRole('button', { name: '开始游戏', exact: true }).click();
    assert.ok((await lineup()).every(src => !src.startsWith('data:')));
    assert.deepEqual(errors, []);
    console.log('PASS: 8/9/12 image selections, independent final image, 30 random rounds, atomic failure, real final merge, next-round settings, restore, refresh, four viewport sizes, no JS errors');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
