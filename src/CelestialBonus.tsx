import { useEffect, useRef } from 'react';
import { RotateCw, Sparkles, Star, Volume2, VolumeX, X } from 'lucide-react';
import { MATCH_TIERS, TIERS, ZODIAC, bonusCounts, money, type PendingBonus, type ZodiacId, type TierId } from './game';
import { CelestialWheel } from './Symbol';
import { CONSTELLATIONS } from './constellations';
import ConstellationChart from './ConstellationChart';
import Starfield from './Starfield';

function CelestialSky() {
  return <svg className="celestial-sky" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <radialGradient id="lunar-surface"><stop stopColor="#c1d7df" /><stop offset=".65" stopColor="#7895a3" /><stop offset="1" stopColor="#344e60" /></radialGradient>
      <radialGradient id="solar-surface"><stop stopColor="#fff0ae" /><stop offset=".65" stopColor="#e9bc58" /><stop offset="1" stopColor="#aa6531" /></radialGradient>
    </defs>
    {Array.from({ length: 95 }, (_, i) => <circle key={i} cx={(i * 137 + 29) % 1440} cy={(i * 89 + 17) % 1000} r={i % 7 === 0 ? 2 : 1} fill={i % 3 === 0 ? '#e4c990' : '#adc8dd'} opacity={.15 + (i % 5) * .12} />)}
    <g className="solar-body" transform="translate(160 200)"><circle r="80" fill="url(#solar-surface)" opacity=".7" />
      {Array.from({ length: 24 }, (_, i) => <path key={i} d="M0-92v-22" stroke="#eac077" opacity=".35" transform={`rotate(${i * 15})`} />)}
      <circle r="103" stroke="#b29456" fill="none" opacity=".2" />
    </g>
    <g className="saturn-body" transform="translate(1280 240) rotate(-25)"><circle r="95" fill="url(#lunar-surface)" opacity=".7" /><ellipse rx="156" ry="33" fill="none" stroke="#b8c9c8" strokeWidth="13" opacity=".3" /><ellipse rx="177" ry="40" fill="none" stroke="#c1b68e" strokeWidth="2" opacity=".3" /></g>
    <g fill="none" stroke="#92b2b6" strokeWidth="1" opacity=".19"><path d="m70 650 120-85 90 115-55 160-155-190m1120 150 60-180 95-60 30 190-185 50" /><circle cx="190" cy="565" r="4" /><circle cx="280" cy="680" r="4" /><circle cx="1250" cy="620" r="4" /></g>
  </svg>;
}

export default function CelestialBonus({ bonus, freeSpins, sound, onSound, onChoose, onReveal, onCollect, demo }: {
  bonus: PendingBonus; freeSpins: number; sound: boolean; onSound: () => void;
  onChoose: (sign: ZodiacId) => void; onReveal: (index: number) => void; onCollect: () => void;
  demo?: { onExit: () => void; onReplay: () => void };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const collect = useRef<HTMLButtonElement>(null);
  const mapTitle = useRef<HTMLHeadingElement>(null);
  const selected = ZODIAC.find(sign => sign.id === bonus.selectedSign);
  const tier = bonus.winner ? TIERS[bonus.winner] : null;
  const counts = bonusCounts(bonus);
  const tiers: readonly TierId[] = bonus.mode === 'legacy' ? ['mini', 'minor', 'major', 'grand'] : MATCH_TIERS;
  const lastStar = bonus.revealedStars.at(-1);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const element = dialog.current;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    if (tier) collect.current?.focus();
    else {
      mapTitle.current?.focus({ preventScroll: true });
      if (!selected) dialog.current?.scrollTo({ top: 0 });
    }
  }, [tier, selected]);

  return <dialog ref={dialog} className={`celestial-bonus ${tier ? 'revealed' : ''} ${demo ? 'demo-bonus' : ''}`} onCancel={event => { event.preventDefault(); demo?.onExit(); }} aria-labelledby="bonus-title" style={{ '--prize-color': tier?.color ?? '#e4c789' } as React.CSSProperties}>
    <Starfield bright /><CelestialSky /><CelestialWheel className="bonus-wheel" />
    {demo && <><span className="bonus-demo-label">BONUS DEMO <span>{money(bonus.bet * bonus.denomination)} BET</span></span><button className="icon-button bonus-exit" aria-label="Exit bonus demo" title="Exit bonus demo" onClick={demo.onExit}><X /></button></>}
    <button className="icon-button bonus-sound" aria-label={sound ? 'Mute bonus sound' : 'Enable bonus sound'} title={sound ? 'Mute bonus sound' : 'Enable bonus sound'} onClick={onSound}>{sound ? <Volume2 /> : <VolumeX />}</button>
    <div className="bonus-content">
      <header className="celestial-heading"><span className="edition"><Sparkles size={14} />THE CELESTIALS HAVE ALIGNED<Sparkles size={14} /></span>
        <h2 id="bonus-title" ref={mapTitle} tabIndex={-1}>{tier ? tier.celestial : selected ? `${selected.name} awaits` : 'Choose your constellation'}</h2>
        <p>{tier ? `${selected?.name} reveals your fortune` : selected ? 'Follow the stars. Reveal your fortune.' : 'Twelve constellations. One cosmic fortune.'}</p>
      </header>
      <div className={`jackpot-tiers ${bonus.mode === 'match3' ? 'match-tiers' : ''}`} aria-label="Possible bonus prizes">{tiers.map(id => {
        const prize = TIERS[id];
        return <div key={id} className={bonus.winner === id ? 'selected-tier' : ''} style={{ '--tier-color': prize.color } as React.CSSProperties}><span>{prize.name}</span><strong>{money(prize.multiplier * bonus.bet * bonus.denomination)}</strong><small>{prize.multiplier}× BET</small>{bonus.mode === 'match3' && <div className="match-counter" aria-label={`${prize.name}: ${counts[id]} of 3 matched`}>{[0, 1, 2].map(i => <Star key={i} size={13} className={i < counts[id] ? 'matched' : ''} />)}</div>}</div>;
      })}</div>
      {!selected ? <div className="constellation-grid" aria-label="Choose a constellation">{ZODIAC.map((sign, index) => <button key={sign.id} className="constellation-card" onClick={() => onChoose(sign.id)} aria-label={`Choose ${sign.name}`} style={{ '--constellation-color': sign.color } as React.CSSProperties}>
        <span className="constellation-number">{String(index + 1).padStart(2, '0')}</span><ConstellationChart sign={sign.id} /><strong>{sign.name}</strong><span className="hidden-prize">{sign.element}</span>
      </button>)}</div> : <div className={`star-pick-map ${tier ? 'complete' : ''}`} style={{ '--constellation-color': selected.color } as React.CSSProperties}>
        <ConstellationChart sign={selected.id} stretch />
        {CONSTELLATIONS[selected.id].stars.map(([x, y, name], index) => {
          const revealed = bonus.revealedStars.includes(index);
          const prize = TIERS[bonus.prizes[index]];
          const won = revealed && bonus.winner === bonus.prizes[index];
          return <button key={index} className={`pick-star ${revealed ? 'uncovered' : ''} ${won ? 'winning-star' : ''}`} style={{ left: `${x}%`, top: `${y}%`, '--star-prize-color': revealed ? prize.color : selected.color } as React.CSSProperties} aria-label={revealed ? `Star ${index + 1}, ${name}: ${prize.name}` : `Reveal star ${index + 1}, ${name}`} disabled={revealed || !!tier || bonus.mode === 'legacy'} onClick={() => onReveal(index)} title={name}>
            <Star size={23} fill="currentColor" strokeWidth={1} /><span>{revealed ? prize.name : String(index + 1).padStart(2, '0')}</span>
          </button>;
        })}
      </div>}
      <div className="bonus-outcome" aria-live="polite" aria-atomic="true">{tier ? <><span className="prize-label">{tier.name.toUpperCase()} {demo ? 'DEMO WIN' : 'BONUS'}</span><strong data-testid="bonus-amount">{money(tier.multiplier * bonus.bet * bonus.denomination)}</strong><span>{demo ? 'BALANCE UNCHANGED' : `+ ${freeSpins} FREE SPINS IN YOUR ORBIT`}</span></> : selected ? <><span className="last-star-result">{lastStar !== undefined ? `${TIERS[bonus.prizes[lastStar]].name} revealed` : 'Your constellation is ready'}</span><small>Match three of a prize to win. Choose another star.</small></> : <><Sparkles size={22} /><span>YOUR FORTUNE AWAITS</span><small>Choose a constellation, then match three prizes in its stars.</small></>}</div>
      {tier && <button className="primary-button collect-bonus" ref={collect} onClick={demo ? demo.onReplay : onCollect}>{demo ? <><RotateCw size={17} />Play demo again</> : <>Collect & continue<Sparkles size={17} /></>}</button>}
    </div>
  </dialog>;
}
