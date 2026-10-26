import { evaluateLine, SYMBOLS, type SymbolId } from '../src/game';
import { MATCH_TIERS, MOON_WEIGHT, STAR_TOTAL_WEIGHT, STAR_WEIGHTS, TIERS, TOTAL_WEIGHT, WILD_WEIGHT, ZODIAC_WEIGHT, freeSpinAward, type MatchTier } from '../src/rules';

export function analyzeStarMatch() {
  const denominator = BigInt(STAR_TOTAL_WEIGHT) ** 7n;
  const winners: Record<MatchTier, bigint> = { mini: 0n, minor: 0n, major: 0n };
  const counts = { mini: 0, minor: 0, major: 0 };
  function visit(depth: number, weight: bigint) {
    for (const tier of MATCH_TIERS) {
      counts[tier]++;
      const nextWeight = weight * BigInt(STAR_WEIGHTS[tier]);
      if (counts[tier] === 3) winners[tier] += nextWeight * BigInt(STAR_TOTAL_WEIGHT) ** BigInt(6 - depth);
      else visit(depth + 1, nextWeight);
      counts[tier]--;
    }
  }
  visit(0, 1n);
  const numerator = MATCH_TIERS.reduce((sum, tier) => sum + winners[tier] * BigInt(TIERS[tier].multiplier), 0n);
  return { numerator, denominator, winners, mean: Number(numerator) / Number(denominator) };
}

export function lineCoefficients() {
  const coefficients = Array.from({ length: 6 }, () => Array<number>(6).fill(0));
  const line: SymbolId[] = [];
  function visit(wilds: number, moons: number) {
    if (line.length === 5) { coefficients[wilds][moons] += evaluateLine(line)?.payout ?? 0; return; }
    for (const symbol of SYMBOLS) {
      line.push(symbol.id);
      visit(wilds + Number(symbol.id === 'sun'), moons + Number(symbol.id === 'moon'));
      line.pop();
    }
  }
  visit(0, 0);
  return coefficients;
}
function choose(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i++) result = result * (n - i + 1) / i;
  return Math.round(result);
}
export function analyzeRtp(coefficients = lineCoefficients(), zodiacWeight = ZODIAC_WEIGHT) {
  const total = BigInt(TOTAL_WEIGHT), moon = BigInt(MOON_WEIGHT), sign = BigInt(zodiacWeight);
  const wild = total - 12n * sign - moon;
  let lineNumerator = 0n;
  for (let w = 0; w <= 5; w++) for (let m = 0; m <= 5 - w; m++) {
    lineNumerator += BigInt(coefficients[w][m]) * wild ** BigInt(w) * moon ** BigInt(m) * sign ** BigInt(5 - w - m);
  }
  const boardDenominator = total ** 15n;
  let triggerNumerator = 0n, freeNumerator = 0n;
  for (let k = 3; k <= 15; k++) {
    const count = BigInt(choose(15, k)) * moon ** BigInt(k) * (total - moon) ** BigInt(15 - k);
    triggerNumerator += count;
    freeNumerator += count * BigInt(freeSpinAward(k));
  }
  const starMatch = analyzeStarMatch();
  const deckSum = starMatch.numerator;
  const deckSize = starMatch.denominator;
  // R = L + P*E[J] + E[F]*R. All terms use exact integer outcome counts.
  const numerator = lineNumerator * total ** 10n * deckSize + triggerNumerator * deckSum;
  const denominator = (boardDenominator - freeNumerator) * deckSize;
  const ratio = (n: bigint, d: bigint) => Number(n) / Number(d);
  return { rtp: ratio(numerator, denominator), houseEdge: 1 - ratio(numerator, denominator),
    lineReturn: ratio(lineNumerator, total ** 5n), bonusTrigger: ratio(triggerNumerator, boardDenominator),
    expectedFreeSpins: ratio(freeNumerator, boardDenominator), bonusMean: Number(deckSum) / Number(deckSize),
    starMatch, numerator, denominator, enumeratedLines: SYMBOLS.length ** 5 };
}
if (process.argv[1]?.endsWith('rtp.ts')) {
  const coefficients = lineCoefficients();
  if (process.argv.includes('--calibrate')) {
    let lo = 1, hi = Math.floor((TOTAL_WEIGHT - MOON_WEIGHT) / 12);
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (analyzeRtp(coefficients, mid).rtp > 0.98) lo = mid + 1; else hi = mid;
    }
    const candidates = [lo - 1, lo].map(weight => ({ weight, ...analyzeRtp(coefficients, weight) }));
    candidates.sort((a, b) => Math.abs(a.rtp - 0.98) - Math.abs(b.rtp - 0.98));
    console.log('Calibrated zodiac weight:', candidates[0].weight, 'RTP:', candidates[0].rtp);
  }
  console.log(JSON.stringify({ weights: { zodiac: ZODIAC_WEIGHT, wild: WILD_WEIGHT, moon: MOON_WEIGHT }, ...analyzeRtp(coefficients) }, (_, value) => typeof value === 'bigint' ? String(value) : value, 2));
}
