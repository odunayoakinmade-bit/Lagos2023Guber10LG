
(function(){
  const data = window.DASHBOARD_DATA;
  const state = {
    partyView: 'winner',
    selectedLGA: 'All LGAs',
    selectedWard: 'All Wards',
    search: ''
  };

  const partyColors = {
    APC: getComputedStyle(document.documentElement).getPropertyValue('--apc').trim(),
    LP: getComputedStyle(document.documentElement).getPropertyValue('--lp').trim(),
    PDP: getComputedStyle(document.documentElement).getPropertyValue('--pdp').trim(),
    winner: getComputedStyle(document.documentElement).getPropertyValue('--winner').trim()
  };

  const nfmt = n => new Intl.NumberFormat().format(Math.round(n));
  const pfmt = n => `${(n * 100).toFixed(1)}%`;

  document.getElementById('scope-note').textContent = data.summary.scope_note;

  // KPIs
  const kpiDefs = [
    ['LGAs in file', data.summary.kpis.lgas],
    ['Wards in file', data.summary.kpis.wards],
    ['Polling units', data.summary.kpis.pus],
    ['Registered voters', data.summary.kpis.registered],
    ['Accredited voters', data.summary.kpis.accredited],
    ['Overall turnout', pfmt(data.summary.kpis.turnout_rate)],
    ['Valid votes', data.summary.kpis.valid_votes],
    ['Zero-turnout PUs', data.summary.kpis.zero_turnout_pus]
  ];
  const kpisEl = document.getElementById('kpis');
  kpiDefs.forEach(([label, value]) => {
    const div = document.createElement('div');
    div.className = 'kpi';
    div.innerHTML = `<div class="label">${label}</div><div class="value">${typeof value === 'number' ? nfmt(value) : value}</div>`;
    kpisEl.appendChild(div);
  });

  const findings = document.getElementById('findings');
  data.summary.headline_findings.forEach(text => {
    const div = document.createElement('div');
    div.className = 'finding';
    div.textContent = text;
    findings.appendChild(div);
  });

  function badgeHtml(text, mode){
    const cls = mode === 'winner' ? 'winner' : mode.toLowerCase();
    return `<span class="badge ${cls}">${text}</span>`;
  }

  function renderLegend(){
    const legend = document.getElementById('map-legend');
    legend.innerHTML = '';
    [['APC lead','APC'],['LP lead','LP'],['PDP lead','PDP'],['Selected view','winner']].forEach(([label,key]) => {
      const span = document.createElement('span');
      span.className = 'pill';
      span.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${partyColors[key]};margin-right:8px"></span>${label}`;
      legend.appendChild(span);
    });
  }
  renderLegend();

  function currentColor(row){
    if(state.partyView === 'winner'){
      return partyColors[row.winner] || partyColors.winner;
    }
    const key = state.partyView.toLowerCase();
    const share = row[`${key}_share`] ?? 0;
    const alpha = Math.max(0.22, Math.min(0.95, share));
    const base = partyColors[state.partyView];
    if(base.startsWith('#')){
      return base;
    }
    return base;
  }

  function drawMap(){
    const svg = document.getElementById('map-svg');
    svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';

    // soft backdrop shape
    const water = document.createElementNS(ns,'rect');
    water.setAttribute('x','0'); water.setAttribute('y','0');
    water.setAttribute('width','1000'); water.setAttribute('height','520');
    water.setAttribute('fill','#0b1425');
    svg.appendChild(water);

    // abstract coast line
    const coast = document.createElementNS(ns,'path');
    coast.setAttribute('d','M20,390 C110,350 170,320 240,300 C350,270 420,300 505,295 C585,290 650,245 740,245 C830,245 900,285 980,330 L980,520 L20,520 Z');
    coast.setAttribute('fill','#0c1930');
    coast.setAttribute('stroke','#20355a');
    coast.setAttribute('stroke-width','1.2');
    svg.appendChild(coast);

    // ward points
    data.wardSummary.forEach(row => {
      if(state.selectedLGA !== 'All LGAs' && row.LGA !== state.selectedLGA) return;
      const c = document.createElementNS(ns,'circle');
      c.setAttribute('cx', row.x);
      c.setAttribute('cy', row.y);
      c.setAttribute('r', Math.max(4, Math.min(16, Math.sqrt(row.valid_votes || 1) / 3.8)));
      c.setAttribute('fill', state.partyView === 'winner' ? (partyColors[row.winner] || partyColors.winner) : partyColors[state.partyView]);
      c.setAttribute('fill-opacity', state.partyView === 'winner' ? '0.70' : String(Math.max(0.25, Math.min(0.95, (row[state.partyView.toLowerCase()] || 0) / Math.max(row.valid_votes || 1,1)))));
      c.setAttribute('stroke', row.LGA === state.selectedLGA && (state.selectedWard === 'All Wards' || row.WARD === state.selectedWard) ? '#ffffff' : '#0b1324');
      c.setAttribute('stroke-width', row.WARD === state.selectedWard ? '2.5' : '1.2');
      c.style.cursor = 'pointer';
      c.addEventListener('mouseenter', e => showTooltip(e, `
        <strong>${row.WARD}</strong><br>
        ${row.LGA}<br>
        Registered: ${nfmt(row.registered)}<br>
        Turnout: ${pfmt(row.turnout_rate)}<br>
        APC: ${nfmt(row.apc)} | LP: ${nfmt(row.lp)} | PDP: ${nfmt(row.pdp)}<br>
        Lead: ${row.winner} | Priority: ${row.priority_type}
      `));
      c.addEventListener('mousemove', showTooltipMove);
      c.addEventListener('mouseleave', hideTooltip);
      c.addEventListener('click', () => {
        state.selectedLGA = row.LGA;
        state.selectedWard = row.WARD;
        syncFilters();
        renderAll();
      });
      svg.appendChild(c);
    });

    // lga bubbles and labels
    data.lgaSummary.forEach(row => {
      if(state.selectedLGA !== 'All LGAs' && row.LGA !== state.selectedLGA) return;
      const g = document.createElementNS(ns,'g');
      const bubble = document.createElementNS(ns,'circle');
      bubble.setAttribute('cx', row.x);
      bubble.setAttribute('cy', row.y);
      bubble.setAttribute('r', Math.max(18, Math.min(42, Math.sqrt(row.valid_votes) / 6)));
      bubble.setAttribute('fill', currentColor(row));
      bubble.setAttribute('fill-opacity', row.LGA === state.selectedLGA ? '0.35' : '0.18');
      bubble.setAttribute('stroke', row.LGA === state.selectedLGA ? '#ffffff' : currentColor(row));
      bubble.setAttribute('stroke-width', row.LGA === state.selectedLGA ? '2.8' : '1.8');
      bubble.style.cursor = 'pointer';
      bubble.addEventListener('mouseenter', e => showTooltip(e, `
        <strong>${row.LGA}</strong><br>
        Polling units: ${nfmt(row.polling_units)}<br>
        Wards: ${nfmt(row.wards)}<br>
        Registered: ${nfmt(row.registered)}<br>
        Turnout: ${pfmt(row.turnout_rate)}<br>
        APC: ${pfmt(row.apc_share)} | LP: ${pfmt(row.lp_share)} | PDP: ${pfmt(row.pdp_share)}<br>
        Lead: ${row.winner}
      `));
      bubble.addEventListener('mousemove', showTooltipMove);
      bubble.addEventListener('mouseleave', hideTooltip);
      bubble.addEventListener('click', () => {
        state.selectedLGA = row.LGA;
        state.selectedWard = 'All Wards';
        syncFilters();
        renderAll();
      });
      g.appendChild(bubble);

      const label = document.createElementNS(ns,'text');
      label.setAttribute('x', row.x);
      label.setAttribute('y', row.y - Math.max(24, Math.min(48, Math.sqrt(row.valid_votes)/6)) - 8);
      label.setAttribute('text-anchor','middle');
      label.setAttribute('fill','#dce7ff');
      label.setAttribute('font-size','13');
      label.setAttribute('font-weight','600');
      label.textContent = row.LGA;
      g.appendChild(label);
      svg.appendChild(g);
    });
  }

  function showTooltip(evt, html){
    const t = document.getElementById('map-tooltip');
    t.innerHTML = html;
    t.classList.remove('hidden');
    showTooltipMove(evt);
  }
  function showTooltipMove(evt){
    const t = document.getElementById('map-tooltip');
    const rect = evt.currentTarget.ownerSVGElement.getBoundingClientRect();
    t.style.left = `${evt.clientX - rect.left + 16}px`;
    t.style.top = `${evt.clientY - rect.top + 16}px`;
  }
  function hideTooltip(){
    document.getElementById('map-tooltip').classList.add('hidden');
  }

  function renderTopTables(){
    const opp = document.querySelector('#opportunity-table tbody');
    opp.innerHTML = '';
    data.topOpportunityWards.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.LGA}</td><td>${r.WARD}</td><td>${r.opportunity_score.toFixed(1)}</td><td>${badgeHtml(r.priority_type,'winner')}</td>`;
      opp.appendChild(tr);
    });

    const bat = document.querySelector('#battle-table tbody');
    bat.innerHTML = '';
    data.topBattlegroundWards.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.LGA}</td><td>${r.WARD}</td><td>${pfmt(r.margin_pct_valid)}</td><td>${nfmt(r.registered)}</td>`;
      bat.appendChild(tr);
    });
  }

  function renderLGATable(){
    const tbody = document.querySelector('#lga-table tbody');
    tbody.innerHTML = '';
    data.lgaSummary.forEach(r => {
      const emph = state.partyView === 'winner' ? r.winner.toLowerCase() : state.partyView.toLowerCase();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="row-strong">${r.LGA}</td>
        <td>${nfmt(r.polling_units)}</td>
        <td>${nfmt(r.wards)}</td>
        <td>${nfmt(r.registered)}</td>
        <td>${pfmt(r.turnout_rate)}</td>
        <td class="${emph === 'apc' ? 'row-strong' : ''}">${pfmt(r.apc_share)}</td>
        <td class="${emph === 'lp' ? 'row-strong' : ''}">${pfmt(r.lp_share)}</td>
        <td class="${emph === 'pdp' ? 'row-strong' : ''}">${pfmt(r.pdp_share)}</td>
        <td>${badgeHtml(r.winner, state.partyView === 'winner' ? 'winner' : r.winner)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function wardOptionsForLGA(lga){
    const wards = [...new Set(data.wardSummary.filter(r => lga === 'All LGAs' || r.LGA === lga).map(r => r.WARD))].sort();
    return ['All Wards', ...wards];
  }

  function syncFilters(){
    const lgaSel = document.getElementById('lga-filter');
    const wardSel = document.getElementById('ward-filter');
    if (![...lgaSel.options].some(o => o.value === state.selectedLGA)) state.selectedLGA = 'All LGAs';
    lgaSel.value = state.selectedLGA;

    wardSel.innerHTML = '';
    wardOptionsForLGA(state.selectedLGA).forEach(w => {
      const opt = document.createElement('option');
      opt.value = w; opt.textContent = w;
      wardSel.appendChild(opt);
    });
    if (![...wardSel.options].some(o => o.value === state.selectedWard)) state.selectedWard = 'All Wards';
    wardSel.value = state.selectedWard;
  }

  function renderWardTable(){
    const tbody = document.querySelector('#ward-table tbody');
    tbody.innerHTML = '';
    let rows = data.wardSummary.slice();
    if (state.selectedLGA !== 'All LGAs') rows = rows.filter(r => r.LGA === state.selectedLGA);
    if (state.selectedWard !== 'All Wards') rows = rows.filter(r => r.WARD === state.selectedWard);
    rows.sort((a,b) => b.opportunity_score - a.opportunity_score || b.registered - a.registered);

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="row-strong">${r.WARD}</td>
        <td>${nfmt(r.polling_units)}</td>
        <td>${nfmt(r.registered)}</td>
        <td>${pfmt(r.turnout_rate)}</td>
        <td>${nfmt(r.apc)}</td>
        <td>${nfmt(r.lp)}</td>
        <td>${nfmt(r.pdp)}</td>
        <td>${badgeHtml(r.winner, state.partyView === 'winner' ? 'winner' : r.winner)}</td>
        <td>${badgeHtml(r.priority_type, 'winner')}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderPUTable(){
    const tbody = document.querySelector('#pu-table tbody');
    tbody.innerHTML = '';
    let rows = data.puRows.slice();
    if (state.selectedLGA !== 'All LGAs') rows = rows.filter(r => r.LGA === state.selectedLGA);
    if (state.selectedWard !== 'All Wards') rows = rows.filter(r => r.WARD === state.selectedWard);
    const q = state.search.trim().toLowerCase();
    if (q) rows = rows.filter(r => String(r.POLLING_UNIT).toLowerCase().includes(q));

    rows.sort((a,b) => b.NVR - a.NVR || a.margin_pct_valid - b.margin_pct_valid);
    rows.slice(0, 250).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="row-strong">${r.POLLING_UNIT}</td>
        <td>${r.LGA}</td>
        <td>${r.WARD}</td>
        <td>${nfmt(r.NVR)}</td>
        <td>${pfmt(r.turnout_rate)}</td>
        <td>${nfmt(r.APC)}</td>
        <td>${nfmt(r.LP)}</td>
        <td>${nfmt(r.PDP)}</td>
        <td>${badgeHtml(r.winner, state.partyView === 'winner' ? 'winner' : r.winner)}</td>
        <td>${nfmt(r.margin_votes)}</td>
        <td>${badgeHtml(r.priority_flag,'winner')}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAll(){
    drawMap();
    renderLGATable();
    renderWardTable();
    renderPUTable();
    renderTopTables();
  }

  // init filters
  const lgaSel = document.getElementById('lga-filter');
  ['All LGAs', ...data.lgaSummary.map(r => r.LGA).sort()].forEach(v => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = v; lgaSel.appendChild(opt);
  });
  lgaSel.addEventListener('change', e => {
    state.selectedLGA = e.target.value;
    state.selectedWard = 'All Wards';
    syncFilters();
    renderAll();
  });

  const wardSel = document.getElementById('ward-filter');
  wardSel.addEventListener('change', e => {
    state.selectedWard = e.target.value;
    renderAll();
  });

  document.getElementById('pu-search').addEventListener('input', e => {
    state.search = e.target.value || '';
    renderPUTable();
  });

  document.querySelectorAll('#party-switch button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#party-switch button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.partyView = btn.dataset.party;
      renderAll();
    });
  });

  syncFilters();
  renderAll();
})();
