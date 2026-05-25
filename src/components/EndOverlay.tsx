'use client';

import { T } from '@/lib/theme';
import { Translation } from '@/lib/translations';
import { ScoreBreakdown } from '@/lib/game';

export function EndOverlay({
  won, targetWord, breakdown, gameMode, onClose, onPlayAgain, t,
}: {
  won: boolean; targetWord: string;
  breakdown: ScoreBreakdown | null;
  gameMode: 'daily' | 'practice';
  onClose: () => void; onPlayAgain: () => void;
  t: Translation;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: T.overlay,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }} onClick={onClose}>
      {won && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: 30 }).map((_, i) => {
            const colors = [T.accent, T.correct, T.present, T.multTLS];
            return (
              <div key={i} style={{
                position: 'absolute',
                left: `${(i * 37) % 100}%`,
                top: -10,
                width: 8, height: 12,
                background: colors[i % colors.length],
                borderRadius: 2,
                animation: `confetti ${1800 + (i * 41) % 1200}ms linear ${(i * 73) % 600}ms forwards`,
              }} />
            );
          })}
        </div>
      )}
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%',
        background: T.bgAlt,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: '28px 24px 48px',
        animation: 'sheetUp 360ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        boxShadow: `0 -8px 30px ${T.tileShadow}`,
        textAlign: 'center',
        position: 'relative',
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 4,
          background: T.tileBorder,
          margin: '0 auto 18px',
        }} />
        <div style={{
          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          fontSize: 11, letterSpacing: 2,
          color: won ? T.correct : T.fgSoft,
          textTransform: 'uppercase', marginBottom: 8,
        }}>
          {won && breakdown ? `${t.solved} in ${breakdown.attempt}` : t.outOfGuesses}
        </div>
        <h2 style={{
          margin: 0,
          fontFamily: 'var(--font-instrument-serif), Georgia, serif',
          fontSize: 44, lineHeight: 1,
          fontStyle: 'italic',
          letterSpacing: -1,
          color: T.fg,
        }}>{targetWord.toLowerCase()}</h2>
        {won && breakdown && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            margin: '20px 0 6px', fontSize: 13, color: T.fgSoft,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 40 }}>
              <span>{t.baseScore}</span>
              <span style={{ color: T.fg, fontWeight: 500 }}>{breakdown.base}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 40 }}>
              <span>{t.attemptBonus}</span>
              <span style={{ color: T.accent, fontWeight: 500 }}>×{breakdown.multiplier}</span>
            </div>
            {breakdown.longWordBonus > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 40 }}>
                <span>{t.longWordBonus}</span>
                <span style={{ color: T.correct, fontWeight: 500 }}>+{breakdown.longWordBonus}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', gap: 40,
              borderTop: `1px solid ${T.tileBorder}`, paddingTop: 6, marginTop: 2,
            }}>
              <span style={{ color: T.fg, fontWeight: 600 }}>{t.finalScore}</span>
              <span style={{
                fontFamily: 'var(--font-instrument-serif), Georgia, serif',
                fontSize: 22, lineHeight: 1, color: T.correct, fontWeight: 600,
              }}>{breakdown.total}</span>
            </div>
          </div>
        )}
        {gameMode === 'daily' && (
          <div style={{
            fontSize: 12, color: T.fgSoft, margin: '12px 0 18px',
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          }}>{t.comesBackTomorrow}</div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onPlayAgain} style={{
            flex: 1, maxWidth: 200,
            height: 50, borderRadius: 14,
            background: T.fg, color: T.bg,
            border: 'none',
            fontWeight: 600, fontSize: 15,
            cursor: 'pointer',
          }}>{gameMode === 'daily' ? t.practice : t.playAgain}</button>
          <button onClick={onClose} style={{
            flex: 1, maxWidth: 200,
            height: 50, borderRadius: 14,
            background: 'transparent', color: T.fg,
            border: `1.5px solid ${T.tileBorder}`,
            fontWeight: 600, fontSize: 15,
            cursor: 'pointer',
          }}>Share</button>
        </div>
      </div>
    </div>
  );
}
