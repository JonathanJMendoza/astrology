import { useEffect, useRef } from 'react';
import { Sparkles, Volume2, VolumeX } from 'lucide-react';
import { TIERS, ZODIAC, money, type PendingBonus, type ZodiacId } from './game';
import { CelestialWheel, ZodiacSymbol } from './Symbol';

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

export default function CelestialBonus({ bonus, freeSpins, sound, onSound, onChoose, onCollect }: {
  bonus: PendingBonus; freeSpins: number; sound: boolean; onSound: () => void;
  onChoose: (sign: ZodiacId) => void; onCollect: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const collect = useRef<HTMLButtonElement>(null);
  const selectedIndex = ZODIAC.findIndex(sign => sign.id === bonus.selectedSign);
  const tier = selectedIndex >= 0 ? TIERS[bonus.prizes[selectedIndex]] : null;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => { if (tier) collect.current?.focus(); }, [tier]);

  return <dialog ref={dialog} className={`celestial-bonus ${tier ? 'revealed' : ''}`} onCancel={event => event.preventDefault()} aria-labelledby="bonus-title" style={{ '--prize-color': tier?.color ?? '#e4c789' } as React.CSSProperties}>
    <CelestialSky /><CelestialWheel className="bonus-wheel" />
    <button className="icon-button bonus-sound" aria-label={sound ? 'Mute bonus sound' : 'Enable bonus sound'} onClick={onSound}>{sound ? <Volume2 /> : <VolumeX />}</button>
    <div className="bonus-content">
      <header className="celestial-heading"><span className="edition"><Sparkles size={14} />THE CELESTIALS HAVE ALIGNED<Sparkles size={14} /></span>
        <h2 id="bonus-title">{tier ? tier.celestial : 'Choose your constellation'}</h2>
        <p>{tier ? `${ZODIAC[selectedIndex].name} reveals your fortune` : 'Twelve signs. One cosmic fortune.'}</p>
      </header>
      <div className="jackpot-tiers" aria-label="Possible bonus prizes">{Object.entries(TIERS).map(([id, prize]) => <div key={id} className={tier && tier.name === prize.name ? 'selected-tier' : ''} style={{ '--tier-color': prize.color } as React.CSSProperties}><span>{prize.name}</span><strong>{money(prize.multiplier * bonus.bet * bonus.denomination)}</strong><small>{prize.multiplier}× BET</small></div>)}</div>
      <div className="constellation-grid" aria-label="Choose an astrology sign">{ZODIAC.map((sign, index) => {
        const selected = sign.id === bonus.selectedSign;
        return <button key={sign.id} className={`constellation-card ${selected ? 'chosen' : ''}`} disabled={!!bonus.selectedSign} onClick={() => onChoose(sign.id)} aria-label={`Choose ${sign.name}`} aria-pressed={selected}>
          <span className="constellation-number">{String(index + 1).padStart(2, '0')}</span><ZodiacSymbol id={sign.id} label={false} /><strong>{sign.name}</strong>
          <span className="hidden-prize">{tier ? TIERS[bonus.prizes[index]].name : sign.element}</span>
        </button>;
      })}</div>
      <div className="bonus-outcome" aria-live="polite" aria-atomic="true">{tier ? <><span className="prize-label">{tier.name.toUpperCase()} BONUS</span><strong data-testid="bonus-amount">{money(tier.multiplier * bonus.bet * bonus.denomination)}</strong><span>+ {freeSpins} FREE SPINS IN YOUR ORBIT</span></> : <><Sparkles size={22} /><span>YOUR FORTUNE AWAITS</span><small>Prizes are shuffled each bonus. Every sign has the same odds.</small></>}</div>
      {tier && <button className="primary-button collect-bonus" ref={collect} onClick={onCollect}>Collect & continue<Sparkles size={17} /></button>}
    </div>
  </dialog>;
}
