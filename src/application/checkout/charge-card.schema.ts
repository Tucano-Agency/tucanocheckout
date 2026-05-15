import { z } from "zod";
import {
  checkoutCardSchema,
  checkoutCustomerSchema,
} from "./checkout-schemas";

export const chargeCardBodySchema = z.object({
  offerId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(128),
  customer: checkoutCustomerSchema,
  card: checkoutCardSchema,
});

export type ChargeCardBody = z.infer<typeof chargeCardBodySchema>;
