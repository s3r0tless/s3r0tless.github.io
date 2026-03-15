const DATA_FILE = 'players_sum.json';
const DOWNLOAD_INFO_FILE = 'download_info.json';
const TIER_IMAGES_FILE = 'tier_images.json';

async function loadRawJson(){
  try{
    const res = await fetch(DATA_FILE, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (Array.isArray(json)) return json;
    for (const v of Object.values(json)) if (Array.isArray(v)) return v;
    throw new Error('JSON이 배열 형식이 아닙니다.');
  }catch(err){
    console.error('데이터 로드 실패:', err);
    return [];
  }
}

async function loadDownloadTime(){
  try{
    const res = await fetch(DOWNLOAD_INFO_FILE, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let data;
    try {
      data = await res.json();
    } catch(e) {
      data = await res.text();
    }
    if (!data) return null;
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      if (data.saved_at) return data.saved_at;
      const vals = Object.values(data);
      for (const v of vals) if (typeof v === 'string') return v;
    }
    return null;
  }catch(err){
    return null;
  }
}

async function loadTierImages(){
  try{
    const res = await fetch(TIER_IMAGES_FILE, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const map = {};
    for (const k of Object.keys(json || {})){
      map[String(k).toLowerCase()] = String(json[k] || '');
    }
    return map;
  }catch(err){
    console.warn('티어 이미지 로드 실패:', err);
    return {};
  }
}

function fmt(n){
  if (n === null || n === undefined) return '-';
  if (!isFinite(n)) return '-';
  if (Math.abs(n - Math.round(n)) < 1e-12) return Math.round(n).toLocaleString();
  return Number(n).toLocaleString(undefined, {maximumFractionDigits:4});
}

function aggregate(arr){
  const map = new Map();
  for(const it of arr){
    if (!it || typeof it !== 'object') continue;
    const nick = (it.nickname||it.name||'').toString();
    let val = Number(it.sum);
    if (!isFinite(val)) val = 0;
    if (!nick) continue;

    const existing = map.get(nick) || { sum: 0, img_src: '', mr4_set: new Set(), cap_set: new Set() };
    existing.sum += val;
    if (!existing.img_src && it.img_src) existing.img_src = it.img_src;

    const mrCandidates = [];
    if (Array.isArray(it.mr_4)) mrCandidates.push(...it.mr_4);
    if (Array.isArray(it['mr-4'])) mrCandidates.push(...it['mr-4']);
    if (Array.isArray(it.mr4)) mrCandidates.push(...it.mr4);
    if (typeof it.mr_4 === 'string') mrCandidates.push(it.mr_4);
    for (const m of mrCandidates){
      if (m || m === 0) existing.mr4_set.add(String(m));
    }

    const capCandidates = [];
    if (Array.isArray(it.capitalize)) capCandidates.push(...it.capitalize);
    if (typeof it.capitalize === 'string') capCandidates.push(it.capitalize);
    if (Array.isArray(it.cap)) capCandidates.push(...it.cap);
    for (const c of capCandidates){
      if (c || c === 0) existing.cap_set.add(String(c));
    }

    map.set(nick, existing);
  }

  return Array.from(map.entries()).map(([nickname,obj])=>{
    const mr4 = Array.from(obj.mr4_set).filter(x=>x!=null && String(x).trim()!=='').sort();
    let cap = Array.from(obj.cap_set).filter(x=>x!=null && String(x).trim()!=='').sort();
    if (!cap.length) cap = ['unranked'];
    return {
      nickname,
      sum: obj.sum,
      img_src: obj.img_src || '',
      mr_4: mr4,
      capitalize: cap
    };
  });
}

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderTable(data, downloadTime, tierImages){
  const list = data.slice().sort((a,b)=>b.sum - a.sum);
  const wrap = document.getElementById('tableWrap');
  wrap.innerHTML = ''; // 초기화

  if (downloadTime){
    const info = document.createElement('div');
    info.className = 'download-time';
    info.style.padding = '8px 18px';
    info.style.fontSize = '13px';
    info.style.color = 'var(--muted, #666)';
    info.style.marginBottom = '6px';
    info.textContent = `저장 시각 (UTC): ${downloadTime}`;
    wrap.appendChild(info);
  }

  if (!list.length){
    wrap.innerHTML += '<p style="padding:18px;color:var(--muted)">표시할 항목이 없습니다.</p>';
    return;
  }

  let prevSum = null;
  let rankCounter = 0;
  const rows = list.map((it)=>{ 
    if (prevSum === null || Math.abs(it.sum - prevSum) > 1e-12){
      rankCounter++;
      prevSum = it.sum;
    }
    return Object.assign({}, it, {rank: rankCounter});
  });

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>순위</th><th>닉네임</th><th style="text-align:right;padding-right:18px">합계</th></tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.style.animation = `slideUpFade 420ms cubic-bezier(.2,.9,.2,1) both`;
    tr.style.animationDelay = `${idx * 40}ms`;

    const tdRank = document.createElement('td');
    tdRank.className = 'rank';
    let badgeHtml = '';
    if (r.rank === 1) badgeHtml = `<span class="badge gold">1</span>`;
    else if (r.rank === 2) badgeHtml = `<span class="badge silver">2</span>`;
    else if (r.rank === 3) badgeHtml = `<span class="badge bronze">3</span>`;
    else badgeHtml = `<span class="rank-muted">${r.rank}</span>`;
    tdRank.innerHTML = badgeHtml;

    const tdNick = document.createElement('td');
    tdNick.className = 'nickname';
    const nickWrap = document.createElement('div');
    nickWrap.style.display = 'flex';
    nickWrap.style.alignItems = 'center';
    nickWrap.style.gap = '8px';

    if (r.img_src) {
      const avatar = document.createElement('img');
      avatar.src = r.img_src;
      avatar.alt = `${r.nickname} avatar`;
      avatar.className = 'avatar';
      avatar.style.width = '28px';
      avatar.style.height = '28px';
      avatar.style.borderRadius = '50%';
      avatar.style.objectFit = 'cover';
      avatar.style.flex = '0 0 28px';
      avatar.style.backgroundColor = 'var(--muted-bg, #eee)';
      nickWrap.appendChild(avatar);
    } else {
      const ph = document.createElement('div');
      ph.className = 'avatar-placeholder';
      ph.style.width = '28px';
      ph.style.height = '28px';
      ph.style.borderRadius = '50%';
      ph.style.display = 'inline-flex';
      ph.style.alignItems = 'center';
      ph.style.justifyContent = 'center';
      ph.style.flex = '0 0 28px';
      ph.style.background = 'linear-gradient(135deg,#ddd,#bbb)';
      ph.style.color = '#333';
      ph.style.fontSize = '12px';
      ph.style.fontWeight = '600';
      const initials = String(r.nickname).split(/\s+/).map(s=>s[0]||'').join('').slice(0,2).toUpperCase();
      ph.textContent = initials || '?';
      nickWrap.appendChild(ph);
    }

    const a = document.createElement('a');
    a.className = 'nick-link';
    a.href = 'https://app.voltaic.gg/' + encodeURIComponent(String(r.nickname));
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = String(r.nickname);
    a.style.textDecoration = 'none';
    a.style.color = 'inherit';
    a.style.fontWeight = '600';
    nickWrap.appendChild(a);

    let tierKey = 'unranked';
    if (Array.isArray(r.capitalize) && r.capitalize.length) {
      tierKey = String(r.capitalize[0]).toLowerCase();
    } else if (typeof r.capitalize === 'string' && r.capitalize.trim()) {
      tierKey = r.capitalize.toLowerCase();
    }
    const tierUrl = (tierImages && tierImages[tierKey]) ? tierImages[tierKey] : '';

    if (tierUrl) {
      const timg = document.createElement('img');
      timg.src = tierUrl;
      timg.alt = `${tierKey} tier`;
      timg.title = tierKey;
      timg.style.width = '18px';
      timg.style.height = '18px';
      timg.style.objectFit = 'contain';
      timg.style.marginLeft = '6px';
      timg.style.flex = '0 0 18px';
      nickWrap.appendChild(timg);
    }

    const metaWrap = document.createElement('div');
    metaWrap.style.display = 'flex';
    metaWrap.style.flexDirection = 'column';
    metaWrap.style.marginLeft = '8px';
    metaWrap.style.fontSize = '12px';
    metaWrap.style.lineHeight = '1';
    metaWrap.style.color = 'var(--muted, #666)';

    const mrText = Array.isArray(r.mr_4) && r.mr_4.length ? r.mr_4.join(', ') : '';
    if (mrText) {
      const sp = document.createElement('div');
      sp.className = 'meta-mr4';
      sp.textContent = mrText;
      metaWrap.appendChild(sp);
    }

    const capText = Array.isArray(r.capitalize) && r.capitalize.length ? r.capitalize.join(', ') : '';
    if (capText) {
      const sp2 = document.createElement('div');
      sp2.className = 'meta-cap';
      sp2.textContent = capText;
      metaWrap.appendChild(sp2);
    }

    if (metaWrap.childElementCount > 0) {
      nickWrap.appendChild(metaWrap);
    }

    tdNick.appendChild(nickWrap);

    const tdSum = document.createElement('td');
    tdSum.className = 'sum';
    tdSum.style.textAlign = 'right';
    tdSum.style.paddingRight = '18px';
    tdSum.innerText = fmt(r.sum);

    tr.appendChild(tdRank);
    tr.appendChild(tdNick);
    tr.appendChild(tdSum);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);

  const goldEl = document.querySelector('.badge.gold');
  if (goldEl){
    goldEl.style.backgroundSize = '200% 100%';
    goldEl.style.backgroundImage = 'linear-gradient(90deg,#fff2cc,#ffe08b,#f59e0b)';
    goldEl.style.animation += ', shimmer 2200ms linear infinite';
    goldEl.style.animationDelay = '600ms';
  }
}

(function init(){
  Promise.all([loadRawJson(), loadDownloadTime(), loadTierImages()]).then(([raw, downloadTime, tierImages])=>{
    try{
      const ag = aggregate(raw);
      renderTable(ag, downloadTime, tierImages);
    }catch(err){
      console.error(err);
      document.getElementById('tableWrap').innerHTML = '<p style="padding:18px;color:var(--muted)">데이터 처리 중 오류가 발생했습니다. 콘솔을 확인하세요.</p>';
    }
  });
})();
