// T-25/T-26 browser acceptance with a fake Supabase API. Run: node tests/reports.browser.mjs
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
const browser= nullConfig(await chromium.launch()),base=`http://localhost:${server.address().port}`;
let failures=0;const ok=(v,m)=>{console.log((v?"ok   ":"FAIL ")+m);if(!v)failures++;};
async function open(pageName,role="admin",width=390){
  const page=await browser.newPage({viewport:{width,height:900}}),requests=[];
  await page.route("**/supabase-config.js*",(r)=>r.fulfill({contentType:"text/javascript",body:'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});'}));
  await page.route("https://fake.supabase.co/**",async r=>{
    const req=r.request(),u=decodeURIComponent(req.url());requests.push({url:u,method:req.method(),body:req.postDataJSON()});
    if(u.includes("/rpc/azal_is_admin"))return r.fulfill({json:role==="admin"});
    if(u.includes("/rest/v1/user_roles"))return r.fulfill({json:role==="customer"?[]:[{role}]});
    if(u.includes("/rest/v1/staff_branch_access"))return r.fulfill({json:role==="manager"?[{branch_slug:"ottawa"}]:[]});
    if(u.includes("/rest/v1/branches"))return r.fulfill({json:[{slug:"ottawa",name_en:"Ottawa",name_fr:"Ottawa"},{slug:"second",name_en:"Second",name_fr:"Deuxième"}]});
    if(u.includes("azal_admin_sales_report")){
      const row={period_start:"2026-11-28",paid_orders:3,placed_count:1,accepted_count:0,preparing_count:0,ready_count:0,handed_over_count:2,cancelled_count:0,collected_cents:5648};
      if(role==="admin")Object.assign(row,{subtotal_cents:4998,discount_cents:0,hst_cents:650,refunds_cents:2824,net_collected_cents:2824,paid_total_cents:8472});
      return r.fulfill({json:{bucket:"day",scope:role==="admin"?"admin":"assigned_branches",rows:[row]}});
    }
    if(u.includes("azal_admin_customer_directory_page"))return r.fulfill({json:{rows:[],total:0,limit:50,offset:0}});
    if(u.includes("/rest/v1/memberships")&&u.includes("status=eq.active"))return r.fulfill({json:[],headers:{"content-range":"0-0/0","access-control-expose-headers":"content-range"}});
    if(u.includes("/rest/v1/orders"))return r.fulfill({json:[]});
    if(u.includes("azal_staff_my_branches"))return r.fulfill({json:["ottawa"]});
    if(u.includes("azal_staff_can_access"))return r.fulfill({json:true});
    if(u.includes("azal_staff_today_summary"))return r.fulfill({json:{date:"2026-11-28",collected_cents:2824,placed_count:1,accepted_count:2,preparing_count:0,ready_count:1,handed_over_count:3,cancelled_count:0}});
    return r.fulfill({status:404,json:{message:"not_found"}});
  });
  await page.addInitScript(()=>localStorage.setItem("azal-auth-v1",JSON.stringify({access_token:"T",refresh_token:"R",expires_at:4e12,user:{id:"u1",email:"team@example.invalid"}})));
  await page.goto(base+"/"+pageName+".html");
  return {page,requests};
}
{
  const {page,requests}=await open("admin","admin",320);
  await page.waitForSelector(".report-table");
  const text=await page.textContent("#reportsRoot");
  ok(/Sales & HST reports/.test(text)&&/Subtotal/.test(text)&&/HST/.test(text)&&/Refunds/.test(text)&&/Net collected/.test(text),"Admin receives financial breakdown, refunds and net collected");
  ok(requests.some(x=>x.url.includes("azal_admin_sales_report")&&x.method==="POST"&&x.body.p_branch_slug===null),"Admin default report is all active branches through the server RPC");
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Admin reports at 320px do not cause page-level horizontal overflow");
  await page.evaluate(()=>document.documentElement.lang="ar");await page.waitForTimeout(100);
  ok(/تقارير المبيعات/.test(await page.textContent("#reportsRoot")),"Admin report copy switches to Arabic");
  await page.close();
}
{
  const {page,requests}=await open("admin","manager",390);
  await page.waitForSelector(".report-table");
  const text=await page.textContent("#reportsRoot");
  ok(/Sales & HST reports/.test(text)&&/Collected sales/.test(text),"Manager receives an assigned-branch report");
  ok(!/Subtotal|Discount|HST|Refunds|Net collected/.test(text),"Manager payload and UI omit Admin financial breakdown");
  const options=await page.locator('#salesReportForm select[name="branch"] option').allTextContents();
  ok(options.some(x=>/All assigned branches/.test(x))&&options.some(x=>/Ottawa/.test(x))&&!options.some(x=>/Second/.test(x)),"Manager selector offers only all assigned or assigned Ottawa");
  ok(requests.some(x=>x.url.includes("azal_admin_sales_report")&&x.body.p_branch_slug===null),"Manager all-assigned scope is sent as null and enforced server-side");
  await page.close();
}
{
  const {page,requests}=await open("staff","staff",320);
  await page.waitForSelector("#staffSummaryCopy");
  const text=await page.textContent("#staffSummaryRoot");
  ok(/Today's summary/.test(text)&&/Collected sales/.test(text)&&/\$28\.24/.test(text),"Staff sees today's net collected total");
  ok(/Received/.test(text)&&/Accepted/.test(text)&&/Handed over/.test(text),"Staff sees status counts");
  ok(!/HST|tax|subtotal|discount/i.test(text),"Staff summary contains no tax or financial breakdown");
  ok(requests.some(x=>x.url.includes("azal_staff_today_summary")&&x.body.p_branch_slug==="ottawa"),"Staff summary requests only its selected assigned branch");
  ok(!requests.some(x=>/outbox|smtp|send_email|sendmail/i.test(x.url)),"Staff summary creates no sending/outbox path");
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Staff summary at 320px has no page-level horizontal overflow");
  await page.close();
}
await browser.close();server.close();console.log(failures?failures+" failed":"all passed");process.exit(failures?1:0);
