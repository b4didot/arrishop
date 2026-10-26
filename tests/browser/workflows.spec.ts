import { test, expect, type BrowserContext } from "@playwright/test";
import sharp from "sharp";
test.beforeEach(async({request})=>{await request.post("http://127.0.0.1:54329/__reset");});
const orderId="55555555-5555-4555-8555-555555555555";
async function login(context:BrowserContext,admin=false){
 const id=admin?"33333333-3333-4333-8333-333333333333":"11111111-1111-4111-8111-111111111111";
 const header=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url");
 const payload=Buffer.from(JSON.stringify({sub:id,aud:"authenticated",role:"authenticated",exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})).toString("base64url");
 const session={access_token:`${header}.${payload}.fixture-signature`,refresh_token:"fixture-refresh",expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:"bearer",user:{id,email:"fixture@example.test",aud:"authenticated",role:"authenticated",app_metadata:{},user_metadata:{}}};
 await context.addCookies([{name:"sb-127-auth-token",value:"base64-"+Buffer.from(JSON.stringify(session)).toString("base64url"),url:"http://localhost:3107",sameSite:"Lax"}]);
}
test("admin report supports filters, saved columns, zoom, count and navigation confirmation",async({page,context},info)=>{
 await login(context,true);await page.goto("/admin/report");
 await expect(page.getByRole("heading",{name:"Order Report",exact:true})).toBeVisible();
 await expect(page.getByRole("cell",{name:"Jamie Baker",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Zoom report out"}).click();await expect(page.getByText("90%",{exact:true})).toBeVisible();
 await page.getByText("Customize columns",{exact:true}).click();
 await page.getByLabel("Address",{exact:true}).uncheck();
 await page.getByRole("button",{name:"Move Cookies Count left",exact:true}).click();
 await page.reload();await expect(page.getByText("90%",{exact:true})).toBeVisible();
 await expect(page.getByRole("columnheader",{name:"Address",exact:true})).toHaveCount(0);
 await page.getByLabel("Name, social or order number").fill("Nobody");await expect(page.getByText("No orders match these filters.")).toBeVisible();
 await page.getByLabel("Name, social or order number").fill("Jamie");
 await page.getByRole("button",{name:/Edit Cookies count/}).click();
 await expect(page.getByRole("dialog",{name:"Change this order's count?"})).toBeVisible();
 await page.getByLabel("Report count",{exact:true}).fill("8");await page.getByRole("button",{name:"Confirm count change"}).click();
 await expect(page.getByRole("dialog",{name:"Change this order's count?"})).not.toBeVisible();await expect(page.getByRole("button",{name:/currently 8/})).toBeVisible();
 await page.getByRole("button",{name:"Completed",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Open this order?"})).toBeVisible();
 await page.getByRole("button",{name:"Stay on report"}).click();await expect(page).toHaveURL(/\/admin\/report$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/report-${info.project.name}.png`,fullPage:true});
});
test("customer order has simple messages and one private review with shared photo limits",async({page,context},info)=>{
 page.on("pageerror", error=>console.error("browser error",error.message));
 await login(context);await page.goto(`/orders/${orderId}`);
 await expect(page.getByRole("heading",{name:"Order messages",exact:true})).toBeVisible();
 const conversationBox=await page.locator(".order-conversation").boundingBox(),summaryBox=await page.locator("main .two-column").boundingBox();
 expect(conversationBox!.y-summaryBox!.y-summaryBox!.height).toBeGreaterThanOrEqual(20);
 const chat=page.locator("section").filter({has:page.getByRole("heading",{name:"Order messages",exact:true})});
 const chatPhoto={name:"chat.png",mimeType:"image/png",buffer:await sharp({create:{width:2,height:2,channels:3,background:"#f6b69d"}}).png().toBuffer()};
 await chat.locator('input[type="file"][multiple]').setInputFiles(Array.from({length:4},(_,i)=>({...chatPhoto,name:`chat${i}.png`})));
 await expect(chat.getByRole("alert")).toContainText("up to 3 photos total");
 await chat.locator('input[type="file"][multiple]').setInputFiles(Array.from({length:3},(_,i)=>({...chatPhoto,name:`chat${i}.png`})));
 await expect(chat.getByText(/3\/3 photos/)).toBeVisible();
 await page.getByLabel("Message",{exact:true}).fill(`Hello from ${info.project.name}`);
 await page.getByRole("button",{name:"Send message",exact:true}).click();
 await expect(page.getByText(`Hello from ${info.project.name}`,{exact:true})).toBeVisible();
 await expect(page.getByRole("dialog",{name:"Please wait",exact:true})).not.toBeVisible();
 const review=page.locator("section").filter({has:page.getByRole("heading",{name:"Private order review",exact:true})});
 // Each test has isolated fixture state; both devices submit their own review.
 {
  await expect(review.getByLabel("Cookies (optional)",{exact:true})).toHaveCount(1);
  await expect(review.locator('input[capture="environment"]')).toHaveCount(1);
  const photo={name:"photo.png",mimeType:"image/png",buffer:await sharp({create:{width:2,height:2,channels:3,background:"#f6b69d"}}).png().toBuffer()};
  await review.locator('input[type="file"][multiple]').setInputFiles(Array.from({length:6},(_,i)=>({...photo,name:`photo${i}.png`})));
  await expect(review.getByRole("alert")).toContainText("up to 5 photos total");
  await review.locator('input[type="file"][multiple]').setInputFiles(Array.from({length:5},(_,i)=>({...photo,name:`photo${i}.png`})));
  await expect(review.getByText(/5\/5 photos/)).toBeVisible();
  await review.getByLabel("Overall order feedback (optional)",{exact:true}).fill("A lovely order");
  await expect(review.getByLabel("Overall order feedback (optional)",{exact:true})).toHaveValue("A lovely order");
  await review.getByLabel("Cookies (optional)",{exact:true}).fill("Delicious");
  await expect(review.getByLabel("Overall order feedback (optional)",{exact:true})).toHaveValue("A lovely order");
  await review.getByRole("button",{name:"Submit private review"}).click();
  await expect(review.getByText("A lovely order",{exact:true})).toBeVisible();
  await expect(review.getByRole("button",{name:"Submit private review"})).toHaveCount(0);
  await expect(page.getByRole("dialog",{name:"Please wait",exact:true})).not.toBeVisible();
  await expect(review.locator(".content-photo-grid img")).toHaveCount(5);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/order-content-${info.project.name}.png`,fullPage:true});
});
test("admin calendar exposes lead time, per-date capacity and closed/open dates",async({page,context},info)=>{
 await login(context,true);await page.goto("/admin/calendar");
 await expect(page.getByRole("heading",{name:"Delivery calendar",exact:true,level:1})).toBeVisible();
 await expect(page.getByLabel("Minimum lead time (calendar days)")).toHaveValue("2");
 await page.getByRole("button",{name:"Next month"}).click();
 await page.getByRole("button",{name:"Previous month"}).click();
 await page.getByLabel("Open for delivery").check();
 await page.getByLabel("Maximum orders",{exact:true}).fill("12");
 await page.getByRole("button",{name:"Save this date"}).click();
 await expect(page.getByText("Delivery date saved. Existing reservations are kept.")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/calendar-${info.project.name}.png`,fullPage:true});
});

test("checkout requires an available delivery day and allows an empty social name",async({page,context})=>{
 await login(context);await page.goto("/checkout");
 await expect(page.getByRole("heading",{name:"Review your order",exact:true})).toBeVisible();
 const hint=page.getByText("Choose an available delivery day. Grey dates are unavailable.",{exact:true});
 const hintBox=await hint.boundingBox(),calendarBox=await page.locator(".delivery-calendar .calendar-grid").boundingBox();
 expect(hintBox!.y+hintBox!.height).toBeLessThanOrEqual(calendarBox!.y);
 const confirm=page.getByRole("button",{name:/Confirm order/});
 await expect(confirm).toBeDisabled();
 await page.locator('input[name="delivery_carrier"][value="lalamove"]').check();
 await expect(confirm).toBeDisabled();
 await page.getByRole("button",{name:/slots left/}).first().click();
 await expect(confirm).toBeEnabled();
 await expect(page.locator('input[name="delivery_date"]')).not.toHaveValue("");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("report shows every row, wraps headers, centers counts, and remembers column widths",async({page,context,request})=>{
 await request.post("http://127.0.0.1:54329/__report-many");
 await login(context,true);await page.goto("/admin/report");
 await expect(page.locator(".order-report tbody tr")).toHaveCount(60);
 await expect(page.getByRole("navigation",{name:"Report pages"})).toHaveCount(0);
 await expect(page.locator(".order-report td.numeric").first()).toHaveCSS("text-align","center");
 await page.getByText("Customize columns",{exact:true}).click();
 const slider=page.getByRole("slider",{name:"Width of Cookies Count",exact:true});
 await slider.focus();await slider.press("Home");
 const handle=page.getByRole("separator",{name:"Resize Cookies Count",exact:true});
 await expect(handle).toHaveAttribute("aria-valuenow","72");
 await page.reload();
 await expect(page.getByRole("separator",{name:"Resize Cookies Count",exact:true})).toHaveAttribute("aria-valuenow","72");
 const header=page.locator("th").filter({has:page.getByRole("button",{name:"Cookies Count",exact:true})});
 await expect(header).toHaveCSS("white-space","normal");
 const height=await header.getByRole("button",{name:"Cookies Count",exact:true}).evaluate(el=>el.getBoundingClientRect().height);
 expect(height).toBeGreaterThan(25);
 await page.screenshot({path:"test-results/report-resize-"+page.viewportSize()!.width+".png",fullPage:true});
});
test("customer receives private in-app message and order update notifications",async({page,context,request})=>{
 await login(context);await page.goto("/account");
 await expect(page.getByRole("button",{name:"Notifications, 0 unread"})).toBeVisible();
 await request.post("http://127.0.0.1:54329/__notify",{data:{kind:"message"}});
 await request.post("http://127.0.0.1:54329/__notify",{data:{kind:"order_update",status:"processing"}});
 await page.getByRole("button",{name:"Notifications, 0 unread"}).click();
 await expect(page.getByRole("button",{name:"Notifications, 2 unread"})).toBeVisible();
 const notifications=page.getByRole("region",{name:"Order notifications"});
 await expect(notifications.getByText("New message",{exact:true})).toBeVisible();
 await expect(notifications.getByText("Order update: Processing",{exact:true})).toBeVisible();
 await notifications.getByRole("button",{name:"Mark all read"}).click();
 await expect(page.getByRole("button",{name:"Notifications, 0 unread"})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("add to cart updates its badge without a page render and loading icon rotates",async({page,context})=>{
 await login(context);await page.goto("/");
 await expect(page.getByRole("link",{name:"Cart, 2 items",exact:true})).toBeVisible();
 let release!:()=>void;const hold=new Promise<void>(resolve=>release=resolve);
 await page.route("**/api/cart",async route=>{await hold;await route.continue();});
 let pageRenders=0;page.on("request",request=>{if(request.headers()["rsc"]==="1"&&new URL(request.url()).pathname==="/"&&!request.headers()["next-router-prefetch"])pageRenders++;});
 try{
  await page.getByRole("button",{name:"Add to cart",exact:true}).first().click();
  const dialog=page.getByRole("dialog",{name:"Please wait",exact:true});
  await expect(dialog).toBeVisible();
  await page.emulateMedia({reducedMotion:"no-preference"});
  const spinner=dialog.locator(".spin");
  await expect(spinner).toHaveCSS("animation-name","arrie-spinner-rotation");
  const first=await spinner.evaluate(el=>getComputedStyle(el).transform);
  await expect.poll(()=>spinner.evaluate(el=>getComputedStyle(el).transform)).not.toBe(first);
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(spinner).toHaveCSS("animation-name","arrie-spinner-rotation");
  await expect(spinner).toHaveCSS("animation-duration","1.6s");
  release();
  await expect(page.getByRole("link",{name:"Cart, 3 items",exact:true})).toBeVisible();
  await expect(dialog).not.toBeVisible();
  expect(pageRenders).toBe(0);
 }finally{release();}
});

test("cart and notification endpoints reject unsigned and cross-origin requests",async({request})=>{
 const crossSite=await request.post("/api/cart",{headers:{origin:"https://unrelated.example"},data:{productId:"44444444-4444-4444-8444-444444444444"}});
 expect(crossSite.status()).toBe(403);
 const unsigned=await request.post("/api/cart",{headers:{origin:"http://localhost:3107"},data:{productId:"44444444-4444-4444-8444-444444444444"}});
 expect(unsigned.status()).toBe(401);
 const notifications=await request.get("/api/notifications");
 expect(notifications.status()).toBe(401);
 const read=await request.post("/api/notifications",{headers:{origin:"https://unrelated.example"},data:{}});
 expect(read.status()).toBe(403);
});