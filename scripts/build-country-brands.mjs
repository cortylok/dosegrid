import { readFile, writeFile } from 'node:fs/promises';
const files = ['meds-europe','meds-asia','meds-americas','meds-africa','meds-oceania','meds-africa-part2','meds-americas-part2'];
const meds = JSON.parse(await readFile('./medications.json'));
const SYN = { acetaminophen:'paracetamol', asa:'aspirin', albuterol:'salbutamol' };
const norm = s => s.toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const byNorm = new Map(meds.map(m => [norm(m.generic), m.generic]));
function mapGeneric(raw){
  let n = norm(raw);
  if (SYN[n]) n = SYN[n];
  if (byNorm.has(n)) return byNorm.get(n);
  const fw = n.split(' ')[0];
  const fwm = SYN[fw] || fw;
  if (byNorm.has(fwm)) return byNorm.get(fwm);
  return null;
}
function splitTop(s, ch){ const out=[]; let d=0,cur=''; for(const c of s){ if(c==='(')d++; else if(c===')')d=Math.max(0,d-1); if(c===ch&&d===0){out.push(cur);cur='';} else cur+=c; } out.push(cur); return out; }
// active-ingredient names that are not brands (drop if a "brand" is just these)
const ACTIVE = new Set(['asa','acetaminophen','paracetamol','ibuprofen','aspirin','naproxen','salbutamol','albuterol','diclofenac','codeine']);
function stripNoise(s){
  return s
    .replace(/\b\d+(\.\d+)?\s?(mg|mcg|µg|g|iu|ml|%)(\s?\/\s?\d+(\.\d+)?\s?(mg|mcg|g|ml|%))?/gi, '') // strengths "120 mg", "1.16%" (no trailing \b — % at end)
    .replace(/\s+\d+(\.\d+)?$/, '')                   // dangling trailing strength number ("Helicid 10"); keeps hyphenated "Dolo-650" & "24HR"
    .replace(/\s{2,}/g, ' ').trim();
}
function stripForm(b){
  let prev;
  do { prev = b; b = b.replace(/\s+(tablets?|tabs?|caplets?|caps?|capsules?|gel|cream|ointment|syrup|drops?|susp(ension)?|spray|nasal|sachets?|effervescent|liquid|elixir|lozenges?|patch(es)?|oral|soln|solution|sirop|jarabe|gotas|comprimidos?|otc|dispersible|chewable)$/i, '').trim(); } while (b !== prev);
  return b;
}
function isBrand(b){
  if(!b) return false;
  if(!/^[A-Z]/.test(b)) return false;               // brands start with an ASCII uppercase letter
  if(/^\d/.test(b)) return false;
  if(b.length > 30) return false;
  if(/[:\[\]()]/.test(b)) return false;
  if(b.split(/\s+/).length > 4) return false;       // brands are short
  // reject prose / status / generic words
  if(/\b(generi[ck]\w*|générique|various|none|rx|pom|combinations?|combos?|available|prescription|only|status|required|note|see|withdrawn|banned|controlled|restricted|sold|limited|imported|is|are|now|generally|mainly|mostly|usually|via|per|aka|found|widely|not|also|class|schedule)\b/i.test(b)) return false;
  return true;
}
function parseBrands(rest, gen){
  rest = rest.replace(/^[^0-9A-Za-z(]+/, '');        // strip leading arrow + spaces (encoding-agnostic)
  const head = rest.split(' [')[0].split(/\.\s/)[0].split('; ')[0];
  const gl = gen.toLowerCase();
  const out = [];
  for(const part of splitTop(head, ',')){
    const base = part.split(' (')[0].replace(/[*]+/g, ''); // drop the strength parenthetical FIRST
    for(let q of base.split('/')){                   // then split "Advil/Motrin", "Aspirin/Bayer"
      let b = stripForm(stripNoise(q.trim()));
      if(!isBrand(b)) continue;
      const bl = b.toLowerCase();
      if(bl === gl || ACTIVE.has(bl)) continue;      // skip the active/generic name itself
      if(!out.some(x => x.toLowerCase() === bl)) out.push(b);
    }
  }
  return out.slice(0, 6);
}
const BULLET = /^-\s+\*\*(.+?)\*\*\s*(.+)$/;
const HDR = /^##\s+.*\(([A-Z]{2})\)\s*$/;
const result = {};
for(const f of files){
  let txt; try { txt = await readFile(`./docs/research/${f}.md`,'utf8'); } catch { continue; }
  let iso=null;
  for(const line of txt.split(/\r?\n/)){
    const h=line.match(HDR); if(h){ iso=h[1]; continue; }
    if(!iso) continue;
    const m=line.match(BULLET); if(!m) continue;
    const gen=mapGeneric(m[1]); if(!gen) continue;
    const brands=parseBrands(m[2], gen); if(!brands.length) continue;
    result[iso]=result[iso]||{};
    if(!result[iso][gen]) result[iso][gen]=brands;
  }
}
console.log('countries:', Object.keys(result).length, '| total generic-mappings:', Object.values(result).reduce((n,o)=>n+Object.keys(o).length,0));
for(const c of ['GB','FR','US','IN','DE','ZA','JP','BR']){ console.log('\n== '+c+' =='); for(const [g,b] of Object.entries(result[c]||{}).slice(0,7)) console.log('  '+g+' -> '+b.join(', ')); }
await writeFile('./country-brands.json', JSON.stringify(result, null, 0) + '\n');
console.log('\nwrote country-brands.json (' + Object.keys(result).length + ' countries)');
