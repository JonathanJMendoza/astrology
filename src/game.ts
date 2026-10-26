import { Random, browserCrypto } from 'random-js';

export const SYMBOLS = [
  { id: 'aries', name: 'Aries', element: 'Fire', color: '#ed9b85', weight: 18, pays: [15, 40, 120] },
  { id: 'taurus', name: 'Taurus', element: 'Earth', color: '#98c7aa', weight: 17, pays: [20, 60, 150] },
  { id: 'gemini', name: 'Gemini', element: 'Air', color: '#b7aadf', weight: 16, pays: [25, 80, 200] },
  { id: 'libra', name: 'Libra', element: 'Air', color: '#90c4d7', weight: 15, pays: [30, 100, 300] },
  { id: 'leo', name: 'Leo', element: 'Fire', color: '#e9c17c', weight: 14, pays: [40, 150, 400] },
  { id: 'pisces', name: 'Pisces', element: 'Water', color: '#e6a4bb', weight: 12, pays: [50, 200, 600] },
  { id: 'sun', name: 'Sun', element: 'Wild', color: '#f1ce82', weight: 3, pays: [50, 250, 1000] },
  { id: 'moon', name: 'Moon', element: 'Scatter', color: '#b9d1e1', weight: 4, pays: [0, 0, 0] },
] as const;

export type SymbolId = typeof SYMBOLS[number]['id'];
export type Board = SymbolId[][];
export const BETS = [10, 20, 50, 100, 200] as const;
export const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
] as const;
export const INITIAL_BOARD: Board = [
  ['aries', 'leo', 'gemini'], ['moon', 'pisces', 'taurus'],
  ['libra', 'sun', 'aries'], ['gemini', 'pisces', 'moon'], ['taurus', 'leo', 'libra'],
];

export interface LineWin { line: number; symbol: SymbolId; count: number; payout: number; }
export interface Outcome { wins: LineWin[]; payout: number; scatters: number; awardedSpins: number; }
export interface SpinRecord extends Outcome { id: string; time: number; board: Board; bet: number; free: boolean; }
export interface Session {
  version: 1;
  balance: number;
  bet: number;
  freeSpins: number;
  bonusBet: number;
  history: SpinRecord[];
}
export const STORAGE_KEY = 'astral-fortune.session.v1';
export const newSession = (): Session => ({ version: 1, balance: 10000, bet: 20, freeSpins: 0, bonusBet: 20, history: [] });

const random = new Random(browserCrypto);
const weightTotal = SYMBOLS.reduce((total, symbol) => total + symbol.weight, 0);

export function drawSymbol(integer = (min: number, max: number) => random.integer(min, max)): SymbolId {
  let ticket = integer(1, weightTotal);
  for (const symbol of SYMBOLS) {
    ticket -= symbol.weight;
    if (ticket <= 0) return symbol.id;
  }
  throw new RangeError('Random draw is outside the symbol distribution.');
}

export function drawBoard(): Board {
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => drawSymbol()));
}

export function evaluateBoard(board: Board, bet: number): Outcome {
  const wins: LineWin[] = [];
  for (const [lineIndex, rows] of PAYLINES.entries()) {
    const line = rows.map((row, reel) => board[reel][row]);
    let best: LineWin | undefined;
    // A leading wild run can pay more by itself than a longer substituted match.
    for (const symbol of SYMBOLS.filter(s => s.id !== 'moon')) {
      let count = 0;
      for (const cell of line) {
        if (cell === symbol.id || (symbol.id !== 'sun' && cell === 'sun')) count++;
        else break;
      }
      if (count < 3) continue;
      const payout = symbol.pays[count - 3] * (bet / PAYLINES.length);
      if (!best || payout > best.payout || (payout === best.payout && symbol.id === 'sun')) {
        best = { line: lineIndex, symbol: symbol.id, count, payout };
      }
    }
    if (best) wins.push(best);
  }
  const scatters = board.flat().filter(id => id === 'moon').length;
  return {
    wins,
    payout: wins.reduce((sum, win) => sum + win.payout, 0),
    scatters,
    awardedSpins: scatters >= 5 ? 12 : scatters === 4 ? 8 : scatters === 3 ? 5 : 0,
  };
}

export function settleSpin(session: Session, board: Board, now = Date.now()): { session: Session; record: SpinRecord } {
  const free = session.freeSpins > 0;
  const bet = free ? session.bonusBet : session.bet;
  if (!free && session.balance < bet) throw new Error('Not enough credits.');
  const outcome = evaluateBoard(board, bet);
  const record: SpinRecord = { ...outcome, id: `${now}-${session.history[0]?.id.slice(0, 8) ?? 'first'}`, time: now, board, bet, free };
  return {
    record,
    session: {
      ...session,
      balance: session.balance - (free ? 0 : bet) + outcome.payout,
      freeSpins: Math.max(0, session.freeSpins - 1) + outcome.awardedSpins,
      bonusBet: free ? session.bonusBet : bet,
      history: [record, ...session.history].slice(0, 30),
    },
  };
}

const isAmount = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const isBoard = (board: unknown): board is Board => Array.isArray(board) && board.length === 5 &&
  board.every(reel => Array.isArray(reel) && reel.length === 3 && reel.every(id => SYMBOLS.some(s => s.id === id)));

export function restoreSession(serialized: string | null): Session {
  try {
    const data: Session = JSON.parse(serialized ?? 'null');
    if (!data || data.version !== 1 || !isAmount(data.balance) || data.balance > 1e12 ||
      !BETS.includes(data.bet as typeof BETS[number]) || !isAmount(data.freeSpins) || data.freeSpins > 10000 ||
      !BETS.includes(data.bonusBet as typeof BETS[number]) || !Array.isArray(data.history)) return newSession();
    const history = data.history.slice(0, 30).filter(record => record && isBoard(record.board) &&
      typeof record.id === 'string' && isAmount(record.time) && typeof record.free === 'boolean' &&
      BETS.includes(record.bet as typeof BETS[number])).map(record => ({
        id: record.id, time: record.time, free: record.free, bet: record.bet, board: record.board,
        ...evaluateBoard(record.board, record.bet),
      }));
    return { version: 1, balance: data.balance, bet: data.bet, freeSpins: data.freeSpins, bonusBet: data.bonusBet, history };
  } catch { return newSession(); }
}
