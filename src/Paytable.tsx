import { useState } from 'react';
import { Play, Star } from 'lucide-react';
import { MATCH_TIERS, PAYLINES, SYMBOLS, TIERS, money } from './game';
import { STAR_TOTAL_WEIGHT, STAR_WEIGHTS, freeSpinAward } from './rules';
import { ZodiacSymbol } from './Symbol';

const TABS = [
  { id: 'symbols', label: 'Symbol payouts' },
  { id: 'lines', label: `${PAYLINES.length} paylines` },
  { id: 'bonus', label: 'Bonus payouts' },
] as const;
export type PaytableTab = typeof TABS[number]['id'];

export default function Paytable({ bet, denomination, initialTab, onDemo, demoDisabled }: {
  bet: number; denomination: number; initialTab: PaytableTab; onDemo: () => void; demoDisabled: boolean;
}) {
  const [tab, setTab] = useState(initialTab);
  const wager = bet * denomination;
  return <>
    <div className="tabs payout-tabs" role="tablist" aria-label="Paytable views">
      {TABS.map(({ id, label }, index) => <button key={id} role="tab" id={`payout-tab-${id}`} aria-controls="payout-view"
        aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault(); setTab(TABS[next].id); document.getElementById(`payout-tab-${TABS[next].id}`)?.focus();
        }}>{label}</button>)}
    </div>
    <div className="table-caption"><span>{bet} credits × {money(denomination)} <strong>{money(wager)}</strong></span><span>Virtual dollars</span></div>
    <div role="tabpanel" id="payout-view" aria-labelledby={`payout-tab-${tab}`} tabIndex={0}>
      {tab === 'symbols' && <>
        <div className="payout-scroll" role="region" aria-label="Symbol payout table" tabIndex={0}>
          <table className="pay-table symbol-pay-table"><caption>Per winning line</caption><thead><tr><th scope="col">Symbol</th><th scope="col">3</th><th scope="col">4</th><th scope="col">5</th></tr></thead><tbody>
            {[...SYMBOLS].filter(symbol => symbol.id !== 'moon').reverse().map(symbol => <tr key={symbol.id}>
              <td><ZodiacSymbol id={symbol.id} small label={false} /><span>{symbol.name}{symbol.id === 'sun' && <small>WILD</small>}</span></td>
              {symbol.pays.map(payout => <td key={payout}>{money(payout * wager / PAYLINES.length)}</td>)}
            </tr>)}
          </tbody></table>
        </div>
        <p className="rules-copy">Three, four, or five consecutive matches pay from the leftmost reel. The Sun substitutes for every sign, but not the Moon. Only the highest win per line pays; separate lines add together. All signs have equal reel odds and payouts.</p>
        <p className="rules-copy">All {PAYLINES.length} lines share the total bet equally. A full screen of Suns pays 1,000× the total bet: {money(1000 * wager)}.</p>
      </>}
      {tab === 'lines' && <>
        <div className="payline-grid">{PAYLINES.map((rows, i) => <div className="payline-example" key={i}><span>{String(i + 1).padStart(2, '0')}</span><svg viewBox="0 0 150 90" role="img" aria-label={`Payline ${i + 1}`}>
          {Array.from({ length: 15 }, (_, j) => <rect key={j} x={(j % 5) * 30 + 2} y={Math.floor(j / 5) * 30 + 2} width="26" height="26" rx="2" />)}
          <polyline points={rows.map((row, reel) => `${reel * 30 + 15},${row * 30 + 15}`).join(' ')} />
        </svg></div>)}</div>
        <p className="rules-copy">All {PAYLINES.length} paylines are always active. Each receives 1/{PAYLINES.length} of your total bet. A line needs at least three consecutive matching symbols, starting on the leftmost reel.</p>
      </>}
      {tab === 'bonus' && <>
        <h3 className="payout-heading"><Star size={17} />Constellation prizes</h3>
        <table className="pay-table bonus-pay-table"><thead><tr><th scope="col">Prize</th><th scope="col">Total bet</th><th scope="col">Payout</th><th scope="col">Per star</th></tr></thead><tbody>
          {MATCH_TIERS.map(id => <tr key={id}><td style={{ color: TIERS[id].color }}>{TIERS[id].name}</td><td>{TIERS[id].multiplier}×</td><td>{money(TIERS[id].multiplier * wager)}</td><td>{new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(STAR_WEIGHTS[id] / STAR_TOTAL_WEIGHT)}</td></tr>)}
        </tbody></table>
        <p className="rules-copy">The first prize revealed three times wins. Each star is independent; per-star odds are not the odds of winning that prize. Every constellation has equal odds, with a match guaranteed within seven picks.</p>
        <h3 className="payout-heading"><ZodiacSymbol id="moon" small label={false} />Moon awards</h3>
        <table className="pay-table bonus-pay-table"><thead><tr><th scope="col">Moons anywhere</th><th scope="col">Free spins</th><th scope="col">Bonus</th></tr></thead><tbody>
          {[3, 4, 5].map(count => <tr key={count}><td>{count === 5 ? '5+' : count}</td><td>{freeSpinAward(count)}</td><td>Star match</td></tr>)}
        </tbody></table>
        <p className="rules-copy">Every Moon trigger awards a constellation bonus and free spins. Bonuses can retrigger. Credits and denomination remain locked to the triggering wager throughout free spins.</p>
        <button className="primary-button paytable-demo" onClick={onDemo} disabled={demoDisabled}><Play size={17} />Try bonus demo</button>
      </>}
    </div>
    <div className="rtp-note"><strong>98.00% theoretical RTP · 2.00% house edge</strong><p>Includes line wins, free spins, retriggers, and constellation matches. Applies to every wager and denomination over long-run play, not to each session.</p></div>
  </>;
}
