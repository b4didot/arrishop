"use client";
import { useEffect, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { submitOrderContent } from "@/app/workflow-actions";
import { createClient } from "@/lib/supabase/client";
import { imageFile } from "@/lib/validation";
import type { ActionState, OrderItem } from "@/types";
function Preview({file}:{file:File}) {
 const [url,setUrl]=useState("");
 useEffect(()=>{const value=URL.createObjectURL(file);setUrl(value);return ()=>URL.revokeObjectURL(value);},[file]);
 return url?<img src={url} alt={file.name}/>:null;
}
export function OrderContentForm({orderId,kind,items=[],entryKey}:{orderId:string;kind:"message"|"review";items?:OrderItem[];entryKey:string}) {
 const [files,setFiles]=useState<File[]>([]);
 const [entry,setEntry]=useState(entryKey);
 const [error,setError]=useState("");
 const [saved,setSaved]=useState(false);
 const [body,setBody]=useState("");
 const [comments,setComments]=useState<Record<string,string>>({});
 const [uploaded,setUploaded]=useState<Map<File,string>>(new Map());
 const maximum=kind==="review"?5:3;
 const unique=[...new Map(items.map(item=>[item.product_id,item])).values()];
 async function add(chosen:File[]) {
  try {
   if(files.length+chosen.length>maximum) throw new Error(`You can attach up to ${maximum} photos total.`);
   for(const file of chosen) { const form=new FormData(); form.set("photo",file); await imageFile(form,"photo"); }
   setFiles(current=>[...current,...chosen]);setError("");
  } catch(error) {setError((error as Error).message);}
 }
 async function submit(state:ActionState,form:FormData):Promise<ActionState> {
  try {
   if(files.length>maximum) throw new Error(`Choose up to ${maximum} photos.`);
   const client=createClient();const {data:{user}}=await client.auth.getUser();
   if(!user) throw new Error("Please log in again.");
   const paths:string[]=[];const nextUploaded=new Map(uploaded);
   for(const [index,file] of files.entries()) {
    const data=new FormData();data.set("photo",file);
    const image=(await imageFile(data,"photo"))!;
    // The same retry uses the same immutable paths. Removing/reordering a draft starts a new entry.
    const path=nextUploaded.get(file) ?? `${user.id}/${orderId}/${kind}/${entry}-${index+1}.${image.extension}`;
    const {error}=await client.storage.from("order-media").upload(path,file,{contentType:image.type,upsert:false});
    if(error && !/already exists|duplicate/i.test(error.message)) throw new Error("We couldn't upload a photo. Please try again.");
    nextUploaded.set(file,path);setUploaded(new Map(nextUploaded));paths.push(path);
   }
   form.set("entry_id",entry);form.set("photo_paths",JSON.stringify(paths));
   const result=await submitOrderContent(state,form);
   if(result.success) {
    setSaved(kind==="review");setFiles([]);setBody("");setComments({});setUploaded(new Map());setEntry(crypto.randomUUID());
   }
   return result;
  } catch(error) {return {error:(error as Error).message};}
 }
 function changeFiles(next:File[]) {setFiles(next);setEntry(crypto.randomUUID());setUploaded(new Map());}
 if(saved) return <p className="message success-message">Thank you! Your private review has been saved.</p>;
 return <ActionForm action={submit} submitLabel={kind==="review"?"Submit private review":"Send message"}>
 <input type="hidden" name="order_id" value={orderId}/><input type="hidden" name="kind" value={kind}/>
 <Field label={kind==="review"?"Overall order feedback (optional)":"Message"}><textarea aria-label={kind==="review"?"Overall order feedback (optional)":"Message"} name="body" maxLength={kind==="review"?5000:3000} value={body} onChange={e=>setBody(e.currentTarget.value)} onInput={e=>setBody(e.currentTarget.value)}/></Field>
 {kind==="review" && unique.map(item=><Field key={item.product_id} label={`${item.title} (optional)`}><textarea aria-label={`${item.title} (optional)`} name={`item:${item.product_id}`} maxLength={3000} value={comments[item.product_id]??""} onChange={e=>{const value=e.currentTarget.value;setComments(current=>({...current,[item.product_id]:value}));}} onInput={e=>{const value=e.currentTarget.value;setComments(current=>({...current,[item.product_id]:value}));}}/></Field>)}
 <div className="media-picker"><label className="button button-outline">Choose photos<input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{const selected=Array.from(e.target.files??[]);e.target.value="";void add(selected);}}/></label>
 <label className="button button-outline">Take photo<input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{const selected=Array.from(e.target.files??[]);e.target.value="";void add(selected);}}/></label></div>
 <p className="field-hint">{files.length}/{maximum} photos. Optional. JPG, PNG or WebP, up to 5 MB each. Camera availability depends on your device.</p>
 <div className="content-photo-grid">{files.map((file,index)=><div key={index}><Preview file={file}/><button type="button" className="button button-small button-outline" onClick={()=>changeFiles(files.filter((_,i)=>i!==index))}>Remove photo {index+1}</button></div>)}</div>
 {error && <p role="alert" className="message error-message">{error}</p>}
 </ActionForm>;
}
