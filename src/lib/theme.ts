export const T = {
  bg: '#0F0F17',
  bgAlt: '#161622',
  fg: '#F4EFE2',
  fgSoft: '#9B9685',
  accent: '#FFB17A',
  correct: '#6FA75B',
  present: '#E0A94A',
  absent: '#3B3B45',
  tileEmpty: '#191923',
  tileBorder: '#2B2B36',
  tileShadow: 'rgba(0,0,0,0.5)',
  multTWS: '#E26A4A',
  multDWS: '#E89B72',
  multTLS: '#5C95B5',
  multDLS: '#85B5CC',
  kbdBg: '#23232F',
  kbdAbsent: '#1B1B23',
  chipBg: '#23232F',
  overlay: 'rgba(0,0,0,0.65)',
};

export const MULT_LABEL: Record<string, string> = { TWS: '3W', DWS: '2W', TLS: '3L', DLS: '2L' };
export const MULT_COLOR: Record<string, string> = {
  TWS: T.multTWS, DWS: T.multDWS, TLS: T.multTLS, DLS: T.multDLS,
};
