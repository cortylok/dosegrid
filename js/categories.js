// js/categories.js — ordered PRN/short-term category ids → labels (single source)
export const CATEGORIES = [
  { id: 'pain-fever', label: 'Pain & fever' },
  { id: 'allergy', label: 'Allergy' },
  { id: 'antibiotic', label: 'Antibiotics (short course)' },
  { id: 'nausea', label: 'Nausea & motion sickness' },
  { id: 'reflux', label: 'Reflux & indigestion' },
  { id: 'cough-cold', label: 'Cough, cold & decongestant' },
  { id: 'gut', label: 'Diarrhoea & constipation' },
  { id: 'migraine', label: 'Migraine' },
  { id: 'cramps', label: 'Cramps & period pain' },
  { id: 'steroid-short', label: 'Short-course steroids' },
  { id: 'sleep', label: 'Sleep & short-term calm' },
  { id: 'antifungal', label: 'Antifungal (short course)' },
  { id: 'antiviral', label: 'Antiviral (short course)' },
  { id: 'reliever', label: 'Reliever inhaler' },
  { id: 'throat-mouth', label: 'Throat & mouth' },
  { id: 'skin', label: 'Skin & topical relief' },
  { id: 'urinary', label: 'Cystitis relief' },
  { id: 'eye-ear', label: 'Eye & ear (short course)' },
  { id: 'custom', label: 'Other / custom' },
];
export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
export const CATEGORY_ORDER = CATEGORIES.map((c) => c.id);

// Categories whose meds are taken on a schedule/course by default (vs as-needed).
export const SCHEDULED_CATEGORIES = new Set(['antibiotic', 'steroid-short', 'antiviral', 'antifungal']);

// Effective dosing model: explicit med.doseType wins, else category default, else 'prn'.
export function resolveDoseType(med) {
  if (med && (med.doseType === 'prn' || med.doseType === 'scheduled')) return med.doseType;
  return med && SCHEDULED_CATEGORIES.has(med.category) ? 'scheduled' : 'prn';
}
