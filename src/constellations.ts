import type { ZodiacId } from './rules';

export interface Constellation {
  stars: readonly (readonly [number, number, string])[];
  lines: readonly (readonly number[])[];
}

// Stylized sky-chart asterisms, with additional constellation members for star picks.
// Positions are diagram coordinates, not a telescope pointing reference.
export const CONSTELLATIONS: Record<ZodiacId, Constellation> = {
  aries: {
    stars: [[18, 68, 'Bharani'], [32, 48, 'Hamal'], [50, 43, 'Sheratan'], [61, 57, 'Mesarthim'], [72, 76, 'Botein'], [43, 22, 'Epsilon Arietis'], [81, 35, 'Zeta Arietis']],
    lines: [[0, 1, 2, 3, 4], [1, 5], [5, 6]],
  },
  taurus: {
    stars: [[12, 18, 'Elnath'], [42, 54, 'Aldebaran'], [66, 18, 'Tianguan'], [52, 71, 'Theta Tauri'], [69, 80, 'Ain'], [79, 59, 'Gamma Tauri'], [20, 77, 'Alcyone'], [88, 30, 'Lambda Tauri']],
    lines: [[0, 1, 2], [1, 3, 4, 5, 1], [3, 6], [5, 7]],
  },
  gemini: {
    stars: [[30, 16, 'Castor'], [66, 23, 'Pollux'], [29, 40, 'Mebsuta'], [60, 46, 'Wasat'], [22, 63, 'Tejat'], [61, 70, 'Mekbuda'], [12, 85, 'Propus'], [40, 85, 'Alhena'], [78, 86, 'Alzirr'], [82, 43, 'Kappa Geminorum']],
    lines: [[0, 2, 4, 6], [4, 7], [1, 3, 5, 8], [2, 3, 9]],
  },
  cancer: {
    stars: [[48, 14, 'Iota Cancri'], [46, 36, 'Asellus Borealis'], [52, 58, 'Asellus Australis'], [24, 81, 'Acubens'], [83, 82, 'Altarf'], [16, 37, 'Chi Cancri'], [80, 33, 'Theta Cancri']],
    lines: [[0, 1, 2, 3], [2, 4], [1, 5], [1, 6]],
  },
  leo: {
    stars: [[78, 22, 'Rasalas'], [58, 16, 'Epsilon Leonis'], [43, 32, 'Adhafera'], [53, 49, 'Algieba'], [67, 70, 'Regulus'], [31, 60, 'Zosma'], [12, 82, 'Denebola'], [41, 85, 'Chertan'], [84, 49, 'Eta Leonis']],
    lines: [[0, 1, 2, 3, 8, 4], [3, 5, 6, 7, 4]],
  },
  virgo: {
    stars: [[15, 25, 'Vindemiatrix'], [37, 39, 'Auva'], [52, 54, 'Porrima'], [80, 73, 'Spica'], [28, 78, 'Heze'], [10, 58, 'Zaniah'], [63, 23, 'Zavijava'], [87, 29, 'Iota Virginis'], [56, 85, 'Syrma']],
    lines: [[0, 1, 2, 3], [2, 4, 5], [2, 6, 7], [4, 8]],
  },
  libra: {
    stars: [[45, 17, 'Zubeneschamali'], [18, 47, 'Zubenelgenubi'], [70, 43, 'Zubenelhakrabi'], [49, 65, 'Upsilon Librae'], [23, 85, 'Brachium'], [79, 81, 'Tau Librae'], [87, 20, 'Theta Librae']],
    lines: [[0, 1, 3, 2, 0], [1, 4], [3, 5], [2, 6]],
  },
  scorpio: {
    stars: [[17, 15, 'Acrab'], [38, 17, 'Dschubba'], [15, 37, 'Pi Scorpii'], [38, 44, 'Antares'], [45, 65, 'Tau Scorpii'], [52, 85, 'Epsilon Scorpii'], [74, 85, 'Sargas'], [88, 67, 'Shaula'], [78, 46, 'Lesath']],
    lines: [[0, 1, 3, 4, 5, 6, 7, 8], [2, 3]],
  },
  sagittarius: {
    stars: [[20, 32, 'Alnasl'], [40, 47, 'Kaus Media'], [55, 17, 'Kaus Borealis'], [71, 42, 'Nunki'], [88, 60, 'Ascella'], [68, 82, 'Tau Sagittarii'], [42, 76, 'Kaus Australis'], [13, 66, 'Phi Sagittarii']],
    lines: [[0, 1, 2, 3, 1, 6, 7, 0], [3, 4, 5, 6]],
  },
  capricorn: {
    stars: [[14, 24, 'Algedi'], [26, 46, 'Dabih'], [48, 80, 'Omega Capricorni'], [70, 63, 'Nashira'], [88, 30, 'Deneb Algedi'], [61, 31, 'Theta Capricorni'], [44, 21, 'Psi Capricorni']],
    lines: [[0, 1, 2, 3, 4, 5, 6, 0]],
  },
  aquarius: {
    stars: [[12, 38, 'Sadalsuud'], [31, 27, 'Sadalmelik'], [48, 43, 'Sadachbia'], [63, 25, 'Zeta Aquarii'], [79, 42, 'Eta Aquarii'], [65, 59, 'Ancha'], [43, 72, 'Theta Aquarii'], [28, 86, 'Skat'], [88, 81, 'Lambda Aquarii']],
    lines: [[0, 1, 2, 3, 4, 2], [2, 5, 6, 7], [5, 8]],
  },
  pisces: {
    stars: [[16, 18, 'Phi Piscium'], [31, 13, 'Eta Piscium'], [39, 32, 'Omicron Piscium'], [27, 45, 'Nu Piscium'], [17, 33, 'Upsilon Piscium'], [48, 62, 'Alrescha'], [64, 72, 'Delta Piscium'], [79, 82, 'Epsilon Piscium'], [91, 70, 'Gamma Piscium'], [83, 51, 'Kappa Piscium'], [66, 52, 'Lambda Piscium']],
    lines: [[0, 1, 2, 3, 4, 0], [3, 5, 6, 7, 8, 9, 10, 6]],
  },
};
export const MAX_CONSTELLATION_STARS = Math.max(...Object.values(CONSTELLATIONS).map(chart => chart.stars.length));
