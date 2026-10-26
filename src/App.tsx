import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, CircleHelp, Coins, Diamond, History, Info, Maximize2, Minus, Moon, Plus, RotateCw, Sparkles, Square, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { BETS, INITIAL_BOARD, PAYLINES, STORAGE_KEY, SYMBOLS, drawBoard, newSession, restoreSession, settleSpin, type Board, type Session, type SpinRecord } from './game';
import { CelestialWheel, ZodiacSymbol } from './Symbol';
import { playTone } from './audio';

const format = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
const formatBalance = (n: number) => n < 100000 ? format(n) : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 0 }).format(n);
type Panel = 'paytable' | 'history' | 'wallet' | 'about' | null;
function readSession() {
  try { return restoreSession(localStorage.getItem(STORAGE_KEY)); } catch { return newSession(); }
}
function readPreference(key: string) {
  try { return localStorage.getItem(`astral.${key}`) === 'true'; } catch { return false; }
}

function IconButton({ label, children, active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode; active?: boolean }) {
  return <button {...props} className={`icon-button ${active ? 'active' : ''} ${props.className ?? ''}`} aria-label={label} title={label}>{children}</button>;
}

function Modal({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="modal-title">
    <div className="modal-inner">
      <header className="modal-header"><div><span className="eyebrow">{eyebrow}</span><h2 id="modal-title">{title}</h2></div><IconButton label="Close dialog" onClick={onClose}><X size={21} /></IconButton></header>
      {children}
    </div>
  </dialog>;
}

function Paytable({ bet, initialTab }: { bet: number; initialTab: 'symbols' | 'lines' }) {
  const [tab, setTab] = useState(initialTab);
  return <>
    <div className="tabs" role="tablist" aria-label="Paytable views">
      <button role="tab" aria-selected={tab === 'symbols'} onClick={() => setTab('symbols')}>Symbol payouts</button>
      <button role="tab" aria-selected={tab === 'lines'} onClick={() => setTab('lines')}>10 paylines</button>
    </div>
    {tab === 'symbols' ? <>
      <div className="table-caption"><span>Total bet <strong>{format(bet)}</strong></span><span>Payouts in credits</span></div>
      <table className="pay-table"><thead><tr><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>
        {[...SYMBOLS].filter(symbol => symbol.id !== 'moon').reverse().map(symbol => <tr key={symbol.id}>
          <td><ZodiacSymbol id={symbol.id} small label={false} /><span>{symbol.name}{symbol.id === 'sun' && <small>WILD</small>}</span></td>
          {symbol.pays.map(payout => <td key={payout}>{format(payout * bet / 10)}</td>)}
        </tr>)}
      </tbody></table>
      <div className="moon-rule"><ZodiacSymbol id="moon" small label={false} /><div><h3>Moonlight free spins</h3><p>3 moons: 5 spins · 4 moons: 8 spins · 5+ moons: 12 spins</p></div></div>
      <p className="rules-copy">Matches pay from the leftmost reel on an active payline. The Sun substitutes for every symbol except the Moon. Only the highest win on each line pays; wins across lines are added. Moons count anywhere and can award more free spins during a bonus. Free spins keep the triggering bet.</p>
    </> : <>
      <div className="payline-grid">{PAYLINES.map((rows, i) => <div className="payline-example" key={i}><span>{String(i + 1).padStart(2, '0')}</span><svg viewBox="0 0 150 90" aria-label={`Payline ${i + 1}`}>
        {Array.from({ length: 15 }, (_, j) => <rect key={j} x={(j % 5) * 30 + 2} y={Math.floor(j / 5) * 30 + 2} width="26" height="26" rx="2" />)}
        <polyline points={rows.map((row, reel) => `${reel * 30 + 15},${row * 30 + 15}`).join(' ')} />
      </svg></div>)}</div>
      <p className="rules-copy">All 10 paylines are always active. Each receives one tenth of your total bet. A line needs at least three consecutive matching symbols, starting on the leftmost reel.</p>
    </>}
  </>;
}

function HistoryPanel({ records }: { records: SpinRecord[] }) {
  return records.length ? <div className="history-list"><div className="history-labels"><span>Spin / bet</span><span>Result</span></div>{records.map((record, i) => <div className="history-row" key={`${record.id}-${i}`}>
    <div className={`history-icon ${record.payout ? 'paid' : ''}`}>{record.payout ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}</div>
    <div className="history-detail"><strong>{record.free ? 'Free spin' : `${format(record.bet)} credit bet`}</strong><span>{new Date(record.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{record.awardedSpins > 0 && ` · +${record.awardedSpins} free spins`}</span></div>
    <div className={`history-amount ${record.payout ? 'paid' : ''}`}><strong>{record.payout ? `+${format(record.payout)}` : 'No win'}</strong><span>{record.wins.length ? `${record.wins.length} winning ${record.wins.length === 1 ? 'line' : 'lines'}` : '—'}</span></div>
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
  const [payTab, setPayTab] = useState<'symbols' | 'lines'>('symbols');
  const [sound, setSound] = useState(() => readPreference('sound'));
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
  const betIndex = BETS.indexOf(session.bet as typeof BETS[number]);
  const canSpin = session.freeSpins > 0 || session.balance >= session.bet;
  const locked = spinning || autoRemaining > 0;

  const persist = useCallback((next: Session) => {
    sessionRef.current = next;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    try { localStorage.setItem('astral.sound', String(sound)); localStorage.setItem('astral.turbo', String(turbo)); }
    catch { setStorageError(true); }
  }, [sound, turbo]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!autoRef.current?.contains(event.target as Node)) setAutoMenu(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const spin = useCallback(() => {
    if (busy.current) return;
    const current = sessionRef.current;
    if (!current.freeSpins && current.balance < current.bet) { setAutoRemaining(0); setPanel('wallet'); return; }
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
    setSession({ ...current, balance: current.balance - (record.free ? 0 : record.bet) });
    // Save the full settlement before animation so a reload cannot lose a payout.
    persist(next);
    playTone('spin', soundRef.current);
    const quick = turbo || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timers.current = [];
    for (let reel = 0; reel < 5; reel++) {
      timers.current.push(setTimeout(() => {
        setBoard(previous => previous.map((column, index) => index === reel ? record.board[reel] : column));
        setMoving(previous => previous.map((value, index) => index === reel ? false : value));
        playTone('stop', soundRef.current);
        if (reel === 4) {
          setSession(next);
          setResult(record);
          setSpinning(false);
          busy.current = false;
          setAutoRemaining(remaining => Math.max(0, remaining - 1));
          if (record.awardedSpins || record.payout) playTone(record.awardedSpins ? 'bonus' : 'win', soundRef.current);
        }
      }, (quick ? 150 : 750) + reel * (quick ? 75 : 200)));
    }
  }, [persist, turbo]);

  useEffect(() => {
    if (!autoRemaining || spinning || panel) return;
    const timeout = setTimeout(spin, turbo ? 350 : 900);
    return () => clearTimeout(timeout);
  }, [autoRemaining, spinning, spin, turbo, panel]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.code === 'Escape') setAutoMenu(false);
      if (event.code === 'Space' && !event.repeat && !panel && !autoMenu && !autoRemaining &&
          !['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault(); spin();
      }
    };
    document.addEventListener('keydown', keyDown);
    return () => document.removeEventListener('keydown', keyDown);
  }, [spin, panel, autoMenu, autoRemaining]);

  function changeBet(index: number) {
    if (locked || session.freeSpins || index < 0 || index >= BETS.length) return;
    const next = { ...sessionRef.current, bet: BETS[index] };
    persist(next); setSession(next);
  }
  function openPanel(value: Panel, tab: 'symbols' | 'lines' = 'symbols') {
    setAutoRemaining(0); setAutoMenu(false); setPayTab(tab); setPanel(value);
  }
  function refill() {
    if (busy.current) return;
    const next = { ...sessionRef.current, balance: Math.max(10000, sessionRef.current.balance) };
    persist(next); setSession(next); setPanel(null); setError('');
  }
  function startAuto(count: number) { setAutoMenu(false); setAutoRemaining(count); spin(); }
  const winningCells = new Set(result?.wins.flatMap(win => PAYLINES[win.line].slice(0, win.count).map((row, reel) => `${reel}-${row}`)));
  const lastWin = result?.payout ?? 0;
  const bestWin = Math.max(0, ...session.history.map(record => record.payout));

  return <div className="app-shell">
    <div className="cosmos" aria-hidden="true"><CelestialWheel className="background-wheel" />
      {Array.from({ length: 58 }, (_, i) => <i key={i} className={i % 11 === 0 ? 'star large' : 'star'} style={{ left: `${(i * 73 + 11) % 100}%`, top: `${(i * 47 + 3) % 100}%`, opacity: 0.12 + i % 5 * 0.07 }} />)}
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
        <div className="machine-topline"><span className="active-lines"><i />10 ACTIVE PAYLINES</span><div className="jackpot-label"><Sparkles size={13} /><span>WRITTEN IN THE STARS</span><Sparkles size={13} /></div><button className="max-win" onClick={() => openPanel('paytable')}>UP TO <strong>1,000×</strong><Info size={13} /></button></div>
        <div className="cabinet">
          <span className="corner corner-tl" aria-hidden="true" /><span className="corner corner-tr" aria-hidden="true" /><span className="corner corner-bl" aria-hidden="true" /><span className="corner corner-br" aria-hidden="true" />
          <div className="bonus-strip"><span className="bonus-name"><Moon size={15} />MOONLIGHT BONUS</span><div className="bonus-condition">{session.freeSpins ? <><Sparkles size={14} /><strong>{session.freeSpins} FREE {session.freeSpins === 1 ? 'SPIN' : 'SPINS'}</strong><span>IN YOUR ORBIT</span></> : <><span className="mini-moons"><Moon /><Moon /><Moon /></span><span>3 MOONS UNLOCK FREE SPINS</span></>}</div></div>
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
            {error ? <span>{error}</span> : spinning ? <span>The stars are in motion<span className="ellipsis">...</span></span> : result?.awardedSpins ? <span><strong>Moonlight magic.</strong> +{result.awardedSpins} free spins{lastWin ? ` + ${format(lastWin)} credits` : ''}</span> : lastWin ? <span><strong>{lastWin >= effectiveBet * 10 ? 'A cosmic win!' : 'The stars align.'}</strong> +{format(lastWin)} credits</span> : <span>{result ? 'A new constellation awaits.' : 'Your next chapter is in the stars.'}</span>}
            <span className="result-decoration" aria-hidden="true">✧</span>
          </div>
        </div>

        <div className="control-deck">
          <div className="balance-control"><span className="control-label">BALANCE</span><div className="balance-value"><Coins size={20} /><strong data-testid="balance" title={`${format(session.balance)} credits`} aria-label={`${format(session.balance)} credits`}>{formatBalance(session.balance)}</strong><IconButton label="Refill virtual credits" disabled={spinning} onClick={() => openPanel('wallet')}><Plus size={14} /></IconButton></div><span className="control-note">virtual credits</span></div>
          <div className="bet-control"><span className="control-label">TOTAL BET</span><div className="bet-stepper"><IconButton label="Decrease bet" disabled={locked || !!session.freeSpins || betIndex === 0} onClick={() => changeBet(betIndex - 1)}><Minus size={16} /></IconButton><strong data-testid="bet">{format(effectiveBet)}</strong><IconButton label="Increase bet" disabled={locked || !!session.freeSpins || betIndex === BETS.length - 1} onClick={() => changeBet(betIndex + 1)}><Plus size={16} /></IconButton></div><button className="max-bet" disabled={locked || !!session.freeSpins || betIndex === BETS.length - 1} onClick={() => changeBet(BETS.length - 1)}>MAX BET</button></div>
          <div className={`win-control ${lastWin ? 'has-win' : ''}`}><span className="control-label">LAST WIN</span><strong data-testid="last-win">{format(lastWin)}</strong><span className="control-note">{result?.wins.length ? `${result.wins.length} winning ${result.wins.length === 1 ? 'line' : 'lines'}` : 'the cosmos is listening'}</span></div>
          <div className="spin-controls"><button className={`spin-button ${spinning ? 'is-spinning' : ''}`} disabled={spinning || autoRemaining > 0} onClick={spin} aria-label={spinning ? 'Spinning' : session.freeSpins ? 'Free spin' : canSpin ? 'Spin' : 'Refill to spin'}><RotateCw size={26} strokeWidth={1.7} /><span>{spinning ? 'SPINNING' : session.freeSpins ? 'FREE SPIN' : canSpin ? 'SPIN' : 'REFILL'}</span><span className="spin-gem" aria-hidden="true">✦</span></button>
            <div className="auto-control" ref={autoRef}>{autoRemaining > 0 ? <button className="auto-button running" onClick={() => setAutoRemaining(0)} aria-label="Stop autoplay"><Square size={11} fill="currentColor" />STOP AUTO <span>{autoRemaining}</span></button> : <button className="auto-button" disabled={spinning || !canSpin} aria-expanded={autoMenu} aria-haspopup="menu" onClick={() => setAutoMenu(!autoMenu)}><RotateCw size={12} />AUTO SPIN</button>}
              {autoMenu && <div className="auto-menu" role="menu" aria-label="Autoplay count"><span>AUTO SPINS</span>{[10, 25, 50].map(count => <button key={count} role="menuitem" onClick={() => startAuto(count)}>{count} spins<ChevronRight size={14} /></button>)}</div>}
            </div>
          </div>
        </div>
        <div className="machine-toolbar"><div><button onClick={() => openPanel('paytable', 'lines')}><span className="paylines-icon" aria-hidden="true">≋</span>Paylines</button><span className="toolbar-divider" /><button onClick={() => openPanel('paytable')}><Info size={14} />Paytable</button></div><span className="machine-id">EST. IN THE COSMOS</span><div><IconButton label={turbo ? 'Disable quick spin' : 'Enable quick spin'} active={turbo} aria-pressed={turbo} onClick={() => setTurbo(!turbo)}><Zap size={15} fill={turbo ? 'currentColor' : 'none'} /></IconButton><IconButton label="Spin history" onClick={() => openPanel('history')}><History size={16} /></IconButton><IconButton label="Toggle fullscreen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => setError('Fullscreen is unavailable in this browser.')); else void gameRef.current?.requestFullscreen?.().catch(() => setError('Fullscreen is unavailable in this browser.')); }}><Maximize2 size={15} /></IconButton></div></div>
      </section>

      <section className="celestial-notes" aria-label="Celestial rewards">
        <div><span className="note-icon"><ZodiacSymbol id="sun" label={false} small /></span><div><h2>A little sunshine</h2><p>SUN WILD · EVERY SIGN HAS A CHANCE</p></div></div>
        <span className="notes-divider" />
        <div><span className="note-icon"><ZodiacSymbol id="moon" label={false} small /></span><div><h2>Meet your moonlight</h2><p>3+ MOONS · UP TO 12 FREE SPINS</p></div></div>
        <span className="notes-divider" />
        <div><span className="note-icon"><Sparkles size={29} strokeWidth={1} /></span><div><h2>Your brightest moment</h2><p>{bestWin ? `${format(bestWin)} CREDITS · BEST OF YOUR LAST 30 SPINS` : 'YOUR BIGGEST WIN IS STILL TO COME'}</p></div></div>
      </section>
    </main>

    <footer className="site-footer"><span><Sparkles size={12} /> ASTRAL FORTUNE</span><p>Made of stardust. Played for fun. <span>No real money. No cash prizes.</span></p><button onClick={() => openPanel('about')}>{storageError ? 'Session not saved' : 'Play for the moment'}<ArrowUpRight size={13} /></button></footer>

    {panel && <Modal title={panel === 'paytable' ? 'The stars, decoded.' : panel === 'history' ? 'Your cosmic journey.' : panel === 'wallet' ? 'A fresh constellation.' : 'Welcome to Astral.'} eyebrow={panel === 'paytable' ? 'PAYOUTS & PAYLINES' : panel === 'history' ? 'SPIN HISTORY' : panel === 'wallet' ? 'VIRTUAL CREDIT WALLET' : 'ASTRAL FORTUNE'} onClose={() => setPanel(null)} wide={panel === 'paytable'}>
      {panel === 'paytable' && <Paytable bet={effectiveBet} initialTab={payTab} />}
      {panel === 'history' && <HistoryPanel records={session.history} />}
      {panel === 'wallet' && <div className="wallet-panel"><Coins size={38} strokeWidth={1.2} /><span>YOUR BALANCE</span><strong>{format(session.balance)}</strong><p>Virtual credits, real cosmic energy. Refill your balance to 10,000 credits, on the house.</p><button className="primary-button" onClick={refill} disabled={spinning || session.balance >= 10000}>{session.balance >= 10000 ? <><Check size={18} />Your wallet is full</> : <><Plus size={18} />Refill to 10,000</>}</button><small>Always free. No purchases or cash value.</small></div>}
      {panel === 'about' && <div className="about-panel"><CelestialWheel /><p>A little escape to the celestial side.</p><p>Astral Fortune is a virtual slot game. Credits are free, have no monetary value, and cannot be purchased, transferred, or redeemed. Each spin is random; previous results and zodiac signs do not change the odds.</p><p>Your balance and the latest 30 spins are saved in this browser when local storage is available. Autoplay stops after your selected number of spins, when you open a panel, or when you stop it.</p><button className="primary-button" onClick={() => setPanel(null)}>Back to the stars<Sparkles size={17} /></button></div>}
    </Modal>}
  </div>;
}
