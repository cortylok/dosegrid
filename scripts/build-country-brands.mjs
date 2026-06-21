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
function cleanBrand(chunk){
  let b = chunk.split(' (')[0].split(' / ')[0].split(' - ')[0].replace(/[*]+/g,'').trim();
  b = b.replace(/\s+generics?$/i,'').trim();        // drop trailing "generics"
  if(!b) return null;
  if(!/^[A-Z]/.test(b)) return null;                // brands start with an ASCII uppercase letter
  const low=b.toLowerCase();
  for(const w of ['generic','various','none','otc','rx','combination','combo','found','widely','no ','not ','in ','also','e.g','available'])
    if(low===w||low.startsWith(w)) return null;
  // reject prose / status text rather than a brand
  if(/\b(only|prescription|available|status|required|note|see|withdrawn|banned|controlled|restricted|sold|limited|imported|various|generique|generics?)\b/i.test(b)) return null;
  if(b.split(/\s+/).length > 4) return null;         // brands are short
  if(/^\d/.test(b)) return null;
  if(b.length>34) return null;
  if(/[:\[\]]/.test(b)) return null;
  return b;
}
function parseBrands(rest){
  rest = rest.replace(/^[^0-9A-Za-z(]+/, '');       // strip leading arrow + spaces (encoding-agnostic)
  let head = rest.split(' [')[0].split(/\.\s/)[0].split('; ')[0];
  const out=[]; for(const p of splitTop(head, ',')){ const b=cleanBrand(p); if(b&&!out.includes(b)) out.push(b); }
  return out.slice(0,6);
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
    const brands=parseBrands(m[2]); if(!brands.length) continue;
    result[iso]=result[iso]||{};
    if(!result[iso][gen]) result[iso][gen]=brands;
  }
}
console.log('countries:', Object.keys(result).length, '| total generic-mappings:', Object.values(result).reduce((n,o)=>n+Object.keys(o).length,0));
for(const c of ['GB','FR','US','IN','DE','ZA','JP','BR']){ console.log('\n== '+c+' =='); for(const [g,b] of Object.entries(result[c]||{}).slice(0,7)) console.log('  '+g+' -> '+b.join(', ')); }
await writeFile('./country-brands.json', JSON.stringify(result, null, 0) + '\n');
console.log('\nwrote country-brands.json (' + Object.keys(result).length + ' countries)');
