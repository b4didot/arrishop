"use client";
import { useEffect,useState } from "react";
import { ShoppingBasket } from "lucide-react";
import Link from "@/components/app-link";
export function CartLink({initialCount}:{initialCount:number}){
 const [count,setCount]=useState(initialCount);
 useEffect(()=>setCount(initialCount),[initialCount]);
 useEffect(()=>{const update=(event:Event)=>{const value=(event as CustomEvent).detail;if(Number.isInteger(value)&&value>=0)setCount(value);};window.addEventListener("arrie:cart-count",update);return()=>window.removeEventListener("arrie:cart-count",update);},[]);
 return <Link href="/cart" prefetch={false} className="floating-cart" aria-label={`Cart, ${count} ${count===1?"item":"items"}`}><ShoppingBasket size={27} strokeWidth={1.8}/><span className="floating-cart-count" aria-hidden="true">{count}</span></Link>;
}
