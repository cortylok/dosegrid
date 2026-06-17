// js/helplines.js — vetted per-country drug-advice/poison help lines + country setting.
// Priority: on-call nurse line → poison information → emergency (only if no advice line).
// Comprehensive global source: WHO World Directory of Poisons Centres.

export const HELP_LINES = {
  AU: { country: 'Australia', advice: [
    { kind: 'nurse', label: 'healthdirect — 24/7 nurse line', number: '1800 022 222', note: 'General health advice' },
    { kind: 'poison', label: 'Poisons Information Centre', number: '13 11 26', note: 'Medicines & overdose, 24/7' },
  ], emergency: { label: 'Emergency', number: '000' } },
  NZ: { country: 'New Zealand', advice: [
    { kind: 'nurse', label: 'Healthline', number: '0800 611 116', note: '24/7 nurse advice' },
    { kind: 'poison', label: 'National Poisons Centre', number: '0800 764 766', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '111' } },
  UK: { country: 'United Kingdom', advice: [
    { kind: 'nurse', label: 'NHS 111', number: '111', note: 'Nurse-led advice, incl. poisoning' },
  ], emergency: { label: 'Emergency', number: '999' } },
  CA: { country: 'Canada', advice: [
    { kind: 'nurse', label: 'Health Link / Telehealth', number: '811', note: 'Most provinces' },
    { kind: 'poison', label: 'Poison Centres', number: '1-844-764-7669', note: 'Québec: 1-800-463-5060' },
  ], emergency: { label: 'Emergency', number: '911' } },
  US: { country: 'United States', advice: [
    { kind: 'poison', label: 'Poison Help', number: '1-800-222-1222', note: '24/7 medicines & overdose advice' },
  ], emergency: { label: 'Emergency', number: '911' } },
  IE: { country: 'Ireland', advice: [
    { kind: 'poison', label: 'National Poisons Information Centre', number: '01 809 2166' },
  ], emergency: { label: 'Emergency', number: '112' } },
  other: { country: 'Other / not listed', advice: [],
    directory: { label: 'WHO World Directory of Poisons Centres', url: 'https://apps.who.int/poisoncentres/' },
    emergency: { label: 'Local emergency number', number: null } },
};

export const COUNTRY_OPTIONS = [
  ['AU', 'Australia'], ['NZ', 'New Zealand'], ['UK', 'United Kingdom'],
  ['CA', 'Canada'], ['US', 'United States'], ['IE', 'Ireland'], ['other', 'Other / not listed'],
];

export function helpLinesFor(code) { return HELP_LINES[code] || HELP_LINES.other; }

const COUNTRY_KEY = 'dosegrid.country';
export function getCountry() { try { return localStorage.getItem(COUNTRY_KEY) || 'AU'; } catch { return 'AU'; } }
export function setCountry(code) { try { localStorage.setItem(COUNTRY_KEY, code); } catch { /* ignore */ } }
