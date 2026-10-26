import test from 'node:test';
import assert from 'node:assert/strict';
import { Random, MersenneTwister19937 } from 'random-js';
import { BETS, DENOMINATIONS, INITIAL_BOARD, PAYLINES, SYMBOLS, TIERS, ZODIAC, chooseBonus, collectBonus, drawBoard, drawBonusDeck, drawSymbol, evaluateBoard, evaluateLine, newBonusDemo, newSession, restoreSession, revealBonusStar, settleSpin, type Board, type SymbolId, type TierId } from './game';
import { LEGACY_BONUS_DECK, MATCH_TIERS, MOON_WEIGHT, SIGN_PAYS, TOTAL_WEIGHT, WILD_PAYS, WILD_WEIGHT, ZODIAC_WEIGHT } from './rules';
import { analyzeRtp, analyzeStarMatch } from '../scripts/rtp';
import { CONSTELLATIONS, MAX_CONSTELLATION_STARS } from './constellations';

const moonBoard: Board = Array.from({ length: 5 }, () => ['moon', 'moon', 'moon']);
const sunBoard: Board = Array.from({ length: 5 }, () => ['sun', 'sun', 'sun']);
const fixedDeck = (): TierId[] => Array.from({ length: MAX_CONSTELLATION_STARS }, (_, i) => (['mini', 'minor', 'major', 'mini', 'minor', 'major', 'major'] as const)[i % 7]);
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

test('all twenty unique paylines pay once and all-wilds pay 1000x total bet', () => {
  assert.equal(PAYLINES.length, 20);
  assert.equal(new Set(PAYLINES.map(line => line.join())).size, 20);
  for (const line of PAYLINES) {
    assert.equal(line.length, 5);
    assert.ok(line.every(row => row >= 0 && row <= 2));
  }
  assert.equal(evaluateBoard(sunBoard, 100).payout, 100000);
  assert.equal(evaluateBoard(sunBoard, 100).wins.length, 20);
  PAYLINES.forEach((rows, line) => {
    const board: Board = Array.from({ length: 5 }, (_, reel) => Array.from({ length: 3 }, (_, row) => rows[reel] === row ? 'aquarius' : 'moon'));
    assert.deepEqual(evaluateBoard(board, 50).wins.find(win => win.line === line), { line, symbol: 'aquarius', count: 5, payout: 1250 });
  });
});

test('all line awards remain integer credits at every supported wager and denomination', () => {
  for (const bet of [...BETS, 10, 20]) for (const denomination of DENOMINATIONS) {
    for (const symbol of SYMBOLS) for (const payout of symbol.pays) {
      const credits = payout * bet / PAYLINES.length;
      assert.ok(Number.isSafeInteger(credits));
      assert.ok(Number.isSafeInteger(credits * denomination));
    }
  }
});

test('new line wins reload correctly and old ten-line settlements keep their payouts', () => {
  const current = settleSpin(newSession(), sunBoard, 123).session;
  assert.equal(current.history[0].wins.at(-1)?.line, 19);
  assert.deepEqual(restoreSession(JSON.stringify(current)), current);
  const old = { ...current, history: [{ ...current.history[0], wins: current.history[0].wins.slice(0, 10).map(win => ({ ...win, payout: win.payout * 2 })) }] };
  assert.deepEqual(restoreSession(JSON.stringify(old)), old);
});

test('bonus demos use normal awards without creating a wager, history or free spins', () => {
  for (const bet of BETS) for (const denomination of DENOMINATIONS) for (const tier of MATCH_TIERS) {
    const original = newBonusDemo(bet, denomination, () => Array(MAX_CONSTELLATION_STARS).fill(tier));
    let played = chooseBonus(original, 'leo');
    assert.equal(played.balance, 0);
    for (let index = 0; index < 3; index++) played = revealBonusStar(played, index);
    assert.equal(played.bonus?.winner, tier);
    assert.equal(played.balance, bet * denomination * TIERS[tier].multiplier);
    assert.equal(revealBonusStar(played, 3), played);
    assert.equal(played.freeSpins, 0);
    assert.deepEqual(played.history, []);
    assert.equal(original.bonus?.selectedSign, null);
    assert.equal(original.balance, 0);
    assert.equal(newBonusDemo(bet, denomination, fixedDeck).bonus?.winner, null);
  }
  assert.throws(() => newBonusDemo(0, 1));
  assert.throws(() => newBonusDemo(100, 3));
  assert.throws(() => newBonusDemo(100, 1, () => []));
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

test('star rewards use independent weighted draws and every constellation has at least seven stars', () => {
  for (const [ticket, expected] of [[1, 'mini'], [3, 'mini'], [4, 'minor'], [5, 'minor'], [6, 'major']] as const) {
    assert.ok(drawBonusDeck(() => ticket).every(tier => tier === expected));
  }
  assert.throws(() => drawBonusDeck(() => 0));
  for (const chart of Object.values(CONSTELLATIONS)) assert.ok(chart.stars.length >= 7);
  assert.equal(new Set(Object.values(CONSTELLATIONS).map(chart => JSON.stringify(chart.stars))).size, 12);
  const variants = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const deck = drawBonusDeck();
    assert.equal(deck.length, MAX_CONSTELLATION_STARS);
    assert.ok(deck.every(tier => MATCH_TIERS.includes(tier as typeof MATCH_TIERS[number])));
    variants.add(deck.join());
  }
  assert.ok(variants.size > 1);
});

test('all 12 constellations pay only on a third match and survive reload between every pick', () => {
  for (const sign of ZODIAC) {
    const pending = settleSpin({ ...newSession(), denomination: 200 }, moonBoard, 123, fixedDeck).session;
    assert.throws(() => settleSpin(pending, INITIAL_BOARD), /Finish the celestial/);
    assert.equal(collectBonus(pending), pending);
    const restored = restoreSession(JSON.stringify(pending));
    assert.deepEqual(restored, pending);
    let chosen = chooseBonus(restored, sign.id);
    assert.equal(chosen.balance, pending.balance);
    assert.equal(collectBonus(chosen), chosen);
    assert.equal(chooseBonus(chosen, 'aries'), chosen);
    for (let i = 0; i < 7; i++) {
      chosen = revealBonusStar(chosen, i);
      assert.equal(chosen.balance, pending.balance + (i === 6 ? 20 * pending.bet * pending.denomination : 0));
      assert.deepEqual(restoreSession(JSON.stringify(chosen)), chosen);
      assert.equal(revealBonusStar(chosen, i), chosen);
    }
    assert.equal(chosen.history[0].bonus?.tier, 'major');
    assert.deepEqual(restoreSession(JSON.stringify(chosen)), chosen);
    assert.equal(revealBonusStar(chosen, 7), chosen);
    const collected = collectBonus(chosen);
    assert.equal(collected.bonus, null);
    assert.equal(collected.balance, chosen.balance);
    assert.equal(chooseBonus(collected, sign.id), collected);
  }
});

test('first match wins, invalid clicks do nothing, and any tier can pay', () => {
  for (const tier of MATCH_TIERS) {
    let session = settleSpin(newSession(), moonBoard, 1, () => Array(MAX_CONSTELLATION_STARS).fill(tier)).session;
    assert.equal(revealBonusStar(session, 0), session);
    session = chooseBonus(session, 'aries');
    for (const invalid of [-1, 1.5, NaN, 99]) assert.equal(revealBonusStar(session, invalid), session);
    for (let i = 0; i < 3; i++) session = revealBonusStar(session, i);
    assert.equal(session.bonus?.winner, tier);
    const balance = session.balance;
    for (let i = 0; i < 7; i++) session = revealBonusStar(session, i);
    assert.equal(session.balance, balance);
  }
});

test('free spins keep original credits and denomination and can retrigger', () => {
  let session = settleSpin({ ...newSession(), bet: 150, denomination: 25 }, moonBoard, 1, fixedDeck).session;
  session = chooseBonus(session, 'aries');
  for (let i = 0; i < 7; i++) session = revealBonusStar(session, i);
  session = collectBonus(session);
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
  assert.equal(migrated.version, 3);
  assert.equal(migrated.balance, 12345);
  assert.equal(migrated.bet, 50);
  assert.equal(migrated.bonusBet, 20);
  assert.equal(migrated.bonusDenomination, 1);
  assert.equal(migrated.history[0].payout, 97);
});

test('unfinished version-2 picks retain their original rewards during migration', () => {
  const initial = settleSpin(newSession(), moonBoard, 99, fixedDeck).session;
  const oldBonus = { spinId: initial.history[0].id, bet: 100, denomination: 1, prizes: [...LEGACY_BONUS_DECK], selectedSign: null };
  const old = { ...initial, version: 2, bonus: oldBonus };
  const restored = restoreSession(JSON.stringify(old));
  assert.equal(restored.bonus?.mode, 'legacy');
  const paid = chooseBonus(restored, 'pisces');
  assert.equal(paid.balance, initial.balance + 10000);
  assert.equal(paid.bonus?.winner, 'grand');
  assert.deepEqual(restoreSession(JSON.stringify(paid)), paid);
  assert.equal(chooseBonus(paid, 'pisces'), paid);
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
  assert.equal(math.bonusMean, 1141776 / 279936);
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

test('enumerating all 6^7 star-ticket sequences verifies match-three win probabilities', () => {
  const winners = { mini: 0n, minor: 0n, major: 0n };
  for (let sequence = 0; sequence < 6 ** 7; sequence++) {
    const counts = { mini: 0, minor: 0, major: 0 };
    let remainder = sequence;
    for (let pick = 0; pick < 7; pick++) {
      const ticket = remainder % 6;
      remainder = Math.floor(remainder / 6);
      const tier = ticket < 3 ? 'mini' : ticket < 5 ? 'minor' : 'major';
      if (++counts[tier] === 3) { winners[tier]++; break; }
    }
  }
  assert.deepEqual(winners, analyzeStarMatch().winners);
  assert.equal(winners.mini + winners.minor + winners.major, 279936n);
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
    if (session.bonus) {
      bonuses++; session = chooseBonus(session, ZODIAC[i % 12].id);
      for (let star = 0; star < 7; star++) session = revealBonusStar(session, star);
      session = collectBonus(session);
    }
  }
  assert.equal(seen.size, 14);
  assert.ok(bonuses > 0);
});
