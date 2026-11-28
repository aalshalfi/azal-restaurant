// T-08 admin workspace browser checks: synthetic Supabase only; no live data or writes.
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require=createRequire(process.env.NODE_PATH?join(process.env.NODE_PATH,"x"):import.meta.url);
const {chromium}=require("playwright");
const root=new URL("..",import.meta.url).pathname;
const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".woff2":"font/woff2"};
const server=http.createServer((q,r)=>{const p=join(root,decodeURIComponent(q.url.split("?")[0]));if(!existsSync(p)){r.writeHead(404);return r.end();}r.writeHead(200,{"Content-Type":types[extname(p)]||"application/octet-stream"});r.end(readFileSync(p));}).listen(0);
const browser=nullConfig(await chromium.launch()),base="http://localhost:"+server.address().port;
let failures=0;const check=(ok,msg)=>{console.log((ok?"ok   ":"FAIL ")+msg);if(!ok)failures++;};
const U1="4d9d36ab-1111-4111-8111-111111111111",U2="22222222-2222-4222-8222-222222222222";
const profiles=[{id:"u1",display_name:"Amal",phone:"+16135550101",member_number:10001,created_at:"2026-11-01T00:00:00Z"},{id:"u2",display_name:"Sara",phone:"+16135550102",member_number:10002,created_at:"2026-11-02T00:00:00Z"}];
const allOrders=[
{id:U1,user_id:"u1",branch_slug:"ottawa",fulfilment_status:"handed_over",payment_status:"paid",subtotal_cents:2499,discount_cents:0,redeemed_points:0,tax_rate_bps:1300,tax_cents:325,total_cents:2824,placed_at:"2026-11-20T10:00:00Z",contact_phone:null},
{id:U2,user_id:"u2",branch_slug:"second",fulfilment_status:"cancelled",payment_status:"refunded",subtotal_cents:599,discount_cents:0,redeemed_points:0,tax_rate_bps:1300,tax_cents:78,total_cents:677,placed_at:"2026-11-21T10:00:00Z",guest_name:null,guest_email:null,contact_phone:null},
{id:"33333333-3333-4333-8333-333333333333",user_id:null,branch_slug:"ottawa",fulfilment_status:"placed",payment_status:"unpaid",subtotal_cents:599,discount_cents:0,redeemed_points:0,tax_rate_bps:1300,tax_cents:78,total_cents:677,placed_at:"2026-11-22T10:00:00Z",guest_name:"Guest",guest_email:"guest@example.invalid",contact_phone:"+16135550103"}
];
async function open({role="admin",lang="en",width=390}={}){
 const page=await browser.newPage({viewport:{width,height:900}}),requests=[];
 await page.route("**/supabase-config.js*",r=>r.fulfill({contentType:"text/javascript",body:'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});'}));
 await page.route("https://fake.supabase.co/**",r=>{
  const req=r.request(),url=decodeURIComponent(req.url()),path=new URL(req.url()).pathname;requests.push({url,method:req.method()});
  if(path.endsWith("/rpc/azal_is_admin"))return r.fulfill({json:role==="admin"});
  if(path.endsWith("/rpc/azal_admin_customer_directory_page"))return r.fulfill({json:{rows:[{user_id:"u1",display_name:"Amal",phone:"+16135550101",email:"amal@example.invalid",member_number:10001,created_at:"2026-11-01T00:00:00Z",balance:100,membership_status:"active",joined_at:"2026-11-01T00:00:00Z"},{user_id:"u2",display_name:"Sara",phone:"+16135550102",email:"sara@example.invalid",member_number:10002,created_at:"2026-11-02T00:00:00Z",balance:55,membership_status:"suspended",joined_at:"2026-11-02T00:00:00Z"}],total:2,limit:50,offset:0}});
  if(path.endsWith("/rpc/azal_admin_team_list"))return r.fulfill({json:{members:[],invites:[],branches:[{slug:"ottawa",name:"Ottawa"}],orders_accounts:[]}});
  if(path.endsWith("/rpc/azal_admin_audit_recent"))return r.fulfill({json:[]});
  if(path.endsWith("/rpc/azal_admin_customer_contact"))return r.fulfill({json:{user_id:"u1",display_name:"Amal",phone:"+16135550101",member_number:10001,email:"amal@example.invalid"}});
  if(path.endsWith("/rpc/azal_admin_order_customer_emails"))return r.fulfill({json:[{user_id:"u1",email:"amal@example.invalid"},{user_id:"u2",email:"sara@example.invalid"}]});
  if(path.endsWith("/rpc/azal_manager_branch_orders"))return r.fulfill({json:[{id:"4d9d36ab-1111-4111-8111-111111111111",branch_slug:"ottawa",fulfilment_status:"placed",placed_at:"2026-11-20T10:00:00Z",items:[{quantity:1,name_en:"Lamb Mandi",name_fr:"Mandi"}]}]});
  if(path.endsWith("/rpc/azal_admin_customer_directory"))return r.fulfill({json:[{user_id:"u1",display_name:"Amal",phone:"+16135550101",email:"amal@example.invalid",member_number:10001,created_at:"2026-11-01T00:00:00Z"},{user_id:"u2",display_name:"Sara",phone:"+16135550102",email:"sara@example.invalid",member_number:10002,created_at:"2026-11-02T00:00:00Z"}]});
  if(path.endsWith("/user_roles"))return r.fulfill({json:role==="admin"?[{role:"admin"}]:role==="manager"?[{role:"manager"}]:role==="staff"?[{role:"staff"}]:[]});
  if(path.endsWith("/staff_branch_access"))return r.fulfill({json:role==="staff"||role==="manager"?[{branch_slug:"ottawa"}]:[]});
  if(path==="/rest/v1/orders"&&url.includes("order_items("))return r.fulfill({json:[{...allOrders[0],customer_note:"No onions",scheduled_for:"2026-11-20T10:30:00Z",order_items:[{id:"i1",quantity:1,item_name_en_snapshot:"Lamb Mandi",item_name_fr_snapshot:"Mandi",unit_price_cents:2499,line_total_cents:2499,order_item_options:[{id:"op1",option_name_en_snapshot:"Extra sauce",option_name_fr_snapshot:"Sauce",quantity:1,line_delta_cents:100}]}],order_events:[{id:1,event_type:"hand_over",from_status:"ready",to_status:"handed_over",details:{source:"staff"},created_at:"2026-11-20T11:00:00Z"}]}]});
  if(path==="/rest/v1/orders"&&url.includes("placed_at=gte."))return r.fulfill({json:[{...allOrders[0],fulfilment_status:"handed_over"},{...allOrders[1],fulfilment_status:"cancelled"},{...allOrders[2],fulfilment_status:"placed"}]});
  if(path==="/rest/v1/orders")return r.fulfill({json:allOrders});
  if(path==="/rest/v1/profiles")return r.fulfill({json:url.includes("id=eq.u1")?[profiles[0]]:profiles});
  if(path==="/rest/v1/memberships"&&url.includes("status=eq.active"))return r.fulfill({json:[{user_id:"u1"}],headers:{"content-range":"0-0/1","access-control-expose-headers":"content-range"}});
  if(path==="/rest/v1/memberships")return r.fulfill({json:[{user_id:"u1",status:"active",joined_at:"2026-11-01T00:00:00Z"},{user_id:"u2",status:"suspended",joined_at:"2026-11-02T00:00:00Z"}]});
  if(path==="/rest/v1/points_ledger")return r.fulfill({json:[{user_id:"u1",delta_points:120},{user_id:"u1",delta_points:-20},{user_id:"u2",delta_points:55}]});
  return r.fulfill({status:404,json:{}});
 });
 await page.addInitScript(l=>{localStorage.setItem("azal-language",l);localStorage.setItem("azal-auth-v1",JSON.stringify({access_token:"T",refresh_token:"R",expires_at:4e12,user:{id:"admin",email:"admin@example.invalid"}}));},lang);
 await page.goto(base+"/admin.html");if(role==="admin")await page.waitForSelector(".admin-workspace");else if(role==="manager")await page.waitForSelector("#managerOperations");else await page.waitForSelector("#adminRoot .admin-note");await page.waitForTimeout(100);if(role==="admin"){await page.waitForSelector("#adminTeamSearch");check(await page.locator("#adminTeamRole").count()===1,"Admin Team role filter mounts");check(await page.locator("#adminTeamBranch").count()===1,"Admin Team branch filter mounts");check(await page.locator("#adminTeamStatus").count()===1,"Admin Team status filter mounts");check(await page.locator("#adminTeamAudit").count()===1,"Admin audit history panel mounts");}
 return {page,requests};
}
for(const lang of ["en","fr","ar"])for(const width of [320,390,1280]){
 const {page,requests}=await open({lang,width});
 const text=await page.textContent("#adminRoot");
 const directory=lang==="en"?"Customer directory":lang==="fr"?"Répertoire des clients":"دليل العملاء";
 const orders=lang==="en"?"All orders":lang==="fr"?"Toutes les commandes":"جميع الطلبات";
 check(text.includes(directory)&&text.includes(orders),lang+" "+width+": directory and order history localized");
 check(text.includes("100")&&text.includes("+1")&&text.includes("Amal")&&text.includes("Sara")&&text.includes("amal@example.invalid"),lang+" "+width+": customer profiles, phone and member numbers visible");
 check(text.includes("Handed over")||text.includes("Remise")||text.includes("تم التسليم"),lang+" "+width+": handed-over order remains visible");
 check(text.includes("4D9D36"),lang+" "+width+": public six-character order code 4D9D36 is shown");
  check(text.includes("Page 1 of 1")||text.includes("Page 1 sur 1")||text.includes("الصفحة 1 من 1"),lang+" "+width+": directory pagination state is rendered");
 check(text.includes("Cancelled")||text.includes("Annulée")||text.includes("ملغي"),lang+" "+width+": cancelled order remains visible");
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),lang+" "+width+": no horizontal overflow");
 check(requests.some(x=>x.url.includes("/rpc/azal_admin_customer_directory_page")),lang+" "+width+": directory uses the server-side page RPC");
  check(requests.every(x=>x.method==="GET"||x.url.includes("/rpc/azal_is_admin")||x.url.includes("/rpc/azal_admin_team_list")||x.url.includes("/rpc/azal_admin_audit_recent")||x.url.includes("/rpc/azal_admin_customer_directory_page")||x.url.includes("/rpc/azal_admin_customer_contact")||x.url.includes("/rpc/azal_admin_customer_directory")),lang+" "+width+": workspace is read-only");
 const contactBeforeDetail=requests.filter(x=>{
  const u=new URL(x.url);
  if(u.pathname.endsWith("/profiles"))return u.searchParams.get("id")!=="eq.admin";
  return u.pathname.endsWith("/rpc/azal_admin_order_customer_emails")||u.pathname.endsWith("/rpc/azal_admin_customer_contact");
 });
 check(contactBeforeDetail.length===0,lang+" "+width+": order list does not fetch other customer profile or contact data");
 const listRead=requests.find(x=>x.url.includes("/rest/v1/orders?")&&!x.url.includes("order_items("));
 const listSelect=listRead?new URL(listRead.url).searchParams.get("select")||"":"";
 check(!!listRead&&!/user_id|guest_name|guest_email|contact_phone/.test(listSelect),lang+" "+width+": order-list SELECT excludes guest name, email and phone");
 const button=page.locator(".admin-workspace > .admin-panel:nth-child(2) .admin-record button").first();await button.click();await page.waitForSelector(".admin-order-detail");
 const detail=await page.textContent(".admin-order-detail");
 check(detail.includes("4D9D36")&&detail.includes("Lamb Mandi")&&detail.includes("Extra sauce")&&detail.includes("hand_over")&&detail.includes("No onions"),lang+" "+width+": item snapshots, options, event and note detail");
 check(requests.some(x=>x.url.includes("/rpc/azal_admin_customer_contact")),lang+" "+width+": single-customer contact is fetched only after opening order detail");
 check(!requests.some(x=>x.url.includes("/rpc/azal_admin_order_customer_emails")),lang+" "+width+": bulk customer-email RPC is never called");
 await page.close();
}
{
 const {page,requests}=await open({role:"staff"});
 const t=await page.textContent("#adminRoot");
 check(t.includes("doesn’t have access")||t.includes("n’y a pas accès")||t.includes("لا يملك صلاحية"),"staff denied admin workspace");
 check(!requests.some(x=>(x.url.includes("/rest/v1/points_ledger")&&!x.url.includes("user_id=eq."))||(x.url.includes("/rest/v1/profiles")&&!x.url.includes("id=eq."))),"staff reads only its own profile/points; no cross-customer directory or ledger request");
 await page.close();
}

for(const lang of ["en","fr","ar"])for(const width of [320,390,1280]){
 const {page,requests}=await open({role:"manager",lang,width});
 await page.waitForFunction(()=>/Lamb Mandi|Mandi/.test(document.querySelector("#managerOperations")?.textContent||""));
 const text=await page.textContent("#managerOperations");
 check(text.includes("Lamb Mandi")||text.includes("Mandi"),lang+" "+width+": Manager sees assigned-branch operational orders");
 const financial=/Payment|Subtotal|Discount|Tax|Total|taxe|Sous-total|الضريبة|الإجمالي|الدفع/.test(text);
 const raw=requests.filter(x=>{
  const u=new URL(x.url),p=u.pathname;
  if(p.endsWith("/orders"))return true;
  if(p.endsWith("/profiles"))return u.searchParams.get("id")!=="eq.admin";
  if(p.endsWith("/points_ledger")||p.endsWith("/memberships"))return u.searchParams.get("user_id")!=="eq.admin";
  return p.endsWith("/rpc/azal_admin_customer_directory_page")||p.endsWith("/rpc/azal_admin_customer_contact")||p.endsWith("/rpc/azal_admin_order_customer_emails");
 });
 if(financial||raw.length)console.log("MANAGER_DIAGNOSTIC",lang,width,JSON.stringify({text,raw:raw.map(x=>x.url)}));
 check(!financial,lang+" "+width+": Manager view omits payment and financial fields");
 check(!raw.length,lang+" "+width+": Manager never reads another customer or raw order tables");
 await page.close();
}

await browser.close();server.close();console.log(failures?failures+" failed":"all passed");process.exit(failures?1:0);
