// ---- CSV + DEMO yükleme ----------------------------------------------------
let HISTORICAL_ODDS = []; // CSV'den doldurulacak (yoksa demo)
const DEMO = [
  { date:'2019-11-03', league:'ENG L1', homeTeam:'Portsmouth', awayTeam:'Fleetwood', home:1.80, draw:3.30, away:4.20, homeGoals:2, awayGoals:0, result:'1' },
  { date:'2020-08-22', league:'ENG L1', homeTeam:'Barnsley', awayTeam:'Oxford Utd', home:1.95, draw:3.40, away:3.80, homeGoals:3, awayGoals:1, result:'1' },
  { date:'2017-02-12', league:'ENG L1', homeTeam:'Fleetwood', awayTeam:'Barnsley', home:2.20, draw:3.10, away:3.10, homeGoals:1, awayGoals:1, result:'X' },
  { date:'2016-01-30', league:'ENG L1', homeTeam:'Barnsley', awayTeam:'Wigan', home:2.60, draw:3.20, away:2.70, homeGoals:0, awayGoals:1, result:'2' },
  { date:'2022-01-15', league:'ENG L1', homeTeam:'Fleetwood', awayTeam:'Sunderland', home:3.10, draw:3.25, away:2.30, homeGoals:0, awayGoals:2, result:'2' },
  { date:'2018-03-04', league:'ENG CH', homeTeam:'Barnsley', awayTeam:'Birmingham', home:1.70, draw:3.50, away:4.80, homeGoals:2, awayGoals:0, result:'1' },
];

async function loadCSV() {
  try {
const res = await fetch('./data/data/historical_odds.csv', {cache:'no-store'});
    if (!res.ok) throw new Error('no csv');
    const text = await res.text();
    const rows = text.trim().split(/\r?\n/);
    const header = rows.shift().split(',');
    // Beklenen başlıklar:
    // date,league,homeTeam,awayTeam,homeOdd,drawOdd,awayOdd,homeGoals,awayGoals,result
    const idx = (k)=>header.indexOf(k);
    HISTORICAL_ODDS = rows.map(line => {
      const c = line.split(',');
      return {
        date: c[idx('date')],
        league: c[idx('league')],
        homeTeam: c[idx('homeTeam')],
        awayTeam: c[idx('awayTeam')],
        home: parseFloat(c[idx('homeOdd')]),
        draw: parseFloat(c[idx('drawOdd')]),
        away: parseFloat(c[idx('awayOdd')]),
        homeGoals: parseInt(c[idx('homeGoals')],10),
        awayGoals: parseInt(c[idx('awayGoals')],10),
        result: c[idx('result')]
      };
    }).filter(r => !Number.isNaN(r.home) && !Number.isNaN(r.draw) && !Number.isNaN(r.away));
    if (!HISTORICAL_ODDS.length) throw new Error('empty csv');
    console.log('CSV yüklendi: ', HISTORICAL_ODDS.length, 'kayıt');
  } catch(e) {
    console.warn('CSV yüklenemedi, DEMO veriye geçiliyor.', e.message);
    HISTORICAL_ODDS = DEMO;
  }
}

function euclideanDistance(a, b) {
  return Math.hypot(Math.log(a.home)-Math.log(b.home),
                    Math.log(a.draw)-Math.log(b.draw),
                    Math.log(a.away)-Math.log(b.away));
}
const fmtPct = (p) => (p*100).toFixed(1) + '%';
function tagFromProbs(p1, pX, p2) {
  const arr = [p1, pX, p2];
  const max = Math.max(...arr);
  const idx = arr.indexOf(max);
  const gap = max - arr.slice().sort((x,y)=>y-x)[1];
  let text = 'Sürpriz Açık';
  if (max > 0.55 && gap > 0.10) text = 'Banko';
  else if (max > 0.50) text = 'Dengeli – 1 Adım Önde';
  return {label:['1','X','2'][idx], text};
}

document.getElementById('year').textContent = new Date().getFullYear();

async function init(){
  await loadCSV();

  const oddsForm = document.getElementById('oddsForm');
  const oddsResult = document.getElementById('oddsResult');
  const nearestList = document.getElementById('nearestList');
  const summaryTag = document.getElementById('summaryTag');
  const summaryText = document.getElementById('summaryText');

  oddsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = {
      home: parseFloat(document.getElementById('homeOdd').value),
      draw: parseFloat(document.getElementById('drawOdd').value),
      away: parseFloat(document.getElementById('awayOdd').value)
    };

    const ranked = HISTORICAL_ODDS
      .map((row, i) => ({i, row, d: euclideanDistance(q, row)}))
      .sort((a,b)=>a.d-b.d)
      .slice(0,5);

    const counts = { '1':0, 'X':0, '2':0 };
    ranked.forEach(r => counts[r.row.result]++);
    const total = ranked.length || 1;
    const p1 = counts['1']/total, pX = counts['X']/total, p2 = counts['2']/total;

    const t = tagFromProbs(p1, pX, p2);
    summaryTag.textContent = `Öneri: ${t.text} (${t.label})`;
    summaryText.innerHTML = `Benzer ${ranked.length} maçta dağılım → <b>1:</b> ${fmtPct(p1)} • <b>X:</b> ${fmtPct(pX)} • <b>2:</b> ${fmtPct(p2)}`;

    nearestList.innerHTML = '';
    if (!ranked.length){
      const li = document.createElement('li');
      li.className = 'text-xs text-amber-700';
      li.textContent = 'Eşleşme bulunamadı';
      nearestList.appendChild(li);
    } else {
      ranked.forEach((r, idx) => {
        const {home, draw, away, result, date, league, homeTeam, awayTeam, homeGoals, awayGoals} = r.row;
        const totalGoals = (homeGoals ?? null) != null && (awayGoals ?? null) != null ? homeGoals + awayGoals : null;
        const over25 = totalGoals != null ? (totalGoals >= 3 ? 'Üst' : 'Alt') : '—';
        const btts = totalGoals != null ? ((homeGoals > 0 && awayGoals > 0) ? 'Var' : 'Yok') : '—';
        const li = document.createElement('li');
        li.innerHTML = `<div class="flex flex-col gap-1 border-b pb-2">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-medium">#${idx+1} → ${home.toFixed(2)} / ${draw.toFixed(2)} / ${away.toFixed(2)} <span class="text-xs text-slate-500">(${date}, ${league})</span></div>
              <div class="text-xs text-slate-600">${homeTeam} ${homeGoals}-${awayGoals} ${awayTeam} – Sonuç: ${result}</div>
            </div>
          </div>
          <div class="text-xs text-slate-500">2.5: ${over25} • KG: ${btts}</div>
        </div>`;
        nearestList.appendChild(li);
      });
    }
    oddsResult.classList.remove('hidden');
  });
}
init();
