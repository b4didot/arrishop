import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/validation";
export async function POST(request:Request) {
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Invalid request."},{status:403});
 try{
  const body=await request.json();
  const client=await createClient();
  const {data,error}=await client.rpc("change_cart_item",{target_product:uuid(body.productId),desired_quantity:1,add_to_existing:true});
  if(error){
   const unauthenticated=["42501","28000","PGRST301","PGRST302"].includes(error.code)||error.message==="Please log in first.";
   return Response.json({error:unauthenticated?"Please log in first.":error.code==="P0001"?error.message:"We couldn't add this item. Please try again."},{status:unauthenticated?401:400});
  }
  revalidatePath("/cart");revalidatePath("/checkout");
  return Response.json({count:data},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return Response.json({error:"We couldn't add this item. Please try again."},{status:400});}
}
