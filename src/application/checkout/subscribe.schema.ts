import { z } from "zod";
import {
  checkoutCardSchema,
  checkoutCustomerSchema,
} from "./checkout-schemas";

export const subscribeBodySchema = z.object({
  offerId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(128),
  customer: checkoutCustomerSchema,
  card: checkoutCardSchema,
});

export type SubscribeBody = z.infer<typeof subscribeBodySchema>;
