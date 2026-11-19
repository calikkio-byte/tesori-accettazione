'use strict';
const KEYS = {c:'atelier_orafo_clients_v1', j:'atelier_orafo_jobs_v1', s:'atelier_orafo_settings_v1'};
const DEF = {shopName:'Atelier Orafo & Gioielleria', shopSubtitle:'Laboratorio Artigianale di Oreficeria e Riparazioni', shopAddress:'Via Roma 42, 29121 Piacenza (PC)', shopPhone:'+39 0523 000000', shopEmail:'laboratorio@atelierorafo.it', shopVat:'P.IVA 01234567890'};
const PRODUCTS = ['Anello','Collana','Bracciale','Orecchini','Orologio','Spilla','Ciondolo','Altro'];
const METALS = ['Oro 750 Giallo','Oro 750 Bianco','Oro 750 Rosa','Oro 375','Platino 950','Argento 925','Acciaio','Altro'];
const STATUSES = [['IN_ATTESA_PEZZI','In attesa pezzi'],['IN_LAVORAZIONE','In lavorazione'],['PRONTO_RITIRO','Pronto per il ritiro'],['CONSEGNATO','Consegnato']];

// ---------- utilità data ----------
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const addDays = (b,n) => { const [y,m,d] = b.split('-').map(Number); return iso(new Date(y,m-1,d+n)); };
const diffDays = t => { if(!t) return 0; const [a,b,c] = t.split('-').map(Number), [x,y,z] = today().split('-').map(Number); return Math.round((new Date(a,b-1,c)-new Date(x,y-1,z))/864e5); };
const fmt = s => s ? s.split('-').reverse().join('/') : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function semaphore(j){
  if(j.status==='CONSEGNATO') return {k:'DONE', l:'Consegnato'};
  const d = diffDays(j.estimatedDeliveryDate);
  if(d<0) return {k:'OVERDUE', l: d===-1 ? 'In ritardo di 1 gg' : `In ritardo di ${-d} gg`};
  if(d<=2) return {k:'DUE_SOON', l: d===0 ? 'Scade oggi' : d===1 ? 'Scade domani' : 'Scade tra 2 gg'};
  return {k:'ON_TIME', l:`Scade tra ${d} gg`};
}
function nextCode(type){
  const y = new Date().getFullYear(), p = type==='CREAZIONE' ? 'CRE' : 'RIP', re = new RegExp(`^${p}-${y}-(\\d+)$`);
  let max = 0; state.jobs.forEach(j => { const m = (j.code||'').match(re); if(m) max = Math.max(max, +m[1]); });
  return `${p}-${y}-${pad(max+1).padStart(3,'0')}`;
}

// ---------- dati demo ----------
function demo(){
  const t = today(), y = new Date().getFullYear();
  const clients = [
    {id:'cli-1', fullName:'Elena Visconti', phone:'338 4512980', fiscalCode:'VSCLNE84M52G535K', address:'Corso Vittorio Emanuele 18, Piacenza', email:'elena.visconti@email.it'},
    {id:'cli-2', fullName:'Marco Ferretti', phone:'347 9081123', fiscalCode:'FRRMRC79C14F205Z', address:'Via Cavour 54, Piacenza', email:'marco.ferretti@studioferretti.it'},
    {id:'cli-3', fullName:'Giulia Conti', phone:'329 6610432', fiscalCode:'CNTGLI91D48G535P', address:'Viale Dante Alighieri 102, Piacenza', email:'giulia.conti91@gmail.com'}];
  const mk = (n,type,cid,prod,w,metal,stones,desc,notes,ind,out,price,status,extra={}) => ({id:'job-'+n, code:`${type==='CREAZIONE'?'CRE':'RIP'}-${y}-00${n}`, serviceType:type, clientId:cid, productType:prod, weightGrams:w, metal, stones, description:desc, notes, intakeDate:addDays(t,ind), estimatedDeliveryDate:addDays(t,out), estimatedPrice:price, status, ...extra});
  const jobs = [
    mk(1,'RIPARAZIONE','cli-1','Anello','4.85','Oro 750 Bianco','Diamante 0.45 ct','Ricostruzione di due griffe e rodiatura.','Incisione interna da preservare.',-10,-3,'140','IN_LAVORAZIONE'),
    mk(2,'CREAZIONE','cli-2','Anello','5.20','Oro 750 Rosa','Zaffiro ovale 1.10 ct','Solitario su misura, misura 14.','Modello in cera approvato.',-14,0,'1250','IN_LAVORAZIONE'),
    mk(3,'RIPARAZIONE','cli-3','Bracciale','11.40','Oro 750 Giallo','','Saldatura laser maglia e molla chiusura.','',-4,1,'65','IN_ATTESA_PEZZI'),
    mk(4,'RIPARAZIONE','cli-2','Anello','4.10','Oro 750 Giallo','','Messa a misura fede da 19 a 20.','',-15,-6,'40','CONSEGNATO',{deliveredAt:addDays(t,-6)})];
  return {clients, jobs};
}

// ---------- stato ----------
const load = (k,f) => { try { const v = localStorage.getItem(k); if(v) return JSON.parse(v); } catch(e){} return f; };
const d0 = demo();
const state = {clients:load(KEYS.c,d0.clients), jobs:load(KEYS.j,d0.jobs), settings:{...DEF, ...load(KEYS.s,{})}, tab:'dashboard', filter:'ALL', q:'', preClient:null};
const save = () => { try { localStorage.setItem(KEYS.c,JSON.stringify(state.clients)); localStorage.setItem(KEYS.j,JSON.stringify(state.jobs)); localStorage.setItem(KEYS.s,JSON.stringify(state.settings)); } catch(e){ toast('Salvataggio non riuscito'); } };
const client = id => state.clients.find(c => c.id===id) || {fullName:'Cliente rimosso', phone:'—'};
let tt; function toast(m){ const t = document.getElementById('toast'); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(()=>t.hidden=true, 3200); }
const $ = id => document.getElementById(id);
const opts = (arr,sel) => arr.map(o => { const [v,l] = Array.isArray(o)?o:[o,o]; return `<option value="${esc(v)}"${v===sel?' selected':''}>${esc(l)}</option>`; }).join('');

// ---------- viste ----------
function render(){
  $('brand').innerHTML = `<b>${esc(state.settings.shopName)}</b><small>${esc(state.settings.shopSubtitle)}</small>`;
  document.querySelectorAll('nav [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab===state.tab));
  $('main').innerHTML = state.tab==='dashboard' ? dashboard() : state.tab==='new' ? newJobForm() : clientsView();
}

function dashboard(){
  const all = state.jobs.map(j => ({...j, c:client(j.clientId), s:semaphore(j)}));
  const act = all.filter(j => j.status!=='CONSEGNATO');
  const kp = [['ALL','Lavori attivi',act.length],['OVERDUE','In ritardo',act.filter(j=>j.s.k==='OVERDUE').length],['DUE_SOON','In scadenza',act.filter(j=>j.s.k==='DUE_SOON').length],['PRONTO_RITIRO','Pronti per il ritiro',act.filter(j=>j.status==='PRONTO_RITIRO').length]];
  const q = state.q.trim().toLowerCase();
  const list = all.filter(j => {
    const f = state.filter;
    if(f==='RIPARAZIONE'||f==='CREAZIONE'){ if(j.serviceType!==f) return false; }
    else if(f==='OVERDUE'||f==='DUE_SOON'){ if(j.s.k!==f) return false; }
    else if(f==='PRONTO_RITIRO'||f==='CONSEGNATO'){ if(j.status!==f) return false; }
    return !q || [j.code,j.c.fullName,j.c.phone,j.description,j.productType].some(v => (v||'').toLowerCase().includes(q));
  }).sort((a,b) => (a.status==='CONSEGNATO')-(b.status==='CONSEGNATO') || (a.estimatedDeliveryDate||'').localeCompare(b.estimatedDeliveryDate||''));
  const pills = [['ALL','Tutti'],['RIPARAZIONE','Riparazioni'],['CREAZIONE','Creazioni'],['OVERDUE','In ritardo'],['DUE_SOON','In scadenza'],['PRONTO_RITIRO','Pronti'],['CONSEGNATO','Consegnati']];
  return `<div class="kpis">${kp.map(([f,l,n]) => `<button class="kpi" data-filter="${f}"><b>${n}</b><span>${l}</span></button>`).join('')}</div>
  <div class="bar"><input type="search" id="q" placeholder="Cerca per codice, cliente, telefono, descrizione…" value="${esc(state.q)}">${pills.map(([f,l]) => `<button data-filter="${f}" class="${state.filter===f?'on':''}">${l}</button>`).join('')}</div>
  <div class="grid">${list.map(card).join('') || '<p class="mu">Nessuna scheda trovata.</p>'}</div>`;
}
function card(j){
  return `<article class="card"><div class="row"><b>${esc(j.code)}</b><span class="badge ${j.s.k}"><i class="dot"></i>${esc(j.s.l)}</span></div>
  <h3>${esc(j.c.fullName)}</h3><div class="mu">${esc(j.productType)} · ${esc(j.metal)} · ${esc(j.weightGrams||'—')} g</div>
  <div>${esc(j.description)}</div>
  <div class="mu">Ingresso ${fmt(j.intakeDate)} · Consegna ${fmt(j.estimatedDeliveryDate)}${j.estimatedPrice?` · € ${esc(j.estimatedPrice)}`:''}</div>
  <div class="row"><select data-status="${j.id}">${opts(STATUSES,j.status)}</select><span><button data-act="detail" data-id="${j.id}">Dettagli</button> <button data-act="receipt" data-id="${j.id}">Ricevuta</button></span></div></article>`;
}

function newJobForm(){
  const p = state.preClient || {};
  const t = today();
  return `<h2>Nuova scheda</h2><form class="form" id="jobForm">
  <label>Cliente già in rubrica<select id="pick"><option value="">— Nuovo cliente —</option>${opts(state.clients.map(c=>[c.id,`${c.fullName} (${c.phone})`]), p.id)}</select></label>
  <div class="cols">
   <label>Tipo di lavoro<select name="serviceType"><option value="RIPARAZIONE">Riparazione</option><option value="CREAZIONE">Creazione</option></select></label>
   <label>Nome e cognome *<input name="clientName" required value="${esc(p.fullName)}"></label>
   <label>Telefono *<input name="clientPhone" required value="${esc(p.phone)}"></label>
   <label>Codice fiscale<input name="clientFiscalCode" value="${esc(p.fiscalCode)}"></label>
   <label>Indirizzo<input name="clientAddress" value="${esc(p.address)}"></label>
   <label>Email<input type="email" name="clientEmail" value="${esc(p.email)}"></label>
   <label>Oggetto<select name="productType">${opts(PRODUCTS)}</select></label>
   <label>Peso (g)<input name="weightGrams" inputmode="decimal"></label>
   <label>Metallo<select name="metal">${opts(METALS)}</select></label>
   <label>Altro metallo<input name="customMetal"></label>
   <label>Data ingresso<input type="date" name="intakeDate" value="${t}"></label>
   <label>Consegna prevista *<input type="date" name="estimatedDeliveryDate" required value="${addDays(t,7)}"></label>
   <label>Prezzo stimato (€)<input name="estimatedPrice" inputmode="decimal"></label>
  </div>
  <label>Pietre<input name="stones"></label>
  <label>Descrizione del lavoro *<textarea name="description" rows="3" required></textarea></label>
  <label>Note interne<textarea name="notes" rows="2"></textarea></label>
  <div class="row"><span>${[3,7,14].map(n=>`<button type="button" data-quick="${n}">+${n} gg</button>`).join(' ')}</span><button class="pri">Salva scheda</button></div></form>`;
}

function clientsView(){
  return `<h2>Clienti (${state.clients.length})</h2><div class="bar"><input type="search" id="cq" placeholder="Cerca cliente…"></div>
  <div class="grid" id="clist">${state.clients.map(c => {
    const n = state.jobs.filter(j=>j.clientId===c.id).length;
    return `<article class="card" data-name="${esc((c.fullName+' '+c.phone).toLowerCase())}"><h3>${esc(c.fullName)}</h3><div class="mu">${esc(c.phone)} · ${esc(c.email)}<br>${esc(c.address)}<br>${esc(c.fiscalCode)}</div><div class="row"><span class="mu">${n} schede</span><button data-act="newfor" data-id="${c.id}">Nuova scheda</button></div></article>`;
  }).join('')}</div>`;
}

// ---------- modali ----------
const modal = h => { $('modal').innerHTML = `<div class="modal">${h}</div>`; $('modal').hidden = false; };
const closeModal = () => { $('modal').hidden = true; $('modal').innerHTML = ''; };

function detailModal(id){
  const j = state.jobs.find(x=>x.id===id); if(!j) return;
  modal(`<h2>${esc(j.code)} — ${esc(client(j.clientId).fullName)}</h2><form id="detailForm" data-id="${id}">
  <div class="cols"><label>Stato<select name="status">${opts(STATUSES,j.status)}</select></label>
  <label>Consegna prevista<input type="date" name="estimatedDeliveryDate" value="${esc(j.estimatedDeliveryDate)}"></label>
  <label>Prezzo (€)<input name="estimatedPrice" value="${esc(j.estimatedPrice)}"></label>
  <label>Peso (g)<input name="weightGrams" value="${esc(j.weightGrams)}"></label></div>
  <label>Pietre<input name="stones" value="${esc(j.stones)}"></label>
  <label>Descrizione<textarea name="description" rows="3">${esc(j.description)}</textarea></label>
  <label>Note<textarea name="notes" rows="2">${esc(j.notes)}</textarea></label>
  <div class="row"><button type="button" class="dan" data-act="delete" data-id="${id}">Elimina</button><span><button type="button" data-act="close">Chiudi</button> <button class="pri">Salva</button></span></div></form>`);
}

function receiptModal(id){
  const j = state.jobs.find(x=>x.id===id); if(!j) return; const c = client(j.clientId), s = state.settings;
  modal(`<div class="receipt"><h3>${esc(s.shopName)}</h3><p>${esc(s.shopSubtitle)}</p><p>${esc(s.shopAddress)} · ${esc(s.shopPhone)}</p><p>${esc(s.shopEmail)} · ${esc(s.shopVat)}</p><hr>
  <h3>Ricevuta di presa in carico n. ${esc(j.code)}</h3><p>Data ingresso: ${fmt(j.intakeDate)} · Consegna prevista: ${fmt(j.estimatedDeliveryDate)}</p><hr>
  <p><b>Cliente:</b> ${esc(c.fullName)} — tel. ${esc(c.phone)}</p>
  <p><b>Oggetto:</b> ${esc(j.productType)}, ${esc(j.metal)}, ${esc(j.weightGrams||'—')} g</p>
  ${j.stones?`<p><b>Pietre:</b> ${esc(j.stones)}</p>`:''}<p><b>Lavoro:</b> ${esc(j.description)}</p>
  ${j.estimatedPrice?`<p><b>Preventivo:</b> € ${esc(j.estimatedPrice)}</p>`:''}<hr><p>Firma cliente: ______________________</p></div>
  <div class="row" style="margin-top:12px"><button data-act="close">Chiudi</button><button class="pri" data-act="print">Stampa</button></div>`);
}

function settingsModal(){
  const s = state.settings, f = [['shopName','Nome attività'],['shopSubtitle','Sottotitolo'],['shopAddress','Indirizzo'],['shopPhone','Telefono'],['shopEmail','Email'],['shopVat','Partita IVA']];
  modal(`<h2>Impostazioni</h2><form id="setForm">${f.map(([k,l])=>`<label>${l}<input name="${k}" value="${esc(s[k])}"></label>`).join('')}<div class="row"><button type="button" data-act="close">Chiudi</button><button class="pri">Salva</button></div></form><hr>
  <h3>Dati</h3><div class="row"><button data-act="export">Esporta backup</button><label class="btn" style="margin:0">Importa backup<input type="file" id="imp" accept="application/json" hidden></label><button data-act="demo">Ricarica demo</button><button class="dan" data-act="wipe">Cancella tutto</button></div>`);
}

// ---------- eventi ----------
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-tab]'); if(!t) { if(e.target===$('modal')) closeModal(); return; }
  if(t.dataset.tab){ state.tab = t.dataset.tab; state.preClient = null; render(); return; }
  if(t.dataset.filter){ state.filter = t.dataset.filter; render(); return; }
  if(t.dataset.quick){ const i = document.querySelector('[name=intakeDate]').value || today(); document.querySelector('[name=estimatedDeliveryDate]').value = addDays(i,+t.dataset.quick); return; }
  const id = t.dataset.id;
  switch(t.dataset.act){
    case 'settings': settingsModal(); break;
    case 'detail': detailModal(id); break;
    case 'receipt': receiptModal(id); break;
    case 'close': closeModal(); break;
    case 'print': window.print(); break;
    case 'newfor': state.preClient = state.clients.find(c=>c.id===id); state.tab = 'new'; render(); break;
    case 'delete': if(confirm('Eliminare definitivamente questa scheda?')){ state.jobs = state.jobs.filter(j=>j.id!==id); save(); closeModal(); render(); toast('Scheda eliminata'); } break;
    case 'export': { const b = new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),settings:state.settings,clients:state.clients,jobs:state.jobs},null,2)],{type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `gestionale-orafo-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('Backup esportato'); break; }
    case 'demo': if(confirm('Sostituire i dati attuali con quelli demo?')){ const d = demo(); state.clients = d.clients; state.jobs = d.jobs; save(); closeModal(); render(); toast('Dati demo caricati'); } break;
    case 'wipe': if(confirm('Cancellare tutti i dati? L’operazione non è reversibile.')){ state.clients = []; state.jobs = []; save(); closeModal(); render(); toast('Dati cancellati'); } break;
  }
});

document.addEventListener('input', e => {
  if(e.target.id==='q'){ state.q = e.target.value; const pos = e.target.selectionStart; render(); const q = $('q'); q.focus(); q.setSelectionRange(pos,pos); }
  if(e.target.id==='cq'){ const v = e.target.value.toLowerCase(); document.querySelectorAll('#clist [data-name]').forEach(c => c.hidden = !c.dataset.name.includes(v)); }
});

document.addEventListener('change', e => {
  const t = e.target;
  if(t.dataset.status){ const j = state.jobs.find(x=>x.id===t.dataset.status); j.status = t.value; j.deliveredAt = t.value==='CONSEGNATO' ? today() : undefined; save(); render(); toast('Stato aggiornato'); }
  if(t.id==='pick'){ state.preClient = state.clients.find(c=>c.id===t.value) || null; const keep = {}; new FormData($('jobForm')).forEach((v,k)=>keep[k]=v); render(); const f = $('jobForm'); ['serviceType','productType','weightGrams','metal','customMetal','stones','description','notes','intakeDate','estimatedDeliveryDate','estimatedPrice'].forEach(k => f.elements[k].value = keep[k]); }
  if(t.id==='imp' && t.files[0]){ const r = new FileReader(); r.onload = ev => { try { const p = JSON.parse(ev.target.result); if(!Array.isArray(p.clients)||!Array.isArray(p.jobs)) throw 0; state.clients = p.clients; state.jobs = p.jobs; if(p.settings) state.settings = {...DEF,...p.settings}; save(); closeModal(); render(); toast(`Importati ${p.jobs.length} lavori e ${p.clients.length} clienti`); } catch(_){ toast('File di backup non valido'); } }; r.readAsText(t.files[0]); }
});

document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target, d = Object.fromEntries(new FormData(f));
  if(f.id==='jobForm'){
    const pay = {fullName:d.clientName.trim(), phone:d.clientPhone.trim(), fiscalCode:d.clientFiscalCode.trim().toUpperCase(), address:d.clientAddress.trim(), email:d.clientEmail.trim()};
    const pickId = $('pick').value;
    let cid = pickId && state.clients.find(c=>c.id===pickId) ? pickId : null;
    if(!cid){ const ex = state.clients.find(c => (pay.fiscalCode && c.fiscalCode && c.fiscalCode.toUpperCase()===pay.fiscalCode) || (c.phone.replace(/\s+/g,'')===pay.phone.replace(/\s+/g,'') && c.fullName.toLowerCase()===pay.fullName.toLowerCase())); cid = ex ? ex.id : 'cli-'+Date.now(); if(!ex) state.clients.unshift({id:cid, ...pay}); }
    Object.assign(state.clients.find(c=>c.id===cid), pay);
    const code = nextCode(d.serviceType), id = 'job-'+Date.now();
    state.jobs.unshift({id, code, serviceType:d.serviceType, clientId:cid, productType:d.productType, weightGrams:d.weightGrams, metal: d.metal==='Altro' && d.customMetal.trim() ? d.customMetal.trim() : d.metal, stones:d.stones.trim(), description:d.description.trim(), notes:d.notes.trim(), intakeDate:d.intakeDate, estimatedDeliveryDate:d.estimatedDeliveryDate, estimatedPrice:d.estimatedPrice, status:'IN_LAVORAZIONE'});
    save(); state.tab = 'dashboard'; state.preClient = null; render(); receiptModal(id); toast(`Scheda ${code} salvata`);
  } else if(f.id==='detailForm'){
    const j = state.jobs.find(x=>x.id===f.dataset.id); Object.assign(j, d); j.deliveredAt = d.status==='CONSEGNATO' ? (j.deliveredAt || today()) : undefined;
    save(); closeModal(); render(); toast(`Scheda ${j.code} aggiornata`);
  } else if(f.id==='setForm'){
    state.settings = {...state.settings, ...d}; save(); closeModal(); render(); toast('Impostazioni salvate');
  }
});

render();
