import { z } from "zod";

export const chargePixBodySchema = z.object({
  offerId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(128),
  expiresInSeconds: z.number().int().min(300).max(86400).optional(),
  customer: z.object({
    email: z.string().email().max(255),
    name: z.string().min(1).max(255),
    phone: z.string().max(64).optional(),
    document: z
      .string()
      .regex(/^[\d]{11,14}$/, "CPF/CNPJ apenas dígitos (11 a 14)"),
  }),
});

export type ChargePixBody = z.infer<typeof chargePixBodySchema>;
