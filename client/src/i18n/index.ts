export type { LangCode, TranslationMap } from './types';

export { default as en } from './en';
export { default as es } from './es';
export { default as fr } from './fr';
export { default as de } from './de';
export { default as ja } from './ja';
export { default as pt } from './pt';
export { default as vi } from './vi';
export { default as zh } from './zh';

export const LANGUAGES: { code: import('./types').LangCode; label: string; native: string; flag: string }[] = [
  { code: 'en', label: 'English',    native: 'English',    flag: '🇺🇸' },
  { code: 'es', label: 'Spanish',    native: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'French',     native: 'Français',   flag: '🇫🇷' },
  { code: 'de', label: 'German',     native: 'Deutsch',    flag: '🇩🇪' },
  { code: 'ja', label: 'Japanese',   native: '日本語',       flag: '🇯🇵' },
  { code: 'pt', label: 'Portuguese', native: 'Português',  flag: '🇧🇷' },
  { code: 'vi', label: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh', label: 'Chinese',    native: '中文',         flag: '🇨🇳' },
];
