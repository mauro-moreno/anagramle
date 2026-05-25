'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LetterState,
  MAX_ATTEMPTS,
  getMultipliers, calculateScore, evaluateGuess, evaluateKeyboard, getScrabblePoints,
} from '@/lib/game';
import { useGameState } from '@/hooks/useGameState';
import { TRANSLATIONS } from '@/lib/translations';
import { T } from '@/lib/theme';
import { Tile } from '@/components/Tile';
import { EndOverlay } from '@/components/EndOverlay';
import { KEYBOARD_LAYOUTS } from '@/lib/keyboard';

// ── Main component ────────────────────────────────────────────────────
export default function Home() {
  const { state, actions } = useGameState();
  const {
    targetWord, targetTokens, wordLength, boardRow, startCol, hintPositions,
    guesses, guessTokens, currentGuess, currentGuessTokens, currentRow,
    gameOver, won, guessScores, animatingRow, scoreBreakdown,
    showModal, language, gameMode,
  } = state;
  const { setLanguage, setGameMode, setShowModal, addChar, backspace, submitGuess, resetGame } = actions;

  const [showHelp, setShowHelp] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [scoreFlash, setScoreFlash] = useState(false);

  // Grid auto-sizing
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [tileSize, setTileSize] = useState(52);

  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const currentRowRef = useRef(0);
  currentRowRef.current = currentRow;

  const tr = TRANSLATIONS[language === 'en-world' ? 'en' : language];

  // ── Auto-size tiles ──────────────────────────────────────────────
  const measureTiles = useCallback(() => {
    if (!gridContainerRef.current || !wordLength) return;
    const w = gridContainerRef.current.getBoundingClientRect().width;
    if (w <= 0) return;
    const gap = wordLength <= 7 ? 6 : wordLength <= 10 ? 5 : 3;
    const px = Math.floor((w - gap * (wordLength - 1)) / wordLength);
    setTileSize(Math.min(64, Math.max(16, px)));
  }, [wordLength]);

  useEffect(() => {
    measureTiles();
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measureTiles)
      : null;
    if (ro && gridContainerRef.current) ro.observe(gridContainerRef.current);
    window.addEventListener('resize', measureTiles);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measureTiles);
    };
  }, [measureTiles]);

  // ── Input handlers (wire hook actions to UI feedback) ─────────────
  const handleKey = useCallback((ch: string) => { addChar(ch); }, [addChar]);
  const handleBackspace = useCallback(() => { backspace(); }, [backspace]);

  const handleSubmit = useCallback(async () => {
    const result = await submitGuess();
    if (!result.ok) {
      const msg = result.reason === 'invalid' ? tr.wordNotInDictionary : tr.validationFailed;
      setErrorMessage(msg);
      setShakeRow(currentRowRef.current);
      setTimeout(() => { setErrorMessage(''); setShakeRow(null); }, 600);
    } else {
      setScoreFlash(true);
      setTimeout(() => setScoreFlash(false), 600);
    }
  }, [submitGuess, tr.wordNotInDictionary, tr.validationFailed]);

  // ── Keyboard event listener ────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.key === 'Process') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (showLanguageDropdown) setShowLanguageDropdown(false);
      if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
      else if (e.key === 'Backspace') { e.preventDefault(); handleBackspace(); }
      else if (/^[a-zA-ZñÑ]$/.test(e.key)) { e.preventDefault(); handleKey(e.key.toUpperCase()); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSubmit, handleBackspace, handleKey, showLanguageDropdown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHelp) setShowHelp(false);
        else if (showModal) { setShowModal(false); resetGame(); }
      } else if (e.key === 'Enter' && showModal) {
        setShowModal(false); resetGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showHelp, showModal, resetGame]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };
    if (showLanguageDropdown) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [showLanguageDropdown]);


  // ── Derived values ─────────────────────────────────────────────────
  const multipliers = wordLength ? getMultipliers(wordLength, boardRow, startCol) : [];
  const pts = getScrabblePoints(language);
  const currentGuessScore = calculateScore(currentGuess, boardRow, startCol, language);
  const targetWordScore = calculateScore(targetWord, boardRow, startCol, language);

  const guessEvaluations = useMemo(
    () => guessTokens.map((tokens, r) =>
      r < currentRow && tokens.length > 0 ? evaluateGuess(tokens, targetTokens) : null
    ),
    [currentRow, guessTokens, targetTokens]
  );

  const keyboardStates = useMemo(
    () => evaluateKeyboard(guessTokens.slice(0, currentRow), targetTokens),
    [currentRow, guessTokens, targetTokens]
  );
  const hasUserInput = currentGuess.length > 0;

  // Closest score to target among submitted rows
  let bestScore = 0;
  let bestDiff = Infinity;
  for (let r = 0; r < currentRow; r++) {
    const s = guessScores[r];
    if (s === 0) continue;
    const diff = Math.abs(s - targetWordScore);
    if (diff < bestDiff) { bestDiff = diff; bestScore = s; }
  }

  // Gap between tiles (tighter for longer words)
  const gap = wordLength <= 7 ? 6 : wordLength <= 10 ? 5 : 3;

  const kbdRows = KEYBOARD_LAYOUTS[language];

  const kbdStateBg = (state: LetterState) =>
    state === 'correct' ? T.correct
    : state === 'present' ? T.present
    : state === 'absent' ? T.kbdAbsent
    : T.kbdBg;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebApplication",
                "@id": "https://anagramle.vercel.app/#webapp",
                "name": "Anagramle",
                "description": "A word puzzle game combining Wordle gameplay with Scrabble scoring.",
                "url": "https://anagramle.vercel.app",
                "applicationCategory": "Game",
                "operatingSystem": "Any",
                "inLanguage": ["en-US", "es-ES"],
                "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
              },
            ],
          })
        }}
      />

      <div style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        height: '100svh',
        background: T.bg, color: T.fg,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <header style={{
          flexShrink: 0,
          padding: '16px 18px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: T.accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-instrument-serif), Georgia, serif',
              fontSize: 18, lineHeight: 1, fontStyle: 'italic',
              position: 'relative',
              boxShadow: `0 1px 0 ${T.tileShadow}`,
              flexShrink: 0,
            }}>
              a
              <span style={{
                position: 'absolute', right: 3, bottom: 2,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 7, fontWeight: 600, opacity: 0.85,
              }}>1</span>
            </div>
            <div style={{
              fontFamily: 'var(--font-instrument-serif), Georgia, serif',
              fontSize: 22, lineHeight: 1, fontStyle: 'italic',
              letterSpacing: -0.3,
            }}>anagramle</div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Mode toggle */}
            <div style={{
              display: 'flex', alignItems: 'center',
              background: T.chipBg, borderRadius: 999, padding: 2, gap: 2,
            }}>
              {(['daily', 'practice'] as const).map(m => (
                <button key={m} onClick={() => setGameMode(m)} style={{
                  height: 24, padding: '0 10px',
                  background: gameMode === m ? T.fg : 'transparent',
                  color: gameMode === m ? T.bg : T.fgSoft,
                  border: 'none', borderRadius: 999,
                  fontWeight: 600, fontSize: 11,
                  letterSpacing: 0.5, textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'background 200ms, color 200ms',
                  fontFamily: 'var(--font-geist-sans), sans-serif',
                }}>{m === 'daily' ? tr.daily : tr.practice}</button>
              ))}
            </div>
            {/* Language */}
            <div ref={languageDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                style={{
                  height: 28, padding: '0 10px',
                  background: T.chipBg, color: T.fg,
                  border: 'none', borderRadius: 999,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  cursor: 'pointer',
                  boxShadow: `0 1px 0 ${T.tileShadow}`,
                  fontFamily: 'var(--font-geist-sans), sans-serif',
                  fontSize: 12, fontWeight: 600,
                }}
              >
                <span>{language === 'es' ? '🇪🇸' : language === 'en-world' ? '🇬🇧' : '🇺🇸'}</span>
                <span style={{ fontSize: 8, color: T.fgSoft }}>{showLanguageDropdown ? '▲' : '▼'}</span>
              </button>
              {showLanguageDropdown && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: T.bgAlt,
                  border: `1px solid ${T.tileBorder}`,
                  borderRadius: 12, overflow: 'hidden',
                  zIndex: 50,
                  boxShadow: `0 8px 24px ${T.tileShadow}`,
                }}>
                  {(['en', 'en-world', 'es'] as const).map(lang => (
                    <button key={lang} onClick={() => { setLanguage(lang); setShowLanguageDropdown(false); }} style={{
                      display: 'block', width: '100%',
                      padding: '10px 16px',
                      background: language === lang ? T.chipBg : 'transparent',
                      color: T.fg, border: 'none',
                      cursor: 'pointer', fontSize: 18, textAlign: 'center',
                    }}>
                      {lang === 'en' ? '🇺🇸' : lang === 'en-world' ? '🇬🇧' : '🇪🇸'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Help */}
            <button
              onClick={() => setShowHelp(true)}
              style={{
                width: 28, height: 28, padding: 0,
                background: T.chipBg, color: T.fgSoft,
                border: 'none', borderRadius: 999,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                fontFamily: 'var(--font-instrument-serif), serif',
                fontSize: 16, fontStyle: 'italic',
                boxShadow: `0 1px 0 ${T.tileShadow}`,
              }}
            >?</button>
          </div>
        </header>

        {/* ── Score row ──────────────────────────────────────────────── */}
        <section style={{
          flexShrink: 0,
          padding: '8px 18px 10px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              fontSize: 10, letterSpacing: 1.5, color: T.fgSoft,
              textTransform: 'uppercase', marginBottom: 2,
            }}>{tr.thisGuess}</div>
            <div className={scoreFlash ? 'score-flash' : ''} style={{
              fontFamily: 'var(--font-instrument-serif), Georgia, serif',
              fontSize: 36, lineHeight: 1,
              color: hasUserInput ? T.fg : T.fgSoft,
              display: 'flex', alignItems: 'baseline', gap: 6,
              transformOrigin: 'left bottom',
            }}>
              {hasUserInput ? currentGuessScore + (wordLength >= 7 ? 50 : 0) : '—'}
              {bestScore > 0 && (
                <span style={{
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  fontSize: 11, color: T.fgSoft, fontStyle: 'normal',
                }}>{tr.best} {bestScore}</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              fontSize: 10, letterSpacing: 1.5, color: T.fgSoft,
              textTransform: 'uppercase', marginBottom: 2,
            }}>{tr.target}</div>
            <div style={{
              fontFamily: 'var(--font-instrument-serif), Georgia, serif',
              fontSize: 28, lineHeight: 1,
              color: T.correct, fontStyle: 'italic',
            }}>{targetWordScore ? targetWordScore + (wordLength >= 7 ? 50 : 0) : '—'}</div>
          </div>
        </section>

        {/* ── Attempt dots ────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          padding: '0 18px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => {
              const used = i < currentRow;
              const isNext = i === currentRow && !gameOver;
              return (
                <span key={i} style={{
                  width: isNext ? 24 : 8, height: 4, borderRadius: 4,
                  background: used ? T.accent : isNext ? T.fg : T.tileBorder,
                  opacity: used ? 0.6 : 1,
                  transition: 'width 240ms ease, background 240ms ease',
                  display: 'block',
                }} />
              );
            })}
          </div>
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            fontSize: 10, color: T.fgSoft, letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            {gameOver
              ? (won ? tr.solvedLabel : tr.finishedLabel)
              : `${MAX_ATTEMPTS - currentRow} ${tr.leftLabel}`}
          </span>
        </div>

        {/* ── Tile grid ───────────────────────────────────────────────── */}
        <div style={{ flexShrink: 0, padding: '0 18px', position: 'relative' }}>
          {errorMessage && (
            <div style={{
              position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)',
              zIndex: 20, padding: '6px 14px',
              background: T.bgAlt,
              border: `1px solid ${T.tileBorder}`,
              color: T.fg,
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: `0 4px 16px ${T.tileShadow}`,
            }}>
              {errorMessage}
            </div>
          )}
          <div ref={gridContainerRef} style={{ width: '100%' }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap,
            width: tileSize ? `${wordLength * tileSize + (wordLength - 1) * gap}px` : '100%',
            maxWidth: '100%',
            margin: '0 auto',
          }}>
            {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIndex) => {
              const isCurrent = rowIndex === currentRow && !gameOver;
              const isSubmitted = rowIndex < currentRow || (rowIndex === currentRow && gameOver && guessTokens[rowIndex]?.length > 0);
              const rowTokens = isCurrent ? currentGuessTokens : (guessTokens[rowIndex] || []);

              // Cursor: first unfilled position in current row
              const cursorCol = isCurrent
                ? (() => {
                    let typed = 0;
                    for (let ci = 0; ci < wordLength; ci++) {
                      if (typed >= currentGuessTokens.length) return ci;
                      typed++;
                    }
                    return -1;
                  })()
                : -1;

              return (
                <div key={rowIndex} style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${wordLength || 6}, minmax(0, 1fr))`,
                  gap,
                  animation: shakeRow === rowIndex ? 'shake 400ms ease' : undefined,
                }}>
                  {Array.from({ length: wordLength }).map((_, colIndex) => {
                    let ch = '';
                    let state: LetterState = 'empty';
                    let isHint = false;

                    if (isCurrent) {
                      ch = rowTokens[colIndex] || '';
                      if (!ch && hintPositions.has(colIndex)) {
                        ch = targetTokens[colIndex] || '';
                        isHint = true;
                      }
                    } else if (isSubmitted) {
                      ch = rowTokens[colIndex] || '';
                      state = guessEvaluations[rowIndex]?.[colIndex] ?? 'empty';
                    }

                    const isAnimating = animatingRow === rowIndex;

                    return (
                      <Tile
                        key={colIndex}
                        ch={ch}
                        state={isSubmitted ? state : 'empty'}
                        multiplier={multipliers[colIndex]}
                        isCurrent={colIndex === cursorCol}
                        isHint={isHint}
                        size={tileSize}
                        scrabblePoints={pts}
                      />
                    );
                    void isAnimating;
                  })}
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* ── Flex spacer ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 8 }} />

        {/* ── Keyboard ────────────────────────────────────────────────── */}
        <section style={{ flexShrink: 0, padding: '8px 10px 32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            {kbdRows.map((row, ri) => (
              <div key={ri} style={{
                display: 'flex', gap: 5,
                padding: ri === 1 ? '0 16px' : 0,
              }}>
                {ri === 2 && (
                  <button
                    onClick={handleSubmit}
                    style={{
                      flex: 1.6, height: 44, minWidth: 0, padding: 0,
                      borderRadius: 10, border: 'none',
                      background: T.kbdBg, color: T.fg,
                      fontWeight: 600, fontSize: 12,
                      textTransform: 'uppercase', letterSpacing: 0.8,
                      cursor: 'pointer',
                      boxShadow: `0 1px 0 ${T.tileShadow}`,
                    }}
                  >{tr.enter}</button>
                )}
                {row.map(L => {
                  const st = keyboardStates.get(L) ?? 'empty';
                  const bg = kbdStateBg(st);
                  const fg = st !== 'empty' ? '#fff' : T.fg;
                  return (
                    <button key={L} onClick={() => handleKey(L)} style={{
                      flex: 1, height: 44, minWidth: 0, padding: 0,
                      borderRadius: 10, border: 'none',
                      background: bg, color: fg,
                      fontWeight: 600,
                      fontSize: L.length > 1 ? 14 : 17,
                      position: 'relative',
                      cursor: 'pointer',
                      boxShadow: `0 1px 0 ${T.tileShadow}`,
                      transition: 'transform 80ms ease, background 200ms ease',
                    }}>
                      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {L}
                        {pts[L] !== undefined && (
                          <span style={{
                            position: 'absolute', bottom: -11, right: -9,
                            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                            fontSize: 9, fontWeight: 500, opacity: 0.65,
                          }}>{pts[L]}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {ri === 2 && (
                  <button onClick={handleBackspace} style={{
                    flex: 1.6, height: 44, minWidth: 0, padding: 0,
                    borderRadius: 10, border: 'none',
                    background: T.kbdBg, color: T.fg,
                    fontWeight: 600, fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: `0 1px 0 ${T.tileShadow}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
                      <path d="M7 1.5h12.5a1.5 1.5 0 011.5 1.5v10a1.5 1.5 0 01-1.5 1.5H7L1 8 7 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M10 5.5l5 5M15 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}

          </div>
        </section>

        {/* ── End overlay ─────────────────────────────────────────────── */}
        {showModal && (
          <EndOverlay
            won={won}
            targetWord={targetWord}
            breakdown={won ? scoreBreakdown : null}
            gameMode={gameMode}
            onClose={() => setShowModal(false)}
            onPlayAgain={() => { setShowModal(false); resetGame(); }}
            t={tr}
          />
        )}

        {/* ── Help sheet ──────────────────────────────────────────────── */}
        {showHelp && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 100,
            background: T.overlay,
            display: 'flex', alignItems: 'flex-end',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }} onClick={() => setShowHelp(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              width: '100%',
              background: T.bgAlt,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              padding: '20px 24px 44px',
              animation: 'sheetUp 360ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              boxShadow: `0 -8px 30px ${T.tileShadow}`,
              maxHeight: '88vh',
              overflowY: 'auto',
            }}>
              {/* Pull handle */}
              <div style={{
                width: 36, height: 4, borderRadius: 4,
                background: T.tileBorder,
                margin: '0 auto 20px',
              }} />

              <h2 style={{
                fontFamily: 'var(--font-instrument-serif), serif',
                fontSize: 32, lineHeight: 1, fontStyle: 'italic', letterSpacing: -0.5,
                margin: '0 0 6px', color: T.fg,
              }}>{tr.howToPlay}</h2>
              <p style={{ color: T.fgSoft, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
                {tr.quickGuide}
              </p>

              {/* Color guide */}
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                color: T.fgSoft, marginBottom: 10,
              }}>{tr.colorGuide}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {([
                  { bg: T.correct, ch: 'A', label: tr.correctPos },
                  { bg: T.present, ch: 'B', label: tr.wrongPos },
                  { bg: T.absent,  ch: 'C', label: tr.notInWord },
                ] as { bg: string; ch: string; label: string }[]).map(({ bg, ch, label }) => (
                  <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 7,
                      background: bg, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-instrument-serif), serif',
                      fontSize: 22, flexShrink: 0,
                      boxShadow: `0 2px 4px ${T.tileShadow}`,
                    }}>{ch}</div>
                    <span style={{ color: T.fgSoft, fontSize: 14, lineHeight: 1.4 }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Board multipliers */}
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                color: T.fgSoft, marginBottom: 10,
              }}>{tr.boardMultipliers}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 24 }}>
                {([
                  { color: T.multTWS, label: tr.multipliers.TWS, name: tr.tripleWordScore },
                  { color: T.multDWS, label: tr.multipliers.DWS, name: tr.doubleWordScore },
                  { color: T.multTLS, label: tr.multipliers.TLS, name: tr.tripleLetterScore },
                  { color: T.multDLS, label: tr.multipliers.DLS, name: tr.doubleLetterScore },
                ] as { color: string; label: string; name: string }[]).map(({ color, label, name }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: T.kbdBg, borderRadius: 10, padding: '10px 12px',
                  }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 999,
                      background: color, color: '#fff',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontWeight: 600, fontSize: 13, flexShrink: 0,
                    }}>{label}</span>
                    <span style={{ color: T.fgSoft, fontSize: 12, lineHeight: 1.3 }}>{name}</span>
                  </div>
                ))}
              </div>

              {/* Letter values */}
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
                color: T.fgSoft, marginBottom: 10,
              }}>{tr.letterValues}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {Object.entries(pts)
                  .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
                  .map(([letter, points]) => (
                    <div key={letter} style={{
                      aspectRatio: '1/1',
                      background: T.kbdBg, borderRadius: 7,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-instrument-serif), serif',
                      fontSize: letter.length > 1 ? 12 : 18,
                      color: T.fg, position: 'relative',
                    }}>
                      {letter}
                      <span style={{
                        position: 'absolute', bottom: 3, right: 4,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 8, fontWeight: 600, opacity: 0.6, color: T.fgSoft,
                      }}>{points}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
