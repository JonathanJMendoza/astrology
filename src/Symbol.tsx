import { SYMBOLS, type SymbolId } from './game';

const glyphs: Record<SymbolId, React.ReactNode> = {
  aries: <path d="M50 77V40C50 15 19 16 22 39c1 10 12 13 17 5M50 40c0-25 31-24 28-1-1 10-12 13-17 5" />,
  taurus: <><circle cx="50" cy="59" r="22" /><path d="M23 19c0 26 54 26 54 0" /></>,
  gemini: <><path d="M25 20q25 12 50 0M25 80q25-12 50 0M37 26v48M63 26v48" /><path className="glyph-detail" d="M45 37v26M55 37v26" /></>,
  cancer: <><path d="M19 37c11-18 38-23 62-6M81 63C70 81 43 86 19 69" /><circle cx="29" cy="41" r="12" /><circle cx="71" cy="59" r="12" /></>,
  virgo: <><path d="M18 70V33q0-17 13-8v45M31 34q0-20 15-9v45M46 35q0-22 15-11v35c0 13 12 23 22 18M61 35q22-19 18 6C75 63 64 71 53 78" /></>,
  scorpio: <><path d="M17 73V32q0-16 14-8v49M31 33q0-17 15-9v49M46 33q0-17 15-9v35q0 18 18 11l5-5M74 64l10 1-1 10" /></>,
  sagittarius: <><path d="m23 78 55-55M47 22h31v31M25 44l31 31" /><path className="glyph-detail" d="m15 84 5-5M84 16l3-3" /></>,
  capricorn: <><path d="M16 28q10-13 15 0l9 41M38 28q10-17 14 2l7 38c8 21 30 5 22-9-10-17-27 3-36 20" /></>,
  aquarius: <><path d="m15 41 14-12 14 12 14-12 14 12 14-12M15 66l14-12 14 12 14-12 14 12 14-12" /><path className="glyph-detail" d="m22 83 4-4M76 17l4-4" /></>,
  libra: <><path d="M18 64h64M18 78h64M20 50h16a18 18 0 1 1 28 0h16" /><path className="glyph-detail" d="M50 14v5M22 25l5 5M78 25l-5 5" /></>,
  leo: <><path d="M37 58c-17-1-19 24-3 24 16 0 18-16 10-29-7-11-15-25-4-33 13-10 32 0 29 16-3 15-15 22-11 35 3 11 18 10 21 0" /></>,
  pisces: <><path d="M26 18c23 18 23 46 0 64M74 18c-23 18-23 46 0 64M19 50h62" /><path className="glyph-detail" d="m15 16 2-3M85 84l-2 3" /></>,
  sun: <><circle cx="50" cy="50" r="20" /><circle className="glyph-detail" cx="50" cy="50" r="13" /><path d="M50 8v11M50 81v11M8 50h11M81 50h11M20 20l8 8M72 72l8 8M20 80l8-8M72 28l8-8" /><path className="glyph-detail" d="m34 12 3 8M63 80l3 8M12 34l8 3M80 63l8 3M12 66l8-3M80 37l8-3M34 88l3-8M63 20l3-8" /></>,
  moon: <><path d="M66 17a34 34 0 1 0 16 50A29 29 0 0 1 66 17Z" /><path className="glyph-detail" d="m74 25 2 7 7 2-7 2-2 7-2-7-7-2 7-2ZM39 39a24 24 0 0 0 19 35" /><circle cx="85" cy="49" r="1.5" /></>,
};

export function ZodiacSymbol({ id, small = false, label = true }: { id: SymbolId; small?: boolean; label?: boolean }) {
  const symbol = SYMBOLS.find(item => item.id === id)!;
  return <div className={`zodiac-symbol ${small ? 'small' : ''} symbol-${id}`} style={{ '--symbol-color': symbol.color } as React.CSSProperties}>
    <svg viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {glyphs[id]}
    </svg>
    {label && <span>{symbol.element === 'Wild' || symbol.element === 'Scatter' ? symbol.element : symbol.name}</span>}
  </div>;
}

export function CelestialWheel({ className = '' }: { className?: string }) {
  return <svg className={`celestial-wheel ${className}`} viewBox="0 0 500 500" fill="none" aria-hidden="true">
    <circle cx="250" cy="250" r="238" /><circle cx="250" cy="250" r="225" />
    <circle cx="250" cy="250" r="180" /><circle cx="250" cy="250" r="173" />
    <circle cx="250" cy="250" r="110" />
    {Array.from({ length: 12 }, (_, i) => <g key={i} transform={`rotate(${i * 30} 250 250)`}>
      <path d="M250 12v65M250 140v10" />
      <path d="m250 40 3 7-3 7-3-7Z" />
      <path d="m250 77 90 173-90 173-90-173Z" opacity=".28" />
    </g>)}
    {Array.from({ length: 60 }, (_, i) => <path key={i} d="M250 20v5" transform={`rotate(${i * 6} 250 250)`} />)}
    <path d="m250 161 21 68 68 21-68 21-21 68-21-68-68-21 68-21Z" />
    <circle cx="250" cy="250" r="17" />
  </svg>;
}
