import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, CircleHelp, Coins, Diamond, History, Info, Maximize2, Moon, Play, Plus, RotateCw, Sparkles, Square, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { BETS, DENOMINATIONS, INITIAL_BOARD, LEGACY_STORAGE_KEY, PAYLINES, PREVIOUS_STORAGE_KEY, REFILL_CENTS, STORAGE_KEY, TIERS, chooseBonus, collectBonus, drawBoard, money, newSession, restoreSession, revealBonusStar, settleSpin, totalWin, type Board, type Session, type SpinRecord, type ZodiacId } from './game';
import { CelestialWheel, ZodiacSymbol } from './Symbol';
import { playTone, setAudioEnabled, stopReels } from './audio';
import CelestialBonus from './CelestialBonus';
import Starfield from './Starfield';
import BonusDemo from './BonusDemo';
import Paytable, { type PaytableTab } from './Paytable';

const format = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
const compactMoney = (cents: number) => cents < 100000 ? money(cents) : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(cents / 100);
type Panel = 'paytable' | 'history' | 'wallet' | 'about' | null;
function readSession() {
  try { return restoreSession(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(PREVIOUS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)); } catch { return newSession(); }
}
function readPreference(key: string, fallback = false) {
  try { const value = localStorage.getItem(`astral.${key}`); return value === null ? fallback : value === 'true'; } catch { return fallback; }
}

function IconButton({ label, children, active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode; active?: boolean }) {
  return <button {...props} className={`icon-button ${active ? 'active' : ''} ${props.className ?? ''}`} aria-label={label} title={label}>{children}</button>;
}

function Modal({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="modal-title">
    <div className="modal-inner">
      <header className="modal-header"><div><span className="eyebrow">{eyebrow}</span><h2 id="modal-title">{title}</h2></div><IconButton label="Close dialog" onClick={onClose}><X size={21} /></IconButton></header>
      {children}
    </div>
  </dialog>;
}

function HistoryPanel({ records }: { records: SpinRecord[] }) {
  return records.length ? <div className="history-list"><div className="history-labels"><span>Spin / bet</span><span>Result</span></div>{records.map((record, i) => <div className="history-row" key={`${record.id}-${i}`}>
    <div className={`history-icon ${totalWin(record) ? 'paid' : ''}`}>{totalWin(record) ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}</div>
    <div className="history-detail"><strong>{record.free ? 'Free spin' : `${money(record.bet * record.denomination)} bet`}</strong><span>{record.bet} credits × {money(record.denomination)} · {new Date(record.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>{record.bonus ? `${record.bonus.sign} · ${TIERS[record.bonus.tier].name} bonus` : ''}{record.awardedSpins > 0 && ` · +${record.awardedSpins} free spins`}</span></div>
    <div className={`history-amount ${totalWin(record) ? 'paid' : ''}`}><strong>{totalWin(record) ? `+${money(totalWin(record) * record.denomination)}` : 'No win'}</strong><span>{record.wins.length ? `${record.wins.length} winning ${record.wins.length === 1 ? 'line' : 'lines'}` : '—'}</span></div>
  </div>)}<p className="history-footnote">Your latest 30 spins · Payouts shown before the bet</p></div> : <div className="empty-history"><Sparkles size={38} /><h3>A story yet to be written.</h3><p>No spins in your orbit just yet.</p></div>;
}

export default function App() {
  const [session, setSession] = useState<Session>(readSession);
  const sessionRef = useRef(session);
  const [board, setBoard] = useState<Board>(() => session.history[0]?.board ?? INITIAL_BOARD);
  const [spinning, setSpinning] = useState(false);
  const [moving, setMoving] = useState<boolean[]>([false, false, false, false, false]);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [result, setResult] = useState<SpinRecord | null>(() => session.history[0] ?? null);
  const [panel, setPanel] = useState<Panel>(null);
  const [payTab, setPayTab] = useState<PaytableTab>('symbols');
  const [demoOpen, setDemoOpen] = useState(false);
  const [sound, setSound] = useState(() => readPreference('sound', true));
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const [turbo, setTurbo] = useState(() => readPreference('turbo'));
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [autoMenu, setAutoMenu] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [error, setError] = useState('');
  const gameRef = useRef<HTMLElement>(null);
  const autoRef = useRef<HTMLDivElement>(null);
  const effectiveBet = session.freeSpins > 0 ? session.bonusBet : session.bet;
  const effectiveDenomination = session.freeSpins > 0 ? session.bonusDenomination : session.denomination;
  const canSpin = session.freeSpins > 0 || session.balance >= session.bet * session.denomination;
  const locked = spinning || autoRemaining > 0 || !!session.bonus || demoOpen;

  const persist = useCallback((next: Session) => {
    sessionRef.current = next;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  }, []);

  useEffect(() => {
    const quiet = () => { if (document.hidden) stopReels(); };
    document.addEventListener('visibilitychange', quiet);
    return () => { timers.current.forEach(clearTimeout); stopReels(); document.removeEventListener('visibilitychange', quiet); };
  }, []);
  useEffect(() => {
    setAudioEnabled(sound);
    try { localStorage.setItem('astral.sound', String(sound)); localStorage.setItem('astral.turbo', String(turbo)); }
    catch { setStorageError(true); }
  }, [sound, turbo]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!autoRef.current?.contains(event.target as Node)) setAutoMenu(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const spin = useCallback(() => {
    if (busy.current || demoOpen) return;
    const current = sessionRef.current;
    if (current.bonus) return;
    if (!current.freeSpins && current.balance < current.bet * current.denomination) { setAutoRemaining(0); setPanel('wallet'); return; }
    let settled: ReturnType<typeof settleSpin>;
    try { settled = settleSpin(current, drawBoard()); }
    catch { setError('The spin could not start. Your credits are unchanged.'); setAutoRemaining(0); return; }
    const { session: next, record } = settled;
    busy.current = true;
    setError('');
    setSpinning(true);
    setMoving([true, true, true, true, true]);
    setResult(null);
    setAutoMenu(false);
    setSession({ ...current, balance: current.balance - (record.free ? 0 : record.bet * record.denomination) });
    // Save the full settlement before animation so a reload cannot lose a payout.
    persist(next);
    playTone('spin', soundRef.current);
    const quick = turbo || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timers.current = [];
    for (let reel = 0; reel < 5; reel++) {
      timers.current.push(setTimeout(() => {
        setBoard(previous => previous.map((column, index) => index === reel ? record.board[reel] : column));
        setMoving(previous => previous.map((value, index) => index === reel ? false : value));
        playTone('stop', soundRef.current, reel);
        if (reel === 4) {
          stopReels();
          setSession(next);
          setResult(record);
          setSpinning(false);
          busy.current = false;
          setAutoRemaining(remaining => next.bonus ? 0 : Math.max(0, remaining - 1));
          if (next.bonus) setPanel(null);
          if (record.awardedSpins || record.payout) playTone(record.awardedSpins ? 'bonus' : 'win', soundRef.current);
        }
      }, (quick ? 150 : 750) + reel * (quick ? 75 : 200)));
    }
  }, [persist, turbo, demoOpen]);

  useEffect(() => {
    if (!autoRemaining || spinning || panel || session.bonus || demoOpen) return;
    const timeout = setTimeout(spin, turbo ? 350 : 900);
    return () => clearTimeout(timeout);
  }, [autoRemaining, spinning, spin, turbo, panel, session.bonus, demoOpen]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.code === 'Escape') setAutoMenu(false);
      if (event.code === 'Space' && !event.repeat && !panel && !session.bonus && !demoOpen && !autoMenu && !autoRemaining &&
          !['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault(); spin();
      }
    };
    document.addEventListener('keydown', keyDown);
    return () => document.removeEventListener('keydown', keyDown);
  }, [spin, panel, autoMenu, autoRemaining, session.bonus, demoOpen]);

  function changeWager(field: 'bet' | 'denomination', value: number) {
    const allowed: readonly number[] = field === 'bet' ? BETS : DENOMINATIONS;
    if (locked || session.freeSpins || !allowed.includes(value)) return;
    const next = { ...sessionRef.current, [field]: value };
    persist(next); setSession(next);
    playTone('credit', soundRef.current);
  }
  function selectBonus(sign: ZodiacId) {
    const current = sessionRef.current;
    if (!current.bonus || current.bonus.selectedSign) return;
    const next = chooseBonus(current, sign);
    persist(next); setSession(next); setResult(next.history[0]);
    playTone(next.bonus?.winner ? 'bonus' : 'pick', soundRef.current);
  }
  function revealStar(index: number) {
    const current = sessionRef.current;
    const next = revealBonusStar(current, index);
    if (next === current) return;
    persist(next); setSession(next); setResult(next.history[0]);
    playTone(next.bonus?.winner ? 'bonus' : 'pick', soundRef.current);
  }
  function finishBonus() {
    const next = collectBonus(sessionRef.current);
    persist(next); setSession(next);
  }
  function openPanel(value: Panel, tab: PaytableTab = 'symbols') {
    setAutoRemaining(0); setAutoMenu(false); setPayTab(tab); setPanel(value);
  }
  function startDemo() {
    if (busy.current || sessionRef.current.bonus) return;
    setAutoRemaining(0); setAutoMenu(false); setPanel(null); setDemoOpen(true);
    playTone('bonus', soundRef.current);
  }
  function refill() {
    if (busy.current) return;
    const next = { ...sessionRef.current, balance: Math.max(REFILL_CENTS, sessionRef.current.balance) };
    persist(next); setSession(next); setPanel(null); setError('');
    playTone('credit', soundRef.current);
  }
  function startAuto(count: number) { setAutoMenu(false); setAutoRemaining(count); spin(); }
  const winningCells = new Set(result?.wins.flatMap(win => PAYLINES[win.line].slice(0, win.count).map((row, reel) => `${reel}-${row}`)));
  const lastWin = totalWin(result);
  const lastWinCents = lastWin * (result?.denomination ?? effectiveDenomination);
  const bestWin = Math.max(0, ...session.history.map(record => totalWin(record) * record.denomination));

  return <div className="app-shell">
    <div className="cosmos" aria-hidden="true"><Starfield /><CelestialWheel className="background-wheel" />
    </div>
    <header className="site-header">
      <a className="brand" href="#" aria-label="Astral Fortune home" onClick={event => { event.preventDefault(); setPanel(null); }}><Sparkles size={27} strokeWidth={1.2} /><span>ASTRAL<span className="brand-dot">.</span></span></a>
      <nav aria-label="Main navigation"><button className={!panel ? 'selected' : ''} onClick={() => setPanel(null)}>The machine</button><button className={panel === 'paytable' ? 'selected' : ''} onClick={() => openPanel('paytable')}>Paytable</button><button className={panel === 'history' ? 'selected' : ''} onClick={() => openPanel('history')}>Spin history</button></nav>
      <div className="header-actions"><span className="demo-badge"><span />VIRTUAL PLAY</span><span className="header-divider" /><IconButton label={sound ? 'Mute sound' : 'Enable sound'} aria-pressed={sound} onClick={() => setSound(!sound)}>{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</IconButton><IconButton label="About Astral Fortune" onClick={() => openPanel('about')}><CircleHelp size={19} /></IconButton></div>
    </header>

    <main>
      <section className="game-heading" aria-labelledby="game-title">
        <div className="edition"><span /><Diamond size={8} fill="currentColor" />THE CELESTIAL COLLECTION<Diamond size={8} fill="currentColor" /><span /></div>
        <h1 id="game-title">Astral <span>Fortune</span></h1>
        <p>A little luck. A little cosmic alignment.</p>
        <div className="heading-star star-one" aria-hidden="true">✦</div><div className="heading-star star-two" aria-hidden="true">✧</div>
      </section>

      <section className={`machine ${session.freeSpins ? 'bonus-mode' : ''}`} ref={gameRef} aria-label="Astral Fortune slot machine">
        <div className="machine-topline"><span className="active-lines"><i />{PAYLINES.length} ACTIVE PAYLINES</span><div className="jackpot-label"><Sparkles size={13} /><span>WRITTEN IN THE STARS</span><Sparkles size={13} /></div><button className="max-win" onClick={() => openPanel('paytable')}>UP TO <strong>1,000×</strong><Info size={13} /></button></div>
        <div className="cabinet">
          <span className="corner corner-tl" aria-hidden="true" /><span className="corner corner-tr" aria-hidden="true" /><span className="corner corner-bl" aria-hidden="true" /><span className="corner corner-br" aria-hidden="true" />
          <div className="bonus-strip"><span className="bonus-name"><Moon size={15} />CELESTIAL BONUS</span><div className="bonus-condition">{session.freeSpins ? <><Sparkles size={14} /><strong>{session.freeSpins} FREE {session.freeSpins === 1 ? 'SPIN' : 'SPINS'}</strong><span>IN YOUR ORBIT</span></> : <><span className="mini-moons"><Moon /><Moon /><Moon /></span><span>3+ MOONS: STAR MATCH + FREE SPINS</span></>}</div></div>
          <div className="reels-area">
            <div className="line-pointer left" aria-hidden="true">1<span /></div>
            <div className="reels" role="img" aria-label={spinning ? 'The five reels are spinning' : `Reels, top to bottom: ${board.map(column => column.join(', ')).join('; ')}`} aria-busy={spinning}>
              {board.map((column, reel) => <div className={`reel ${moving[reel] ? 'moving' : 'stopped'}`} key={reel}>
                <div className="reel-track" key={`${reel}-${moving[reel]}`}>
                  {(moving[reel] ? [...column, ...column, ...column] : column).map((id, row) => <div className={`symbol-cell ${!spinning && winningCells.has(`${reel}-${row}`) ? 'winning' : ''} ${!spinning && result?.awardedSpins && id === 'moon' ? 'bonus-symbol' : ''}`} key={row} data-symbol={id}>
                    <ZodiacSymbol id={id} />
                    {!spinning && winningCells.has(`${reel}-${row}`) && <span className="win-spark">✦</span>}
                  </div>)}
                </div>
              </div>)}
              {!spinning && !!result?.wins.length && <svg className="winning-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{result.wins.map(win => <polyline key={win.line} points={PAYLINES[win.line].slice(0, win.count).map((row, reel) => `${reel * 20 + 10},${row * 100 / 3 + 100 / 6}`).join(' ')} />)}</svg>}
            </div>
            <div className="line-pointer right" aria-hidden="true"><span />1</div>
          </div>
          <div className={`result-bar ${lastWin ? 'has-win' : ''}`} role="status" aria-live="polite" aria-atomic="true">
            <span className="result-decoration" aria-hidden="true">✧</span>
            {error ? <span>{error}</span> : spinning ? <span>The stars are in motion<span className="ellipsis">...</span></span> : result?.bonus ? <span><strong>{TIERS[result.bonus.tier].name} constellation!</strong> +{money(lastWinCents)}</span> : result?.awardedSpins ? <span><strong>Celestial alignment.</strong> +{result.awardedSpins} free spins</span> : lastWin ? <span><strong>{lastWin >= (result?.bet ?? effectiveBet) * 10 ? 'A cosmic win!' : 'The stars align.'}</strong> +{money(lastWinCents)}</span> : <span>{result ? 'A new constellation awaits.' : 'Your next chapter is in the stars.'}</span>}
            <span className="result-decoration" aria-hidden="true">✧</span>
          </div>
        </div>

        <div className="wager-settings">
          <label>BET CREDITS<select aria-label="Bet credits" value={effectiveBet} disabled={locked || !!session.freeSpins} onChange={event => changeWager('bet', Number(event.target.value))}>{!BETS.includes(effectiveBet as typeof BETS[number]) && <option value={effectiveBet}>{effectiveBet}</option>}{BETS.map(bet => <option key={bet} value={bet}>{bet}</option>)}</select></label>
          <span className="wager-times">×</span>
          <label>DENOMINATION<select aria-label="Denomination" value={effectiveDenomination} disabled={locked || !!session.freeSpins} onChange={event => changeWager('denomination', Number(event.target.value))}>{DENOMINATIONS.map(denom => <option key={denom} value={denom}>{money(denom)}</option>)}</select></label>
          <span className="wager-lock">{session.freeSpins ? 'BONUS WAGER LOCKED' : '98.00% THEORETICAL RTP'}</span>
        </div>
        <div className="control-deck">
          <div className="balance-control"><span className="control-label">VIRTUAL BALANCE</span><div className="balance-value"><Coins size={20} /><strong data-testid="balance" title={money(session.balance)} aria-label={money(session.balance)}>{compactMoney(session.balance)}</strong><IconButton label="Refill virtual credits" disabled={spinning} onClick={() => openPanel('wallet')}><Plus size={14} /></IconButton></div><span className="control-note">{format(Math.floor(session.balance / effectiveDenomination))} credits</span></div>
          <div className="bet-control"><span className="control-label">TOTAL BET</span><div className="bet-stepper"><strong data-testid="bet">{money(effectiveBet * effectiveDenomination)}</strong></div><span className="control-note">{effectiveBet} credits × {money(effectiveDenomination)}</span></div>
          <div className={`win-control ${lastWin ? 'has-win' : ''}`}><span className="control-label">LAST WIN</span><strong data-testid="last-win" title={money(lastWinCents)}>{compactMoney(lastWinCents)}</strong><span className="control-note">{lastWin ? `${format(lastWin)} credits` : 'the cosmos is listening'}</span></div>
          <div className="spin-controls"><button className={`spin-button ${spinning ? 'is-spinning' : ''}`} disabled={spinning || autoRemaining > 0} onClick={spin} aria-label={spinning ? 'Spinning' : session.freeSpins ? 'Free spin' : canSpin ? 'Spin' : 'Refill to spin'}><RotateCw size={26} strokeWidth={1.7} /><span>{spinning ? 'SPINNING' : session.freeSpins ? 'FREE SPIN' : canSpin ? 'SPIN' : 'REFILL'}</span><span className="spin-gem" aria-hidden="true">✦</span></button>
            <div className="auto-control" ref={autoRef}>{autoRemaining > 0 ? <button className="auto-button running" onClick={() => setAutoRemaining(0)} aria-label="Stop autoplay"><Square size={11} fill="currentColor" />STOP AUTO <span>{autoRemaining}</span></button> : <button className="auto-button" disabled={spinning || !canSpin} aria-expanded={autoMenu} aria-haspopup="menu" onClick={() => setAutoMenu(!autoMenu)}><RotateCw size={12} />AUTO SPIN</button>}
              {autoMenu && <div className="auto-menu" role="menu" aria-label="Autoplay count"><span>AUTO SPINS</span>{[10, 25, 50].map(count => <button key={count} role="menuitem" onClick={() => startAuto(count)}>{count} spins<ChevronRight size={14} /></button>)}</div>}
            </div>
          </div>
        </div>
        <div className="machine-toolbar"><div><button onClick={() => openPanel('paytable', 'lines')}><span className="paylines-icon" aria-hidden="true">≋</span>Paylines</button><span className="toolbar-divider" /><button onClick={() => openPanel('paytable')}><Info size={14} />Paytable</button></div><button className="demo-trigger" onClick={startDemo} disabled={spinning || !!session.bonus}><Play size={14} />Bonus demo</button><div><IconButton label={turbo ? 'Disable quick spin' : 'Enable quick spin'} active={turbo} aria-pressed={turbo} onClick={() => setTurbo(!turbo)}><Zap size={15} fill={turbo ? 'currentColor' : 'none'} /></IconButton><IconButton label="Spin history" onClick={() => openPanel('history')}><History size={16} /></IconButton><IconButton label="Toggle fullscreen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => setError('Fullscreen is unavailable in this browser.')); else void gameRef.current?.requestFullscreen?.().catch(() => setError('Fullscreen is unavailable in this browser.')); }}><Maximize2 size={15} /></IconButton></div></div>
      </section>

      <section className="celestial-notes" aria-label="Celestial rewards">
        <div><span className="note-icon"><ZodiacSymbol id="sun" label={false} small /></span><div><h2>A little sunshine</h2><p>SUN WILD · EVERY SIGN HAS A CHANCE</p></div></div>
        <span className="notes-divider" />
        <div><span className="note-icon"><ZodiacSymbol id="moon" label={false} small /></span><div><h2>A celestial calling</h2><p>MATCH THREE · MINI · MINOR · MAJOR</p></div></div>
        <span className="notes-divider" />
        <div><span className="note-icon"><Sparkles size={29} strokeWidth={1} /></span><div><h2>Your brightest moment</h2><p>{bestWin ? `${money(bestWin)} · BEST OF YOUR LAST 30 SPINS` : 'YOUR BIGGEST WIN IS STILL TO COME'}</p></div></div>
      </section>
    </main>

    <footer className="site-footer"><span><Sparkles size={12} /> ASTRAL FORTUNE</span><p>Made of stardust. Played for fun. <span>No real money. No cash prizes.</span></p><button onClick={() => openPanel('about')}>{storageError ? 'Session not saved' : 'Play for the moment'}<ArrowUpRight size={13} /></button></footer>

    {panel && <Modal title={panel === 'paytable' ? 'The stars, decoded.' : panel === 'history' ? 'Your cosmic journey.' : panel === 'wallet' ? 'A fresh constellation.' : 'Welcome to Astral.'} eyebrow={panel === 'paytable' ? 'PAYOUTS & PAYLINES' : panel === 'history' ? 'SPIN HISTORY' : panel === 'wallet' ? 'VIRTUAL CREDIT WALLET' : 'ASTRAL FORTUNE'} onClose={() => setPanel(null)} wide={panel === 'paytable'}>
      {panel === 'paytable' && <Paytable bet={effectiveBet} denomination={effectiveDenomination} initialTab={payTab} onDemo={startDemo} demoDisabled={spinning || !!session.bonus} />}
      {panel === 'history' && <HistoryPanel records={session.history} />}
      {panel === 'wallet' && <div className="wallet-panel"><Coins size={38} strokeWidth={1.2} /><span>YOUR VIRTUAL BALANCE</span><strong>{money(session.balance)}</strong><p>{format(Math.floor(session.balance / effectiveDenomination))} credits at {money(effectiveDenomination)} each. Denomination changes preserve the dollar balance.</p><button className="primary-button" onClick={refill} disabled={spinning || session.balance >= REFILL_CENTS}>{session.balance >= REFILL_CENTS ? <><Check size={18} />Your wallet is full</> : <><Plus size={18} />Refill to $10,000</>}</button><small>Demo dollars only. No purchases or cash value.</small></div>}
      {panel === 'about' && <div className="about-panel"><CelestialWheel /><p>A little escape to the celestial side.</p><p>All 12 zodiac signs share equal odds. Three or more Moons unlock a constellation match and free spins. Choose a constellation, then reveal stars until three Mini, Minor, or Major prizes match. Your first match wins. Free spins retain the triggering credits and denomination.</p><p>Theoretical RTP is 98.00%, including all bonuses and retriggers: a 2.00% house edge over long-run play. It does not guarantee a return for any individual spin or session.</p><p>Dollar amounts are virtual. Credits cannot be purchased, transferred, or redeemed. Your wallet, star reveals, and latest 30 spins are saved in this browser. Autoplay stops at its limit, on a bonus, when you open a panel, or when you stop it.</p><button className="primary-button" onClick={() => setPanel(null)}>Back to the stars<Sparkles size={17} /></button></div>}
    </Modal>}
    {session.bonus && !spinning && <CelestialBonus bonus={session.bonus} freeSpins={session.freeSpins} sound={sound} onSound={() => setSound(!sound)} onChoose={selectBonus} onReveal={revealStar} onCollect={finishBonus} />}
    {demoOpen && <BonusDemo bet={effectiveBet} denomination={effectiveDenomination} sound={sound} onSound={() => setSound(!sound)} onExit={() => setDemoOpen(false)} />}
  </div>;
}
