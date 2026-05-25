'use client';

import { LetterState, MultiplierType } from '@/lib/game';
import { T, MULT_LABEL, MULT_COLOR } from '@/lib/theme';

export function Tile({
  ch, state, multiplier, isCurrent, isHint, size, scrabblePoints,
}: {
  ch: string; state: LetterState; multiplier?: MultiplierType;
  isCurrent?: boolean; isHint?: boolean; size: number; scrabblePoints: Record<string, number>;
}) {
  const radius = Math.round(size * 0.18);
  const showChips = size >= 26;
  const multAccent = multiplier ? MULT_COLOR[multiplier] : undefined;
  const showMultChip = state === 'empty' && !!multAccent;
  const stateBg = state === 'correct' ? T.correct
    : state === 'present' ? T.present
    : state === 'absent' ? T.absent
    : T.tileEmpty;
  const stateFg = state === 'empty' ? T.fg : '#fff';

  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      borderRadius: radius,
      background: stateBg,
      color: stateFg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-instrument-serif), Georgia, serif',
      fontWeight: 400,
      fontSize: Math.max(11, size * 0.55),
      lineHeight: 1,
      transition: 'background 240ms ease, color 240ms ease',
      boxShadow: state === 'empty'
        ? showMultChip
          ? `inset 0 0 0 1.5px ${multAccent}40, 0 1px 0 ${T.tileShadow}`
          : `inset 0 0 0 1px ${T.tileBorder}, 0 1px 0 ${T.tileShadow}`
        : `0 1px 0 ${T.tileShadow}, 0 2px 4px ${T.tileShadow}`,
      outline: isCurrent ? `2px solid ${T.accent}` : 'none',
      outlineOffset: 2,
      flexShrink: 0,
    }}>
      {showMultChip && showChips && multiplier && (
        <div style={{
          position: 'absolute',
          top: Math.max(2, size * 0.06), left: Math.max(2, size * 0.06),
          padding: '1px 5px',
          borderRadius: 999,
          background: multAccent,
          color: '#fff',
          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          fontWeight: 600,
          fontSize: Math.max(8, size * 0.16),
          lineHeight: 1.1,
          letterSpacing: 0.2,
        }}>{MULT_LABEL[multiplier]}</div>
      )}
      {showMultChip && !showChips && (
        <div style={{
          position: 'absolute', top: 2, left: 2,
          width: 6, height: 6, borderRadius: 999,
          background: multAccent,
        }} />
      )}
      <span style={{ opacity: isHint ? 0.45 : 1, fontStyle: isHint ? 'italic' : 'normal' }}>
        {ch}
      </span>
      {ch && showChips && (
        <span style={{
          position: 'absolute',
          right: Math.max(4, size * 0.08), bottom: Math.max(2, size * 0.04),
          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          fontWeight: 500, fontSize: Math.max(8, size * 0.16),
          opacity: state === 'empty' ? 0.55 : 0.85,
          color: state === 'empty' ? T.fg : '#fff',
        }}>{scrabblePoints[ch] || ''}</span>
      )}
    </div>
  );
}
