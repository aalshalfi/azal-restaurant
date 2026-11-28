/* T-14 Team & Access. All mutations cross the Admin-checked Edge Function/RPC boundary.
   A6: pending named-user invites are in-portal only; no email is sent. */
(function (root) {
  "use strict";
  const cfg = root.AZAL_SUPABASE || {};
  const auth = root.AZALAuth;
  const base = cfg.url ? String(cfg.url).replace(/\/+$/, "") : "";
  const S = {
    en: {
      team:"Team & access", add:"Add team member", edit:"Edit access", name:"Full name", email:"Email", role:"Role", admin:"Admin", manager:"Manager", staff:"Staff",
      branches:"Branch access", save:"Save access", cancel:"Cancel", pending:"Pending account", revokeInvite:"Revoke invitation", pendingNote:"No email was sent. Access will attach after this person creates and verifies an account through the existing sign-up flow.",
      members:"Team members", lastSeen:"Last sign-in", neverSignedIn:"No sign-in recorded", noMembers:"No named team members yet.", remove:"Remove access", reason:"Reason (required)", confirm:"Confirm removal",
      orders:"Branch Orders accounts", accessHistory:"Recent access history", teamSearch:"Search name or email", teamRole:"Role", teamBranch:"Branch", teamStatus:"Status", teamAll:"All", teamActive:"Active team", teamPending:"Pending invitations", auditUnavailable:"Access history is temporarily unavailable.", provision:"Create branch Orders account", reset:"Reset password", password:"New password (16+ characters)", provisionAccount:"Create account",
      assigned:"Access saved.", removed:"Access revoked.", created:"Branch Orders account created.", resetDone:"Branch password reset.", error:"The action could not be completed. Refresh and check the current state before retrying.",
      anonymize:"Anonymize & deactivate customer", anonymizeNote:"This scrubs identifying details, disables sign-in and retires the member number. Financial/order history is retained without customer contact details.",
      confirmAnonymize:"Confirm anonymization", anonymized:"Customer anonymized and deactivated.", managerOrders:"Branch operations", noOrders:"No branch orders to display.", status:"Status", time:"Placed", pickup:"Pickup", items:"Items",
      noBranch:"No branch assigned. Ask the Admin to assign one.", passwordHint:"The password is never displayed again after saving.", emailGate:"Email sending is disabled. No invitation or notification email is sent."
    },
    fr: {
      team:"Équipe et accès", add:"Ajouter un membre", edit:"Modifier l’accès", name:"Nom complet", email:"Courriel", role:"Rôle", admin:"Admin", manager:"Gestionnaire", staff:"Personnel",
      branches:"Accès aux succursales", save:"Enregistrer l’accès", cancel:"Annuler", pending:"Compte en attente", revokeInvite:"Révoquer l’invitation", pendingNote:"Aucun courriel n’a été envoyé. L’accès sera attribué lorsque la personne aura créé et vérifié un compte avec le processus d’inscription existant.",
      members:"Membres de l’équipe", lastSeen:"Dernière connexion", neverSignedIn:"Aucune connexion enregistrée", noMembers:"Aucun membre nommé pour le moment.", remove:"Révoquer l’accès", reason:"Motif (obligatoire)", confirm:"Confirmer la révocation",
      orders:"Comptes Commandes par succursale", accessHistory:"Historique récent des accès", teamSearch:"Rechercher nom ou courriel", teamRole:"Rôle", teamBranch:"Succursale", teamStatus:"État", teamAll:"Tous", teamActive:"Équipe active", teamPending:"Invitations en attente", auditUnavailable:"L’historique des accès est temporairement indisponible.", provision:"Créer un compte Commandes", reset:"Réinitialiser le mot de passe", password:"Nouveau mot de passe (16 caractères ou plus)", provisionAccount:"Créer le compte",
      assigned:"Accès enregistré.", removed:"Accès révoqué.", created:"Compte Commandes créé.", resetDone:"Mot de passe de succursale réinitialisé.", error:"L’action n’a pas abouti. Actualisez et vérifiez l’état avant de réessayer.",
      anonymize:"Anonymiser et désactiver le client", anonymizeNote:"Les renseignements identifiants sont effacés, la connexion est désactivée et le numéro de membre est retiré. L’historique financier et des commandes est conservé sans coordonnées client.",
      confirmAnonymize:"Confirmer l’anonymisation", anonymized:"Client anonymisé et désactivé.", managerOrders:"Opérations de la succursale", noOrders:"Aucune commande de succursale à afficher.", status:"État", time:"Créée", pickup:"Ramassage", items:"Articles",
      noBranch:"Aucune succursale attribuée. Demandez à l’Admin de vous en attribuer une.", passwordHint:"Le mot de passe ne sera plus affiché après l’enregistrement.", emailGate:"L’envoi de courriels est désactivé. Aucun courriel d’invitation ou de notification n’est envoyé."
    },
    ar: {
      team:"الفريق والصلاحيات", add:"إضافة عضو للفريق", edit:"تعديل الصلاحية", name:"الاسم الكامل", email:"البريد الإلكتروني", role:"الدور", admin:"مدير النظام", manager:"مدير فرع", staff:"موظف",
      branches:"الفروع المصرّح بها", save:"حفظ الصلاحية", cancel:"إلغاء", pending:"حساب بانتظار التفعيل", revokeInvite:"إلغاء الدعوة", pendingNote:"لم يُرسل أي بريد. ستُربط الصلاحية بعد أن ينشئ الشخص حساباً ويتحقق من بريده عبر مسار التسجيل الحالي.",
      members:"أعضاء الفريق", lastSeen:"آخر تسجيل دخول", neverSignedIn:"لا يوجد تسجيل دخول مسجّل", noMembers:"لا يوجد أعضاء فريق مسجلون بعد.", remove:"إلغاء الصلاحية", reason:"السبب (مطلوب)", confirm:"تأكيد الإلغاء",
      orders:"حسابات الطلبات للفروع", accessHistory:"سجل الصلاحيات الأخير", teamSearch:"ابحث بالاسم أو البريد", teamRole:"الدور", teamBranch:"الفرع", teamStatus:"الحالة", teamAll:"الكل", teamActive:"الفريق النشط", teamPending:"دعوات معلّقة", auditUnavailable:"سجل الصلاحيات غير متاح مؤقتاً.", provision:"إنشاء حساب طلبات للفرع", reset:"إعادة تعيين كلمة المرور", password:"كلمة مرور جديدة (16 حرفاً فأكثر)", provisionAccount:"إنشاء الحساب",
      assigned:"تم حفظ الصلاحية.", removed:"تم إلغاء الصلاحية.", created:"تم إنشاء حساب الطلبات.", resetDone:"تم تغيير كلمة مرور الفرع.", error:"تعذّر إتمام الإجراء. حدّث الصفحة وتحقق من الحالة قبل إعادة المحاولة.",
      anonymize:"إخفاء هوية العميل وتعطيل حسابه", anonymizeNote:"سيتم مسح بيانات التعريف وتعطيل الدخول وإحالة رقم العضوية للتقاعد. سيبقى السجل المالي وسجل الطلبات دون بيانات تواصل شخصية.",
      confirmAnonymize:"تأكيد إخفاء الهوية", anonymized:"تم إخفاء هوية العميل وتعطيل حسابه.", managerOrders:"عمليات الفرع", noOrders:"لا توجد طلبات للفرع لعرضها.", status:"الحالة", time:"وقت الطلب", pickup:"موعد الاستلام", items:"الأصناف",
      noBranch:"لا يوجد فرع معيّن لهذا الحساب. اطلب من مدير النظام تعيين فرع.", passwordHint:"لن تظهر كلمة المرور مرة أخرى بعد الحفظ.", emailGate:"إرسال البريد معطّل. لا تُرسل رسائل دعوة أو إشعارات."
    }
  };
  const lang = () => ["en","fr","ar"].includes(document.documentElement.lang) ? document.documentElement.lang : "en";
  const L = (k) => S[lang()][k] || S.en[k];
  const el = (tag, cls, value) => { const n=document.createElement(tag); if(cls)n.className=cls; if(value!=null)n.textContent=String(value); return n; };
  const label = (text, control) => { const l=el("label","admin-team-label",text); l.append(control); return l; };
  let token = "", role = "none", branches = [], lastRoot = null, busy = false, mountBusy = false, mountAgain = false;

  async function session() {
    const s = auth && await auth.session();
    if (!s || !s.access_token) throw new Error("signed_out");
    token = s.access_token;
    return s;
  }
  async function request(path, body, method="POST") {
    await session();
    const res = await root.fetch(base + path, {
      method, headers: { apikey:cfg.anonKey, Authorization:"Bearer "+token, "Content-Type":"application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(()=>null);
    if (!res.ok) throw new Error(data && data.error || data && data.message || "request_failed");
    return data;
  }
  async function edge(action, payload) {
    return request("/functions/v1/admin-team-access", Object.assign({action},payload||{}));
  }
  async function detectRole() {
    const s=await session();
    const [a,r,b]=await Promise.all([
      request("/rest/v1/rpc/azal_is_admin",{}),
      request("/rest/v1/user_roles?select=role&user_id=eq."+encodeURIComponent(s.user.id),undefined,"GET"),
      request("/rest/v1/staff_branch_access?select=branch_slug&user_id=eq."+encodeURIComponent(s.user.id),undefined,"GET")
    ]);
    role=a===true?"admin":(r||[]).some(x=>x.role==="manager")?"manager":(r||[]).some(x=>x.role==="staff")?"staff":"customer";
    branches=(b||[]).map(x=>x.branch_slug);
    return role;
  }
  function status(node, text, bad=false) {
    node.textContent=text; node.classList.toggle("member-history-error",bad); node.setAttribute("role","status");
  }
  function branchChecks(list, selected=[]) {
    const box=el("fieldset","admin-team-branches"); box.append(el("legend",null,L("branches")));
    for(const b of list||[]){
      const input=document.createElement("input"); input.type="checkbox"; input.value=b.slug; input.checked=selected.includes(b.slug); input.dataset.branch=b.slug;
      const row=el("label","admin-team-branch",b.name||b.slug); row.append(input); box.append(row);
    }
    return box;
  }
  function applyTeamFilters(panel) {
    const term=(panel.querySelector("#adminTeamSearch")?.value||"").trim().toLocaleLowerCase();
    const role=panel.querySelector("#adminTeamRole")?.value||"";
    const branch=panel.querySelector("#adminTeamBranch")?.value||"";
    const state=panel.querySelector("#adminTeamStatus")?.value||"";
    const members=panel.querySelector("#adminTeamMembers"),invites=panel.querySelector("#adminTeamInvites");
    if(members)members.hidden=state==="pending";
    if(invites)invites.hidden=state==="active";
    for(const card of panel.querySelectorAll(".admin-team-filterable")){
      const matchTerm=!term||(card.dataset.search||"").includes(term);
      const matchRole=!role||(card.dataset.role||"").split(",").includes(role);
      const matchBranch=!branch||(card.dataset.branches||"").split(",").includes(branch);
      card.hidden=!(matchTerm&&matchRole&&matchBranch);
    }
  }
  function buildTeamPanel(host) {
    const panel=el("section","admin-panel admin-team-panel"); panel.id="adminTeamPanel";
    panel.append(el("h2",null,L("team")),el("p","admin-note",L("emailGate")));
    const form=el("form","admin-team-form"); form.append(el("h3",null,L("add")));
    form.id="adminTeamAddForm";
    const name=document.createElement("input"); name.name="display_name"; name.type="text"; name.required=true; name.maxLength=80; name.autocomplete="name";
    const email=document.createElement("input"); email.name="email"; email.type="email"; email.required=true; email.maxLength=254; email.autocomplete="email";
    const roleSelect=document.createElement("select"); roleSelect.name="role";
    for(const [v,k] of [["manager","manager"],["staff","staff"],["admin","admin"]]){const o=el("option",null,L(k));o.value=v;roleSelect.append(o);}
    form.append(label(L("name"),name),label(L("email"),email),label(L("role"),roleSelect));
    let checks=branchChecks([]);
    form.append(checks);
    roleSelect.addEventListener("change",()=>{const current=form.querySelector(".admin-team-branches");if(current){current.hidden=roleSelect.value==="admin";if(roleSelect.value==="admin")for(const input of current.querySelectorAll("input[data-branch]"))input.checked=false;}});
    const reason=document.createElement("input"); reason.type="text"; reason.maxLength=500; reason.placeholder=L("reason");
    form.append(label(L("reason"),reason));
    const save=el("button","button button-gold",L("save")); save.type="submit"; form.append(save);
    const formStatus=el("p","admin-note"); form.append(formStatus);
    form.addEventListener("submit",async e=>{
      e.preventDefault(); if(busy)return; busy=true; save.disabled=true;
      try{
        const selected=[...form.querySelectorAll(".admin-team-branches input[data-branch]:checked")].map(x=>x.value);
        const result=await edge("team_assign",{email:email.value,display_name:name.value,role:roleSelect.value,branch_slugs:selected,reason:reason.value});
        status(formStatus,result.status==="pending_account"?L("pendingNote"):L("assigned"));
        await refreshTeam(panel);
      }catch{status(formStatus,L("error"),true);}
      finally{busy=false;save.disabled=false;}
    });
    panel.append(form,el("h3",null,L("members")));
    const filters=el("div","admin-team-filters");
    const search=document.createElement("input");search.type="search";search.id="adminTeamSearch";search.placeholder=L("teamSearch");
    const roleFilter=document.createElement("select");roleFilter.id="adminTeamRole";
    for(const [v,k] of [["", "teamAll"],["admin","admin"],["manager","manager"],["staff","staff"]]){const o=el("option",null,L(k));o.value=v;roleFilter.append(o);}
    const branchFilter=document.createElement("select");branchFilter.id="adminTeamBranch";const allBranches=el("option",null,L("teamAll"));allBranches.value="";branchFilter.append(allBranches);
    const statusFilter=document.createElement("select");statusFilter.id="adminTeamStatus";
    for(const [v,k] of [["","teamAll"],["active","teamActive"],["pending","teamPending"]]){const o=el("option",null,L(k));o.value=v;statusFilter.append(o);}
    filters.append(label(L("teamSearch"),search),label(L("teamRole"),roleFilter),label(L("teamBranch"),branchFilter),label(L("teamStatus"),statusFilter));panel.append(filters);
    for(const control of [search,roleFilter,branchFilter,statusFilter])control.addEventListener(control===search?"input":"change",()=>applyTeamFilters(panel));
    const members=el("div","admin-team-members"); members.id="adminTeamMembers"; panel.append(members);
    const invites=el("div","admin-team-invites"); invites.id="adminTeamInvites"; panel.append(invites);
    panel.append(el("h3",null,L("orders")));
    const orders=el("div","admin-orders-accounts"); orders.id="adminOrdersAccounts"; panel.append(orders);
    panel.append(el("h3",null,L("accessHistory")));
    const audit=el("div","admin-team-audit");audit.id="adminTeamAudit";panel.append(audit);
    host.append(panel);
    refreshTeam(panel).catch(()=>status(formStatus,L("error"),true));
  }
  function memberCard(member) {
    const card=el("article","admin-record admin-team-member admin-team-filterable");
    card.dataset.search=((member.name||"")+" "+(member.email||"")).toLocaleLowerCase();
    card.dataset.role=(member.roles||[]).join(",");card.dataset.branches=(member.branches||[]).join(",");
    card.append(el("strong",null,member.name||member.email),el("span","admin-record-meta",member.email||""),
      el("span","admin-record-meta",(member.roles||[]).map(x=>L(x)).join(" · ")),
      el("span","admin-record-meta",(member.branches||[]).join(", ")||"—"),
      el("span","admin-record-meta",L("lastSeen")+": "+(member.last_sign_in_at?new Date(member.last_sign_in_at).toLocaleString(lang()):L("neverSignedIn"))));
    if(!member.is_orders_account && !(member.roles||[]).includes("admin")){
      const edit=el("button","button admin-detail-button",L("edit")); edit.type="button";
      edit.addEventListener("click",()=>{
        const form=document.getElementById("adminTeamAddForm");if(!form)return;
        form.querySelector("[name=display_name]").value=member.name||"";
        form.querySelector("[name=email]").value=member.email||"";
        form.querySelector("[name=role]").value=(member.roles||[]).includes("manager")?"manager":"staff";
        const selected=new Set(member.branches||[]);
        for(const input of form.querySelectorAll(".admin-team-branches input[data-branch]"))input.checked=selected.has(input.value);
        form.scrollIntoView({block:"center"});form.querySelector("[name=display_name]").focus();
      });
      card.append(edit);
      const remove=el("button","button admin-detail-button",L("remove")); remove.type="button";
      remove.addEventListener("click",()=>{
        if(card.querySelector(".admin-team-revoke"))return;
        const form=el("form","admin-team-revoke"), why=document.createElement("input");why.required=true;why.maxLength=500;why.placeholder=L("reason");
        const go=el("button","button button-gold",L("confirm"));go.type="submit";form.append(why,go);
        form.addEventListener("submit",async e=>{e.preventDefault();go.disabled=true;try{await edge("team_remove",{user_id:member.user_id,reason:why.value});status(card,L("removed"));await refreshTeam(document.getElementById("adminTeamPanel"));}catch{status(card,L("error"),true);}finally{go.disabled=false;}});
        card.append(form);
      });
      card.append(remove);
    }
    return card;
  }
  function orderAccountCard(branch, account) {
    const card=el("article","admin-record admin-orders-account");
    card.append(el("strong",null,branch.name||branch.slug),el("span","admin-record-meta",account?account.email:L("provision")));
    const form=el("form","admin-team-form");
    const email=document.createElement("input"); email.type="email"; email.required=true; email.maxLength=254; email.placeholder=L("email");
    const password=document.createElement("input"); password.type="password"; password.required=true; password.minLength=16; password.maxLength=128; password.autocomplete="new-password"; password.placeholder=L("password");
    const reason=document.createElement("input"); reason.type="text"; reason.maxLength=500; reason.placeholder=L("reason"); reason.required=!!account;
    if(!account)form.append(label(L("email"),email));
    form.append(label(L("password"),password));
    if(account)form.append(label(L("reason"),reason));
    const go=el("button","button button-gold",account?L("reset"):L("provisionAccount"));go.type="submit";form.append(go);
    const note=el("p","admin-note",L("passwordHint"));form.append(note);
    form.addEventListener("submit",async e=>{
      e.preventDefault();go.disabled=true;
      try{
        if(account)await edge("orders_reset",{branch_slug:branch.slug,password:password.value,reason:reason.value});
        else await edge("orders_provision",{branch_slug:branch.slug,email:email.value,password:password.value});
        password.value="";status(note,account?L("resetDone"):L("created"));await refreshTeam(document.getElementById("adminTeamPanel"));
      }catch{status(note,L("error"),true);}
      finally{go.disabled=false;}
    });
    card.append(form);return card;
  }
  async function refreshTeam(panel) {
    if(!panel||!panel.isConnected)return;
    const data=await request("/rest/v1/rpc/azal_admin_team_list",{});
    let auditRows=[],auditFailed=false;try{auditRows=await request("/rest/v1/rpc/azal_admin_audit_recent",{p_limit:50});}catch{auditFailed=true;}
    const branchFilter=panel.querySelector("#adminTeamBranch");branchFilter.replaceChildren();const allBranches=el("option",null,L("teamAll"));allBranches.value="";branchFilter.append(allBranches);for(const b of data.branches||[]){const o=el("option",null,b.name||b.slug);o.value=b.slug;branchFilter.append(o);}
    const members=panel.querySelector("#adminTeamMembers");members.replaceChildren();
    if(!(data.members||[]).length)members.append(el("p","admin-note",L("noMembers")));
    for(const m of data.members||[])members.append(memberCard(m));
    const invites=panel.querySelector("#adminTeamInvites");invites.replaceChildren();
    for(const i of data.invites||[]){
      const card=el("article","admin-record admin-team-filterable");card.dataset.search=(i.email||"").toLocaleLowerCase();card.dataset.role=i.role||"";card.dataset.branches=(i.branches||[]).join(",");card.append(el("strong",null,L("pending")+": "+i.email),el("span","admin-record-meta",L(i.role)+" · "+(i.branches||[]).join(", ")+" · "+new Date(i.expires_at).toLocaleDateString(lang())));
      const revoke=el("button","button admin-detail-button",L("revokeInvite"));revoke.type="button";
      revoke.addEventListener("click",()=>{
        if(card.querySelector("form"))return;
        const form=el("form","admin-team-revoke"),why=document.createElement("input");why.required=true;why.maxLength=500;why.placeholder=L("reason");
        const go=el("button","button button-gold",L("confirm"));go.type="submit";form.append(why,go);
        form.addEventListener("submit",async e=>{e.preventDefault();go.disabled=true;try{await edge("team_invite_revoke",{invite_id:i.id,reason:why.value});status(card,L("removed"));await refreshTeam(panel);}catch{status(card,L("error"),true);go.disabled=false;}});
        card.append(form);
      });
      card.append(revoke);invites.append(card);
    }
    const orders=panel.querySelector("#adminOrdersAccounts");orders.replaceChildren();
    const byBranch=new Map((data.orders_accounts||[]).map(x=>[x.branch_slug,x]));
    for(const b of data.branches||[])orders.append(orderAccountCard(b,byBranch.get(b.slug)||null));
    const audit=panel.querySelector("#adminTeamAudit");audit.replaceChildren();
    for(const a of auditRows||[]){const row=el("article","admin-record admin-audit-row");row.append(el("strong",null,a.action),el("span","admin-record-meta",(a.actor_name||"")+" · "+(a.target_type||"")+" · "+(a.target_id||"")),el("span","admin-record-meta",(a.branch_slug||"")+" · "+(a.reason||"")),el("span","admin-record-meta",new Date(a.created_at).toLocaleString(lang())));audit.append(row);}
    const form=panel.querySelector(".admin-team-form");
    const old=panel.querySelector(".admin-team-branches");
    if(old){const next=branchChecks(data.branches||[]);next.hidden=panel.querySelector("[name=role]").value==="admin";old.replaceWith(next);}
  }
  async function mountManager(host) {
    if(host.dataset.loaded==="1")return;host.dataset.loaded="1";
    const own=branches;
    if(!own.length){host.append(el("p","admin-note",L("noBranch")));return;}
    const select=document.createElement("select");
    for(const slug of own){const o=el("option",null,slug);o.value=slug;select.append(o);}
    const list=el("div","admin-manager-orders");
    const load=async()=>{
      list.replaceChildren(el("p","admin-note","…"));
      try{
        const rows=await request("/rest/v1/rpc/azal_manager_branch_orders",{p_branch_slug:select.value,p_limit:50,p_offset:0});
        list.replaceChildren();
        if(!rows.length)list.append(el("p","admin-note",L("noOrders")));
        for(const o of rows){
          const card=el("article","admin-record");
          card.append(el("strong",null,String(o.id||"").slice(0,6).toUpperCase()),
            el("span","admin-record-meta",L("status")+": "+o.fulfilment_status),
            el("span","admin-record-meta",L("time")+": "+new Date(o.placed_at).toLocaleString(lang())),
            el("span","admin-record-meta",L("pickup")+": "+(o.scheduled_for?new Date(o.scheduled_for).toLocaleString(lang()):"—")),
            el("span","admin-record-meta",L("items")+": "+(o.items||[]).map(x=>(x.quantity||1)+" × "+(lang()==="fr"?x.name_fr:lang()==="ar"?x.name_en:x.name_en)).join(" · ")));
          list.append(card);
        }
      }catch{status(list,L("error"),true);}
    };
    select.addEventListener("change",load);host.append(label(L("branches"),select),list);await load();
  }
  function enhanceCustomers() {
    if(role!=="admin")return;
    for(const card of document.querySelectorAll(".admin-record[data-user-id]")){
      if(card.querySelector(".admin-customer-anonymize"))continue;
      const userId=card.dataset.userId;
      const button=el("button","button admin-detail-button admin-customer-anonymize",L("anonymize"));button.type="button";
      button.addEventListener("click",()=>{
        if(card.querySelector(".admin-customer-anonymize-form"))return;
        const form=el("form","admin-customer-anonymize-form");
        form.append(el("p","admin-note",L("anonymizeNote")));
        const reason=document.createElement("input");reason.type="text";reason.required=true;reason.maxLength=500;reason.placeholder=L("reason");
        const confirm=el("button","button button-gold",L("confirmAnonymize"));confirm.type="submit";form.append(reason,confirm);
        form.addEventListener("submit",async e=>{
          e.preventDefault();confirm.disabled=true;
          try{await edge("customer_anonymize",{user_id:userId,reason:reason.value});status(form,L("anonymized"));root.location.reload();}
          catch{status(form,L("error"),true);confirm.disabled=false;}
        });
        card.append(form);
      });
      card.append(button);
    }
  }
  async function mount() {
    if(mountBusy){mountAgain=true;return;} mountBusy=true;
    try{
      const rootEl=document.getElementById("adminRoot");if(!rootEl||!cfg.url||!cfg.anonKey)return;
      try{await detectRole();}catch{return;}
      if(role==="admin"){
        const host=rootEl.querySelector(".admin-workspace");
        if(host&&!host.querySelector("#adminTeamPanel"))buildTeamPanel(host);
        enhanceCustomers();
      }else if(role==="manager"){
        const host=rootEl.querySelector("#managerOperations");
        if(host)await mountManager(host);
      }
    } finally {mountBusy=false;if(mountAgain){mountAgain=false;mount();}}
  }
  function observe() {
    const rootEl=document.getElementById("adminRoot");if(!rootEl||rootEl===lastRoot)return;
    lastRoot=rootEl;
    new MutationObserver(()=>{if(!busy)mount();}).observe(rootEl,{childList:true,subtree:true});
    mount();
  }
  if(typeof module!=="undefined"&&module.exports){module.exports={};return;}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe);else observe();
  new MutationObserver(observe).observe(document.documentElement,{childList:true,subtree:true});
})(typeof window!=="undefined"?window:globalThis);
