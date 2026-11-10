// Chapter & Verse — Cloudflare Worker
// Serves the static site from /public and one API route:
//   GET /api/day?d=<puzzle number>  ->  today's five verses in NKJV (via API.Bible)
// The API.Bible key lives in the Worker secret API_BIBLE_KEY (never sent to browsers).
import POOLS from './pools.json';

const USFM = ["GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI","1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL","MAT","MRK","LUK","JHN","ACT","ROM","1CO","2CO","GAL","EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS","1PE","2PE","1JN","2JN","3JN","JUD","REV"];
const API = 'https://rest.api.bible/v1';
const EPOCH = Date.UTC(2026, 10, 7);

// --- must match pickDay() in public/index.html ---
function rng(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function permFor(tier,cycle,n){ const r=rng(tier*7919+cycle*104729+20261107); const a=[...Array(n).keys()]; for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function pickDay(p){
  const used=new Set(), out=[];
  POOLS.forEach((pool,t)=>{
    const n=pool.length, cycle=Math.floor((p-1)/n), pos=(p-1)%n;
    for(let j=0;j<8;j++){
      const v=pool[permFor(t,cycle+j*977,n)[pos]], key=v[0]+':'+v[1];
      if(!used.has(key)||j===7){ used.add(key); out.push({b:v[0],c:v[1],v:v[2],tier:t}); break; }
    }
  });
  return out;
}

const json = (obj, status=200, extra={}) => new Response(JSON.stringify(obj), {status, headers:{'content-type':'application/json; charset=utf-8', ...extra}});

async function bibleId(env){
  if (env.BIBLE_ID) return env.BIBLE_ID;
  const cache = caches.default, key = new Request('https://cache.verse-find/bible-id/nkjv');
  const hit = await cache.match(key); if (hit) return (await hit.json()).id;
  const r = await fetch(`${API}/bibles?abbreviation=NKJV`, {headers:{'api-key':env.API_BIBLE_KEY}});
  if (!r.ok) throw new Error('bibles lookup '+r.status);
  const list = (await r.json()).data || [];
  const b = list.find(x => (x.abbreviation||'').toUpperCase()==='NKJV' && (x.language?.id||'eng')==='eng') || list[0];
  if (!b) throw new Error('NKJV not enabled for this API key');
  await cache.put(key, json({id:b.id}, 200, {'cache-control':'max-age=604800'}));
  return b.id;
}

function clean(s){ return String(s||'').replace(/[¶¶]/g,'').replace(/^\s*\[?\d+\]?\s*/,'').replace(/\s+/g,' ').trim(); }

async function getVerse(env, id, q){
  const vid = `${USFM[q.b]}.${q.c}.${q.v}`;
  const cache = caches.default, key = new Request(`https://cache.verse-find/v/${id}/${vid}`);
  const hit = await cache.match(key); if (hit) return hit.json();
  const url = `${API}/bibles/${id}/verses/${vid}?content-type=text&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=false&fums-version=3`;
  const r = await fetch(url, {headers:{'api-key':env.API_BIBLE_KEY}});
  if (!r.ok) throw new Error(`verse ${vid} ${r.status}`);
  const j = await r.json();
  const out = {text: clean(j.data?.content), copyright: j.data?.copyright || '', fumsToken: j.meta?.fumsToken || null};
  // Cache well under API.Bible's 30-day refresh rule.
  await cache.put(key, json(out, 200, {'cache-control':'max-age=604800'}));
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/day') {
      if (!env.API_BIBLE_KEY) return json({error:'no_key'}, 503);
      const d = parseInt(url.searchParams.get('d'), 10);
      const utcNum = Math.floor((Date.now() - EPOCH) / 864e5) + 1;
      if (!(d >= 1 && d >= utcNum - 1 && d <= utcNum + 1)) return json({error:'bad_day'}, 400);
      try {
        const id = await bibleId(env);
        const picks = pickDay(d);
        const verses = await Promise.all(picks.map(q => getVerse(env, id, q).then(x => ({...q, ...x}))));
        return json({puzzle:d, translation:'NKJV', verses}, 200, {'cache-control':'public, max-age=600'});
      } catch (e) {
        return json({error:'upstream', detail:String(e.message||e)}, 502);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
