import { test, expect } from '@playwright/test';
import { STORAGE_KEY } from '../src/game';

test('renders and spins, saves accounting, opens paytable and history', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Astral Fortune', exact: true })).toBeVisible();
  await expect(page.getByTestId('balance')).toHaveText('10,000');
  await page.getByRole('button', { name: 'Increase bet', exact: true }).click();
  await expect(page.getByTestId('bet')).toHaveText('50');
  await page.getByRole('button', { name: 'Decrease bet', exact: true }).click();
  await expect(page.getByTestId('bet')).toHaveText('20');
  await page.getByRole('button', { name: 'Enable sound', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('initial.png'), fullPage: true });
  const before = await page.locator('.reels').getAttribute('aria-label');
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spinning', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Increase bet', exact: true })).toBeDisabled();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  expect(await page.locator('.reels').getAttribute('aria-label')).not.toBe(before);
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored.history).toHaveLength(1);
  expect(stored.balance).toBe(10000 - 20 + stored.history[0].payout);
  await expect(page.getByTestId('balance')).toHaveText(stored.balance.toLocaleString('en-US'));
  await page.getByRole('button', { name: 'Paylines', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.payline-example')).toHaveCount(10);
  await page.getByRole('tab', { name: 'Symbol payouts' }).click();
  await expect(page.locator('.pay-table tbody tr')).toHaveCount(7);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Spin history', exact: true }).last().click();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('balance')).toHaveText(stored.balance.toLocaleString('en-US'));
  await expect(page.getByTestId('last-win')).toHaveText(stored.history[0].payout.toLocaleString('en-US'));
  expect(errors).toEqual([]);
});

test('reload during animation preserves the already-settled result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  await page.reload();
  await expect(page.getByTestId('balance')).toHaveText(stored.balance.toLocaleString('en-US'));
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).history.length, STORAGE_KEY)).toBe(1);
});

test('free spins use the bonus wager without charging credits', async ({ page }) => {
  await page.addInitScript(({ key }) => localStorage.setItem(key, JSON.stringify({ version: 1, balance: 0, bet: 200, bonusBet: 20, freeSpins: 2, history: [] })), { key: STORAGE_KEY });
  await page.goto('/');
  await expect(page.getByTestId('bet')).toHaveText('20');
  await expect(page.getByRole('button', { name: 'Increase bet', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Free spin', exact: true }).click();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(stored.history[0].free).toBe(true);
  expect(stored.history[0].bet).toBe(20);
  expect(stored.balance).toBe(stored.history[0].payout);
  expect(stored.freeSpins).toBe(1 + stored.history[0].awardedSpins);
});

test('empty wallet refills, and autoplay stops on request', async ({ page }) => {
  await page.addInitScript(({ key }) => localStorage.setItem(key, JSON.stringify({ version: 1, balance: 0, bet: 20, bonusBet: 20, freeSpins: 0, history: [] })), { key: STORAGE_KEY });
  await page.goto('/');
  await page.getByRole('button', { name: 'Refill to spin', exact: true }).click();
  await page.getByRole('button', { name: 'Refill to 10,000', exact: true }).click();
  await expect(page.getByTestId('balance')).toHaveText('10,000');
  await page.getByRole('button', { name: 'Enable quick spin', exact: true }).click();
  await page.getByRole('button', { name: 'AUTO SPIN', exact: true }).click();
  await page.getByRole('menuitem', { name: '10 spins', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop autoplay', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop autoplay', exact: true }).click();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  await page.waitForTimeout(1100);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).history.length, STORAGE_KEY)).toBe(1);
});

test('layouts stay within the viewport and symbols render', async ({ page }, testInfo) => {
  await page.goto('/');
  for (const width of testInfo.project.name === 'mobile' ? [320, 390, 680] : [768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.symbol-cell')).toHaveCount(15);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await page.locator('.control-deck').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const overlaps = await page.locator('.control-deck').evaluate(deck => {
      const boxes = Array.from(deck.children).map(element => element.getBoundingClientRect());
      return boxes.some((a, i) => boxes.slice(i + 1).some(b => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1));
    });
    expect(overlaps).toBe(false);
    for (const svg of await page.locator('.reels .zodiac-symbol > svg').all()) {
      const box = await svg.boundingBox();
      expect(box!.width).toBeGreaterThan(35);
      expect(box!.height).toBeGreaterThan(35);
    }
  }
});

test('unavailable storage leaves the game playable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Spin history', exact: true }).last().click();
  await expect(page.locator('.history-row')).toHaveCount(1);
});

test('wild jackpot displays all winning cells and pays exactly once', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'getRandomValues', { value: (values: Uint32Array) => { values.fill(92); return values; } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('last-win')).toHaveText('20,000');
  await expect(page.getByTestId('balance')).toHaveText('29,980');
  await expect(page.locator('.symbol-cell.winning')).toHaveCount(15);
  await expect(page.locator('.winning-lines polyline')).toHaveCount(10);
  await expect(page.getByRole('status')).toContainText('A cosmic win!');
  await page.screenshot({ path: testInfo.outputPath('jackpot.png'), fullPage: true });
});

test('moon scatter awards and retriggers free spins at the original wager', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'getRandomValues', { value: (values: Uint32Array) => { values.fill(95); return values; } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Free spin', exact: true })).toBeEnabled();
  await expect(page.getByTestId('balance')).toHaveText('9,980');
  await expect(page.locator('.bonus-condition')).toContainText('12 FREE SPINS');
  await expect(page.getByRole('button', { name: 'Increase bet', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Free spin', exact: true }).click();
  await expect(page.locator('.reels')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('balance')).toHaveText('9,980');
  await expect(page.locator('.bonus-condition')).toContainText('23 FREE SPINS');
});

test('autoplay finishes at its selected limit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable quick spin', exact: true }).click();
  await page.getByRole('button', { name: 'AUTO SPIN', exact: true }).click();
  await page.getByRole('menuitem', { name: '10 spins', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop autoplay', exact: true })).toHaveCount(0, { timeout: 15000 });
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).history.length, STORAGE_KEY)).toBe(10);
});
