// js/helplines.js — vetted per-country drug-advice/poison help lines + country setting.
// Priority: on-call nurse line → poison information → emergency (only if no advice line).
// Only public-callable, high/med-confidence lines are listed here; clinician-only poison
// lines are deliberately excluded. Countries with no confirmed public advice line fall back
// to `other`, which points at the WHO World Directory of Poisons Centres.
// Sourced from docs/research/helplines-*.md (research pass 2026-06-18). Verify before relying.

export const HELP_LINES = {
  // ── Oceania ──────────────────────────────────────────────────────────────
  AU: { country: 'Australia', advice: [
    { kind: 'nurse', label: 'healthdirect — 24/7 nurse line', number: '1800 022 222', note: 'General health advice' },
    { kind: 'poison', label: 'Poisons Information Centre', number: '13 11 26', note: 'Medicines & overdose, 24/7' },
  ], emergency: { label: 'Emergency', number: '000' } },
  NZ: { country: 'New Zealand', advice: [
    { kind: 'nurse', label: 'Healthline', number: '0800 611 116', note: '24/7 nurse advice' },
    { kind: 'poison', label: 'National Poisons Centre', number: '0800 764 766', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '111' } },

  // ── Europe ───────────────────────────────────────────────────────────────
  UK: { country: 'United Kingdom', advice: [
    { kind: 'nurse', label: 'NHS 111', number: '111', note: 'Nurse-led advice, incl. poisoning' },
  ], emergency: { label: 'Emergency', number: '999' } },
  IE: { country: 'Ireland', advice: [
    { kind: 'nurse', label: 'HSE Live', number: '1800 700 700', note: 'Health info (Mon–Sat, daytime)' },
    { kind: 'poison', label: 'National Poisons Information Centre', number: '01 809 2166', note: '8am–10pm daily' },
  ], emergency: { label: 'Emergency', number: '112' } },
  AT: { country: 'Austria', advice: [
    { kind: 'nurse', label: 'Gesundheitshotline 1450', number: '1450', note: '24/7 nurse line' },
    { kind: 'poison', label: 'Vergiftungsinformationszentrale', number: '+43 1 406 43 43', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  BE: { country: 'Belgium', advice: [
    { kind: 'nurse', label: 'Medical on-call 1733', number: '1733', note: 'GP out-of-hours triage' },
    { kind: 'poison', label: 'Antigifcentrum / Centre Antipoisons', number: '070 245 245', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  BG: { country: 'Bulgaria', advice: [
    { kind: 'poison', label: 'National Toxicology Centre', number: '+359 2 9154 233', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  CH: { country: 'Switzerland', advice: [
    { kind: 'nurse', label: 'Medgate medical hotline', number: '0800 789 789' },
    { kind: 'poison', label: 'Tox Info Suisse', number: '145', note: '24/7, free' },
  ], emergency: { label: 'Emergency', number: '112' } },
  CZ: { country: 'Czechia', advice: [
    { kind: 'poison', label: 'Toxicological Information Centre (TIS)', number: '+420 224 919 293', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  DE: { country: 'Germany', advice: [
    { kind: 'nurse', label: 'Medical on-call 116117', number: '116117', note: '24/7' },
    { kind: 'poison', label: 'Giftnotruf (Berlin)', number: '030 19240', note: 'Regional centres — Berlin shown; 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  DK: { country: 'Denmark', advice: [
    { kind: 'nurse', label: 'Medical Helpline 1813', number: '1813', note: 'Capital Region; other regions vary' },
    { kind: 'poison', label: 'Giftlinjen', number: '+45 82 12 12 12', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  EE: { country: 'Estonia', advice: [
    { kind: 'poison', label: 'Poisoning Information Centre', number: '16662', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  ES: { country: 'Spain', advice: [
    { kind: 'nurse', label: 'Medical advice 061', number: '061', note: 'Regional, varies' },
    { kind: 'poison', label: 'Servicio de Información Toxicológica', number: '+34 91 562 04 20', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  FI: { country: 'Finland', advice: [
    { kind: 'nurse', label: 'Medical Helpline 116117', number: '116117', note: '24/7' },
    { kind: 'poison', label: 'Myrkytystietokeskus', number: '0800 147 111', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  FR: { country: 'France', advice: [
    { kind: 'poison', label: 'Centre Antipoison (Paris)', number: '+33 1 40 05 48 48', note: 'Any regional CAP, 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  GR: { country: 'Greece', advice: [
    { kind: 'poison', label: 'Poison Information Centre', number: '+30 210 779 3777', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  HR: { country: 'Croatia', advice: [
    { kind: 'poison', label: 'Poison Control Centre', number: '+385 1 2348 342', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  HU: { country: 'Hungary', advice: [
    { kind: 'nurse', label: 'Health information line', number: '1812', note: '24/7' },
    { kind: 'poison', label: 'ETTSZ poison information', number: '+36 80 201 199', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  IS: { country: 'Iceland', advice: [
    { kind: 'poison', label: 'Poison Centre (Landspítali)', number: '+354 543 2222', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  IT: { country: 'Italy', advice: [
    { kind: 'poison', label: 'Centro Antiveleni (Milano)', number: '+39 02 6610 1029', note: 'Regional centres; 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  LT: { country: 'Lithuania', advice: [
    { kind: 'poison', label: 'Poison Control & Information Bureau', number: '+370 5 236 2052', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  LU: { country: 'Luxembourg', advice: [
    { kind: 'poison', label: 'Antipoison Centre (Belgium)', number: '8002 5500', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  LV: { country: 'Latvia', advice: [
    { kind: 'poison', label: 'Poisoning & Medicines Information Centre', number: '+371 67 042 473', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  MT: { country: 'Malta', advice: [
    { kind: 'poison', label: 'National Poisons Centre', number: '1774', note: '8am–8pm; outside hours call 112' },
  ], emergency: { label: 'Emergency', number: '112' } },
  NL: { country: 'Netherlands', advice: [
    { kind: 'nurse', label: 'GP out-of-hours (huisartsenpost)', number: '0900 1515', note: 'Poison line is clinicians-only — call 112 in an emergency' },
  ], emergency: { label: 'Emergency', number: '112' } },
  NO: { country: 'Norway', advice: [
    { kind: 'nurse', label: 'Legevakt (out-of-hours)', number: '116117', note: '24/7' },
    { kind: 'poison', label: 'Giftinformasjonen', number: '+47 22 59 13 00', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  PL: { country: 'Poland', advice: [
    { kind: 'nurse', label: 'NFZ patient info line', number: '800 190 590', note: 'Free, 24/7' },
    { kind: 'poison', label: 'Toxicology centre (Warsaw)', number: '+48 22 619 6654', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  PT: { country: 'Portugal', advice: [
    { kind: 'nurse', label: 'SNS 24', number: '808 24 24 24', note: 'Nurse triage, 24/7' },
    { kind: 'poison', label: 'CIAV antipoison centre', number: '800 250 250', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  RO: { country: 'Romania', advice: [
    { kind: 'poison', label: 'Toxicology Information Centre', number: '+40 21 599 2300' },
  ], emergency: { label: 'Emergency', number: '112' } },
  RS: { country: 'Serbia', advice: [
    { kind: 'poison', label: 'National Poison Control Centre', number: '+381 11 3672 187', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  SE: { country: 'Sweden', advice: [
    { kind: 'nurse', label: '1177 health advice', number: '1177', note: '24/7' },
    { kind: 'poison', label: 'Giftinformationscentralen', number: '+46 10 456 6700', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  SI: { country: 'Slovenia', advice: [
    { kind: 'poison', label: 'Poison Control Centre (UKC Ljubljana)', number: '+386 1 400 6039', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  SK: { country: 'Slovakia', advice: [
    { kind: 'nurse', label: 'Linka Zdravia', number: '0850 111 313', note: '24/7 first-aid advice' },
    { kind: 'poison', label: 'National Toxicology Information Centre', number: '+421 2 5477 4166', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  TR: { country: 'Turkey', advice: [
    { kind: 'poison', label: 'UZEM (ALO 114)', number: '114', note: 'Free, 24/7' },
    { kind: 'nurse', label: 'SABİM health line', number: '184' },
  ], emergency: { label: 'Emergency', number: '112' } },

  // ── Asia & Middle East ───────────────────────────────────────────────────
  JP: { country: 'Japan', advice: [
    { kind: 'poison', label: 'Japan Poison Information Center', number: '+81 72 727 2499', note: 'Japanese only; 24/7' },
  ], emergency: { label: 'Emergency', number: '119' } },
  KR: { country: 'South Korea', advice: [
    { kind: 'nurse', label: 'Emergency Medical Info (multilingual)', number: '1339', note: '24/7' },
    { kind: 'poison', label: 'Seoul Poison Control Center', number: '1855 2221', note: 'Weekday hours' },
  ], emergency: { label: 'Emergency', number: '119' } },
  TW: { country: 'Taiwan', advice: [
    { kind: 'poison', label: 'National Poison Center', number: '02 2871 7121', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '119' } },
  SG: { country: 'Singapore', advice: [
    { kind: 'nurse', label: 'NurseFirst', number: '6262 6262', note: 'Daily 8am–11pm, free' },
    { kind: 'poison', label: 'Drug & Poison Info Centre (SGH)', number: '6423 9119', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '995' } },
  MY: { country: 'Malaysia', advice: [
    { kind: 'poison', label: 'National Poison Centre', number: '04 653 6999', note: 'Daytime; outside hours call 999' },
  ], emergency: { label: 'Emergency', number: '999' } },
  TH: { country: 'Thailand', advice: [
    { kind: 'poison', label: 'Ramathibodi Poison Center', number: '1367', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '1669' } },
  ID: { country: 'Indonesia', advice: [
    { kind: 'poison', label: 'Halo BPOM', number: '1500 533', note: 'Business hours' },
  ], emergency: { label: 'Emergency', number: '112' } },
  PH: { country: 'Philippines', advice: [
    { kind: 'nurse', label: 'DOH health line', number: '1555' },
    { kind: 'poison', label: 'National Poison Centre (PGH)', number: '02 8524 1078', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '911' } },
  VN: { country: 'Vietnam', advice: [
    { kind: 'poison', label: 'Poison Control Center (Bach Mai)', number: '1900 888 866', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '115' } },
  KH: { country: 'Cambodia', advice: [
    { kind: 'poison', label: 'Calmette Hospital Toxicology', number: '+855 23 426 948', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '119' } },
  IN: { country: 'India', advice: [
    { kind: 'nurse', label: 'State health helpline', number: '104', note: 'Most states, 24/7' },
    { kind: 'poison', label: 'National Poisons Information Centre (AIIMS)', number: '1800 116 117', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  LK: { country: 'Sri Lanka', advice: [
    { kind: 'poison', label: 'National Poisons Information Centre', number: '011 268 6143', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '110' } },
  NP: { country: 'Nepal', advice: [
    { kind: 'poison', label: 'Poison Information Centre (TUTH)', number: '01 4502011', note: 'Established 2023 — verify' },
  ], emergency: { label: 'Emergency', number: '102' } },
  UZ: { country: 'Uzbekistan', advice: [
    { kind: 'poison', label: 'Republican Toxicology Centre', number: '+998 71 291 4545' },
  ], emergency: { label: 'Emergency', number: '103' } },
  IL: { country: 'Israel', advice: [
    { kind: 'poison', label: 'Israel Poison Information Center', number: '04 777 1900', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '101' } },
  JO: { country: 'Jordan', advice: [
    { kind: 'poison', label: 'Pharmacy One Poison Call Center', number: '+962 7 9171 2222', note: 'Private service, 24/7' },
  ], emergency: { label: 'Emergency', number: '911' } },
  LB: { country: 'Lebanon', advice: [
    { kind: 'nurse', label: 'MOH health hotline', number: '1214' },
    { kind: 'poison', label: 'Poison Control Center (USJ)', number: '+961 1 421 259', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  KW: { country: 'Kuwait', advice: [
    { kind: 'poison', label: 'Kuwait Poison Control Center', number: '1804774', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  QA: { country: 'Qatar', advice: [
    { kind: 'nurse', label: 'PHCC Health Advice Line', number: '16000', note: 'Nurse triage' },
    { kind: 'poison', label: 'Qatar Poison Center', number: '+974 4003 1111', note: '9am–1am, free' },
  ], emergency: { label: 'Emergency', number: '999' } },
  SA: { country: 'Saudi Arabia', advice: [
    { kind: 'nurse', label: 'MOH 937 (doctors & nurses)', number: '937', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '997' } },
  AE: { country: 'United Arab Emirates', advice: [
    { kind: 'poison', label: 'Drug & Poison Info (Abu Dhabi)', number: '800 424', note: 'Abu Dhabi; daytime' },
  ], emergency: { label: 'Emergency', number: '998' } },

  // ── Americas ─────────────────────────────────────────────────────────────
  CA: { country: 'Canada', advice: [
    { kind: 'nurse', label: 'Health Link / Telehealth', number: '811', note: 'Most provinces' },
    { kind: 'poison', label: 'Poison Centres', number: '1-844-764-7669', note: 'Québec: 1-800-463-5060' },
  ], emergency: { label: 'Emergency', number: '911' } },
  US: { country: 'United States', advice: [
    { kind: 'poison', label: 'Poison Help', number: '1-800-222-1222', note: '24/7 medicines & overdose advice' },
  ], emergency: { label: 'Emergency', number: '911' } },
  GT: { country: 'Guatemala', advice: [
    { kind: 'poison', label: 'CIAT-USAC', number: '1801 0029832', note: 'Toll-free, 24/7' },
  ], emergency: { label: 'Emergency', number: '125' } },
  SV: { country: 'El Salvador', advice: [
    { kind: 'poison', label: 'CIATOX', number: '+503 6027 1459', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '911' } },
  HN: { country: 'Honduras', advice: [
    { kind: 'poison', label: 'CENTOX (UNAH)', number: '+504 2216 5166', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '911' } },
  NI: { country: 'Nicaragua', advice: [
    { kind: 'poison', label: 'CIVATOX (MINSA)', number: '+505 2894 7990' },
  ], emergency: { label: 'Emergency', number: '128' } },
  CR: { country: 'Costa Rica', advice: [
    { kind: 'poison', label: 'CNCI', number: '800 4686 9422', note: 'Toll-free, 24/7' },
  ], emergency: { label: 'Emergency', number: '911' } },
  CU: { country: 'Cuba', advice: [
    { kind: 'poison', label: 'CENATOX', number: '+53 7 274 3008' },
  ], emergency: { label: 'Emergency', number: '104' } },
  JM: { country: 'Jamaica', advice: [
    { kind: 'poison', label: 'CARPIN poison info', number: '1-888-764-7666' },
  ], emergency: { label: 'Emergency', number: '110' } },
  BR: { country: 'Brazil', advice: [
    { kind: 'poison', label: 'Disque-Intoxicação (CIATox)', number: '0800 722 6001', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '192' } },
  AR: { country: 'Argentina', advice: [
    { kind: 'poison', label: 'Centro Nacional de Intoxicaciones', number: '0800 333 0160', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '911' } },
  CL: { country: 'Chile', advice: [
    { kind: 'poison', label: 'CITUC', number: '+56 2 2635 3800', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '131' } },
  UY: { country: 'Uruguay', advice: [
    { kind: 'poison', label: 'CIAT', number: '1722', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '911' } },
  PY: { country: 'Paraguay', advice: [
    { kind: 'poison', label: 'CNTox', number: '+595 21 220 418' },
  ], emergency: { label: 'Emergency', number: '911' } },
  PE: { country: 'Peru', advice: [
    { kind: 'poison', label: 'CICOTOX (UNMSM)', number: '0800 1 3040', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '106' } },
  EC: { country: 'Ecuador', advice: [
    { kind: 'poison', label: 'CIATOX (MSP)', number: '1800 836 366', note: 'Free, 24/7' },
  ], emergency: { label: 'Emergency', number: '911' } },
  CO: { country: 'Colombia', advice: [
    { kind: 'poison', label: 'CISPROQUIM', number: '018000 916 012', note: 'Toll-free, 24/7' },
  ], emergency: { label: 'Emergency', number: '123' } },
  VE: { country: 'Venezuela', advice: [
    { kind: 'poison', label: 'SIMET/CIATO (UCV)', number: '0800 8694267' },
  ], emergency: { label: 'Emergency', number: '911' } },

  // ── Africa ───────────────────────────────────────────────────────────────
  ZA: { country: 'South Africa', advice: [
    { kind: 'poison', label: 'Poisons Information Helpline (AfriTox)', number: '0861 555 777', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  DZ: { country: 'Algeria', advice: [
    { kind: 'poison', label: 'Centre Antipoison (Alger)', number: '+213 21 97 98 98', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '14' } },
  EG: { country: 'Egypt', advice: [
    { kind: 'nurse', label: 'MOH hotline', number: '16474' },
    { kind: 'poison', label: 'Poison Control Centre (Ain Shams)', number: '02 2434 6127', note: '24/7' },
  ], emergency: { label: 'Emergency', number: '123' } },
  MA: { country: 'Morocco', advice: [
    { kind: 'poison', label: 'CAPM antipoison centre', number: '0801 00 18 01', note: 'Toll-free, 24/7' },
  ], emergency: { label: 'Emergency', number: '15' } },
  TN: { country: 'Tunisia', advice: [
    { kind: 'poison', label: 'Centre National de Pharmacovigilance', number: '+216 71 56 47 63' },
  ], emergency: { label: 'Emergency', number: '190' } },
  KE: { country: 'Kenya', advice: [
    { kind: 'poison', label: 'National Poison Information Centre (KNH)', number: '0800 720 021', note: 'Toll-free' },
  ], emergency: { label: 'Emergency', number: '112' } },
  GH: { country: 'Ghana', advice: [
    { kind: 'poison', label: 'Poisons Information Centre (Accra)', number: '+233 800 100 46', note: 'Toll-free, 24/7' },
  ], emergency: { label: 'Emergency', number: '112' } },
  SN: { country: 'Senegal', advice: [
    { kind: 'poison', label: 'Centre Antipoison du Sénégal', number: '+221 818 00 15 15' },
  ], emergency: { label: 'Emergency', number: '1515' } },
  ET: { country: 'Ethiopia', advice: [
    { kind: 'poison', label: 'Toxicology Centre (St Peter Hospital)', number: '+251 911 480 507' },
  ], emergency: { label: 'Emergency', number: '907' } },
  MW: { country: 'Malawi', advice: [
    { kind: 'nurse', label: 'Chipatala Cha Pa Foni', number: '54747', note: 'Toll-free nurse hotline, 24/7' },
  ], emergency: { label: 'Emergency', number: '998' } },

  // ── Fallback ─────────────────────────────────────────────────────────────
  other: { country: 'Other / not listed', advice: [],
    directory: { label: 'WHO World Directory of Poisons Centres', url: 'https://apps.who.int/poisoncentres/' },
    emergency: { label: 'Local emergency number', number: null } },
};

// Display order for the country picker: alphabetical by name, with Other last.
export const COUNTRY_OPTIONS = Object.entries(HELP_LINES)
  .filter(([code]) => code !== 'other')
  .map(([code, e]) => [code, e.country])
  .sort((a, b) => a[1].localeCompare(b[1]))
  .concat([['other', 'Other / not listed']]);

export function helpLinesFor(code) { return HELP_LINES[code] || HELP_LINES.other; }

const COUNTRY_KEY = 'dosegrid.country';
export function getCountry() { try { return localStorage.getItem(COUNTRY_KEY) || 'AU'; } catch { return 'AU'; } }
export function setCountry(code) { try { localStorage.setItem(COUNTRY_KEY, code); } catch { /* ignore */ } }
