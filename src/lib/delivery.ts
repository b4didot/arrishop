export type DeliveryCarrier = "jnt" | "lalamove";
export const deliveryCarriers = { jnt: "J&T (JNT)", lalamove: "Lalamove" };
export function deliveryCarrier(value: unknown): DeliveryCarrier {
  if (value !== "jnt" && value !== "lalamove") throw new Error("Please choose J&T or Lalamove for delivery.");
  return value;
}
export function shippingFee(carrier: DeliveryCarrier): number { return carrier === "jnt" ? 9900 : 0; }
