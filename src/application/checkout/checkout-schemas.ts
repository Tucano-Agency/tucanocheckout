import { z } from "zod";
import { isValidCpfCnpj } from "@/lib/validate-cpf-cnpj";

export const checkoutCustomerSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  phone: z.string().max(64).optional(),
  document: z
    .string()
    .regex(/^[\d]{11,14}$/, "CPF/CNPJ apenas dígitos (11 a 14)")
    .refine((v) => isValidCpfCnpj(v), {
      message: "CPF ou CNPJ inválido (confira os dígitos verificadores).",
    }),
});

export const checkoutCardSchema = z.object({
  holderName: z.string().min(2).max(64),
  number: z.string().regex(/^\d{13,19}$/),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(2024).max(2100),
  cvv: z.string().regex(/^\d{3,4}$/),
  billingAddress: z
    .object({
      line1: z.string().min(1).max(256),
      line2: z.string().max(128).optional(),
      city: z.string().min(1).max(64),
      region: z.string().min(1).max(8),
      postalCode: z.string().min(1).max(16),
      country: z.string().length(2),
    })
    .optional(),
});
