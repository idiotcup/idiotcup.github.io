/* The Idiot Cup site. All stats are computed here from window.IC (docs/data.js). */
(function () {
  'use strict';

  const D = window.IC;
  const MIN = D.meta.minTrips;
  const TRIPS = D.trips.filter(t => !t.upcoming);
  const LAST = TRIPS[TRIPS.length - 1];
  const CORE = new Set(D.players.core);
  const ALL_PLAYERS = new Set([...D.players.core, ...D.players.others]);

  // ---------- helpers ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = encodeURIComponent;
  const pl = n => ALL_PLAYERS.has(n) ? `<a class="pl" href="#/player/${enc(n)}">${esc(n)}</a>` : esc(n);
  const pair = arr => arr.map(pl).join(' &amp; ');
  const money = n => n == null ? '—' : '$' + Math.round(n).toLocaleString();
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const num = n => n == null ? '—' : (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));
  const tripLink = t => `<a class="pl" href="#/trip/${t.year}">${esc(t.dest)}</a>`;
  const beltScore = b => {
    if (!b.gross && !b.net) return '';
    if (b.gross && b.net) return `${esc(b.gross)} / Net ${esc(b.net)}*`;
    return b.gross ? esc(b.gross) : `Net ${esc(b.net)}*`;
  };
  const opp = (rc, w) => rc.caps.find(c => c !== w);

  // PGA-style ranks: rows already sorted; key gives the comparable value
  function ranks(rows, key) {
    const out = [];
    rows.forEach((r, i) => {
      const k = key(r);
      const rank = i > 0 && key(rows[i - 1]) === k ? out[i - 1].n : i + 1;
      out.push({ n: rank });
    });
    return out.map((o, i) => {
      const tied = rows.some((r, j) => j !== i && out[j].n === o.n);
      return (tied ? 'T' : '') + o.n;
    });
  }

  // ---------- derived stats ----------
  const S = {};
  const P = n => S[n] || (S[n] = {
    name: n, trips: [], belts: [], capW: [], capL: [], calc: [], teamW: [], teamL: [],
    ptsW: 0, ptsL: 0, ptsYears: 0, ctp: 0, ctpYears: {},
  });
  ALL_PLAYERS.forEach(P);

  TRIPS.forEach(t => {
    t.attendees.forEach(n => P(n).trips.push(t.year));
    t.belt.champs.forEach(n => P(n).belts.push(t.year));
    const rc = t.rc;
    if (rc.winner && rc.caps.length === 2) {
      P(rc.winner).capW.push(t.year);
      P(opp(rc, rc.winner)).capL.push(t.year);
    }
    Object.entries(rc.side || {}).forEach(([n, s]) => (s === 'W' ? P(n).teamW : P(n).teamL).push(t.year));
    Object.entries(rc.pts || {}).forEach(([n, [w, l]]) => { const p = P(n); p.ptsW += w; p.ptsL += l; p.ptsYears++; });
    if (t.calcutta) t.calcutta.owners.forEach(n => P(n).calc.push(t.year));
    (t.ctp || []).forEach(day => Object.entries(day.wins).forEach(([n, v]) => {
      const p = P(n); p.ctpYears[t.year] = (p.ctpYears[t.year] || 0) + v;
    }));
  });
  Object.entries(D.ctpBefore2026).forEach(([n, v]) => { P(n).ctpBefore = v; });
  Object.values(S).forEach(p => { p.ctp = (p.ctpBefore || 0) + Object.values(p.ctpYears).reduce((a, b) => a + b, 0); });
  // Names like "Gators" or "Bud" (2012/2019 captains) are team labels, not players
  const players = () => Object.values(S).filter(p => ALL_PLAYERS.has(p.name) && p.trips.length);
  const qualified = () => players().filter(p => p.trips.length >= MIN);
  const CALC_TRIPS = TRIPS.filter(t => t.calcutta);

  // ---------- render plumbing ----------
  const app = document.getElementById('app');
  const sec = (title, hint, body) => `<section class="block"><div class="wrap"><div class="sec-title"><h2>${title}</h2>${hint ? `<span class="hint">${hint}</span>` : ''}</div>${body}</div></section>`;
  const phead = (eyebrow, title, sub, crumbs) => `<div class="phead"><div class="wrap"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}</div></div>`;
  const table = (head, rows, cls = '') => `<div class="tw"><table class="${cls}"><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const bar = (v, max, gold) => `<div class="track"><div class="fill${gold ? ' gold' : ''}" style="width:${Math.max(3, v / max * 100)}%"></div></div>`;

  // ---------- pages ----------
  function home() {
    const t = LAST;
    const rc = t.rc;
    const intl = TRIPS.filter(x => x.intl).length;
    const totalPot = CALC_TRIPS.reduce((a, x) => a + x.calcutta.pot, 0);
    return `
    <div class="hero"><div class="wrap">
      <div class="eyebrow">Annual golf trip · Est. ${D.meta.since}</div>
      <h1>The Idiot <em>Cup</em></h1>
      <p class="sub">${TRIPS.length} trips, ${players().length} golfers, one belt. Every result since ${D.meta.since}.</p>
      <div class="hero-stats">
        <div><div class="v">${TRIPS.length}</div><div class="l">Trips</div></div>
        <div><div class="v">${intl}</div><div class="l">International</div></div>
        <div><div class="v">${players().length}</div><div class="l">Golfers all-time</div></div>
        <div><div class="v">${money(totalPot)}</div><div class="l">Calcutta pots since ${CALC_TRIPS[0].year}</div></div>
      </div>
    </div></div>
    ${sec(`${t.year} in Review`, `${esc(t.dest)} · ${esc(t.course)}${t.dates ? ' · ' + esc(t.dates) : ''}`, yearInReview(t))}
    ${sec('All Trips', '<a class="pl" href="#/trips">Trip pages</a>', mapSection() + '<div style="height:16px"></div>' + tripCards([...TRIPS].reverse()))}
    ${sec('Leaders', `Min ${MIN} trips`, leaderTiles())}`;
  }

  function leaderTiles() {
    const q = qualified();
    const top = (arr, f, fmt) => {
      const s = [...arr].sort((a, b) => f(b) - f(a));
      const best = f(s[0]);
      const names = s.filter(p => f(p) === best).map(p => pl(p.name)).join(', ');
      return { v: fmt(best), names };
    };
    const tiles = [
      ['Most Belts', top(q, p => p.belts.length, v => v), '#/belt'],
      ['Most Trips', top(q, p => p.trips.length, v => v), '#/attendance'],
      ['Most CTPs', top(q, p => p.ctp, num), '#/attendance'],
      ['Most Calcuttas', top(q, p => p.calc.length, v => v), '#/calcutta'],
    ];
    return `<div class="grid g4">${tiles.map(([l, r, href]) => `<div class="card tile"><div class="v">${r.v}</div><div class="l"><a class="pl" href="${href}">${l}</a></div><div class="s">${r.names}</div></div>`).join('')}</div>`;
  }

  function yearInReview(t) {
    const rc = t.rc;
    const champs = t.belt.champs;
    const ctp = {};
    (t.ctp || []).forEach(d => Object.entries(d.wins).forEach(([n, v]) => { ctp[n] = (ctp[n] || 0) + v; }));
    const ctpTotal = Object.values(ctp).reduce((a, b) => a + b, 0);
    const banner = `<div class="grid g3">
      <div class="card dark"><h3>The Belt</h3><div class="champ"><div class="icon">🏆</div><div><div class="who">${pair(champs)}</div><div class="what">${beltScore(t.belt)}${t.belt.note ? ' · ' + esc(t.belt.note) : ''}</div></div></div></div>
      <div class="card"><h3>Ryder Cup</h3><div class="champ"><div class="icon">⛳</div><div><div class="who">Team ${pl(rc.winner)}</div><div class="what">${rc.score ? `${num(rc.score[0])}–${num(rc.score[1])} over Team ${pl(opp(rc, rc.winner))}` : 'over ' + pl(opp(rc, rc.winner))}</div></div></div></div>
      <div class="card gold"><h3>Calcutta</h3><div class="champ"><div class="icon">💰</div><div><div class="who">${t.calcutta ? pair(t.calcutta.owners) : '—'}</div><div class="what">${t.calcutta ? `Bought ${pair(champs)} for ${money(t.calcutta.price)}${t.calcutta.price === Math.max(...CALC_TRIPS.map(x => x.calcutta.price)) ? ' (all-time record bid)' : ''} · Pot ${money(t.calcutta.pot)}` : ''}</div></div></div></div>
    </div>`;
    const rows = t.attendees.map(n => {
      const pts = rc.pts && rc.pts[n];
      return { n, w: pts ? pts[0] : null, l: pts ? pts[1] : null, side: rc.side[n], belt: champs.includes(n), ctp: ctp[n] || 0, cap: rc.caps.includes(n), own: t.calcutta && t.calcutta.owners.includes(n) };
    }).sort((a, b) => (b.w ?? -1) - (a.w ?? -1) || b.ctp - a.ctp || a.n.localeCompare(b.n));
    const body = rows.map(r => `<tr>
      <td class="nm">${pl(r.n)}${r.cap ? ' <span class="chip cap">Captain</span>' : ''}</td>
      <td class="c">${r.side ? `<span class="chip ${r.side}">${r.side === 'W' ? 'Won' : 'Lost'}</span>` : '—'}</td>
      <td class="r num strong">${num(r.w)}</td>
      <td class="r num muted hm">${num(r.l)}</td>
      <td class="r num">${r.w != null ? pct(r.w, r.w + r.l) : '—'}</td>
      <td class="c">${r.belt ? '<span class="chip belt">Yes</span>' : '<span class="muted">—</span>'}</td>
      <td class="r num">${r.ctp ? num(r.ctp) : '<span class="muted">—</span>'}</td>
    </tr>`);
    return `${banner}<div class="card" style="margin-top:16px"><h3>Every golfer, ${t.year}</h3>${table(
      '<th>Player</th><th class="c">RC Team</th><th class="r">Pts W</th><th class="r hm">Pts L</th><th class="r">Pts %</th><th class="c">Belt</th><th class="r">CTP</th>',
      body, 'yir')}<div class="note">${ctpTotal ? `${num(ctpTotal)} closest-to-the-pins awarded. ` : ''}<a class="pl" href="#/trip/${t.year}">Full ${t.year} matchups &rarr;</a></div></div>`;
  }

  function tripCards(list) {
    return `<div class="trips">${list.map(t => `<a class="trip${t.intl ? ' intl' : ''}" href="#/trip/${t.year}">
      <div class="t1"><span class="y">${t.year}</span><span class="n">#${t.n}${t.intl ? ' · Intl' : ''} · ${t.golfers} golfers</span></div>
      <div class="d">${esc(t.dest)}</div><div class="c">${esc(t.course)}</div>
      <div class="b"><span>Belt:</span> ${t.belt.champs.map(esc).join(' &amp; ') || '—'}${t.rc.winner ? `<br><span>Cup:</span> ${esc(t.rc.winner)}` : ''}${t.calcutta ? `<br><span>Calcutta:</span> ${t.calcutta.owners.map(esc).join(' &amp; ')}` : ''}</div>
    </a>`).join('')}</div>`;
  }

  function tripsPage() {
    return phead('Since ' + D.meta.since, 'Every Trip', 'Gold edge = international. Tap a trip for the full results.') + sec('The Map', 'Tap a pin', mapSection()) + sec('All Trips', '', tripCards([...TRIPS].reverse()));
  }

  function tripPage(year) {
    const i = TRIPS.findIndex(t => t.year === year);
    const t = TRIPS[i];
    if (!t) return notFound();
    const prev = TRIPS[i - 1], next = TRIPS[i + 1];
    const crumbs = [prev && `<a href="#/trip/${prev.year}">&larr; ${prev.year} ${esc(prev.dest)}</a>`, `<a href="#/trips">All trips</a>`, next && `<a href="#/trip/${next.year}">${next.year} ${esc(next.dest)} &rarr;</a>`].filter(Boolean).join('');
    const rc = t.rc;
    let html = phead(`Trip #${t.n} · ${t.year}${t.intl ? ' · International' : ''}`, esc(t.dest), `Final day: ${esc(t.course)}${t.dates ? ' · ' + esc(t.dates) : ''} · ${t.golfers} golfers`, crumbs);

    const tiles = `<div class="grid g3">
      <div class="card dark"><h3>The Belt</h3><div class="champ"><div class="icon">🏆</div><div><div class="who">${pair(t.belt.champs)}</div><div class="what">${beltScore(t.belt) || 'Score not recorded'}</div></div></div>${t.belt.note ? `<div class="note" style="color:rgba(255,255,255,.6)">${esc(t.belt.note)}</div>` : ''}</div>
      <div class="card"><h3>Ryder Cup</h3>${rc.winner ? `<div class="champ"><div class="icon">⛳</div><div><div class="who">Team ${pl(rc.winner)}</div><div class="what">${rc.score ? `${num(rc.score[0])}–${num(rc.score[1])} ` : ''}over Team ${pl(opp(rc, rc.winner))}</div></div></div>` : `<div class="empty">${t.year < 2009 ? 'No Ryder Cup format before 2009.' : 'Captains and result not recorded.'}</div>`}</div>
      <div class="card gold"><h3>Calcutta</h3>${t.calcutta ? `<div class="champ"><div class="icon">💰</div><div><div class="who">${pair(t.calcutta.owners)}</div><div class="what">Winning bid ${money(t.calcutta.price)} · Pot ${money(t.calcutta.pot)} · ${pct(t.calcutta.price, t.calcutta.pot)} of pot</div></div></div>` : `<div class="empty">${t.year < 2017 ? 'Calcutta started in 2017.' : 'Not recorded.'}</div>`}</div>
    </div>`;
    html += sec('Results', '', tiles);

    if (rc.matches) {
      const capA = rc.caps.find(c => rc.teams[c].includes(rc.matches[0].a[0]));
      const capB = opp(rc, capA);
      const days = [...new Set(rc.matches.map(m => m.day))];
      const mhtml = days.map(d => {
        const ms = rc.matches.filter(m => m.day === d);
        return `<div class="day-h">Day ${d} · ${esc(ms[0].format)}</div>` + ms.map(m => `<div class="match">
          <div class="side a ${m.pa > m.pb ? 'won' : m.pa < m.pb ? 'lost' : ''}">${pair(m.a)}</div>
          <div class="sc">${num(m.pa)} – ${num(m.pb)}</div>
          <div class="side b ${m.pb > m.pa ? 'won' : m.pb < m.pa ? 'lost' : ''}">${pair(m.b)}</div></div>`).join('');
      }).join('');
      html += sec('Ryder Cup Matches', `Team ${esc(capA)} vs Team ${esc(capB)}`, `<div class="card"><div class="teamhdr"><div>Team ${pl(capA)}</div><div></div><div>Team ${pl(capB)}</div></div>${mhtml}</div>`);
    }

    const sideW = Object.keys(rc.side || {}).filter(n => rc.side[n] === 'W');
    const sideL = Object.keys(rc.side || {}).filter(n => rc.side[n] === 'L');
    if (sideW.length || rc.pts) {
      const rows = t.attendees.filter(n => rc.side[n] || (rc.pts && rc.pts[n])).map(n => ({ n, s: rc.side[n], p: rc.pts && rc.pts[n] }))
        .sort((a, b) => (a.s === b.s ? 0 : a.s === 'W' ? -1 : 1) || ((b.p ? b.p[0] : -1) - (a.p ? a.p[0] : -1)));
      const body = rows.map(r => `<tr><td>${pl(r.n)}</td><td class="c">${r.s ? `<span class="chip ${r.s}">${r.s === 'W' ? 'Won' : 'Lost'}</span>` : '—'}</td>${rc.pts ? `<td class="r num strong">${r.p ? num(r.p[0]) : '—'}</td><td class="r num muted">${r.p ? num(r.p[1]) : '—'}</td>` : ''}</tr>`);
      const issue = rc.note ? { text: rc.note } : null;
      html += sec('Ryder Cup by Player', rc.pts ? 'Individual points' : 'Team result only; no individual points recorded',
        `<div class="card">${table(`<th>Player</th><th class="c">Team</th>${rc.pts ? '<th class="r">Pts W</th><th class="r">Pts L</th>' : ''}`, body)}${issue ? `<div class="note">Data note: ${esc(issue.text)}</div>` : ''}</div>`);
    }

    if (t.ctp) {
      const days = t.ctp.map(d => `<tr><td class="strong">Day ${d.day}</td><td>${Object.entries(d.wins).map(([n, v]) => `${pl(n)}${v !== 1 ? ` (${num(v)})` : ''}`).join(', ')}</td></tr>`);
      html += sec('Closest to the Pin', '', `<div class="card">${table('<th>Day</th><th>Winners</th>', days)}</div>`);
    }

    const roles = n => [t.belt.champs.includes(n) && '<span class="chip belt">Belt</span>', rc.caps.includes(n) && '<span class="chip cap">Captain</span>', t.calcutta && t.calcutta.owners.includes(n) && '<span class="chip own">Calcutta</span>'].filter(Boolean).join(' ');
    html += sec('Who Went', `${t.attendees.length} golfers`, `<div class="ptiles">${[...t.attendees].sort().map(n => `<a class="ptile" href="#/player/${enc(n)}"><div class="nm">${esc(n)}</div><div class="meta">Trip ${S[n].trips.indexOf(t.year) + 1} of ${S[n].trips.length} ${roles(n)}</div></a>`).join('')}</div>`);
    return html;
  }

  function playersPage() {
    const list = players().sort((a, b) => b.trips.length - a.trips.length || a.name.localeCompare(b.name));
    return phead('Roster', 'Players', `${list.length} golfers have made at least one trip.`) + sec('Everyone', '', `<input class="search" id="psearch" placeholder="Search players" style="margin-bottom:14px">
      <div class="ptiles" id="plist">${list.map(p => `<a class="ptile" data-n="${esc(p.name.toLowerCase())}" href="#/player/${enc(p.name)}"><div class="nm">${esc(p.name)}${D.players.aka[p.name] ? ` <span class="muted small">(${esc(D.players.aka[p.name])})</span>` : ''}</div>
      <div class="meta">${p.trips.length} trip${p.trips.length > 1 ? 's' : ''} · ${p.trips[0]}${p.trips.length > 1 ? '–' + String(p.trips[p.trips.length - 1]).slice(2) : ''}${p.belts.length ? ` · ${p.belts.length} belt${p.belts.length > 1 ? 's' : ''}` : ''}</div></a>`).join('')}</div>`);
  }

  function playerPage(name) {
    const p = S[name];
    if (!p || !p.trips.length) return notFound();
    const aka = D.players.aka[name];
    const capTot = p.capW.length + p.capL.length;
    const teamTot = p.teamW.length + p.teamL.length;
    const first = p.trips[0], last = p.trips[p.trips.length - 1];
    let html = phead(`Player${aka ? ' · aka ' + esc(aka) : ''}`, esc(name), `${p.trips.length} of ${TRIPS.length} trips · first in ${first}, most recent ${last}`, `<a href="#/players">All players</a><a href="#/h2h?a=${enc(name)}">Head to head &rarr;</a>`);
    const tile = (v, l, s) => `<div class="card tile"><div class="v">${v}</div><div class="l">${l}</div>${s ? `<div class="s muted">${s}</div>` : ''}</div>`;
    html += sec('Career', '', `<div class="grid g4">
      ${tile(p.belts.length, 'Belt wins', p.belts.length ? `${pct(p.belts.length, p.trips.length)} of trips · ${p.belts.join(', ')}` : '')}
      ${tile(teamTot ? `${p.teamW.length}–${p.teamL.length}` : '—', 'Ryder Cup team record', teamTot ? pct(p.teamW.length, teamTot) + ' won' : '')}
      ${tile(p.ptsYears ? `${num(p.ptsW)}–${num(p.ptsL)}` : '—', 'RC individual points', p.ptsYears ? `${pct(p.ptsW, p.ptsW + p.ptsL)} won · ${p.ptsYears} cups with data` : 'No individual data')}
      ${tile(capTot ? `${p.capW.length}–${p.capL.length}` : '—', 'Captain record', capTot ? [...p.capW, ...p.capL].sort().join(', ') : '')}
      ${tile(p.calc.length, 'Calcutta wins', p.calc.join(', '))}
      ${tile(num(p.ctp), 'Closest to the pin', 'Lifetime')}
      ${tile(p.trips.length, 'Trips', p.trips.length >= MIN ? '' : `Leaderboards need ${MIN}`)}
      ${tile(longestStreak(p.trips), 'Longest trip streak', 'Consecutive years')}
    </div>`);

    const partners = {};
    TRIPS.forEach(t => { if (t.belt.champs.includes(name)) t.belt.champs.filter(n => n !== name).forEach(n => { partners[n] = (partners[n] || []).concat(t.year); }); });
    const mates = {};
    TRIPS.forEach(t => {
      const s = t.rc.side && t.rc.side[name];
      if (!s) return;
      Object.entries(t.rc.side).forEach(([n, s2]) => { if (n !== name && s2 === s) { const m = mates[n] || (mates[n] = { w: 0, l: 0 }); s === 'W' ? m.w++ : m.l++; } });
    });
    const mateRows = Object.entries(mates).filter(([, m]) => m.w + m.l >= 3).sort((a, b) => (b[1].w / (b[1].w + b[1].l)) - (a[1].w / (a[1].w + a[1].l)) || (b[1].w + b[1].l) - (a[1].w + a[1].l));
    html += sec('Partners', '', `<div class="grid g2">
      <div class="card"><h3>Belt partners</h3>${Object.keys(partners).length ? Object.entries(partners).map(([n, ys]) => `<div class="cup"><span class="win">${pl(n)}</span><span class="muted small">${ys.join(', ')}</span></div>`).join('') : '<div class="empty">No belt yet. There is always next year.</div>'}</div>
      <div class="card"><h3>Ryder Cup teammates (3+ cups together)</h3>${mateRows.length ? table('<th>Teammate</th><th class="r">Together</th><th class="r">Win %</th>', mateRows.map(([n, m]) => `<tr><td>${pl(n)} <a class="small muted" href="#/h2h?a=${enc(name)}&b=${enc(n)}">h2h</a></td><td class="r num">${m.w}–${m.l}</td><td class="r num strong">${pct(m.w, m.w + m.l)}</td></tr>`)) : '<div class="empty">Not enough Ryder Cup data.</div>'}</div>
    </div>`);

    const rows = TRIPS.filter(t => t.attendees.includes(name)).reverse().map(t => {
      const rc = t.rc, pts = rc.pts && rc.pts[name];
      const tags = [t.belt.champs.includes(name) && '<span class="chip belt">Belt</span>', rc.caps.includes(name) && `<span class="chip cap">Captain${rc.winner === name ? ' (W)' : rc.winner ? ' (L)' : ''}</span>`, t.calcutta && t.calcutta.owners.includes(name) && '<span class="chip own">Calcutta</span>'].filter(Boolean).join(' ');
      return `<tr><td class="yr">${t.year}</td><td>${tripLink(t)}</td><td class="c">${rc.side[name] ? `<span class="chip ${rc.side[name]}">${rc.side[name]}</span>` : '<span class="muted">—</span>'}</td><td class="r num">${pts ? `${num(pts[0])}–${num(pts[1])}` : '<span class="muted">—</span>'}</td><td class="r num">${p.ctpYears[t.year] ? num(p.ctpYears[t.year]) : '<span class="muted">—</span>'}</td><td><div class="chips">${tags}</div></td></tr>`;
    });
    html += sec('Year by Year', 'CTP by year from 2026', `<div class="card">${table('<th>Year</th><th>Trip</th><th class="c">RC</th><th class="r">RC Pts</th><th class="r">CTP</th><th></th>', rows)}</div>`);
    return html;
  }

  function longestStreak(ys) {
    let best = 0, cur = 0, prev = null;
    ys.forEach(y => { cur = prev === y - 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = y; });
    return best;
  }

  function beltPage() {
    const q = qualified().filter(p => p.belts.length).sort((a, b) => b.belts.length - a.belts.length || b.belts.length / b.trips.length - a.belts.length / a.trips.length);
    const r = ranks(q, p => p.belts.length);
    const max = q[0].belts.length;
    const lb = q.map((p, i) => `<tr><td class="rank${i < 3 ? ' top' : ''}">${r[i]}</td><td>${pl(p.name)}</td><td class="r num strong">${p.belts.length}</td><td class="barcell">${bar(p.belts.length, max, true)}</td><td class="r num">${pct(p.belts.length, p.trips.length)}</td><td class="muted small">${p.belts.join(', ')}</td></tr>`);
    const pairs = {};
    TRIPS.forEach(t => { if (t.belt.champs.length === 2) { const k = [...t.belt.champs].sort().join(' & '); pairs[k] = (pairs[k] || []).concat(t.year); } });
    const repeat = Object.entries(pairs).filter(([, ys]) => ys.length > 1);
    const years = [...TRIPS].reverse().filter(t => t.belt.champs.length).map(t => `<tr><td class="yr">${t.year}</td><td class="strong">${pair(t.belt.champs)}</td><td class="muted">${esc(t.course)}</td><td class="r small">${beltScore(t.belt) || '<span class="muted">—</span>'}</td></tr>`);
    return phead('The Belt', 'Belt Champions', 'Final-day two-man team. Win % is belts per trip attended.') +
      sec('Leaderboard', `Min ${MIN} trips`, `<div class="card">${table('<th></th><th>Player</th><th class="r">Belts</th><th></th><th class="r">Win %</th><th>Years</th>', lb)}</div>`) +
      sec('Year by Year', '', `<div class="grid g2"><div class="card" style="grid-column:1/-1">${table('<th>Year</th><th>Champions</th><th>Course</th><th class="r">Score</th>', years)}<div class="note">*Net = adjusted net, off the low team of group.</div></div></div>`) +
      (repeat.length ? sec('Repeat Pairs', 'Same two guys, more than once', `<div class="card">${repeat.map(([k, ys]) => `<div class="cup"><span class="win">${k.split(' & ').map(pl).join(' &amp; ')}</span><span class="muted small">${ys.join(', ')}</span></div>`).join('')}</div>`) : '');
  }

  function rcPage() {
    const pts = qualified().filter(p => p.ptsYears >= MIN).map(p => ({ ...p, pp: p.ptsW / (p.ptsW + p.ptsL) })).sort((a, b) => b.pp - a.pp);
    const pr = ranks(pts, p => Math.round(p.pp * 1000));
    const ptsRows = pts.map((p, i) => `<tr><td class="rank${i < 3 ? ' top' : ''}">${pr[i]}</td><td>${pl(p.name)}</td><td class="r num">${num(p.ptsW)}–${num(p.ptsL)}</td><td class="r num muted">${p.ptsYears}</td><td class="r num strong">${pct(p.ptsW, p.ptsW + p.ptsL)}</td><td class="barcell">${bar(p.pp, pts[0].pp)}</td></tr>`);

    const team = qualified().filter(p => p.teamW.length + p.teamL.length >= 3).map(p => ({ ...p, tp: p.teamW.length / (p.teamW.length + p.teamL.length) })).sort((a, b) => b.tp - a.tp || b.teamW.length - a.teamW.length);
    const tr = ranks(team, p => Math.round(p.tp * 1000));
    const teamRows = team.map((p, i) => `<tr><td class="rank${i < 3 ? ' top' : ''}">${tr[i]}</td><td>${pl(p.name)}</td><td class="r num">${p.teamW.length}–${p.teamL.length}</td><td class="r num strong">${pct(p.teamW.length, p.teamW.length + p.teamL.length)}</td></tr>`);

    const caps = players().filter(p => p.capW.length + p.capL.length).sort((a, b) => b.capW.length / (b.capW.length + b.capL.length) - a.capW.length / (a.capW.length + a.capL.length) || b.capW.length - a.capW.length);
    const capRows = caps.map(p => `<tr><td>${pl(p.name)}</td><td class="r num">${p.capW.length}–${p.capL.length}</td><td class="r num strong">${pct(p.capW.length, p.capW.length + p.capL.length)}</td><td class="muted small">${[...p.capW.map(y => y + ' W'), ...p.capL.map(y => y + ' L')].sort().join(', ')}</td></tr>`);

    const cups = [...TRIPS].reverse().filter(t => t.year >= 2009).map(t => t.rc.winner
      ? `<div class="cup"><span class="yr">${t.year}</span><span class="win">${pl(t.rc.winner)}</span><span class="over">over</span><span class="los">${pl(opp(t.rc, t.rc.winner))}</span>${t.rc.score ? `<span class="muted small">${num(t.rc.score[0])}–${num(t.rc.score[1])}</span>` : ''}</div>`
      : `<div class="cup"><span class="yr">${t.year}</span><span class="muted small">Captains not recorded</span></div>`).join('');

    return phead('Ryder Cup · Since 2009', 'Ryder Cup', 'Team results from 2009. Individual points recorded for 2013, 2016, and 2019 on.') +
      sec('Records', '', `<div class="grid g2">
        <div class="card"><h3>Individual points (min ${MIN} cups with data)</h3>${table('<th></th><th>Player</th><th class="r">Pts W–L</th><th class="r">Cups</th><th class="r">Pts %</th><th></th>', ptsRows)}</div>
        <div class="card"><h3>Team record (min 3 cups)</h3>${table('<th></th><th>Player</th><th class="r">W–L</th><th class="r">Win %</th>', teamRows)}</div>
        <div class="card"><h3>Captains</h3>${table('<th>Captain</th><th class="r">W–L</th><th class="r">Win %</th><th>Years</th>', capRows)}<div class="note">2012 (Gators vs Non-Gators) and 2019 (Bud vs Pal) were team-name captaincies.</div></div>
        <div class="card"><h3>Cup results by year</h3>${cups}</div>
      </div>`);
  }

  function calcuttaPage() {
    const ed = CALC_TRIPS.length;
    const q = players().filter(p => p.calc.length).sort((a, b) => b.calc.length - a.calc.length || a.name.localeCompare(b.name));
    const r = ranks(q, p => p.calc.length);
    const biggest = [...CALC_TRIPS].sort((a, b) => b.calcutta.pot - a.calcutta.pot)[0];
    const topBid = [...CALC_TRIPS].sort((a, b) => b.calcutta.price - a.calcutta.price)[0];
    const avgPot = CALC_TRIPS.reduce((a, t) => a + t.calcutta.pot, 0) / ed;
    const tile = (v, l, cls = '') => `<div class="card tile ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
    const rows = [...CALC_TRIPS].reverse().map(t => `<tr><td class="yr">${t.year}</td><td class="strong">${pair(t.calcutta.owners)}</td><td class="muted">${t.belt.champs.map(esc).join(' / ')}</td><td class="r num strong">${money(t.calcutta.price)}</td><td class="r num">${money(t.calcutta.pot)}</td><td class="r num muted">${pct(t.calcutta.price, t.calcutta.pot)}</td></tr>`);
    const maxPot = biggest.calcutta.pot;
    const potRows = CALC_TRIPS.map(t => `<tr><td class="yr">${t.year}</td><td class="barcell">${bar(t.calcutta.pot, maxPot, t === biggest)}</td><td class="r num">${money(t.calcutta.pot)}</td></tr>`);
    return phead('Calcutta · Since 2017', 'Calcutta', 'Owners of the team that won the Belt. Win % is share of all editions.') +
      sec('By the Numbers', '', `<div class="grid g4">${tile(ed, 'Editions')}${tile(money(maxPot), `Biggest pot (${biggest.year})`, 'gold')}${tile(money(topBid.calcutta.price), `Record winning bid (${topBid.year})`)}${tile(money(avgPot), 'Average pot')}</div>`) +
      sec('Winning Owners', 'All owners shown', `<div class="grid g2"><div class="card">${table('<th></th><th>Owner</th><th class="r">Wins</th><th class="r">% of editions</th><th>Years</th>', q.map((p, i) => `<tr><td class="rank${i < 3 ? ' top' : ''}">${r[i]}</td><td>${pl(p.name)}</td><td class="r num strong">${p.calc.length}</td><td class="r num">${pct(p.calc.length, ed)}</td><td class="muted small">${p.calc.join(', ')}</td></tr>`))}</div>
      <div class="card"><h3>Pot size</h3>${table('<th>Year</th><th></th><th class="r">Pot</th>', potRows)}</div></div>`) +
      sec('Year by Year', '', `<div class="card">${table('<th>Year</th><th>Owners</th><th>Team owned</th><th class="r">Bid</th><th class="r">Pot</th><th class="r">% of pot</th>', rows)}</div>`);
  }

  function attendancePage() {
    const all = players().sort((a, b) => b.trips.length - a.trips.length || a.trips[0] - b.trips[0]);
    const q = all.filter(p => p.trips.length >= MIN);
    const ar = ranks(q, p => p.trips.length);
    const attRows = q.map((p, i) => `<tr><td class="rank${i < 3 ? ' top' : ''}">${ar[i]}</td><td>${pl(p.name)}</td><td class="r num strong">${p.trips.length}</td><td class="barcell">${bar(p.trips.length, TRIPS.length)}</td><td class="r num muted">${pct(p.trips.length, TRIPS.length)}</td></tr>`);
    const c = q.filter(p => p.ctp > 0).sort((a, b) => b.ctp - a.ctp);
    const cr = ranks(c, p => p.ctp);
    const ctpRows = c.map((p, i) => `<tr><td class="rank${i < 3 ? ' top' : ''}">${cr[i]}</td><td>${pl(p.name)}</td><td class="r num strong">${num(p.ctp)}</td><td class="barcell">${bar(p.ctp, c[0].ctp)}</td><td class="r num muted">${p.ctpYears[LAST.year] ? '+' + num(p.ctpYears[LAST.year]) : ''}</td></tr>`);

    const code = (p, t) => {
      if (!t.attendees.includes(p.name)) return '';
      const k = [t.belt.champs.includes(p.name) && 'W', t.rc.caps.includes(p.name) && 'C', t.calcutta && t.calcutta.owners.includes(p.name) && 'O'].filter(Boolean);
      const cls = k[0] || 'A';
      return `<div class="dot ${cls}" title="${esc(p.name)} ${t.year}${k.length ? ': ' + k.join('+') : ''}">${k.join('')}</div>`;
    };
    const head = '<th></th>' + TRIPS.map(t => `<th>'${String(t.year).slice(2)}</th>`).join('') + '<th class="r">Tot</th>';
    const grid = all.map(p => `<tr><td class="nm">${pl(p.name)}</td>${TRIPS.map(t => `<td>${code(p, t)}</td>`).join('')}<td class="tot">${p.trips.length}</td></tr>`);

    return phead('Attendance & Closest to the Pin', 'Who Shows Up', `${TRIPS.length} trips since ${D.meta.since}.`) +
      sec('Leaderboards', `Min ${MIN} trips`, `<div class="grid g2">
        <div class="card"><h3>Trips attended</h3>${table('<th></th><th>Player</th><th class="r">Trips</th><th></th><th class="r">%</th>', attRows)}</div>
        <div class="card"><h3>Closest to the pin, lifetime</h3>${table(`<th></th><th>Player</th><th class="r">CTP</th><th></th><th class="r">${LAST.year}</th>`, ctpRows)}<div class="note">${esc(D.meta.ctpNote)}</div></div>
      </div>`) +
      sec('Attendance Grid', 'Every golfer, every year', `<div class="card"><div class="legend"><span><span class="dot A"></span>Attended</span><span><span class="dot W">W</span>Belt winner</span><span><span class="dot C">C</span>Captain</span><span><span class="dot O">O</span>Calcutta owner</span></div><div class="tw">${`<table class="agrid"><thead><tr>${head}</tr></thead><tbody>${grid.join('')}</tbody></table>`}</div></div>`);
  }

  function h2hPage(params) {
    const list = players().filter(p => p.trips.length >= 2).map(p => p.name).sort((a, b) => a.localeCompare(b));
    const a = params.get('a') || 'Shevin';
    const b = params.get('b') || (a === 'Soto' ? 'Shevin' : 'Soto');
    const opts = sel => list.map(n => `<option${n === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');
    let html = phead('Head to Head', 'Head to Head', 'Pick two golfers. Ryder Cup team results go back to 2009; individual matchups start in 2026.') +
      `<section class="block"><div class="wrap"><div class="card"><div class="pick"><select id="h2a">${opts(a)}</select><span class="vs">vs</span><select id="h2b">${opts(b)}</select></div></div></div></section>`;
    if (a === b || !S[a] || !S[b]) return html + sec('Pick two different players', '', '');

    const together = TRIPS.filter(t => t.attendees.includes(a) && t.attendees.includes(b));
    const same = { w: 0, l: 0, ys: [] }, vs = { a: 0, b: 0, ys: [] };
    together.forEach(t => {
      const sa = t.rc.side[a], sb = t.rc.side[b];
      if (!sa || !sb) return;
      if (sa === sb) { sa === 'W' ? same.w++ : same.l++; same.ys.push(`${t.year} ${sa}`); }
      else { sa === 'W' ? vs.a++ : vs.b++; vs.ys.push(`${t.year}: ${sa === 'W' ? a : b}`); }
    });
    const belts = together.filter(t => t.belt.champs.includes(a) && t.belt.champs.includes(b)).map(t => t.year);
    const ms = { with: [], against: [] };
    together.forEach(t => (t.rc.matches || []).forEach(m => {
      const inA = m.a.includes(a) ? 'a' : m.b.includes(a) ? 'b' : null;
      const inB = m.a.includes(b) ? 'a' : m.b.includes(b) ? 'b' : null;
      if (!inA || !inB) return;
      const mine = inA === 'a' ? m.pa : m.pb, theirs = inA === 'a' ? m.pb : m.pa;
      (inA === inB ? ms.with : ms.against).push({ t, m, mine, theirs });
    }));
    const sumPts = arr => arr.reduce((s, x) => [s[0] + x.mine, s[1] + x.theirs], [0, 0]);
    const tile = (v, l, s) => `<div class="card tile"><div class="v">${v}</div><div class="l">${l}</div>${s ? `<div class="s muted small">${s}</div>` : ''}</div>`;
    html += sec(`${esc(a)} &amp; ${esc(b)}`, `${together.length} trips together`, `<div class="grid g4">
      ${tile(together.length, 'Trips together', together.length ? `${together[0].year}–${together[together.length - 1].year}` : '')}
      ${tile(same.w + same.l ? `${same.w}–${same.l}` : '—', 'Same RC team', same.ys.join(', '))}
      ${tile(vs.a + vs.b ? `${vs.a}–${vs.b}` : '—', `Opposite RC teams (${esc(a)}'s side first)`, vs.ys.join(', '))}
      ${tile(belts.length, 'Belts together', belts.join(', '))}
    </div>`);
    const mrow = x => `<tr><td class="yr">${x.t.year}</td><td class="muted small">Day ${x.m.day} · ${esc(x.m.format)}</td><td>${pair(x.m.a)} <span class="muted">vs</span> ${pair(x.m.b)}</td><td class="r num ${x.mine > x.theirs ? 'w' : x.mine < x.theirs ? 'l' : ''}">${num(x.mine)}–${num(x.theirs)}</td></tr>`;
    if (ms.with.length || ms.against.length) {
      const sw = sumPts(ms.with), sa = sumPts(ms.against);
      html += sec('Match Play', `Points from ${esc(a)}'s side`, `<div class="grid g2">
        <div class="card"><h3>As partners · ${num(sw[0])}–${num(sw[1])}</h3>${ms.with.length ? table('<th>Year</th><th></th><th>Match</th><th class="r">Pts</th>', ms.with.map(mrow)) : '<div class="empty">Never paired.</div>'}</div>
        <div class="card"><h3>Against each other · ${num(sa[0])}–${num(sa[1])}</h3>${ms.against.length ? table('<th>Year</th><th></th><th>Match</th><th class="r">Pts</th>', ms.against.map(mrow)) : '<div class="empty">Never matched up.</div>'}</div>
      </div>`);
    } else {
      html += sec('Match Play', '', '<div class="card empty">No individual matchups recorded between these two yet. Match-level data starts in 2026.</div>');
    }
    const cmp = [['Trips', p => p.trips.length], ['Belts', p => p.belts.length], ['RC team W–L', p => `${p.teamW.length}–${p.teamL.length}`], ['RC pts %', p => p.ptsYears ? pct(p.ptsW, p.ptsW + p.ptsL) : '—'], ['Captain W–L', p => `${p.capW.length}–${p.capL.length}`], ['Calcuttas', p => p.calc.length], ['CTP', p => num(p.ctp)]];
    html += sec('Career Side by Side', '', `<div class="card">${table(`<th></th><th class="r">${pl(a)}</th><th class="r">${pl(b)}</th>`, cmp.map(([l, f]) => `<tr><td class="muted">${l}</td><td class="r num strong">${f(S[a])}</td><td class="r num strong">${f(S[b])}</td></tr>`))}</div>`);
    return html;
  }

  // One pin per place; repeat visits (Pinehurst, Casa de Campo) share a pin
  function mapSection() {
    return `<div class="card mapcard"><div id="map"></div><div class="legend" style="margin:10px 0 0"><span><span class="pin"></span>U.S.</span><span><span class="pin intl"></span>International</span><span>Bigger pin = more visits</span></div></div>`;
  }
  function initMap() {
    const el = document.getElementById('map');
    if (!el) return;
    if (!window.L) { el.innerHTML = '<div class="empty" style="padding:20px">Map could not load.</div>'; return; }
    const places = {};
    TRIPS.forEach(t => {
      const k = t.dest.replace(/\s*\(\d+\)$/, '');
      (places[k] = places[k] || { name: k, lat: t.lat, lng: t.lng, intl: t.intl, trips: [] }).trips.push(t);
    });
    const map = L.map(el, { scrollWheelZoom: false, worldCopyJump: true });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 12, attribution: 'Tiles &copy; Esri',
    }).addTo(map);
    const pts = [];
    Object.values(places).forEach(p => {
      const n = p.trips.length;
      const m = L.circleMarker([p.lat, p.lng], { radius: 7 + 3 * (n - 1), color: '#ffffff', weight: 2, fillColor: p.intl ? '#c9a84c' : '#2d6a4f', fillOpacity: 0.95 }).addTo(map);
      m.bindTooltip(`${esc(p.name)}${n > 1 ? ` (${n})` : ''}`);
      m.bindPopup(`<div class="mp"><b>${esc(p.name)}</b>${p.trips.map(t => `<a href="#/trip/${t.year}"><span class="yr">${t.year}</span> ${esc(t.course)}<br><span class="muted small">Belt: ${t.belt.champs.map(esc).join(' &amp; ')}</span></a>`).join('')}</div>`);
      pts.push([p.lat, p.lng]);
    });
    map.fitBounds(pts, { padding: [24, 24] });
    // Leaflet only loads tiles for the size it measured at start; re-measure once layout and fonts settle
    const refit = () => { map.invalidateSize(); map.fitBounds(pts, { padding: [24, 24] }); };
    setTimeout(refit, 250);
    if (document.fonts) document.fonts.ready.then(refit);
    if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe(el);
  }

  function notFound() {
    return phead('Lost ball', 'Not found', 'That page is in the hazard.', '<a href="#/">Back to the clubhouse</a>');
  }

  // ---------- router ----------
  function route() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const params = new URLSearchParams(qs || '');
    let html, key = parts[0] || '';
    if (!parts.length) html = home();
    else if (key === 'trips') html = tripsPage();
    else if (key === 'trip') { html = tripPage(+parts[1]); key = 'trips'; }
    else if (key === 'players') html = playersPage();
    else if (key === 'player') { html = playerPage(parts[1]); key = 'players'; }
    else if (key === 'belt') html = beltPage();
    else if (key === 'ryder-cup') html = rcPage();
    else if (key === 'calcutta') html = calcuttaPage();
    else if (key === 'attendance') html = attendancePage();
    else if (key === 'h2h') html = h2hPage(params);
    else html = notFound();
    app.innerHTML = html;
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + key));
    const title = app.querySelector('h1');
    document.title = (parts.length && title ? title.textContent + ' · ' : '') + 'The Idiot Cup';
    wire();
    initMap();
    window.scrollTo(0, 0);
  }

  function wire() {
    const s = document.getElementById('psearch');
    if (s) s.addEventListener('input', () => {
      const v = s.value.toLowerCase();
      document.querySelectorAll('#plist .ptile').forEach(el => { el.style.display = el.dataset.n.includes(v) ? '' : 'none'; });
    });
    const a = document.getElementById('h2a'), b = document.getElementById('h2b');
    if (a && b) [a, b].forEach(x => x.addEventListener('change', () => { location.hash = `#/h2h?a=${enc(a.value)}&b=${enc(b.value)}`; }));
  }

  document.getElementById('foot-notes').innerHTML = (D.meta.footnotes || []).map(f => `<p>${esc(f)}</p>`).join('');
  document.getElementById('foot-meta').textContent = `Through the ${LAST.year} trip (${LAST.dest}). Updated ${D.meta.updated}. Leaderboards require ${MIN}+ trips.`;
  window.addEventListener('hashchange', route);
  route();
})();
