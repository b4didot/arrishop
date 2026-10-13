import type { DeliveryAddress } from "@/types";

export function DeliveryAddressDetails({ address, fallback }: { address?: Partial<DeliveryAddress>; fallback: string }) {
  if (!address?.street_address) return <span>{fallback}</span>;
  const fields = [
    ["Street Address", address.street_address],
    ["Subdivision / District / Landmark", address.subdivision],
    ["Barangay", address.barangay],
    ["City / Municipality", address.city],
    ["Province / Region", address.province],
    ["ZIP Code", address.zip_code],
  ];
  return <span className="delivery-address-lines">{fields.filter(([, value]) => value).map(([label, value]) => <span key={label}><strong>{label}:</strong> {value}</span>)}</span>;
}
