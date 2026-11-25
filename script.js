const products = [
{id:1,name:"Lamb Mandi",category:"Rice",type:"Rice & meat",price:24.99,description:"Fragrant Yemeni rice with slow-cooked tender lamb.",image:"https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",tag:"Signature"},
{id:2,name:"Chicken Mandi",category:"Rice",type:"Rice & meat",price:18.99,description:"Aromatic mandi rice served with seasoned roasted chicken.",image:"https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80",tag:"Popular"},
{id:3,name:"Lamb Haneeth",category:"Rice",type:"Rice & meat",price:26.99,description:"Traditional slow-roasted lamb, tender and full of spice.",image:"https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",tag:"Traditional"},
{id:4,name:"Yemeni Fahsa",category:"Traditional",type:"Traditional",price:19.99,description:"A rich traditional stew served bubbling hot with bread.",image:"https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",tag:""},
{id:5,name:"Yemeni Saltah",category:"Traditional",type:"Traditional",price:17.99,description:"A comforting Yemeni favourite with a savoury, spiced broth.",image:"https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80",tag:""},
{id:6,name:"Sahawiq & Fresh Bread",category:"Sides",type:"Sides",price:5.99,description:"Freshly baked bread with a bright Yemeni chilli relish.",image:"https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=900&q=80",tag:""},
{id:7,name:"Hummus",category:"Sides",type:"Sides",price:7.99,description:"Creamy chickpea dip finished with olive oil.",image:"https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=900&q=80",tag:""},
{id:8,name:"Adeni Chai",category:"Drinks",type:"Drinks",price:3.99,description:"Yemeni-style spiced milk tea, fragrant and warming.",image:"https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=900&q=80",tag:""},
{id:9,name:"Fresh Mango Juice",category:"Drinks",type:"Drinks",price:5.49,description:"A refreshing sweet mango drink.",image:"https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=900&q=80",tag:""}
];
const cart = new Map();
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(n);
const productGrid=$("productGrid"), cartDrawer=$("cartDrawer"), backdrop=$("cartBackdrop"), cartItems=$("cartItems");
const cartCount=$("cartCount"), cartTotal=$("cartTotal"), checkoutButton=$("checkoutButton");
const checkoutModal=$("checkoutModal"), customerName=$("customerName"), checkoutMessage=$("checkoutMessage");
const nav=document.querySelector(".nav"), toggle=document.querySelector(".menu-toggle");
const search=$("menuSearch"), tabs=$("categoryTabs");

function renderProducts(category="All",query=""){
 if(!productGrid)return;
 const normalized=query.trim().toLowerCase();
 const shown=products.filter(p=>(category==="All"||p.category===category)&&(!normalized||(`${p.name} ${p.description} ${p.type}`).toLowerCase().includes(normalized)));
 productGrid.innerHTML=shown.length?shown.map(p=>`<article class="product-card"><div class="product-image" style="background-image:url('${p.image}')" role="img" aria-label="${p.name}" loading="lazy"></div>${p.tag?`<span class="product-tag">${p.tag}</span>`:""}<div class="product-info"><span class="product-category">${p.type}</span><h3>${p.name}</h3><p>${p.description}</p><div class="product-bottom"><span class="product-price">${money(p.price)}</span><button class="add-button" data-add="${p.id}">Add +</button></div></div></article>`).join(""):'<p class="no-products">No dishes match that search. Try another name or category.</p>';
}
function renderCart(){
 const entries=[...cart.entries()], count=entries.reduce((sum,[,qty])=>sum+qty,0);
 const total=entries.reduce((sum,[id,qty])=>sum+products.find(p=>p.id===id).price*qty,0);
 if(cartCount)cartCount.textContent=count;
 if(cartTotal)cartTotal.textContent=money(total);
 if(checkoutButton)checkoutButton.disabled=count===0;
 if(cartItems)cartItems.innerHTML=entries.length?entries.map(([id,qty])=>{const p=products.find(x=>x.id===id);return `<div class="cart-row"><div><strong>${p.name}</strong><small>${money(p.price)} each · ${money(p.price*qty)}</small></div><div class="quantity-controls"><button data-change="${id}" data-delta="-1" aria-label="Remove one">−</button><span>${qty}</span><button data-change="${id}" data-delta="1" aria-label="Add one">+</button></div></div>`}).join(""):'<p class="empty-cart">Your basket is waiting for something delicious.</p>';
}
function openCart(){if(!cartDrawer||!backdrop)return;cartDrawer.classList.add("open");backdrop.classList.add("open");cartDrawer.setAttribute("aria-hidden","false");document.body.classList.add("locked")}
function closeCart(){cartDrawer?.classList.remove("open");backdrop?.classList.remove("open");cartDrawer?.setAttribute("aria-hidden","true");document.body.classList.remove("locked")}
function closeModal(){checkoutModal?.classList.remove("open");document.body.classList.remove("locked")}

// Render core content first: optional controls must never prevent the menu appearing.
renderProducts();
renderCart();

productGrid?.addEventListener("click",e=>{const b=e.target.closest("[data-add]");if(!b)return;const id=Number(b.dataset.add);cart.set(id,(cart.get(id)||0)+1);renderCart();b.textContent="Added ✓";});
cartItems?.addEventListener("click",e=>{const b=e.target.closest("[data-change]");if(!b)return;const id=Number(b.dataset.change),next=(cart.get(id)||0)+Number(b.dataset.delta);if(next<=0)cart.delete(id);else cart.set(id,next);renderCart()});
tabs?.addEventListener("click",e=>{const b=e.target.closest("button[data-category]");if(!b)return;tabs.querySelectorAll("button").forEach(x=>{const active=x===b;x.classList.toggle("active",active);x.setAttribute("aria-pressed",String(active))});renderProducts(b.dataset.category,search?.value||"")});
search?.addEventListener("input",e=>{const active=tabs?.querySelector("button.active");renderProducts(active?.dataset.category||"All",e.target.value)});
$("cartOpen")?.addEventListener("click",openCart);
$("cartClose")?.addEventListener("click",closeCart);
backdrop?.addEventListener("click",closeCart);
checkoutButton?.addEventListener("click",()=>{if(checkoutModal){closeCart();checkoutModal.classList.add("open");document.body.classList.add("locked")}});
$("modalClose")?.addEventListener("click",closeModal);
$("placeDemoOrder")?.addEventListener("click",()=>{const name=customerName?.value.trim();if(!name){if(checkoutMessage)checkoutMessage.textContent="Please enter your name to preview the demo.";return}const count=[...cart.values()].reduce((a,b)=>a+b,0);if(checkoutMessage)checkoutMessage.textContent=`Thank you, ${name}. Your demo order contains ${count} item(s). This has not been sent to the restaurant.`;cart.clear();renderCart()});
checkoutModal?.addEventListener("click",e=>{if(e.target.id==="checkoutModal")closeModal()});
toggle?.addEventListener("click",()=>{const open=nav?.classList.toggle("open")||false;toggle.setAttribute("aria-expanded",String(open))});
nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");toggle?.setAttribute("aria-expanded","false")}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeCart();closeModal();nav?.classList.remove("open");toggle?.setAttribute("aria-expanded","false")}});
if($("year"))$("year").textContent=new Date().getFullYear();
