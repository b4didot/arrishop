import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { configured,createClient } from "@/lib/supabase/server";
export const getAuthenticatedUser=cache(async()=>{
 if(!configured())return null;
 const client=await createClient();const {data:{user}}=await client.auth.getUser();
 return user;
});
export const getViewer=cache(async()=>{
 const user=await getAuthenticatedUser();
 if(!user)return {user:null,admin:false,cartCount:0};
 const client=await createClient();const {data,error}=await client.rpc("viewer_context");
 if(error)throw new Error("We couldn't load your account. Please try again.");
 return {user,admin:data?.admin===true,cartCount:Number(data?.cart_count??0)};
});
export async function requireUser(next="/"){
 const user=await getAuthenticatedUser();if(!user)redirect(`/login?next=${encodeURIComponent(next)}`);return user;
}
export async function requireAdmin(){
 const viewer=await getViewer();if(!viewer.user)redirect("/login?next=/admin");
 if(!viewer.admin)redirect("/account?notice=admin-only");return viewer.user;
}
