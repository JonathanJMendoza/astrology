import { test, expect, type Page } from '@playwright/test';
import { BONUS_DECK, STORAGE_KEY, chooseBonus, newSession, settleSpin, type Board, type Session } from '../src/game';

const moonBoard: Board = Array.from({ length: 5 }, () => ['moon', 'moon', 'moon']);
const pendingBonus = (bet = 100, denomination = 1) => settleSpin({ ...newSession(), bet, denomination }, moonBoard, 123, () => [...BONUS_DECK]).session;
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
  await expect(page.getByRole('combobox', { name: 'Denomination' })).toBeDisabled();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  let data = await stored(page);
  expect(data.history).toHaveLength(1);
  expect(data.balance).toBe(1000000 - 50 + data.history[0].payout);
  if (data.bonus) {
    await page.getByRole('button', { name: 'Choose Aries', exact: true }).click();
    await page.getByRole('button', { name: 'Collect & continue' }).click();
    data = await stored(page);
  }
  await page.getByRole('button', { name: 'Paylines', exact: true }).click();
  await expect(page.locator('.payline-example')).toHaveCount(10);
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

test('celestial pick, prize reveal, and exact-once payout survive refresh', async ({ page }, testInfo) => {
  const initial = pendingBonus();
  await seed(page, initial);
  await page.goto('/');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.constellation-card')).toHaveCount(12);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('bonus-pick.png'), fullPage: true });
  const deck = (await stored(page)).bonus!.prizes;
  await page.reload();
  expect((await stored(page)).bonus!.prizes).toEqual(deck);
  await page.getByRole('button', { name: 'Choose Pisces', exact: true }).click();
  await expect(page.getByTestId('bonus-amount')).toHaveText('$100.00');
  await expect(page.getByRole('heading', { name: 'Solar coronation' })).toBeVisible();
  await expect(page.locator('.constellation-card:disabled')).toHaveCount(12);
  expect((await stored(page)).balance).toBe(initial.balance + 10000);
  await page.screenshot({ path: testInfo.outputPath('bonus-grand.png'), fullPage: true });
  await page.reload();
  await expect(page.getByTestId('bonus-amount')).toHaveText('$100.00');
  expect((await stored(page)).balance).toBe(initial.balance + 10000);
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
  const bonus = chooseBonus(pendingBonus(250, 200), 'pisces');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: bonus });
  await page.reload();
  await expect(page.getByTestId('bonus-amount')).toHaveText('$50,000.00');
  expect(await page.locator('.celestial-bonus').evaluate(element => element.scrollWidth <= innerWidth)).toBe(true);
  for (const card of await page.locator('.constellation-card').all()) {
    expect(await card.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
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
