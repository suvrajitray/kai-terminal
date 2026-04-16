export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5001';
export const APP_NAME = 'KAI Terminal';

export const BROKERS = [
  { id: 'upstox',  name: 'Upstox',  color: '#7B2FF7' },
  { id: 'zerodha', name: 'Zerodha', color: '#387ED1' },
] as const;

export const UNDERLYING_KEYS: Record<string, string> = {
  'NIFTY':     'NSE_INDEX|Nifty 50',
  'BANKNIFTY': 'NSE_INDEX|Nifty Bank',
  'FINNIFTY':  'NSE_INDEX|Nifty Fin Service',
  'SENSEX':    'BSE_INDEX|SENSEX',
  'BANKEX':    'BSE_INDEX|BANKEX',
};
