/* T-27: lead-adjudicated Admin shell. Reorganizes existing server-authorized DOM; it never grants access. */
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
  const locale = () => {
    const lang = String(document.documentElement.lang || "en").toLowerCase();
    return lang.startsWith("fr") ? "fr" : lang.startsWith("ar") ? "ar" : "en";
  };
  const words = {
    en: {
      home:"Home",orders:"Orders",customers:"Customers",reports:"Reports",more:"More",
      daily:"Daily",monthly:"Monthly",yearly:"Yearly",run:"Run report",from:"From",to:"To",
      allAssigned:"All assigned branches",branch:"Branch",placed:"Placed",accepted:"Accepted",preparing:"Preparing",ready:"Ready",cancelled:"Cancelled",active:"Active",scheduled:"Scheduled",history:"History",open:"Open",
      back:"Back to customers",grossCollected:"Gross collected",refunds:"Refunds",netCollected:"Net collected",
      count:"Orders",collectedCount:"Handed over",subtotal:"Subtotal",discount:"Discount",tax:"HST",
      noReport:"Choose a period and run the report.",reportError:"The report could not be loaded. Try again.",
      noRows:"No orders in this date range.",team:"Team & access",accounts:"Orders accounts",audit:"Access history",
      profile:"Account",orderNotFound:"That order is not in the loaded order list. Search by its code."
    },
    fr: {
      home:"Accueil",orders:"Commandes",customers:"Clients",reports:"Rapports",more:"Plus",
      daily:"Quotidien",monthly:"Mensuel",yearly:"Annuel",run:"Afficher le rapport",from:"Du",to:"Au",
      allAssigned:"Toutes les succursales attribuées",branch:"Succursale",placed:"Passées",accepted:"Acceptées",preparing:"En préparation",ready:"Prêtes",cancelled:"Annulées",active:"Actives",scheduled:"Planifiées",history:"Historique",open:"Ouvrir",
      back:"Retour aux clients",grossCollected:"Brut encaissé",refunds:"Remboursements",netCollected:"Net encaissé",
      count:"Commandes",collectedCount:"Remises",subtotal:"Sous-total",discount:"Rabais",tax:"TVH",
      noReport:"Choisissez une période et affichez le rapport.",reportError:"Impossible de charger le rapport. Réessayez.",
      noRows:"Aucune commande dans cette période.",team:"Équipe et accès",accounts:"Comptes de commandes",audit:"Historique d’accès",
      profile:"Compte",orderNotFound:"Cette commande ne figure pas dans la liste chargée. Recherchez son code."
    },
    ar: {
      home:"الرئيسية",orders:"الطلبات",customers:"العملاء",reports:"التقارير",more:"المزيد",
      daily:"يومي",monthly:"شهري",yearly:"سنوي",run:"عرض التقرير",from:"من",to:"إلى",
      allAssigned:"كل الفروع المعيّنة",branch:"الفرع",placed:"جديدة",accepted:"مقبولة",preparing:"قيد التحضير",ready:"جاهزة",cancelled:"ملغاة",active:"النشطة",scheduled:"المجدولة",history:"السجل",open:"فتح",
      back:"العودة إلى العملاء",grossCollected:"إجمالي المحصّل",refunds:"المبالغ المستردة",netCollected:"صافي المحصّل",
      count:"الطلبات",collectedCount:"تم تسليمها",subtotal:"المجموع الفرعي",discount:"الخصم",tax:"ضريبة HST",
      noReport:"اختر الفترة ثم اعرض التقرير.",reportError:"تعذّر تحميل التقرير. حاول مرة أخرى.",
      noRows:"لا توجد طلبات في هذه الفترة.",team:"الفريق والصلاحيات",accounts:"حسابات الطلبات",audit:"سجل الوصول",
      profile:"الحساب",orderNotFound:"الطلب غير موجود في القائمة المحمّلة. ابحث برقم الطلب."
    }
  };
  const L = (key) => words[locale()][key] || words.en[key] || key;
  const cad = (cents) => new Intl.NumberFormat(locale()==="fr"?"fr-CA":locale()==="ar"?"ar-CA-u-nu-latn":"en-CA",{style:"currency",currency:"CAD"}).format(Number(cents||0)/100);
  const torontoDate = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  function dateRangeFor(period, today) {
    const d = today || torontoDate();
    const parts = d.split("-").map(Number);
    const y = parts[0], m = parts[1];
    if (period === "year") return { from: y + "-01-01", to: y + "-12-31" };
    if (period === "month") return { from: y + "-" + String(m).padStart(2,"0") + "-01", to: new Date(Date.UTC(y,m,0)).toISOString().slice(0,10) };
    return { from: d, to: d };
  }
  function reportPanel(role, branches) {
    const admin = role === "admin";
    const panel = make("section","admin-panel admin-report-screen");
    const heading = make("h2",null,L("reports")); heading.dataset.shellLabel="reports"; panel.append(heading);
    const tabs = make("div","admin-report-tabs");
    const period = document.createElement("input"); period.type="hidden"; period.value="day";
    const form = make("form","admin-report-form");
    const today = torontoDate(), initial = dateRangeFor("day",today);
    const from = document.createElement("input"); from.type="date"; from.required=true; from.value=initial.from;
    const to = document.createElement("input"); to.type="date"; to.required=true; to.value=initial.to;
    const fromLabel = make("label","admin-report-field"); const fromText=make("span",null,L("from"));fromText.dataset.shellLabel="from";fromLabel.append(fromText,from);
    const toLabel = make("label","admin-report-field"); const toText=make("span",null,L("to"));toText.dataset.shellLabel="to";toLabel.append(toText,to);
    let branchSelect = null;
    if (!admin && Array.isArray(branches) && branches.length > 1) {
      const branchLabel=make("label","admin-report-field");
      const branchText=make("span",null,L("branch"));branchText.dataset.shellLabel="branch";
      branchSelect=document.createElement("select");branchSelect.setAttribute("aria-label",L("branch"));
      const all=make("option",null,L("allAssigned"));all.value="";branchSelect.append(all);
      for(const slug of branches){const option=make("option",null,slug);option.value=slug;branchSelect.append(option);}
      branchLabel.append(branchText,branchSelect);form.append(branchLabel);
    }
    const run = make("button","button button-gold",L("run")); run.type="submit";run.dataset.shellLabel="run";
    const status = make("p","admin-note",L("noReport"));status.setAttribute("role","status");status.dataset.shellLabel="noReport";
    const results = make("div","admin-report-results");results.hidden=true;
    const clearResults=()=>{results.replaceChildren();results.hidden=true;status.textContent=L("noReport");status.dataset.shellLabel="noReport";};
    const setPeriod = (p) => {
      period.value=p;
      for(const x of tabs.querySelectorAll("button"))x.setAttribute("aria-pressed",String(x.dataset.period===p));
      const range=dateRangeFor(p,torontoDate());
      from.value=range.from;to.value=range.to;clearResults();
    };
    for (const p of ["day","month","year"]) {
      const key=p==="day"?"daily":p==="month"?"monthly":"yearly";
      const b=make("button","button admin-detail-button",L(key));b.type="button";b.dataset.period=p;b.dataset.shellLabel=key;
      b.setAttribute("aria-pressed",String(p==="day"));b.addEventListener("click",()=>setPeriod(p));tabs.append(b);
    }
    form.append(fromLabel,toLabel,run);
    form.addEventListener("submit",async e=>{
      e.preventDefault();
      if(!from.value||!to.value||from.value>to.value){status.textContent=L("reportError");status.dataset.shellLabel="reportError";results.replaceChildren();results.hidden=true;return;}
      run.disabled=true;status.textContent="…";status.removeAttribute("data-shell-label");results.replaceChildren();results.hidden=true;
      try {
        const api=root.AZALAdminAPI;
        if(!api||typeof api.salesReport!=="function")throw new Error("report_api_unavailable");
        const branch=branchSelect&&branchSelect.value?branchSelect.value:null;
        const data=await api.salesReport({period:period.value,startDate:from.value,endDate:to.value,branchSlug:branch});
        const totals=data&&data.totals||{};
        const metrics=[["order_count",L("count"),false],["placed_count",L("placed"),false],["accepted_count",L("accepted"),false],["preparing_count",L("preparing"),false],["ready_count",L("ready"),false],["collected_count",L("collectedCount"),false],["cancelled_count",L("cancelled"),false]];
        if(admin)metrics.push(["collected_cents",L("grossCollected"),true],["refunds_cents",L("refunds"),true],["net_collected_cents",L("netCollected"),true],
          ["subtotal_cents",L("subtotal"),true],["discount_cents",L("discount"),true],["tax_cents",L("tax"),true]);
        else metrics.push(["net_collected_cents",L("netCollected"),true]);
        const grid=make("dl","admin-report-kpis");
        for(const [key,label,isMoney] of metrics){
          const item=make("div","admin-kpi"),value=totals[key];
          item.append(make("dt",null,label),make("dd",null,value==null?"—":isMoney?cad(value):String(value)));grid.append(item);
        }
        results.append(grid);
        const rows=data&&Array.isArray(data.rows)?data.rows:[];
        if(!rows.length)results.append(make("p","admin-note",L("noRows")));
        for(const row of rows){
          const card=make("article","admin-record");
          card.append(make("strong",null,String(row.period_start||"")+" · "+(row.branch_slug||L("allAssigned"))),
            make("span","admin-record-meta",L("count")+": "+row.order_count+" · "+L("placed")+": "+row.placed_count+" · "+L("accepted")+": "+row.accepted_count),make("span","admin-record-meta",L("preparing")+": "+row.preparing_count+" · "+L("ready")+": "+row.ready_count+" · "+L("collectedCount")+": "+row.collected_count+" · "+L("cancelled")+": "+row.cancelled_count));
          if(admin){
            card.append(make("span","admin-record-meta",L("grossCollected")+": "+cad(row.collected_cents)+" · "+L("refunds")+": "+cad(row.refunds_cents)),
              make("span","admin-record-meta",L("netCollected")+": "+cad(row.net_collected_cents)));
            card.append(make("span","admin-record-meta",L("subtotal")+": "+cad(row.subtotal_cents)+" · "+L("discount")+": "+cad(row.discount_cents)+" · "+L("tax")+": "+cad(row.tax_cents)));
          } else card.append(make("span","admin-record-meta",L("netCollected")+": "+cad(row.net_collected_cents)));
          results.append(card);
        }
        results.hidden=false;status.textContent="";status.removeAttribute("data-shell-label");
      } catch { status.textContent=L("reportError");status.dataset.shellLabel="reportError"; }
      finally {run.disabled=false;}
    });
    panel.append(tabs,form,status,results);
    panel.__refreshLanguage=()=>{clearResults();if(branchSelect)branchSelect.setAttribute("aria-label",L("branch"));};
    return panel;
  }

  let routeController = null;
  function build() {
    if (rootEl.querySelector(".admin-shell-layout")) return;
    if (routeController) routeController.abort();
    routeController = new AbortController();
    const signal=routeController.signal;
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
    const nav=make("nav","admin-shell-nav");
    const content=make("div","admin-shell-content");
    const destinations=role==="admin"?["home","orders","customers","reports","more"]:["orders","reports"];
    const screens={};
    for(const id of destinations){
      const screen=make("section","admin-shell-screen");screen.id="adminScreen-"+id;screen.dataset.screen=id;
      screen.setAttribute("aria-label",L(id));screen.tabIndex=-1;screens[id]=screen;
      const link=make("a","admin-shell-link",L(id));link.href="#"+id;link.dataset.destination=id;link.dataset.shellLabel=id;
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
    const profile=make("div","admin-profile");
    const profileButton=make("button","admin-profile-trigger");
    profileButton.type="button";profileButton.setAttribute("aria-haspopup","true");profileButton.setAttribute("aria-label",L("profile"));profileButton.setAttribute("aria-expanded","false");profileButton.setAttribute("aria-controls","adminProfileMenu");
    const profileIcon=make("span","admin-profile-icon");profileIcon.setAttribute("aria-hidden","true");profileButton.append(profileIcon);
    const profileMenu=make("div","admin-profile-menu");profileMenu.id="adminProfileMenu";profileMenu.hidden=true;profileMenu.setAttribute("role","group");profileMenu.setAttribute("aria-label",L("profile"));
    profileMenu.append(who);profile.append(profileButton,profileMenu);top.append(profile);
    const closeProfile=()=>{profileMenu.hidden=true;profileButton.setAttribute("aria-expanded","false");};
    profileButton.addEventListener("click",()=>{
      const open=profileMenu.hidden;profileMenu.hidden=!open;profileButton.setAttribute("aria-expanded",String(open));
      if(open){const out=profileMenu.querySelector("button");if(out)out.focus();}
    });
    root.addEventListener("click",e=>{if(!profile.contains(e.target))closeProfile();},{signal});
    root.addEventListener("keydown",e=>{if(e.key==="Escape"&&!profileMenu.hidden){closeProfile();profileButton.focus();}},{signal});

    shell.append(nav,content);rootEl.replaceChildren(top,shell);
    function activate(id){
      if(!screens[id])id=destinations[0];
      for(const [key,screen] of Object.entries(screens))screen.hidden=key!==id;
      for(const a of nav.querySelectorAll("a")){if(a.dataset.destination===id)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");}
      const h=screens[id].querySelector("h2")||title;
      if(h){if(!h.hasAttribute("tabindex"))h.setAttribute("tabindex","-1");h.focus({preventScroll:true});}
    }
    function routeFromLocation(){
      const parts=decodeURIComponent(location.hash.slice(1)||"").split("/");
      const screenId=parts[0],sub=parts[1]||null;
      const id=destinations.includes(screenId)?screenId:destinations[0];
      activate(id);
      if(rootEl.__adminCustomerRoute)rootEl.__adminCustomerRoute(id==="customers"?sub:null,false);
      if(id==="orders"&&sub&&role==="admin"&&typeof root.AZALAdminOpenOrderByCode==="function"){
        root.AZALAdminOpenOrderByCode(sub,false).then(ok=>{
          const note=screens.orders.querySelector(".admin-order-route-status")||make("p","admin-note admin-order-route-status");
          if(!ok){note.textContent=L("orderNotFound");if(!note.parentElement)screens.orders.prepend(note);}
          else note.remove();
        });
      } else {
        if(typeof root.AZALAdminCloseOrder==="function")root.AZALAdminCloseOrder(false);
        const note=screens.orders.querySelector(".admin-order-route-status");if(note)note.remove();
      }
      if(rootEl.__adminMoreRoute)rootEl.__adminMoreRoute(id==="more"?sub:null,false);
    }
    rootEl.__adminRoute=routeFromLocation;
    nav.addEventListener("click",e=>{
      const a=e.target.closest("a[data-destination]");if(!a)return;e.preventDefault();
      history.pushState(null,"","#"+a.dataset.destination);routeFromLocation();
    });
    root.addEventListener("hashchange",routeFromLocation,{signal});
    root.addEventListener("popstate",routeFromLocation,{signal});
    routeFromLocation();
    rootEl.__adminRefresh=()=>{
      nav.setAttribute("aria-label",locale()==="fr"?"Navigation de gestion":locale()==="ar"?"تنقّل الإدارة":"Management navigation");
      for(const [id,screen] of Object.entries(screens))screen.setAttribute("aria-label",L(id));
      profileButton.setAttribute("aria-label",L("profile"));profileMenu.setAttribute("aria-label",L("profile"));
      for(const el of rootEl.querySelectorAll("[data-shell-label]"))el.textContent=L(el.dataset.shellLabel);
      const report=rootEl.querySelector(".admin-report-screen");if(report&&report.__refreshLanguage)report.__refreshLanguage();
      const moreNav=rootEl.querySelector(".admin-more-links");if(moreNav)moreNav.setAttribute("aria-label",L("more"));
    };
  }

  function enhance() {
    const shell=rootEl.querySelector(".admin-shell-layout");
    if(!shell)return;
    const workspace=rootEl.querySelector(".admin-workspace");
    const more=rootEl.querySelector("#adminScreen-more");
    if(workspace&&more&&workspace.parentElement!==more)more.append(workspace);

    const customers=rootEl.querySelector("#adminScreen-customers");
    const directory=customers&&customers.querySelector(".admin-panel");
    if(directory){
      let detail=customers.querySelector(".admin-customer-detail");
      if(!detail){
        detail=make("section","admin-panel admin-customer-detail");detail.hidden=true;
        const back=make("button","button admin-detail-button admin-customer-back",L("back"));back.type="button";back.dataset.shellLabel="back";
        detail.append(back);customers.append(detail);
      }
      const back=detail.querySelector(".admin-customer-back");
      let state={card:null,parent:null,next:null};
      const restore=()=>{
        if(state.card&&state.parent)state.parent.insertBefore(state.card,state.next&&state.next.parentNode===state.parent?state.next:null);
        state={card:null,parent:null,next:null};detail.replaceChildren(back);detail.hidden=true;directory.hidden=false;
      };
      const show=(card,push)=>{
        if(state.card&&state.card!==card)restore();
        if(!state.card)state={card,parent:card.parentElement,next:card.nextSibling};
        directory.hidden=true;detail.hidden=false;detail.append(back,card);
        if(push){history.pushState(null,"","#customers/"+encodeURIComponent(card.dataset.userId));if(rootEl.__adminRoute)rootEl.__adminRoute();}
      };
      rootEl.__adminCustomerRoute=(id,push)=>{
        if(!id){if(state.card)restore();return true;}
        const card=[...directory.querySelectorAll(".admin-record[data-user-id]")].find(x=>x.dataset.userId===id);
        if(!card)return false;show(card,Boolean(push));return true;
      };
      back.onclick=()=>{history.pushState(null,"","#customers");if(rootEl.__adminRoute)rootEl.__adminRoute();};
      for(const card of directory.querySelectorAll(".admin-record[data-user-id]")){
        if(card.querySelector(".admin-customer-open"))continue;
        const button=make("button","button admin-detail-button admin-customer-open",L("open"));button.type="button";button.dataset.shellLabel="open";
        button.addEventListener("click",()=>rootEl.__adminCustomerRoute(card.dataset.userId,true));card.append(button);
      }
    } else rootEl.__adminCustomerRoute=null;

    const orders=rootEl.querySelector("#adminScreen-orders");
    const orderPanel=orders&&orders.querySelector('[data-admin-screen-part="orders"]');
    if(orderPanel&&!orderPanel.querySelector(".admin-order-tabs")){
      const form=orderPanel.querySelector("form.admin-filter");
      const tabs=make("div","admin-report-tabs admin-order-tabs");
      for(const [id,label] of [["active","active"],["scheduled","scheduled"],["history","history"]]){
        const b=make("button","button admin-detail-button",L(label));b.type="button";b.dataset.orderView=id;b.dataset.shellLabel=label;
        b.addEventListener("click",()=>{
          for(const x of tabs.querySelectorAll("button"))x.setAttribute("aria-pressed",String(x===b));
          const cards=[...orderPanel.querySelectorAll(".admin-record[data-order-card='1']")];
          for(const card of cards){
            const status=card.dataset.status,scheduled=card.dataset.scheduled==="true";
            card.hidden=id==="active"?(scheduled||["handed_over","cancelled"].includes(status)):id==="scheduled"?!scheduled:!["handed_over","cancelled"].includes(status);
          }
          if(form)form.hidden=false;
        });
        tabs.append(b);
      }
      orderPanel.prepend(tabs);tabs.querySelector('[data-order-view="active"]').click();
    }

    const morePanel=more&&more.querySelector("#adminTeamPanel");
    if(morePanel){
      let links=morePanel.querySelector(".admin-more-links");
      if(!links){
        links=make("nav","admin-more-links");links.setAttribute("aria-label",L("more"));
        for(const [key,id,label] of [["team","adminTeamMembersTitle","team"],["accounts","adminOrdersAccounts","accounts"],["audit","adminTeamAudit","audit"]]){
          const target=morePanel.querySelector("#"+id);if(!target)continue;
          const a=make("a","admin-more-link",L(label));a.href="#more/"+key;a.dataset.shellLabel=label;links.append(a);
        }
        morePanel.prepend(links);
      }
      const targets={team:"adminTeamMembersTitle",accounts:"adminOrdersAccounts",audit:"adminTeamAudit"};
      rootEl.__adminMoreRoute=(key)=>{
        if(!key)return true;
        const id=targets[key];const target=id&&morePanel.querySelector("#"+id);
        if(!target)return false;
        target.scrollIntoView({behavior:"auto",block:"start"});target.setAttribute("tabindex","-1");target.focus({preventScroll:true});return true;
      };
    } else rootEl.__adminMoreRoute=null;
    if(rootEl.__adminRoute)rootEl.__adminRoute();
  }

  const observer=new MutationObserver(()=>{if(!rootEl.querySelector(".admin-shell-layout"))build();enhance();});
  observer.observe(rootEl,{childList:true,subtree:true});
  build();enhance();
  new MutationObserver(()=>{if(rootEl.__adminRefresh)rootEl.__adminRefresh();if(rootEl.__adminRoute)rootEl.__adminRoute();})
    .observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  if(typeof module!=="undefined"&&module.exports)module.exports={torontoDate,cad,dateRangeFor};
})(typeof window!=="undefined"?window:globalThis);
