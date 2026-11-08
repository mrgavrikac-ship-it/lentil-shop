'use strict';
const $ = selector => document.querySelector(selector);
const tg = window.Telegram?.WebApp;
const API_BASE = (window.SHOP_CONFIG?.API_BASE || 'https://exit-cupped-embassy.ngrok-free.dev/api').replace(/\/$/, '');
try { tg?.ready(); tg?.expand(); tg?.setHeaderColor('#10251f'); tg?.setBackgroundColor('#10251f'); } catch {}
const item = {id:'dido-nut', name:'DIDO Nut', price:25, img:'assets/dido.png', desc:'Вафельный батончик с молочным шоколадом и фундуком, 35 г.'};
const state = {balance:0, demo:!tg?.initData, ready:false, busy:false};
const dialog = $('#dialog'), modal = $('#modal');
let returnFocus;
function toast(text) { const el=$('#toast'); el.textContent=text; el.classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('visible'),3500); }
function showDialog() { returnFocus=document.activeElement; if(!dialog.open) dialog.showModal(); }
function closeDialog() { if(state.busy)return; dialog.close(); returnFocus?.focus(); }
dialog.addEventListener('cancel',event=>{if(state.busy)event.preventDefault();});
dialog.addEventListener('close',()=>returnFocus?.focus());
dialog.addEventListener('click',event=>{if(event.target===dialog)closeDialog();});
function closeButton() {const b=document.createElement('button'); b.className='close';b.textContent='×';b.setAttribute('aria-label','Закрыть');b.onclick=closeDialog;return b;}
function element(tag, className, text) {const e=document.createElement(tag);e.className=className;if(text!==undefined)e.textContent=text;return e;}
function heading(text) {const h=element('h2','m-title',text);h.id='modalTitle';return h;}
function lentil() {const i=new Image();i.src='assets/lentil.png';i.alt='чечевичек';return i;}
function row(label, value, bad=false) {const e=element('div','row'+(bad?' bad':'')),b=element('b','',String(value));b.append(lentil());e.append(element('span','',label),b);return e;}
function updateBalance() {$('#balanceNum').textContent=state.ready?String(state.balance):'—';$('#modeLabel').textContent=state.demo?'Предпросмотр · демо-баланс':state.ready?'Баланс синхронизирован':'Нет соединения с балансом';}
function connectionStatus(message) {
  let box=$('#connectionStatus');
  if(!box){box=element('p','connection-status');box.id='connectionStatus';box.setAttribute('role','status');$('#showcase').prepend(box);}
  box.textContent=message;box.hidden=!message;
}
async function api(path, options={}) {
  const tunnelHeaders = /^https:\/\/[a-z0-9.-]+\.ngrok-free\.(dev|app)(\/|$)/.test(API_BASE) ? {'ngrok-skip-browser-warning':'1'} : {};
  let response;
  const host=new URL(API_BASE,location.href).hostname;
  try{response=await fetch(API_BASE+path,{...options,cache:'no-store',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json','X-Init-Data':tg?.initData||'',...tunnelHeaders,...options.headers}});}
  catch(error){throw new Error(`Нет ответа от ${host}. ${error.name==='TimeoutError'?'Ожидание больше 12 секунд.':'Проверьте подключение и доступность API.'}`);}
  const raw=await response.text();
  let data;try {data=JSON.parse(raw);}catch{const code=raw.match(/ERR_NGROK_\d+/)?.[0];throw new Error(`API ${host}: HTTP ${response.status}, вместо данных пришла веб-страница${code?' ('+code+')':''}. Версия магазина: 3.`);}
  if(!response.ok)throw new Error(data.error||`API ${host}: HTTP ${response.status}`);
  return data;
}
async function loadBalance(){
  if(state.demo){state.balance=100;state.ready=true;updateBalance();return;}
  try{const data=await api('/balance');if(!Number.isFinite(data.balance))throw new Error('Не удалось загрузить баланс');state.balance=data.balance;state.ready=true;}
  catch(error){state.ready=false;connectionStatus(error.message);toast(error.message);}
  if(state.ready)connectionStatus('');
  updateBalance();
}
function showHow(){
  modal.replaceChildren(closeButton(),heading('Маленькая зимняя сказка'),element('p','m-desc','Добрые дела превращаются в чечевички. А чечевички — в подарки.'));
  const steps=element('ol','steps');
  for(const [title,copy] of [['Копите чечевички','За помощь, старание и достижения. Баллы выдаёт учитель или администратор.'],['Выберите награду','Нажмите на товар и подтвердите обмен. Цена будет списана с вашего баланса.'],['Получите подарок','Покажите чек администратору и заберите свою награду.']]){const li=document.createElement('li'),text=document.createElement('div');text.append(element('strong','',title),element('p','',copy));li.append(text);steps.append(li);}
  modal.append(steps);
  if(state.demo)modal.append(element('p','m-desc','Сейчас открыт предпросмотр: баланс и покупки демонстрационные, настоящие баллы не списываются.'));
  showDialog();
}
function openItem(){
  if(state.busy)return;
  const enough=state.ready&&state.balance>=item.price;
  let requestId=sessionStorage.getItem('pending-order-'+item.id);
  if(!requestId){requestId=crypto.randomUUID();sessionStorage.setItem('pending-order-'+item.id,requestId);}
  const scene=element('div','m-image'),pic=new Image();pic.src=item.img;pic.alt=item.name;scene.append(pic);
  modal.replaceChildren(closeButton(),scene,heading('Ваша шоколадная пауза'),element('p','m-desc',item.desc));
  if(state.demo)modal.append(element('p','m-desc','Демонстрационная покупка. Настоящие баллы не списываются.'));
  const rows=element('div','m-rows');rows.append(row('Стоимость',item.price),row('Ваш баланс',state.ready?state.balance:'—'));
  if(state.ready)rows.append(enough?row('После обмена',state.balance-item.price):row('Не хватает',item.price-state.balance,true));
  const button=element('button','buy-button',!state.ready?'Повторить подключение':enough?(state.demo?'Попробовать обмен · 25':'Обменять на 25 чечевичек'):'Недостаточно чечевичек');
  button.disabled=state.ready&&!enough;
  button.onclick=async()=>{
    if(!state.ready){await loadBalance();openItem();return;}
    if(state.busy||state.balance<item.price)return;
    state.busy=true;button.disabled=true;button.textContent='Оформляем ваш подарок…';
    try{
      let result;
      if(state.demo){await new Promise(resolve=>setTimeout(resolve,450));result={ok:true,balance:state.balance-item.price,order_id:'DEMO-'+Math.floor(1000+Math.random()*9000)};}
      else result=await api('/buy',{method:'POST',body:JSON.stringify({item_id:item.id,request_id:requestId})});
      if(!result.ok)throw new Error(result.error||'Не получилось оформить покупку');
      if(!Number.isFinite(result.balance)||result.order_id==null)throw new Error('Проверьте заказ у администратора перед повторной покупкой');
      sessionStorage.removeItem('pending-order-'+item.id);
      state.balance=result.balance;updateBalance();showSuccess(result.order_id);tg?.HapticFeedback?.notificationOccurred('success');
    }catch(error){toast(error.message);button.disabled=false;button.textContent='Попробовать снова';}
    finally{state.busy=false;}
  };
  const cancel=element('button','ghost','Ещё немного посмотрю');cancel.onclick=closeDialog;
  modal.append(rows,button,cancel);showDialog();
}
function showSuccess(id){
  modal.replaceChildren(closeButton(),heading(state.demo?'Вот так рождается радость':'Подарок почти у вас'));
  modal.append(element('p','m-desc',state.demo?'Это демо-чек: он не даёт права на получение товара. Откройте магазин через бота для настоящего обмена.':'Обмен оформлен. Покажите этот номер администратору, чтобы получить DIDO Nut.'));
  const receipt=element('div','receipt');receipt.append(element('small','',state.demo?'ДЕМОНСТРАЦИОННЫЙ ЧЕК':'НОМЕР ВАШЕГО ЧЕКА'),element('b','','#'+id));
  const button=element('button','buy-button','Спасибо за маленькое чудо');button.onclick=closeDialog;modal.append(receipt,button);
}
$('#how').onclick=showHow;$('#balance').onclick=()=>{if(!state.ready&&!state.demo)loadBalance();showHow();};
$('#openProduct').onclick=openItem;$('#productPreview').onclick=openItem;

// Lightweight layered snow: time-based motion, capped pixel ratio, no hidden-tab work.
const canvas=$('#snow'),ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let snowing=!reduced.matches,width=0,height=0,flakes=[],last=0,frameId=0;
function resize(){const ratio=Math.min(devicePixelRatio||1,2);width=innerWidth;height=innerHeight;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);flakes=Array.from({length:Math.min(78,Math.round(width/18))},()=>({x:Math.random()*width,y:Math.random()*height,z:Math.random(),phase:Math.random()*6.28}));}
function frame(time){if(!snowing||document.hidden){frameId=0;return;}const dt=Math.min((time-last)/1000||.016,.05);last=time;ctx.clearRect(0,0,width,height);for(const f of flakes){f.y+=dt*(10+f.z*24);f.x+=dt*(3+Math.sin(time/2600+f.phase)*10);if(f.y>height+5){f.y=-5;f.x=Math.random()*width;}if(f.x>width+5)f.x=-5;ctx.beginPath();ctx.globalAlpha=.15+f.z*.35;ctx.fillStyle='#f6f2e8';ctx.arc(f.x,f.y,.6+f.z*1.8,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;frameId=requestAnimationFrame(frame);}
function syncSnow(){const button=$('#snowToggle');button.setAttribute('aria-pressed',String(snowing));button.setAttribute('aria-label',snowing?'Выключить снег':'Включить снег');button.querySelector('span').textContent=snowing?'Снег идёт':'Снег на паузе';if(!snowing){cancelAnimationFrame(frameId);frameId=0;ctx.clearRect(0,0,width,height);}else if(!frameId&&!document.hidden){last=performance.now();frameId=requestAnimationFrame(frame);}}
$('#snowToggle').onclick=()=>{snowing=!snowing;syncSnow();};
addEventListener('resize',resize);document.addEventListener('visibilitychange',syncSnow);reduced.addEventListener('change',()=>{snowing=!reduced.matches;syncSnow();});
resize();syncSnow();loadBalance();
