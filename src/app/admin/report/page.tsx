import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrderReport } from "@/components/order-report";
import { PageHeading } from "@/components/ui";
import type { Product, ReportOrder } from "@/types";
export default async function ReportPage() {
 const user=await requireAdmin();const client=await createClient();
 // Explicit pagination avoids Supabase's default response cap silently omitting orders/products.
 const orders:ReportOrder[]=[];const products:Pick<Product,"id"|"title">[]=[];
 for(let offset=0;;offset+=500) {
  const {data,error}=await client.from("orders").select("*,order_items(id,product_id,title,quantity,unit_price_centavos,item_count,report_count)").order("id").range(offset,offset+499);
  if(error)throw new Error("We couldn't load the Order Report.");
  orders.push(...(data??[]) as ReportOrder[]);if((data?.length??0)<500)break;
 }
 for(let offset=0;;offset+=500){
  const {data,error}=await client.from("products").select("id,title").order("title").order("id").range(offset,offset+499);
  if(error)throw new Error("We couldn't load report products.");
  products.push(...(data??[]));if((data?.length??0)<500)break;
 }
 return <><PageHeading eyebrow="YOUR BAKING WORKSHEET" title="Order Report" description="Reserved delivery orders, product quantities, and suggested preparation counts."/><OrderReport orders={orders} products={products} userId={user.id}/></>;
}
