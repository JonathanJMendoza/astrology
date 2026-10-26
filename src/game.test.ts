import test from 'node:test';
import assert from 'node:assert/strict';
import { BETS, INITIAL_BOARD, PAYLINES, SYMBOLS, drawBoard, drawSymbol, evaluateBoard, newSession, restoreSession, settleSpin, type Board, type SymbolId } from './game';

function centerLine(symbols: SymbolId[]): Board {
  return symbols.map(symbol => ['moon', symbol, 'moon']);
}

test('weighted symbol tickets match the configured distribution exactly', () => {
  const counts = new Map<SymbolId, number>();
  const total = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
  for (let ticket = 1; ticket <= total; ticket++) {
    const id = drawSymbol(() => ticket);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const symbol of SYMBOLS) assert.equal(counts.get(symbol.id), symbol.weight);
});

test('real random draws return five valid three-row reels', () => {
  const board = drawBoard();
  assert.equal(board.length, 5);
  for (const column of board) {
    assert.equal(column.length, 3);
    assert.ok(column.every(id => SYMBOLS.some(symbol => symbol.id === id)));
  }
});

test('all ten paylines pay at most once; five wilds pay the maximum', () => {
  const board: Board = Array.from({ length: 5 }, () => ['sun', 'sun', 'sun']);
  const result = evaluateBoard(board, 20);
  assert.equal(result.wins.length, 10);
  assert.equal(result.payout, 20000);
  assert.ok(result.wins.every(win => win.symbol === 'sun' && win.count === 5));
});

test('wilds substitute and line payouts scale with the selected bet', () => {
  const board = centerLine(['leo', 'sun', 'leo', 'leo', 'taurus']);
  for (const bet of BETS) {
    const result = evaluateBoard(board, bet);
    assert.deepEqual(result.wins, [{ line: 0, symbol: 'leo', count: 4, payout: 150 * bet / 10 }]);
  }
});

test('higher-paying leading wild match wins over a longer substitution', () => {
  const result = evaluateBoard(centerLine(['sun', 'sun', 'sun', 'aries', 'taurus']), 10);
  assert.deepEqual(result.wins, [{ line: 0, symbol: 'sun', count: 3, payout: 50 }]);
});

test('matches must start at the leftmost reel and stop at a scatter', () => {
  assert.equal(evaluateBoard(centerLine(['taurus', 'aries', 'aries', 'aries', 'aries']), 10).payout, 0);
  assert.equal(evaluateBoard(centerLine(['aries', 'sun', 'moon', 'aries', 'aries']), 10).payout, 0);
});

test('every payline recognizes a matching five-symbol path', () => {
  PAYLINES.forEach((rows, line) => {
    const board: Board = Array.from({ length: 5 }, (_, reel) => Array.from({ length: 3 }, (_, row) => rows[reel] === row ? 'pisces' : 'moon'));
    const win = evaluateBoard(board, 10).wins.find(win => win.line === line);
    assert.deepEqual(win, { line, symbol: 'pisces', count: 5, payout: 600 });
  });
});

test('scatters anywhere grant 5, 8, or 12 spins without wild substitution', () => {
  for (const [count, expected] of [[0, 0], [2, 0], [3, 5], [4, 8], [5, 12], [15, 12]]) {
    const board: Board = Array.from({ length: 5 }, (_, reel) => Array.from({ length: 3 }, (_, row) => reel * 3 + row < count ? 'moon' : 'sun'));
    assert.equal(evaluateBoard(board, 10).awardedSpins, expected);
  }
});

test('paid spins debit once and cannot spend an insufficient balance', () => {
  const session = newSession();
  const settled = settleSpin(session, INITIAL_BOARD, 123);
  assert.equal(settled.session.balance, session.balance - session.bet + settled.record.payout);
  assert.equal(session.balance, 10000);
  assert.throws(() => settleSpin({ ...session, balance: 0 }, INITIAL_BOARD), /Not enough/);
});

test('free spins retain the triggering wager, cost nothing, and retrigger', () => {
  const session = { ...newSession(), balance: 0, bet: 200, bonusBet: 20, freeSpins: 2 };
  const board = centerLine(['moon', 'moon', 'moon', 'aries', 'aries']);
  const settled = settleSpin(session, board);
  assert.equal(settled.record.free, true);
  assert.equal(settled.record.bet, 20);
  assert.equal(settled.session.balance, settled.record.payout);
  assert.equal(settled.session.freeSpins, 13);
  assert.equal(settled.session.bonusBet, 20);
});

test('settlement survives restoration and history is limited to 30 spins', () => {
  let session = newSession();
  for (let i = 0; i < 35; i++) session = settleSpin(session, INITIAL_BOARD, i).session;
  assert.equal(session.history.length, 30);
  assert.deepEqual(restoreSession(JSON.stringify(session)), session);
});

test('corrupt persisted data is rejected and malformed history cannot crash the UI', () => {
  for (const data of ['broken', 'null', '{}', JSON.stringify({ ...newSession(), balance: -10 }), JSON.stringify({ ...newSession(), freeSpins: 1.5 })]) {
    assert.deepEqual(restoreSession(data), newSession());
  }
  assert.deepEqual(restoreSession(JSON.stringify({ ...newSession(), history: [null, {}, { board: [] }] })).history, []);
});
