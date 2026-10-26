import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deliveryAvailability } from "@/lib/order-workflows";
import { AdminCalendar } from "@/components/admin-calendar";
import { PageHeading } from "@/components/ui";
export default async function CalendarPage(){
 await requireAdmin();const client=await createClient();
 const [days,settings,configured]=await Promise.all([deliveryAvailability(),client.from("delivery_settings").select("*").eq("id",1).single(),client.from("delivery_days").select("*").order("delivery_date")]);
 if(settings.error||configured.error) throw new Error("We couldn't load the delivery calendar.");
 return <><PageHeading eyebrow="PLAN THE BAKING" title="Delivery calendar" description="Open delivery days, set capacity, and choose how far ahead customers must order."/><AdminCalendar days={days} settings={settings.data} configured={configured.data??[]}/></>;
}
