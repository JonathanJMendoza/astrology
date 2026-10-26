import { useRef, useState } from 'react';
import { chooseBonus, newBonusDemo, revealBonusStar, type Session } from './game';
import { playTone } from './audio';
import CelestialBonus from './CelestialBonus';

export default function BonusDemo({ bet, denomination, sound, onSound, onExit }: {
  bet: number; denomination: number; sound: boolean; onSound: () => void; onExit: () => void;
}) {
  const [session, setSession] = useState(() => newBonusDemo(bet, denomination));
  const current = useRef(session);
  function update(next: Session) {
    if (next === current.current) return;
    current.current = next;
    setSession(next);
    playTone(next.bonus?.winner ? 'bonus' : 'pick', sound);
  }
  return <CelestialBonus bonus={session.bonus!} freeSpins={0} sound={sound} onSound={onSound}
    onChoose={sign => update(chooseBonus(current.current, sign))}
    onReveal={index => update(revealBonusStar(current.current, index))} onCollect={onExit}
    demo={{ onExit, onReplay: () => update(newBonusDemo(bet, denomination)) }} />;
}
