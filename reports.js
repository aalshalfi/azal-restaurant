(function (root) {
  "use strict";
  const TZ = "America/Toronto";
  const today = (now) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const addDay = (iso) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10); };
  const money = (c, locale) => new Intl.NumberFormat(locale, { style:"currency", currency:"CAD" }).format(Number(c||0)/100);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const COPY = {
    en:{title:"Sales & HST reports",intro:"Collected sales are paid orders handed over to the customer. Periods use the successful payment timestamp and Toronto dates.",bucket:"Group by",day:"Daily",month:"Monthly",year:"Yearly",from:"From",to:"Through",branch:"Branch",all:"All assigned branches",run:"Run report",period:"Period",paid:"Paid orders",placed:"Received",accepted:"Accepted",preparing:"Preparing",ready:"Ready",handed:"Handed over",cancelled:"Cancelled",collected:"Collected sales",subtotal:"Subtotal",discount:"Discount",hst:"HST",refunds:"Refunds",net:"Net collected",empty:"No paid orders in this period.",error:"The report could not be loaded. Check your access and try again.",manager:"Manager view: assigned branches only; financial breakdown is restricted to Admin.",admin:"Admin view: all branches and financial breakdown.",currencyNote:"Amounts are CAD. Historical tax values are read from the order snapshot."},
    fr:{title:"Rapports des ventes et de la TVH",intro:"Les ventes encaissées correspondent aux commandes payées et remises au client. Les périodes utilisent l’heure du paiement confirmé et les dates de Toronto.",bucket:"Regrouper par",day:"Jour",month:"Mois",year:"Année",from:"Du",to:"Jusqu’au",branch:"Succursale",all:"Toutes les succursales attribuées",run:"Afficher le rapport",period:"Période",paid:"Commandes payées",placed:"Reçues",accepted:"Acceptées",preparing:"En préparation",ready:"Prêtes",handed:"Remises",cancelled:"Annulées",collected:"Ventes encaissées",subtotal:"Sous-total",discount:"Rabais",hst:"TVH",refunds:"Remboursements",net:"Net encaissé",empty:"Aucune commande payée pour cette période.",error:"Impossible de charger le rapport. Vérifiez vos accès et réessayez.",manager:"Vue Gestionnaire : succursales attribuées seulement; le détail financier est réservé à l’Admin.",admin:"Vue Admin : toutes les succursales et détail financier.",currencyNote:"Montants en CAD. Les valeurs fiscales historiques proviennent de l’instantané de la commande."},
    ar:{title:"تقارير المبيعات وHST",intro:"المبيعات المحصّلة هي الطلبات المدفوعة التي سُلّمت للعميل. تعتمد الفترات على وقت نجاح الدفع وتاريخ تورونتو.",bucket:"التجميع حسب",day:"يومي",month:"شهري",year:"سنوي",from:"من",to:"حتى",branch:"الفرع",all:"كل الفروع المعيّنة",run:"عرض التقرير",period:"الفترة",paid:"الطلبات المدفوعة",placed:"مستلمة",accepted:"مقبولة",preparing:"قيد التحضير",ready:"جاهزة",handed:"تم تسليمها",cancelled:"ملغاة",collected:"المبيعات المحصّلة",subtotal:"المجموع الفرعي",discount:"الخصم",hst:"HST",refunds:"المبالغ المستردة",net:"صافي التحصيل",empty:"لا توجد طلبات مدفوعة في هذه الفترة.",error:"تعذّر تحميل التقرير. تحقق من الصلاحيات وحاول مجدداً.",manager:"عرض المدير: الفروع المعيّنة فقط؛ التفاصيل المالية للمدير العام فقط.",admin:"عرض المدير العام: جميع الفروع والتفاصيل المالية.",currencyNote:"المبالغ بالدولار الكندي. نستخدم القيم الضريبية المحفوظة مع الطلب."}
  };
  function createReports({config,fetch:fetchFn,getSession,now}) {
    const enabled=Boolean(config&&config.url&&config.anonKey&&fetchFn), base=enabled?String(config.url).replace(/\/+$/,""):"";
    now=now||(()=>Date.now());
    async function call(path,token,method="GET",body) {
      const res=await fetchFn(base+path,{method,headers:{apikey:config.anonKey,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
      const data=await res.json().catch(()=>null);
      if(!res.ok) throw Object.assign(new Error((data&&data.message)||"request_failed"),{status:res.status,code:res.status===401?"signed_out":"error"});
      return data;
    }
    return {
      enabled,
      async access(){
        const s=enabled&&getSession?await getSession():null;if(!s||!s.access_token)return {status:"signed_out"};
        const uid=s.user&&s.user.id;
        const [isAdmin,roles,branches]=await Promise.all([
          call("/rest/v1/rpc/azal_is_admin",s.access_token,"POST",{}),
          call("/rest/v1/user_roles?select=role&user_id=eq."+encodeURIComponent(uid),s.access_token),
          call("/rest/v1/staff_branch_access?select=branch_slug&user_id=eq."+encodeURIComponent(uid),s.access_token)
        ]);
        const rs=new Set((roles||[]).map(x=>x.role));
        return {status:"signed_in",role:isAdmin===true?"admin":rs.has("manager")?"manager":"other",branches:(branches||[]).map(x=>x.branch_slug),token:s.access_token};
      },
      async branchNames(token){return (await call("/rest/v1/branches?select=slug,name_en,name_fr&active=eq.true&order=name_en.asc",token))||[];},
      async report(token,{bucket,from,to,branch}) {
        return call("/rest/v1/rpc/azal_admin_sales_report",token,"POST",{p_bucket:bucket,p_from:from,p_to:addDay(to),p_branch_slug:branch||null});
      }
    };
  }
  const api={createReports,today,addDay,money};
  if(typeof module!=="undefined"&&module.exports){module.exports=api;return;}
  const host=document.getElementById("reportsRoot");if(!host)return;
  const auth=root.AZALAuth, apiClient=createReports({config:root.AZAL_SUPABASE||{},fetch:root.fetch&&root.fetch.bind(root),getSession:async()=>{try{return auth&&await auth.session();}catch{return null;}}});
  const lang=()=>["fr","ar"].includes(document.documentElement.lang)?document.documentElement.lang:"en";
  const L=k=>COPY[lang()][k]||COPY.en[k]||k;
  const locale=()=>({en:"en-CA",fr:"fr-CA",ar:"ar-CA-u-nu-latn"})[lang()];
  const state={access:null,branches:[],data:null,busy:false,error:false,seq:0,bucket:"day",from:"",to:"",branch:""};
  const fmtMoney=c=>{const s=money(c,locale());return lang()==="ar"?"\u2066"+s+"\u2069":s;};
  const dateText=v=>new Intl.DateTimeFormat(locale(),{timeZone:TZ,dateStyle:"medium"}).format(new Date(v+"T12:00:00Z"));
  const labelBranch=b=>{const x=state.branches.find(v=>v.slug===b);return x?(lang()==="fr"?x.name_fr:x.name_en)||b:b;};
  function render(){
    if(!state.access||!["admin","manager"].includes(state.access.role)){host.replaceChildren();return;}
    const admin=state.access.role==="admin";
    const branches=admin?state.branches:state.branches.filter(b=>state.access.branches.includes(b.slug));
    const opts=(admin?[{slug:"",name_en:L("all"),name_fr:L("all")}]:[]).concat(branches).map(b=>'<option value="'+esc(b.slug)+'"'+(b.slug===state.branch?' selected':'')+'>'+esc(b.slug?labelBranch(b.slug):L("all"))+'</option>').join("");
    let html='<section class="admin-panel report-panel"><h2>'+esc(L("title"))+'</h2><p class="admin-note">'+esc(L("intro"))+'</p><p class="admin-note">'+esc(L(admin?"admin":"manager"))+'</p>';
    html+='<form id="salesReportForm" class="report-filters"><label>'+esc(L("bucket"))+'<select name="bucket"><option value="day"'+(state.bucket==="day"?" selected":"")+'>'+esc(L("day"))+'</option><option value="month"'+(state.bucket==="month"?" selected":"")+'>'+esc(L("month"))+'</option><option value="year"'+(state.bucket==="year"?" selected":"")+'>'+esc(L("year"))+'</option></select></label><label>'+esc(L("from"))+'<input type="date" name="from" value="'+esc(state.from)+'" required></label><label>'+esc(L("to"))+'<input type="date" name="to" value="'+esc(state.to)+'" required></label><label>'+esc(L("branch"))+'<select name="branch">'+opts+'</select></label><button class="button button-gold" type="submit"'+(state.busy?" disabled":"")+'>'+esc(state.busy?"…":L("run"))+'</button></form>';
    if(state.error)html+='<p class="member-history-error" role="alert">'+esc(L("error"))+'</p>';
    else if(state.busy)html+='<p class="admin-note" aria-live="polite">…</p>';
    else if(state.data){
      const rows=state.data.rows||[];
      if(!rows.length)html+='<p class="admin-note">'+esc(L("empty"))+'</p>';
      else{
        const cols=["period_start","paid_orders","placed_count","accepted_count","preparing_count","ready_count","handed_over_count","cancelled_count","collected_cents"];
        const heads=[L("period"),L("paid"),L("placed"),L("accepted"),L("preparing"),L("ready"),L("handed"),L("cancelled"),L("collected")];
        if(admin){cols.push("subtotal_cents","discount_cents","hst_cents","refunds_cents","net_collected_cents");heads.push(L("subtotal"),L("discount"),L("hst"),L("refunds"),L("net"));}
        html+='<div class="report-table-wrap"><table class="report-table"><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join("")+'</tr></thead><tbody>';
        for(const r of rows){html+='<tr>'+cols.map(c=>'<td>'+esc(c==="period_start"?dateText(r[c]):c.endsWith("_cents")?fmtMoney(r[c]):r[c])+'</td>').join("")+'</tr>';}
        html+='</tbody></table></div><p class="admin-note">'+esc(L("currencyNote"))+'</p>';
      }
    }
    html+='</section>';host.innerHTML=html;
  }
  async function load(){
    const seq=++state.seq;state.busy=true;state.error=false;render();
    try{
      const a=await apiClient.access();if(seq!==state.seq)return;state.access=a;
      if(!["admin","manager"].includes(a.role)){state.busy=false;render();return;}
      const bs=await apiClient.branchNames(a.token);if(seq!==state.seq)return;
      state.branches=a.role==="manager"?bs.filter(b=>a.branches.includes(b.slug)):bs;
      if(!state.from){const t=today(now());state.to=t;state.from=t.slice(0,7)+"-01";}
      if(a.role==="manager"&&!state.branch)state.branch=state.branches[0]?.slug||"";
      state.busy=false;render();
      if(state.from&&state.to)await runReport();
    }catch{if(seq!==state.seq)return;state.busy=false;state.error=true;render();}
  }
  async function runReport(){
    if(!state.access||!state.access.token)return;
    const seq=++state.seq;state.busy=true;state.error=false;render();
    try{state.data=await apiClient.report(state.access.token,{bucket:state.bucket,from:state.from,to:state.to,branch:state.branch});if(seq!==state.seq)return;state.busy=false;render();}
    catch{if(seq!==state.seq)return;state.busy=false;state.error=true;render();}
  }
  host.addEventListener("submit",e=>{
    if(!e.target||e.target.id!=="salesReportForm")return;e.preventDefault();
    const d=new FormData(e.target);state.bucket=d.get("bucket");state.from=d.get("from");state.to=d.get("to");state.branch=d.get("branch")||"";
    if(state.from&&state.to&&state.from<=state.to)runReport();else{state.error=true;render();}
  });
  document.addEventListener("azal:auth",()=>{state.access=null;state.data=null;state.seq++;load();});
  root.addEventListener("storage",e=>{if(e.key==="azal-auth-v1"||e.key===null){state.access=null;state.data=null;state.seq++;load();}});
  new MutationObserver(()=>{if(state.access)render();}).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  if(apiClient.enabled)load();
})(typeof window!=="undefined"?window:globalThis);
