/* T-27: adjudicated Admin portal shell. This layer reorganizes existing server-authorized DOM; it does not grant access. */
(function (root) {
  "use strict";
  const rootEl = document.getElementById("adminRoot");
  if (!rootEl) return;
  const text = (el) => (el && el.textContent || "").trim();
  const make = (tag, cls, value) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value != null) n.textContent = value;
    return n;
  };
  const locale = () => document.documentElement.lang === "fr" ? "fr" : document.documentElement.lang === "ar" ? "ar" : "en";
  const words = {
    en: { home:"Home",orders:"Orders",customers:"Customers",reports:"Reports",more:"More",daily:"Daily",monthly:"Monthly",yearly:"Yearly",run:"Run report",from:"From",to:"To",all:"All",active:"Active",scheduled:"Scheduled",history:"History",open:"Open",back:"Back to customers",collected:"Collected sales",count:"Orders",collectedCount:"Collected orders",subtotal:"Subtotal",discount:"Discount",tax:"HST",noReport:"Choose a period and run the report.",reportError:"The report could not be loaded. Try again.",team:"Team & access",accounts:"Orders accounts",audit:"Access history" },
    fr: { home:"Accueil",orders:"Commandes",customers:"Clients",reports:"Rapports",more:"Plus",daily:"Quotidien",monthly:"Mensuel",yearly:"Annuel",run:"Afficher",from:"Du",to:"Au",all:"Toutes",active:"Actives",scheduled:"Planifiées",history:"Historique",open:"Ouvrir",back:"Retour aux clients",collected:"Ventes encaissées",count:"Commandes",collectedCount:"Commandes encaissées",subtotal:"Sous-total",discount:"Rabais",tax:"TVH",noReport:"Choisissez une période et affichez le rapport.",reportError:"Impossible de charger le rapport. Réessayez.",team:"Équipe et accès",accounts:"Comptes de commandes",audit:"Historique d’accès" },
    ar: { home:"الرئيسية",orders:"الطلبات",customers:"العملاء",reports:"التقارير",more:"المزيد",daily:"يومي",monthly:"شهري",yearly:"سنوي",run:"عرض التقرير",from:"من",to:"إلى",all:"الكل",active:"النشطة",scheduled:"المجدولة",history:"السجل",open:"فتح",back:"العودة إلى العملاء",collected:"المبيعات المحصّلة",count:"الطلبات",collectedCount:"الطلبات المستلمة",subtotal:"المجموع الفرعي",discount:"الخصم",tax:"ضريبة HST",noReport:"اختر الفترة ثم اعرض التقرير.",reportError:"تعذّر تحميل التقرير. حاول مرة أخرى.",team:"الفريق والصلاحيات",accounts:"حسابات الطلبات",audit:"سجل الوصول" }
  };
  const L = (key) => words[locale()][key] || words.en[key] || key;
  const cad = (cents) => new Intl.NumberFormat(locale()==="fr"?"fr-CA":locale()==="ar"?"ar-CA-u-nu-latn":"en-CA",{style:"currency",currency:"CAD"}).format(Number(cents||0)/100);
  const torontoDate = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  function reportPanel(role, branches) {
    const panel = make("section","admin-panel admin-report-screen");
    panel.append(make("h2",null,L("reports")));
    const tabs = make("div","admin-report-tabs");
    const period = document.createElement("input"); period.type="hidden"; period.value="day";
    for (const p of ["day","month","year"]) {
      const b=make("button","button admin-detail-button",L(p==="day"?"daily":p==="month"?"monthly":"yearly")); b.type="button"; b.dataset.period=p;
      if(p==="day") b.setAttribute("aria-pressed","true");
      b.addEventListener("click",()=>{period.value=p;for(const x of tabs.querySelectorAll("button"))x.setAttribute("aria-pressed",String(x===b));});
      tabs.append(b);
    }
    const form=make("form","admin-report-form");
    const today=torontoDate();
    const from=document.createElement("input");from.type="date";from.required=true;from.value=today;
    const to=document.createElement("input");to.type="date";to.required=true;to.value=today;
    const fromLabel=make("label","admin-report-field",L("from"));fromLabel.append(from);
    const toLabel=make("label","admin-report-field",L("to"));toLabel.append(to);
    const run=make("button","button button-gold",L("run"));run.type="submit";
    const status=make("p","admin-note",L("noReport"));status.setAttribute("role","status");
    const results=make("div","admin-report-results");
    form.append(fromLabel,toLabel,run);
    form.addEventListener("submit",async e=>{
      e.preventDefault();run.disabled=true;status.textContent="…";results.replaceChildren();
      try {
        const api=root.AZALAdminAPI;
        if(!api||typeof api.salesReport!=="function")throw new Error("report_api_unavailable");
        const branch=role==="manager"?(branches&&branches[0]||null):null;
        const data=await api.salesReport({period:period.value,startDate:from.value,endDate:to.value,branchSlug:branch});
        const totals=data&&data.totals||{};
        const grid=make("dl","admin-report-kpis");
        for(const [key,label] of [["order_count",L("count")],["collected_count",L("collectedCount")],["collected_cents",L("collected")]]) {
          const item=make("div","admin-kpi");const value=totals[key];
          item.append(make("dt",null,label),make("dd",null,value==null?"—":key.endsWith("_cents")?cad(value):String(value)));grid.append(item);
        }
        if(Object.prototype.hasOwnProperty.call(totals,"subtotal_cents")) {
          for(const [key,label] of [["subtotal_cents",L("subtotal")],["discount_cents",L("discount")],["tax_cents",L("tax")]]) {
            const item=make("div","admin-kpi");item.append(make("dt",null,label),make("dd",null,cad(totals[key])));grid.append(item);
          }
        }
        results.append(grid);
        for(const row of data.rows||[]) {
          const card=make("article","admin-record");
          card.append(make("strong",null,String(row.period_start||"")+" · "+(row.branch_slug||L("all"))),
            make("span","admin-record-meta",L("count")+": "+row.order_count+" · "+L("collectedCount")+": "+row.collected_count),
            make("span","admin-record-meta",L("collected")+": "+cad(row.collected_cents)));
          if(Object.prototype.hasOwnProperty.call(row,"subtotal_cents"))card.append(make("span","admin-record-meta",L("subtotal")+": "+cad(row.subtotal_cents)+" · "+L("discount")+": "+cad(row.discount_cents)+" · "+L("tax")+": "+cad(row.tax_cents)));
          results.append(card);
        }
        status.textContent="";
      } catch { status.textContent=L("reportError"); }
      finally {run.disabled=false;}
    });
    panel.append(tabs,form,status,results);
    return panel;
  }
  function build() {
    if (rootEl.querySelector(".admin-shell-layout")) return;
    const title=rootEl.querySelector(":scope > .admin-title");
    const who=rootEl.querySelector(":scope > .admin-who-bar");
    if(!title||!who)return;
    const manager=rootEl.querySelector(":scope > #managerOperations");
    const overview=rootEl.querySelector(":scope > .admin-panel[aria-labelledby='admOverview']");
    const actions=rootEl.querySelector(":scope > .admin-actions");
    const workspace=rootEl.querySelector(":scope > .admin-workspace");
    if(!manager&&!overview&&!workspace)return;
    const role=manager?"manager":"admin";
    const shell=make("div","admin-shell-layout");
    const nav=make("nav","admin-shell-nav");nav.setAttribute("aria-label",locale()==="fr"?"Navigation de gestion":locale()==="ar"?"تنقّل الإدارة":"Management navigation");
    const content=make("div","admin-shell-content");
    const destinations=role==="admin"?["home","orders","customers","reports","more"]:["orders","reports"];
    const screens={};
    for(const id of destinations){
      const screen=make("section","admin-shell-screen");screen.id="adminScreen-"+id;screen.dataset.screen=id;
      screen.setAttribute("aria-label",L(id));screens[id]=screen;
      const link=make("a","admin-shell-link",L(id));link.href="#"+id;link.dataset.destination=id;
      nav.append(link);content.append(screen);
    }
    if(role==="admin"){
      if(overview)screens.home.append(overview);
      if(actions)screens.home.append(actions);
      if(workspace){
        const customer=workspace.querySelector(":scope > .admin-panel");
        const order=[...workspace.querySelectorAll(":scope > .admin-panel")].find(x=>/ordersTitle/.test(x.textContent)||x.querySelector("form.admin-filter select.admin-status"));
        const detail=workspace.querySelector(":scope > .admin-order-detail");
        if(customer){customer.dataset.adminScreenPart="customers";screens.customers.append(customer);}
        if(order){order.dataset.adminScreenPart="orders";screens.orders.append(order);}
        if(detail)screens.orders.append(detail);
        screens.more.append(workspace);
      }
      screens.reports.append(reportPanel(role,[]));
    } else {
      screens.orders.append(manager);
      screens.reports.append(reportPanel(role,root.AZALAdminAccess&&root.AZALAdminAccess.branches||[]));
    }
    const top=make("div","admin-shell-heading");top.append(title);
    shell.append(nav,content);
    rootEl.replaceChildren(top,who,shell);
    function activate(id, updateUrl) {
      if(!screens[id])id=destinations[0];
      for(const [key,screen] of Object.entries(screens))screen.hidden=key!==id;
      for(const a of nav.querySelectorAll("a")) {
        if(a.dataset.destination===id){a.setAttribute("aria-current","page");}
        else a.removeAttribute("aria-current");
      }
      if(updateUrl&&location.hash!=="#"+id)history.pushState(null,"","#"+id);
      const h=screens[id].querySelector("h2")||title;
      if(h){if(!h.hasAttribute("tabindex"))h.setAttribute("tabindex","-1");h.focus({preventScroll:true});}
    }
    nav.addEventListener("click",e=>{const a=e.target.closest("a[data-destination]");if(!a)return;e.preventDefault();activate(a.dataset.destination,true);});
    root.addEventListener("hashchange",()=>activate(location.hash.slice(1),false));
    root.addEventListener("popstate",()=>activate(location.hash.slice(1),false));
    const initial=location.hash.slice(1).split("/")[0];
    activate(destinations.includes(initial)?initial:destinations[0],false);
    rootEl.dataset.adminShell="1";
  }
  function enhance() {
    const shell=rootEl.querySelector(".admin-shell-layout");
    if(!shell)return;
    const workspace=rootEl.querySelector(".admin-workspace");
    const more=rootEl.querySelector("#adminScreen-more");
    if(workspace&&more&&workspace.parentElement!==more)more.append(workspace);
    const customers=rootEl.querySelector("#adminScreen-customers");
    const directory=customers&&customers.querySelector(".admin-panel");
    if(directory&&!customers.querySelector(".admin-customer-detail")){
      const detail=make("section","admin-panel admin-customer-detail");detail.hidden=true;
      let detailCard=null, restoreParent=null, restoreNext=null;
      const back=make("button","button admin-detail-button",L("back"));back.type="button";
      back.addEventListener("click",()=>{
        if(detailCard&&restoreParent)restoreParent.insertBefore(detailCard,restoreNext);
        detailCard=null;restoreParent=null;restoreNext=null;
        detail.replaceChildren(back);detail.hidden=true;directory.hidden=false;history.pushState(null,"","#customers");
      });
      detail.append(back);customers.append(detail);
      const openCustomer=(card)=>{
        if(card.querySelector(".admin-customer-open"))return;
        const b=make("button","button admin-detail-button admin-customer-open",L("open"));b.type="button";
        b.addEventListener("click",()=>{
          detailCard=card;restoreParent=card.parentElement;restoreNext=card.nextSibling;
          directory.hidden=true;detail.hidden=false;detail.append(card);
          history.pushState(null,"","#customers/"+encodeURIComponent(card.dataset.userId));
        });
        card.append(b);
      };
      for(const card of directory.querySelectorAll(".admin-record[data-user-id]"))openCustomer(card);
      const deepId=decodeURIComponent(location.hash.slice("#customers/".length));
      if(location.hash.startsWith("#customers/")){
        const card=[...directory.querySelectorAll(".admin-record[data-user-id]")].find(x=>x.dataset.userId===deepId);
        if(card){const button=card.querySelector(".admin-customer-open");if(button)button.click();}
      }
    }
    const orders=rootEl.querySelector("#adminScreen-orders");
    const orderPanel=orders&&orders.querySelector('[data-admin-screen-part="orders"]');
    if(orderPanel&&!orderPanel.querySelector(".admin-order-tabs")){
      const form=orderPanel.querySelector("form.admin-filter");
      const tabs=make("div","admin-report-tabs admin-order-tabs");
      for(const [id,label] of [["active",L("active")],["scheduled",L("scheduled")],["history",L("history")]]){
        const b=make("button","button admin-detail-button",label);b.type="button";b.dataset.orderView=id;
        b.addEventListener("click",()=>{
          for(const x of tabs.querySelectorAll("button"))x.setAttribute("aria-pressed",String(x===b));
          const cards=[...orderPanel.querySelectorAll(".admin-record")].filter(x=>x.dataset.orderCard==="1");
          for(const card of cards){
            const status=card.dataset.status,scheduled=card.dataset.scheduled==="true";
            card.hidden=id==="active"?(scheduled||["handed_over","cancelled"].includes(status)):id==="scheduled"?!scheduled:!["handed_over","cancelled"].includes(status);
          }
          if(form)form.hidden=false;
        });
        tabs.append(b);
      }
      orderPanel.prepend(tabs);
      tabs.querySelector('[data-order-view="active"]').click();
    }
    const morePanel=more&&more.querySelector("#adminTeamPanel");
    if(morePanel&&!morePanel.querySelector(".admin-more-links")){
      const links=make("nav","admin-more-links");links.setAttribute("aria-label",L("more"));
      for(const [id,label] of [["adminTeamMembersTitle",L("team")],["adminOrdersAccounts",L("accounts")],["adminTeamAudit",L("audit")]]){
        const target=morePanel.querySelector("#"+id);if(!target)continue;
        const a=make("a","admin-more-link",label);a.href="#more/"+id;a.addEventListener("click",e=>{e.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"});target.setAttribute("tabindex","-1");target.focus({preventScroll:true});});links.append(a);
      }
      morePanel.prepend(links);
    }
  }
  const observer=new MutationObserver(()=>{if(!rootEl.querySelector(".admin-shell-layout"))build();enhance();});
  observer.observe(rootEl,{childList:true,subtree:true});
  build();enhance();
  new MutationObserver(()=>{if(rootEl.querySelector(".admin-shell-layout")){const id=location.hash.slice(1).split("/")[0];const a=rootEl.querySelector('.admin-shell-link[data-destination="'+id+'"]');if(a&&a.getAttribute("aria-current")!=="page")a.click();}}).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  if(typeof module!=="undefined"&&module.exports)module.exports={torontoDate,cad};
})(typeof window!=="undefined"?window:globalThis);
