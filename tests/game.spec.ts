import { test, expect, type Page } from '@playwright/test';
import { STORAGE_KEY, chooseBonus, newSession, revealBonusStar, settleSpin, type Board, type Session, type TierId } from '../src/game';
import { MAX_CONSTELLATION_STARS } from '../src/constellations';

const moonBoard: Board = Array.from({ length: 5 }, () => ['moon', 'moon', 'moon']);
const fixedDeck = (): TierId[] => Array.from({ length: MAX_CONSTELLATION_STARS }, (_, i) => (['mini', 'minor', 'major', 'mini', 'minor', 'major', 'major'] as const)[i % 7]);
const pendingBonus = (bet = 100, denomination = 1) => settleSpin({ ...newSession(), bet, denomination }, moonBoard, 123, fixedDeck).session;
async function seed(page: Page, session: Session) {
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, { key: STORAGE_KEY, value: session });
}
async function stored(page: Page): Promise<Session> { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY); }
async function predictableReels(page: Page) {
  await page.addInitScript(() => Object.defineProperty(crypto, 'getRandomValues', { value: (values: Uint32Array) => { values.fill(0); return values; } }));
}

test('12 signs, all wager settings, sound toggle, accounting, paytable and history', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Astral Fortune', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Bet credits' }).locator('option')).toHaveText(['50', '100', '150', '200', '250']);
  await expect(page.getByRole('combobox', { name: 'Denomination' }).locator('option')).toHaveText(['$0.01', '$0.02', '$0.05', '$0.10', '$0.25', '$0.50', '$1.00', '$2.00']);
  await page.getByRole('combobox', { name: 'Bet credits' }).selectOption('250');
  await page.getByRole('combobox', { name: 'Denomination' }).selectOption('200');
  await expect(page.getByTestId('bet')).toHaveText('$500.00');
  expect((await stored(page)).balance).toBe(1000000);
  await page.getByRole('combobox', { name: 'Bet credits' }).selectOption('50');
  await page.getByRole('combobox', { name: 'Denomination' }).selectOption('1');
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('machine.png'), fullPage: true });
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spinning', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Bonus demo', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Denomination' })).toBeDisabled();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  let data = await stored(page);
  expect(data.history).toHaveLength(1);
  expect(data.balance).toBe(1000000 - 50 + data.history[0].payout);
  if (data.bonus) {
    await page.getByRole('button', { name: 'Choose Aries', exact: true }).click();
    for (let i = 1; i <= 7; i++) {
      if ((await stored(page)).bonus?.winner) break;
      await page.getByRole('button', { name: new RegExp(`^Reveal star ${i},`) }).click();
    }
    await page.getByRole('button', { name: 'Collect & continue' }).click();
    data = await stored(page);
  }
  await page.getByRole('button', { name: 'Paylines', exact: true }).click();
  await expect(page.locator('.payline-example')).toHaveCount(20);
  await page.getByRole('tab', { name: 'Symbol payouts' }).click();
  await expect(page.locator('.pay-table tbody tr')).toHaveCount(13);
  await expect(page.locator('.rtp-note')).toContainText('98.00% theoretical RTP');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Spin history', exact: true }).last().click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.reload();
  expect((await stored(page)).balance).toBe(data.balance);
  expect(errors).toEqual([]);
});

test('twenty-line paytable and bonus awards match the selected wager', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: testInfo.project.name === 'mobile' ? 320 : 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.active-lines')).toHaveText('20 ACTIVE PAYLINES');
  await page.getByRole('combobox', { name: 'Bet credits' }).selectOption('250');
  await page.getByRole('combobox', { name: 'Denomination' }).selectOption('200');
  await page.getByRole('button', { name: 'Paylines', exact: true }).click();
  await expect(page.getByRole('tab', { name: '20 paylines' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.payline-example')).toHaveCount(20);
  await page.screenshot({ path: testInfo.outputPath('twenty-paylines.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Symbol payouts' }).click();
  await expect(page.locator('.symbol-pay-table tr').filter({ hasText: 'Aries' }).locator('td')).toHaveText(['Aries', '$500.00', '$2,500.00', '$12,500.00']);
  await expect(page.locator('.symbol-pay-table tr').filter({ hasText: 'Sun' }).locator('td')).toHaveText(['SunWILD', '$1,250.00', '$6,250.00', '$25,000.00']);
  await page.getByRole('tab', { name: 'Symbol payouts' }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Bonus payouts' })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('$10,000.00');
  await expect(page.locator('.bonus-pay-table').first().locator('tbody tr')).toHaveText(['Mini2×$1,000.0050%', 'Minor5×$2,500.0033.33%', 'Major20×$10,000.0016.67%']);
  await expect(page.locator('.bonus-pay-table').last().locator('tbody tr')).toHaveText(['35Star match', '48Star match', '5+12Star match']);
  expect(await page.getByRole('dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('bonus-paytable.png'), fullPage: true });
  const before = await stored(page);
  await page.getByRole('button', { name: 'Try bonus demo', exact: true }).click();
  await expect(page.locator('.demo-bonus')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByRole('button', { name: 'Exit bonus demo' }).click();
  expect(await stored(page)).toEqual(before);
});

test('bonus demo works with an empty wallet, replays, and never saves awards', async ({ page }, testInfo) => {
  const initial = { ...newSession(), balance: 0, bet: 250, denomination: 200 };
  await seed(page, initial);
  await predictableReels(page);
  await page.goto('/');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const board = await page.locator('.reels').getAttribute('aria-label');
  const trigger = page.getByRole('button', { name: 'Bonus demo', exact: true });
  await trigger.click();
  await expect(page.locator('.bonus-demo-label')).toContainText('$500.00 BET');
  await expect(page.locator('.constellation-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Choose Aries', exact: true }).click();
  await page.keyboard.press('Space');
  for (let i = 1; i <= 3; i++) await page.getByRole('button', { name: new RegExp(`^Reveal star ${i},`) }).click();
  await expect(page.getByTestId('bonus-amount')).toHaveText('$1,000.00');
  await expect(page.locator('.bonus-outcome')).toContainText('BALANCE UNCHANGED');
  await expect(page.getByRole('button', { name: 'Collect & continue' })).toHaveCount(0);
  expect(await stored(page)).toEqual(initial);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('demo-win.png'), fullPage: true });
  await page.getByRole('button', { name: 'Play demo again' }).click();
  await expect(page.locator('.constellation-card')).toHaveCount(12);
  await expect(page.getByTestId('bonus-amount')).toHaveCount(0);
  await expect(page.getByLabel('Mini: 0 of 3 matched')).toBeVisible();
  await page.getByRole('button', { name: 'Choose Pisces', exact: true }).click();
  await page.getByRole('button', { name: /^Reveal star 1,/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.locator('.reels').getAttribute('aria-label')).toBe(board);
  expect(await stored(page)).toEqual(initial);
  await trigger.click();
  await page.getByRole('button', { name: 'Choose Leo', exact: true }).click();
  await page.getByRole('button', { name: /^Reveal star 1,/ }).click();
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await stored(page)).toEqual(initial);
  expect(errors).toEqual([]);
});

test('bonus demo preserves pending free spins and their locked wager', async ({ page }) => {
  const initial = { ...newSession(), bet: 250, denomination: 200, freeSpins: 5, bonusBet: 50, bonusDenomination: 2 };
  await seed(page, initial);
  await predictableReels(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Bonus demo', exact: true }).click();
  await expect(page.locator('.bonus-demo-label')).toContainText('$1.00 BET');
  await page.getByRole('button', { name: 'Choose Leo', exact: true }).click();
  for (let i = 1; i <= 3; i++) await page.getByRole('button', { name: new RegExp(`^Reveal star ${i},`) }).click();
  await expect(page.getByTestId('bonus-amount')).toHaveText('$2.00');
  await page.getByRole('button', { name: 'Exit bonus demo' }).click();
  expect(await stored(page)).toEqual(initial);
  await expect(page.getByRole('button', { name: 'Free spin', exact: true })).toBeEnabled();
  await expect(page.getByRole('combobox', { name: 'Bet credits' })).toBeDisabled();
});

test('starting a bonus demo cancels autoplay and does not resume it on exit', async ({ page }) => {
  await predictableReels(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'AUTO SPIN', exact: true }).click();
  await page.getByRole('menuitem', { name: '10 spins', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Bonus demo', exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const before = await stored(page);
  await page.waitForTimeout(1100);
  expect(await stored(page)).toEqual(before);
  await page.getByRole('button', { name: 'Exit bonus demo' }).click();
  await page.waitForTimeout(1100);
  expect(await stored(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Stop autoplay' })).toHaveCount(0);
});

test('constellation selection, individual star reveals, and first match survive refresh', async ({ page }, testInfo) => {
  const initial = pendingBonus();
  await seed(page, initial);
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.constellation-card')).toHaveCount(12);
  await expect(page.locator('.constellation-card .constellation-chart')).toHaveCount(12);
  await expect(page.locator('.constellation-card .zodiac-symbol')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('bonus-pick.png'), fullPage: true });
  const deck = (await stored(page)).bonus!.prizes;
  await page.reload();
  expect((await stored(page)).bonus!.prizes).toEqual(deck);
  await page.getByRole('button', { name: 'Choose Pisces', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pisces awaits' })).toBeVisible();
  await expect(page.getByTestId('bonus-amount')).toHaveCount(0);
  expect((await stored(page)).balance).toBe(initial.balance);
  await page.getByRole('button', { name: /^Reveal star 1,/ }).click();
  await page.getByRole('button', { name: /^Reveal star 2,/ }).click();
  await expect(page.getByLabel('Mini: 1 of 3 matched')).toBeVisible();
  await expect(page.getByLabel('Minor: 1 of 3 matched')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('star-map.png'), fullPage: true });
  await page.reload();
  expect((await stored(page)).bonus!.revealedStars).toEqual([0, 1]);
  await expect(page.getByRole('button', { name: /^Star 1,.*Mini$/ })).toBeDisabled();
  for (let i = 3; i <= 7; i++) await page.getByRole('button', { name: new RegExp(`^Reveal star ${i},`) }).click();
  await expect(page.getByTestId('bonus-amount')).toHaveText('$20.00');
  await expect(page.getByRole('heading', { name: 'Saturn ascendant' })).toBeVisible();
  await expect(page.locator('.winning-star')).toHaveCount(3);
  expect((await stored(page)).balance).toBe(initial.balance + 2000);
  await page.screenshot({ path: testInfo.outputPath('bonus-major.png'), fullPage: true });
  await page.reload();
  await expect(page.getByTestId('bonus-amount')).toHaveText('$20.00');
  expect((await stored(page)).balance).toBe(initial.balance + 2000);
  await page.getByRole('button', { name: 'Collect & continue' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Free spin', exact: true })).toBeEnabled();
  await expect(page.getByRole('combobox', { name: 'Bet credits' })).toBeDisabled();
  expect((await stored(page)).bonus).toBeNull();
});

test('free spins keep the trigger denomination and do not debit the wallet', async ({ page }) => {
  await seed(page, { ...newSession(), balance: 0, bet: 250, denomination: 200, bonusBet: 50, bonusDenomination: 2, freeSpins: 2 });
  await predictableReels(page);
  await page.goto('/');
  await expect(page.getByTestId('bet')).toHaveText('$1.00');
  await expect(page.getByRole('combobox', { name: 'Bet credits' })).toHaveValue('50');
  await expect(page.getByRole('combobox', { name: 'Denomination' })).toBeDisabled();
  await page.getByRole('button', { name: 'Free spin', exact: true }).click();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  const data = await stored(page);
  expect(data.history[0].free).toBe(true);
  expect(data.history[0].denomination).toBe(2);
  expect(data.balance).toBe(data.history[0].payout * 2);
  expect(data.freeSpins).toBe(1);
});

test('reload during reel animation preserves its settlement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  const data = await stored(page);
  await page.reload();
  expect((await stored(page)).balance).toBe(data.balance);
  expect((await stored(page)).history).toHaveLength(1);
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
});

test('empty wallet refills and autoplay stops on request', async ({ page }) => {
  await seed(page, { ...newSession(), balance: 0 });
  await predictableReels(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Refill to spin', exact: true }).click();
  await page.getByRole('button', { name: 'Refill to $10,000', exact: true }).click();
  expect((await stored(page)).balance).toBe(1000000);
  await page.getByRole('button', { name: 'Enable quick spin', exact: true }).click();
  await page.getByRole('button', { name: 'AUTO SPIN', exact: true }).click();
  await page.getByRole('menuitem', { name: '10 spins', exact: true }).click();
  await page.getByRole('button', { name: 'Stop autoplay', exact: true }).click();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  await page.waitForTimeout(1100);
  expect((await stored(page)).history).toHaveLength(1);
});

test('autoplay finishes at its selected limit', async ({ page }) => {
  await predictableReels(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable quick spin', exact: true }).click();
  await page.getByRole('button', { name: 'AUTO SPIN', exact: true }).click();
  await page.getByRole('menuitem', { name: '10 spins', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop autoplay', exact: true })).toHaveCount(0, { timeout: 15000 });
  expect((await stored(page)).history).toHaveLength(10);
});

test('wager controls and maximum bonus amounts fit desktop and mobile', async ({ page }, testInfo) => {
  await page.goto('/');
  for (const width of testInfo.project.name === 'mobile' ? [320, 390, 680] : [768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const overlaps = await page.locator('.control-deck').evaluate(deck => {
      const boxes = Array.from(deck.children).map(element => element.getBoundingClientRect());
      return boxes.some((a, i) => boxes.slice(i + 1).some(b => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1));
    });
    expect(overlaps).toBe(false);
  }
  let bonus = chooseBonus(pendingBonus(250, 200), 'pisces');
  for (let i = 0; i < 7; i++) bonus = revealBonusStar(bonus, i);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: bonus });
  await page.reload();
  await expect(page.getByTestId('bonus-amount')).toHaveText('$10,000.00');
  expect(await page.locator('.celestial-bonus').evaluate(element => element.scrollWidth <= innerWidth)).toBe(true);
  for (const card of await page.locator('.pick-star').all()) {
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
});

test('play and bonus backgrounds draw visible pixels and actually animate', async ({ page }) => {
  await page.goto('/');
  const pixels = (selector: string) => page.locator(selector).evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0, hash = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]) { count++; hash = (hash + i * data[i]) >>> 0; }
    return { count, hash };
  });
  await page.evaluate(() => document.fonts.ready);
  for (const selector of ['.cosmos .starfield', '.bonus-starfield']) {
    if (selector.includes('bonus')) {
      await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: pendingBonus() });
      await page.reload();
    }
    await page.waitForTimeout(100);
    const before = await pixels(selector);
    await page.waitForTimeout(600);
    const after = await pixels(selector);
    expect(before.count).toBeGreaterThan(100);
    expect(after.count).toBeGreaterThan(100);
    expect(after.hash).not.toBe(before.hash);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(150);
  const still = await pixels('.bonus-starfield');
  await page.waitForTimeout(500);
  expect((await pixels('.bonus-starfield')).hash).toBe(still.hash);
});

test('all constellation star targets stay separate and inside their map', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: testInfo.project.name === 'mobile' ? 320 : 1440, height: 900 });
  await page.goto('/');
  for (const sign of ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const) {
    const value = chooseBonus(pendingBonus(), sign);
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value });
    await page.reload();
    const geometry = await page.locator('.star-pick-map').evaluate(map => {
      const parent = map.getBoundingClientRect();
      const stars = Array.from(map.querySelectorAll('.pick-star')).map(star => star.getBoundingClientRect());
      return {
        overflow: stars.some(box => box.left < parent.left || box.right > parent.right || box.top < parent.top || box.bottom > parent.bottom),
        overlap: stars.some((a, i) => stars.slice(i + 1).some(b => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1)),
      };
    });
    expect(geometry, sign).toEqual({ overflow: false, overlap: false });
  }
});

test('unavailable storage still allows spins', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage blocked'); }; });
  await predictableReels(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Spin history', exact: true }).last().click();
  await expect(page.locator('.history-row')).toHaveCount(1);
});

test('casino synthesizer renders audible effects without clipping', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const path = '/src/audio.ts';
    const { scheduleSound } = await import(/* @vite-ignore */ path);
    const effects = [];
    for (const kind of ['spin', 'stop', 'win', 'bonus', 'grand', 'credit']) {
      const context = new OfflineAudioContext(1, 44100 * 3, 44100);
      scheduleSound(context, context.destination, kind, 0);
      const data = (await context.startRendering()).getChannelData(0);
      let peak = 0, energy = 0;
      for (const sample of data) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
      effects.push({ kind, peak, energy });
    }
    return effects;
  });
  for (const effect of results) { expect(effect.energy, effect.kind).toBeGreaterThan(1); expect(effect.peak, effect.kind).toBeLessThan(1); }
});
