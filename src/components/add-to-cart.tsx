"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LoaderCircle } from "lucide-react";
import { useLoadingSignal } from "@/components/loading-provider";
export function AddToCart({productId}:{productId:string}){
 const [pending,setPending]=useState(false),[error,setError]=useState(""),[added,setAdded]=useState(false);
 const router=useRouter();useLoadingSignal(pending);
 async function add(){
  if(pending)return;setPending(true);setError("");setAdded(false);
  try{
   const response=await fetch("/api/cart",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId})});
   if(response.status===401){router.push("/login?next=%2F");return;}
   const result=await response.json();
   if(!response.ok)throw new Error(result.error??"We couldn't add this item.");
   window.dispatchEvent(new CustomEvent("arrie:cart-count",{detail:result.count}));
   setAdded(true);
  }catch(error){setError(error instanceof Error?error.message:"Please try again.");}
  finally{setPending(false);}
 }
 return <div className="product-add"><button type="button" className="button button-small" disabled={pending} onClick={add}>{pending?<LoaderCircle size={16} className="spin"/>:<Plus size={16}/>} {pending?"Adding…":"Add to cart"}</button>{error&&<p role="alert" className="small">{error}</p>}{added&&<span className="visually-hidden" role="status">Added to your cart!</span>}</div>;
}
