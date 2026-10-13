import { Field } from "@/components/ui";
import type { DeliveryAddress } from "@/types";

export function AddressFields({ address = {}, previousAddress }: { address?: Partial<DeliveryAddress>; previousAddress?: string }) {
  return <fieldset className="address-fields form-stack"><legend>Delivery address</legend>
    {previousAddress && !address.street_address && <p className="field-hint">Your previous address: {previousAddress}. Please enter it in the fields below.</p>}
    <Field label="Street Address"><input name="street_address" required maxLength={300} autoComplete="address-line1" placeholder="House No., Unit, Block/Lot, Street" defaultValue={address.street_address} /></Field>
    <Field label="Subdivision / District / Landmark"><input name="subdivision" maxLength={200} autoComplete="address-line2" placeholder="Subdivision, district, or nearby landmark" defaultValue={address.subdivision} /></Field>
    <p className="field-hint">Optional</p>
    <Field label="Barangay"><input name="barangay" required maxLength={100} autoComplete="address-level3" placeholder="Enter barangay" defaultValue={address.barangay} /></Field>
    <div className="field-row">
      <Field label="City / Municipality"><input name="city" required maxLength={100} autoComplete="address-level2" placeholder="Enter city or municipality" defaultValue={address.city} /></Field>
      <Field label="Province / Region"><input name="province" required maxLength={100} autoComplete="address-level1" placeholder="Enter province or region" defaultValue={address.province} /></Field>
    </div>
    <Field label="ZIP Code"><input name="zip_code" required type="text" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="postal-code" placeholder="Enter 4-digit ZIP code" defaultValue={address.zip_code} /></Field>
  </fieldset>;
}
