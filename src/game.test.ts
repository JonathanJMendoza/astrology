import test from 'node:test';
import assert from 'node:assert/strict';
import { Random, MersenneTwister19937 } from 'random-js';
import { BETS, BONUS_DECK, DENOMINATIONS, INITIAL_BOARD, PAYLINES, SYMBOLS, TIERS, ZODIAC, chooseBonus, collectBonus, drawBoard, drawBonusDeck, drawSymbol, evaluateBoard, evaluateLine, newSession, restoreSession, settleSpin, type Board, type SymbolId } from './game';
import { MOON_WEIGHT, SIGN_PAYS, TOTAL_WEIGHT, WILD_PAYS, WILD_WEIGHT, ZODIAC_WEIGHT } from './rules';
import { analyzeRtp } from '../scripts/rtp';

const moonBoard: Board = Array.from({ length: 5 }, () => ['moon', 'moon', 'moon']);
const sunBoard: Board = Array.from({ length: 5 }, () => ['sun', 'sun', 'sun']);
const fixedDeck = () => [...BONUS_DECK];
const centerLine = (symbols: SymbolId[]): Board => symbols.map(symbol => ['moon', symbol, 'moon']);

test('all 12 signs occupy equal, reachable weighted intervals', () => {
  assert.equal(ZODIAC.length, 12);
  assert.equal(new Set(ZODIAC.map(s => s.id)).size, 12);
  let offset = 0;
  for (const symbol of SYMBOLS) {
    assert.equal(drawSymbol(() => offset + 1), symbol.id);
    assert.equal(drawSymbol(() => offset + symbol.weight), symbol.id);
    offset += symbol.weight;
  }
  assert.equal(offset, TOTAL_WEIGHT);
  for (const invalid of [0, -1, TOTAL_WEIGHT + 1, NaN]) assert.throws(() => drawSymbol(() => invalid));
});

test('real cryptographic draws return a valid five-by-three board', () => {
  const board = drawBoard();
  assert.equal(board.length, 5);
  for (const column of board) {
    assert.equal(column.length, 3);
    assert.ok(column.every(id => SYMBOLS.some(symbol => symbol.id === id)));
  }
});

test('every sign pays at 3, 4, and 5 matches; wilds substitute', () => {
  for (const sign of ZODIAC) for (const length of [3, 4, 5]) {
    const line: SymbolId[] = Array.from({ length: 5 }, (_, i) => i < length ? sign.id : 'moon');
    line[1] = 'sun';
    assert.equal(evaluateLine(line)?.payout, SIGN_PAYS[length - 3]);
  }
  assert.deepEqual(evaluateLine(['sun', 'sun', 'sun', 'moon', 'aries']), { symbol: 'sun', count: 3, payout: 50 });
  assert.equal(evaluateLine(['taurus', 'aries', 'aries', 'aries', 'aries']), undefined);
  assert.equal(evaluateLine(['aries', 'sun', 'moon', 'aries', 'aries']), undefined);
});

test('all ten paylines pay once and all-wilds pay 1000x total bet', () => {
  assert.equal(evaluateBoard(sunBoard, 100).payout, 100000);
  assert.equal(evaluateBoard(sunBoard, 100).wins.length, 10);
  PAYLINES.forEach((rows, line) => {
    const board: Board = Array.from({ length: 5 }, (_, reel) => Array.from({ length: 3 }, (_, row) => rows[reel] === row ? 'aquarius' : 'moon'));
    assert.deepEqual(evaluateBoard(board, 50).wins.find(win => win.line === line), { line, symbol: 'aquarius', count: 5, payout: 2500 });
  });
});

test('all 40 wager and denomination combinations debit and pay exact integer cents', () => {
  for (const bet of BETS) for (const denomination of DENOMINATIONS) {
    const session = { ...newSession(), bet, denomination };
    const settled = settleSpin(session, sunBoard);
    assert.equal(settled.session.balance, session.balance - bet * denomination + 1000 * bet * denomination);
    assert.ok(Number.isSafeInteger(settled.session.balance));
    assert.equal(settled.record.denomination, denomination);
    assert.equal(session.balance, 1000000);
    const line = settleSpin(session, centerLine(['aries', 'aries', 'sun', 'moon', 'moon']), 1, fixedDeck);
    assert.ok(Number.isSafeInteger(line.session.balance));
  }
  assert.throws(() => settleSpin({ ...newSession(), balance: 99 }, INITIAL_BOARD), /Not enough/);
});

test('scatter awards include one sign pick and the correct number of free spins', () => {
  for (const [count, award] of [[0, 0], [2, 0], [3, 5], [4, 8], [5, 12], [15, 12]]) {
    const board: Board = Array.from({ length: 5 }, (_, reel) => Array.from({ length: 3 }, (_, row) => reel * 3 + row < count ? 'moon' : 'sun'));
    const result = settleSpin(newSession(), board, count, fixedDeck);
    assert.equal(result.record.awardedSpins, award);
    assert.equal(!!result.session.bonus, award > 0);
  }
});

test('bonus deck preserves six Mini, four Minor, one Major, and one Grand', () => {
  const variants = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const deck = drawBonusDeck();
    assert.deepEqual([...deck].sort(), [...BONUS_DECK].sort());
    variants.add(deck.join());
  }
  assert.ok(variants.size > 1);
});

test('each of the 12 sign choices pays its saved tier once, including after reload', () => {
  for (const [index, sign] of ZODIAC.entries()) {
    const pending = settleSpin({ ...newSession(), denomination: 200 }, moonBoard, 123, fixedDeck).session;
    assert.throws(() => settleSpin(pending, INITIAL_BOARD), /Finish the celestial/);
    assert.equal(collectBonus(pending), pending);
    const restored = restoreSession(JSON.stringify(pending));
    assert.deepEqual(restored, pending);
    const chosen = chooseBonus(restored, sign.id);
    const expected = TIERS[BONUS_DECK[index]].multiplier * pending.bet * pending.denomination;
    assert.equal(chosen.balance, pending.balance + expected);
    assert.equal(chosen.history[0].bonus?.tier, BONUS_DECK[index]);
    assert.deepEqual(restoreSession(JSON.stringify(chosen)), chosen);
    assert.equal(chooseBonus(chosen, 'aries'), chosen);
    const collected = collectBonus(chosen);
    assert.equal(collected.bonus, null);
    assert.equal(collected.balance, chosen.balance);
    assert.equal(chooseBonus(collected, sign.id), collected);
  }
});

test('free spins keep original credits and denomination and can retrigger', () => {
  let session = settleSpin({ ...newSession(), bet: 150, denomination: 25 }, moonBoard, 1, fixedDeck).session;
  session = collectBonus(chooseBonus(session, 'aries'));
  session = { ...session, bet: 250, denomination: 200 };
  const result = settleSpin(session, moonBoard, 2, fixedDeck);
  assert.equal(result.record.free, true);
  assert.equal(result.record.bet, 150);
  assert.equal(result.record.denomination, 25);
  assert.equal(result.session.balance, session.balance);
  assert.equal(result.session.freeSpins, 23);
});

test('migration preserves legacy wallet, free wager, and historical payouts', () => {
  const record = { ...settleSpin(newSession(), INITIAL_BOARD, 1).record, bet: 20, payout: 97 };
  const legacy = { version: 1, balance: 12345, bet: 20, bonusBet: 20, freeSpins: 3, history: [record] };
  const migrated = restoreSession(JSON.stringify(legacy));
  assert.equal(migrated.version, 2);
  assert.equal(migrated.balance, 12345);
  assert.equal(migrated.bet, 50);
  assert.equal(migrated.bonusBet, 20);
  assert.equal(migrated.bonusDenomination, 1);
  assert.equal(migrated.history[0].payout, 97);
});

test('corrupt sessions are rejected and history remains bounded', () => {
  for (const data of ['broken', 'null', '{}', JSON.stringify({ ...newSession(), denomination: 3 }), JSON.stringify({ ...newSession(), balance: -1 })]) {
    assert.deepEqual(restoreSession(data), newSession());
  }
  let session = newSession();
  for (let i = 0; i < 35; i++) session = settleSpin(session, INITIAL_BOARD, i).session;
  assert.equal(session.history.length, 30);
  assert.deepEqual(restoreSession(JSON.stringify(session)), session);
});

test('analytical RTP is 98.00% including all bonuses and recursive free spins', () => {
  const math = analyzeRtp();
  assert.equal(math.enumeratedLines, 14 ** 5);
  assert.ok(Math.abs(math.rtp - .98) < 1e-9);
  const difference = math.numerator * 50n - math.denominator * 49n;
  assert.ok((difference < 0n ? -difference : difference) * 1_000_000_000n < math.denominator * 50n);
  assert.ok(math.expectedFreeSpins < 1);
  assert.equal(math.bonusMean, 152 / 12);
  // Independently derive line expectation by the initial wild run and its first non-wild.
  const q = ZODIAC_WEIGHT / TOTAL_WEIGHT, w = WILD_WEIGHT / TOTAL_WEIGHT, m = MOON_WEIGHT / TOTAL_WEIGHT;
  let expectation = w ** 5 * 1000;
  for (let wilds = 0; wilds < 5; wilds++) {
    const wildPay = wilds >= 3 ? WILD_PAYS[wilds - 3] : 0;
    expectation += w ** wilds * m * wildPay;
    for (let length = wilds + 1; length <= 5; length++) {
      const payout = Math.max(wildPay, length >= 3 ? SIGN_PAYS[length - 3] : 0);
      expectation += w ** wilds * 12 * q * (q + w) ** (length - wilds - 1) * (length === 5 ? 1 : 1 - q - w) * payout;
    }
  }
  assert.ok(Math.abs(math.lineReturn - expectation) < 1e-12);
});

test('seeded random draws exercise all 14 symbols and all session settlement paths', () => {
  const rng = new Random(MersenneTwister19937.seed(20261026));
  const integer = (min: number, max: number) => rng.integer(min, max);
  const seen = new Set<SymbolId>();
  let session = { ...newSession(), balance: 100000000 };
  let bonuses = 0;
  for (let i = 0; i < 2000; i++) {
    const board = drawBoard(integer);
    board.flat().forEach(id => seen.add(id));
    const before = session.balance;
    const { record, session: next } = settleSpin(session, board, i, fixedDeck);
    assert.equal(next.balance, before - (record.free ? 0 : record.bet * record.denomination) + record.payout * record.denomination);
    session = next;
    if (session.bonus) { bonuses++; session = collectBonus(chooseBonus(session, ZODIAC[i % 12].id)); }
  }
  assert.equal(seen.size, 14);
  assert.ok(bonuses > 0);
});
