import { CONSTELLATIONS } from './constellations';
import { type ZodiacId } from './rules';

export default function ConstellationChart({ sign, stretch = false }: { sign: ZodiacId; stretch?: boolean }) {
  const chart = CONSTELLATIONS[sign];
  return <svg className="constellation-chart" viewBox="0 0 100 100" preserveAspectRatio={stretch ? 'none' : 'xMidYMid meet'} fill="none" aria-hidden="true">
    {chart.lines.map((line, i) => <polyline key={i} points={line.map(index => chart.stars[index].slice(0, 2).join(',')).join(' ')} />)}
    {chart.stars.map(([x, y], i) => <g key={i}><circle className="chart-halo" cx={x} cy={y} r="3.5" /><circle className="chart-star" cx={x} cy={y} r={i % 3 === 0 ? '1.65' : '1.15'} /></g>)}
  </svg>;
}
