// Calibrated by scripts/rtp.ts, including free-spin retriggers and sign-pick prizes.
export const ZODIAC_WEIGHT = 92_448_882_741;
export const MOON_WEIGHT = 30_000_000_000;
export const TOTAL_WEIGHT = 1_200_000_000_000;
export const WILD_WEIGHT = TOTAL_WEIGHT - 12 * ZODIAC_WEIGHT - MOON_WEIGHT;
export const SIGN_PAYS = [20, 100, 500] as const;
export const WILD_PAYS = [50, 250, 1000] as const;

export const ZODIAC = [
  { id: 'aries', name: 'Aries', element: 'Fire', color: '#ed9b85' },
  { id: 'taurus', name: 'Taurus', element: 'Earth', color: '#98c7aa' },
  { id: 'gemini', name: 'Gemini', element: 'Air', color: '#b7aadf' },
  { id: 'cancer', name: 'Cancer', element: 'Water', color: '#acd9dc' },
  { id: 'leo', name: 'Leo', element: 'Fire', color: '#e9c17c' },
  { id: 'virgo', name: 'Virgo', element: 'Earth', color: '#c2cc8a' },
  { id: 'libra', name: 'Libra', element: 'Air', color: '#90c4d7' },
  { id: 'scorpio', name: 'Scorpio', element: 'Water', color: '#dca1a1' },
  { id: 'sagittarius', name: 'Sagittarius', element: 'Fire', color: '#e9b28d' },
  { id: 'capricorn', name: 'Capricorn', element: 'Earth', color: '#a0c4b0' },
  { id: 'aquarius', name: 'Aquarius', element: 'Air', color: '#9baee3' },
  { id: 'pisces', name: 'Pisces', element: 'Water', color: '#e6a4bb' },
] as const;
export type ZodiacId = typeof ZODIAC[number]['id'];

export const TIERS = {
  mini: { name: 'Mini', multiplier: 2, color: '#99d2b7', celestial: 'Lunar blessing' },
  minor: { name: 'Minor', multiplier: 5, color: '#a6c8e9', celestial: 'Venus rising' },
  major: { name: 'Major', multiplier: 20, color: '#e6a78d', celestial: 'Saturn ascendant' },
  grand: { name: 'Grand', multiplier: 100, color: '#f1cd80', celestial: 'Solar coronation' },
} as const;
export type TierId = keyof typeof TIERS;
export const BONUS_DECK: TierId[] = ['mini', 'mini', 'mini', 'mini', 'mini', 'mini', 'minor', 'minor', 'minor', 'minor', 'major', 'grand'];
export const BETS = [50, 100, 150, 200, 250] as const;
export const DENOMINATIONS = [1, 2, 5, 10, 25, 50, 100, 200] as const;
export const REFILL_CENTS = 1_000_000;
export const TARGET_RTP = 0.98;
export const freeSpinAward = (moons: number) => moons >= 5 ? 12 : moons === 4 ? 8 : moons === 3 ? 5 : 0;
