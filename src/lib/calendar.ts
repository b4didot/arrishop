export function deliveryDate(value: string | null) {
 return value ? new Intl.DateTimeFormat("en-PH",{weekday:"short",month:"long",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(value+"T00:00:00Z")) : "Not scheduled";
}
