import { Random, browserCrypto } from 'random-js';
import { BETS, BONUS_DECK, DENOMINATIONS, MOON_WEIGHT, REFILL_CENTS, SIGN_PAYS, TIERS, TOTAL_WEIGHT, WILD_PAYS, WILD_WEIGHT, ZODIAC, ZODIAC_WEIGHT, freeSpinAward, type TierId, type ZodiacId } from './rules';
export { BETS, BONUS_DECK, DENOMINATIONS, REFILL_CENTS, TIERS, ZODIAC } from './rules';
export type { TierId, ZodiacId } from './rules';

export const SYMBOLS = [
  ...ZODIAC.map(sign => ({ ...sign, weight: ZODIAC_WEIGHT, pays: SIGN_PAYS })),
  { id: 'sun', name: 'Sun', element: 'Wild', color: '#f1ce82', weight: WILD_WEIGHT, pays: WILD_PAYS },
  { id: 'moon', name: 'Moon', element: 'Scatter', color: '#b9d1e1', weight: MOON_WEIGHT, pays: [0, 0, 0] },
] as const;
export type SymbolId = ZodiacId | 'sun' | 'moon';
export type Board = SymbolId[][];
export const PAYLINES = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
] as const;
export const INITIAL_BOARD: Board = [
  ['aries', 'leo', 'gemini'], ['cancer', 'pisces', 'virgo'],
  ['libra', 'sun', 'scorpio'], ['sagittarius', 'capricorn', 'moon'], ['taurus', 'aquarius', 'libra'],
];
export interface LineWin { line: number; symbol: SymbolId; count: number; payout: number; }
export interface Outcome { wins: LineWin[]; payout: number; scatters: number; awardedSpins: number; }
export interface BonusAward { sign: ZodiacId; tier: TierId; payout: number; }
export interface SpinRecord extends Outcome { id: string; time: number; board: Board; bet: number; denomination: number; free: boolean; bonus?: BonusAward; }
export interface PendingBonus { spinId: string; bet: number; denomination: number; prizes: TierId[]; selectedSign: ZodiacId | null; }
export interface Session {
  version: 2;
  balance: number; // Integer virtual cents; denomination changes preserve the wallet's value.
  bet: number;
  denomination: number;
  freeSpins: number;
  bonusBet: number;
  bonusDenomination: number;
  bonus: PendingBonus | null;
  history: SpinRecord[];
}
export const STORAGE_KEY = 'astral-fortune.session.v2';
export const LEGACY_STORAGE_KEY = 'astral-fortune.session.v1';
export const newSession = (): Session => ({ version: 2, balance: REFILL_CENTS, bet: 100, denomination: 1, freeSpins: 0, bonusBet: 100, bonusDenomination: 1, bonus: null, history: [] });
export const totalWin = (record?: SpinRecord | null) => record ? record.payout + (record.bonus?.payout ?? 0) : 0;
export const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const random = new Random(browserCrypto);
export type IntegerRandom = (min: number, max: number) => number;
export const integerRandom: IntegerRandom = (min, max) => random.integer(min, max);

export function drawSymbol(integer: IntegerRandom = integerRandom): SymbolId {
  let ticket = integer(1, TOTAL_WEIGHT);
  if (!Number.isInteger(ticket) || ticket < 1 || ticket > TOTAL_WEIGHT) throw new RangeError('Invalid random ticket.');
  for (const symbol of SYMBOLS) {
    ticket -= symbol.weight;
    if (ticket <= 0) return symbol.id;
  }
  throw new RangeError('Symbol distribution does not sum to the ticket range.');
}
export function drawBoard(integer: IntegerRandom = integerRandom): Board {
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => drawSymbol(integer)));
}
export function drawBonusDeck(): TierId[] { return random.shuffle([...BONUS_DECK]); }

export function evaluateLine(line: readonly SymbolId[]): Omit<LineWin, 'line'> | undefined {
  let best: Omit<LineWin, 'line'> | undefined;
  for (const symbol of SYMBOLS) {
    if (symbol.id === 'moon') continue;
    let count = 0;
    for (const cell of line) {
      if (cell === symbol.id || (symbol.id !== 'sun' && cell === 'sun')) count++;
      else break;
    }
    if (count < 3) continue;
    const payout = symbol.pays[count - 3];
    if (!best || payout > best.payout || (payout === best.payout && symbol.id === 'sun')) best = { symbol: symbol.id, count, payout };
  }
  return best;
}
export function evaluateBoard(board: Board, bet: number): Outcome {
  const wins: LineWin[] = [];
  PAYLINES.forEach((rows, line) => {
    const win = evaluateLine(rows.map((row, reel) => board[reel][row]));
    if (win) wins.push({ ...win, line, payout: win.payout * bet / PAYLINES.length });
  });
  const scatters = board.flat().filter(id => id === 'moon').length;
  return { wins, payout: wins.reduce((sum, win) => sum + win.payout, 0), scatters, awardedSpins: freeSpinAward(scatters) };
}
export function settleSpin(session: Session, board: Board, now = Date.now(), deckFactory = drawBonusDeck): { session: Session; record: SpinRecord } {
  if (session.bonus) throw new Error('Finish the celestial bonus first.');
  const free = session.freeSpins > 0;
  const bet = free ? session.bonusBet : session.bet;
  const denomination = free ? session.bonusDenomination : session.denomination;
  const cost = free ? 0 : bet * denomination;
  if (session.balance < cost) throw new Error('Not enough credits.');
  const outcome = evaluateBoard(board, bet);
  const record: SpinRecord = { ...outcome, id: `${now}-${(session.history[0]?.time ?? 0) + 1}`, time: now, board, bet, denomination, free };
  const bonus: PendingBonus | null = outcome.awardedSpins ? { spinId: record.id, bet, denomination, prizes: deckFactory(), selectedSign: null } : null;
  if (bonus && !validDeck(bonus.prizes)) throw new Error('Invalid bonus deck.');
  return { record, session: { ...session, balance: session.balance - cost + outcome.payout * denomination,
    freeSpins: Math.max(0, session.freeSpins - 1) + outcome.awardedSpins,
    bonusBet: bet, bonusDenomination: denomination, bonus, history: [record, ...session.history].slice(0, 30) } };
}
export function chooseBonus(session: Session, sign: ZodiacId): Session {
  const bonus = session.bonus;
  const index = ZODIAC.findIndex(item => item.id === sign);
  if (!bonus || bonus.selectedSign || index < 0) return session;
  const tier = bonus.prizes[index];
  const payout = bonus.bet * TIERS[tier].multiplier;
  return { ...session, balance: session.balance + payout * bonus.denomination,
    bonus: { ...bonus, selectedSign: sign },
    history: session.history.map(record => record.id === bonus.spinId ? { ...record, bonus: { tier, sign, payout } } : record) };
}
export function collectBonus(session: Session): Session {
  return session.bonus?.selectedSign ? { ...session, bonus: null } : session;
}

const isAmount = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const validBet = (n: unknown) => typeof n === 'number' && [...BETS, 10, 20].includes(n);
const validDenom = (n: unknown) => DENOMINATIONS.includes(n as typeof DENOMINATIONS[number]);
const validBoard = (board: unknown): board is Board => Array.isArray(board) && board.length === 5 && board.every(reel =>
  Array.isArray(reel) && reel.length === 3 && reel.every(id => SYMBOLS.some(s => s.id === id)));
const validDeck = (deck: unknown): deck is TierId[] => Array.isArray(deck) && deck.length === 12 && [...deck].sort().join() === [...BONUS_DECK].sort().join();

export function restoreSession(serialized: string | null): Session {
  try {
    const raw = JSON.parse(serialized ?? 'null');
    if (!raw || ![1, 2].includes(raw.version) || !isAmount(raw.balance) || raw.balance > 1e12 ||
      !validBet(raw.bet) || !isAmount(raw.freeSpins) || raw.freeSpins > 10000 || !validBet(raw.bonusBet) || !Array.isArray(raw.history)) return newSession();
    const legacy = raw.version === 1;
    const data: Session = legacy ? { ...raw, version: 2, bet: BETS.find(bet => bet >= raw.bet) ?? 250, denomination: 1, bonusDenomination: 1, bonus: null } : raw;
    if (!BETS.includes(data.bet as typeof BETS[number]) || !validDenom(data.denomination) || !validDenom(data.bonusDenomination)) return newSession();
    const history: SpinRecord[] = raw.history.slice(0, 30).filter((r: SpinRecord) => r && validBoard(r.board) && typeof r.id === 'string' &&
      isAmount(r.time) && validBet(r.bet) && typeof r.free === 'boolean' && isAmount(r.payout) && isAmount(r.scatters) && isAmount(r.awardedSpins) &&
      Array.isArray(r.wins) && r.wins.every(w => w && Number.isInteger(w.line) && w.line >= 0 && w.line < 10 &&
        Number.isInteger(w.count) && w.count >= 3 && w.count <= 5 && isAmount(w.payout) && SYMBOLS.some(s => s.id === w.symbol)) &&
      (legacy || validDenom(r.denomination)) && (!r.bonus || (ZODIAC.some(s => s.id === r.bonus!.sign) &&
        Object.hasOwn(TIERS, r.bonus.tier) && r.bonus.payout === TIERS[r.bonus.tier].multiplier * r.bet)))
      .map((r: SpinRecord) => ({ ...r, denomination: legacy ? 1 : r.denomination }));
    if (data.bonus) {
      const b = data.bonus;
      const record = history.find(r => r.id === b.spinId);
      if (!validDeck(b.prizes) || !validBet(b.bet) || !validDenom(b.denomination) || !record || !record.awardedSpins ||
        record.bet !== b.bet || record.denomination !== b.denomination) return newSession();
      if (b.selectedSign !== null) {
        const index = ZODIAC.findIndex(s => s.id === b.selectedSign);
        if (index < 0 || record.bonus?.sign !== b.selectedSign || record.bonus.tier !== b.prizes[index]) return newSession();
      } else if (record.bonus) return newSession();
    }
    return { version: 2, balance: data.balance, bet: data.bet, denomination: data.denomination, freeSpins: data.freeSpins,
      bonusBet: data.bonusBet, bonusDenomination: data.bonusDenomination, bonus: data.bonus ?? null, history };
  } catch { return newSession(); }
}
