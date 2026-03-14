const DATA_FILE = 'players_sum.json';

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
    const existing = map.get(nick) || { sum: 0, img_src: '' };
    existing.sum += val;
    if (!existing.img_src && it.img_src) existing.img_src = it.img_src;
    map.set(nick, existing);
  }
  return Array.from(map.entries()).map(([nickname,obj])=>({
    nickname,
    sum: obj.sum,
    img_src: obj.img_src || ''
  }));
}

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderTable(data){
  const list = data.slice().sort((a,b)=>b.sum - a.sum);
  const wrap = document.getElementById('tableWrap');
  wrap.innerHTML = ''; // 초기화

  if (!list.length){
    wrap.innerHTML = '<p style="padding:18px;color:var(--muted)">표시할 항목이 없습니다.</p>';
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
  loadRawJson().then((raw)=>{
    try{
      const ag = aggregate(raw);
      renderTable(ag);
    }catch(err){
      console.error(err);
      document.getElementById('tableWrap').innerHTML = '<p style="padding:18px;color:var(--muted)">데이터 처리 중 오류가 발생했습니다. 콘솔을 확인하세요.</p>';
    }
  });
})();