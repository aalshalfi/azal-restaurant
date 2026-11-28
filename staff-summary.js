(function(root){
  "use strict";
  const COPY={
    en:{title:"Today's summary",collected:"Collected sales",placed:"Received",accepted:"Accepted",preparing:"Preparing",ready:"Ready",handed:"Handed over",cancelled:"Cancelled",copy:"Copy summary",copied:"Summary copied. Share it manually.",error:"Today's summary is unavailable right now."},
    fr:{title:"Résumé du jour",collected:"Ventes encaissées",placed:"Reçues",accepted:"Acceptées",preparing:"En préparation",ready:"Prêtes",handed:"Remises",cancelled:"Annulées",copy:"Copier le résumé",copied:"Résumé copié. Partagez-le manuellement.",error:"Le résumé du jour est momentanément indisponible."},
    ar:{title:"ملخص اليوم",collected:"المبيعات المحصّلة",placed:"مستلمة",accepted:"مقبولة",preparing:"قيد التحضير",ready:"جاهزة",handed:"تم تسليمها",cancelled:"ملغاة",copy:"نسخ الملخص",copied:"تم نسخ الملخص. أرسله يدوياً.",error:"ملخص اليوم غير متاح حالياً."}
  };
  const host=document.getElementById("staffSummaryRoot");if(!host)return;
  const auth=root.AZALAuth,config=root.AZAL_SUPABASE||{},base=String(config.url||"").replace(/\/+$/,""),fetchFn=root.fetch&&root.fetch.bind(root);
  const lang=()=>["fr","ar"].includes(document.documentElement.lang)?document.documentElement.lang:"en",L=k=>COPY[lang()][k]||COPY.en[k]||k;
  const money=c=>{const s=new Intl.NumberFormat(({en:"en-CA",fr:"fr-CA",ar:"ar-CA-u-nu-latn"})[lang()],{style:"currency",currency:"CAD"}).format(Number(c||0)/100);return lang()==="ar"?"\u2066"+s+"\u2069":s;};
  let branches=[],data=null,error=false,seq=0,token=null,branch="",flash="",timer=null;
  async function call(path,body){const r=await fetchFn(base+path,{method:"POST",headers:{apikey:config.anonKey,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body||{})});const j=await r.json().catch(()=>null);if(!r.ok)throw new Error("summary_unavailable");return j;}
  function render(){
    if(!token){host.replaceChildren();return;}
    if(error){host.innerHTML='<section class="staff-summary"><h2>'+L("title")+'</h2><p role="status">'+L("error")+'</p></section>';return;}
    if(!data){host.innerHTML='<section class="staff-summary"><h2>'+L("title")+'</h2><p class="staff-note">…</p></section>';return;}
    const counts=[["placed",data.placed_count],["accepted",data.accepted_count],["preparing",data.preparing_count],["ready",data.ready_count],["handed",data.handed_over_count],["cancelled",data.cancelled_count]];
    host.innerHTML='<section class="staff-summary" aria-labelledby="staffSummaryTitle"><div class="staff-summary-head"><h2 id="staffSummaryTitle">'+L("title")+'</h2><span>'+String(data.date||"")+'</span></div><p class="staff-summary-total"><span>'+L("collected")+'</span><strong>'+money(data.collected_cents)+'</strong></p><dl class="staff-summary-counts">'+counts.map(([k,v])=>'<div><dt>'+L(k)+'</dt><dd>'+Number(v||0)+'</dd></div>').join("")+'</dl><div class="staff-summary-actions"><button type="button" class="button staff-summary-copy" id="staffSummaryCopy">'+L("copy")+'</button><span role="status">'+flash+'</span></div></section>';
  }
  async function refresh(){
    const my=++seq;error=false;data=null;render();
    try{
      const s=auth&&await auth.session();if(my!==seq)return;token=s&&s.access_token;if(!token){render();return;}
      const isAdmin=await call("/rest/v1/rpc/azal_is_admin",{});if(my!==seq)return;if(isAdmin===true){token=null;render();return;}
      branches=await call("/rest/v1/rpc/azal_staff_my_branches",{});if(my!==seq)return;
      const chosen=document.getElementById("staffBranch")?.value;
      branch=branches.includes(chosen)?chosen:(branches[0]||"");
      if(!branch){token=null;render();return;}
      data=await call("/rest/v1/rpc/azal_staff_today_summary",{p_branch_slug:branch});if(my!==seq)return;
    }catch{if(my!==seq)return;error=true;}
    render();
  }
  host.addEventListener("click",async e=>{
    if(!e.target||e.target.id!=="staffSummaryCopy"||!data)return;
    const text=[L("title")+" — "+data.date,L("collected")+": "+money(data.collected_cents),...[[ "placed",data.placed_count],["accepted",data.accepted_count],["preparing",data.preparing_count],["ready",data.ready_count],["handed",data.handed_over_count],["cancelled",data.cancelled_count]].map(([k,v])=>L(k)+": "+Number(v||0))].join("\n");
    try{await root.navigator.clipboard.writeText(text);flash=L("copied");}catch{flash="";}render();
  });
  document.getElementById("staffRoot")?.addEventListener("change",e=>{if(e.target&&e.target.id==="staffBranch")refresh();});
  document.addEventListener("azal:auth",refresh);
  root.addEventListener("storage",e=>{if(e.key==="azal-auth-v1"||e.key===null)refresh();});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  if(fetchFn&&config.url&&config.anonKey){refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},60000);}
})(typeof window!=="undefined"?window:globalThis);
