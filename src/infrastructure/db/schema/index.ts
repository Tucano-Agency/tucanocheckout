import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  bigint,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/** Assinatura do Tenant conosco (SaaS) — sem % sobre vendas. */
export const tenantPlatformSubscriptionStatusEnum = pgEnum(
  "tenant_platform_subscription_status",
  ["active", "trial", "suspended_due_to_billing", "cancelled"],
);

export const gatewayProviderEnum = pgEnum("gateway_provider", [
  "pagarme",
  "asaas",
]);

export const currencyCodeEnum = pgEnum("currency_code", ["BRL", "USD", "EUR"]);

export const checkoutLocaleEnum = pgEnum("checkout_locale", [
  "pt_BR",
  "en_US",
  "es_ES",
]);

export const productKindEnum = pgEnum("product_kind", [
  "digital",
  "service",
  "bundle",
]);

export const planIntervalEnum = pgEnum("plan_interval", [
  "day",
  "week",
  "month",
  "year",
]);

export const offerPricingModeEnum = pgEnum("offer_pricing_mode", [
  "one_time",
  "subscription",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "pending_payment",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "paused",
  "cancelled",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "card_charge",
  "pix_charge",
  "subscription_create",
  "subscription_cycle",
  "refund",
  "chargeback",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
]);

export const splitRecipientKindEnum = pgEnum("split_recipient_kind", [
  "affiliate",
  "coproducer",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "card",
  "pix",
  "boleto",
  "wallet",
]);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    legalName: varchar("legal_name", { length: 255 }),
    supportEmail: varchar("support_email", { length: 255 }).notNull(),
    platformSubscriptionStatus:
      tenantPlatformSubscriptionStatusEnum("platform_subscription_status")
        .notNull()
        .default("trial"),
    platformCurrentPeriodEndAt: timestamp("platform_current_period_end_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("tenants_slug_uidx").on(t.slug)],
);

export const tenantGateways = pgTable(
  "tenant_gateways",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: gatewayProviderEnum("provider").notNull(),
    /** Ciphertext + metadados (IV, alg); nunca plaintext. */
    encryptedCredentialBlob: text("encrypted_credential_blob").notNull(),
    encryptionKeyVersion: integer("encryption_key_version").notNull().default(1),
    isDefault: boolean("is_default").notNull().default(false),
    /** Moedas que este gateway atende para roteamento (BYOG). */
    supportedCurrencies: jsonb("supported_currencies")
      .$type<("BRL" | "USD" | "EUR")[]>()
      .notNull()
      .default([]),
    lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tenant_gateways_tenant_id_idx").on(t.tenantId),
    uniqueIndex("tenant_gateways_tenant_provider_uidx").on(
      t.tenantId,
      t.provider,
    ),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    phone: varchar("phone", { length: 64 }),
    document: varchar("document", { length: 32 }),
    gatewayCustomerRefs: jsonb("gateway_customer_refs")
      .$type<Partial<Record<"pagarme" | "asaas", string>>>()
      .default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("customers_tenant_id_idx").on(t.tenantId),
    uniqueIndex("customers_tenant_email_uidx").on(t.tenantId, t.email),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    kind: productKindEnum("kind").notNull().default("digital"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("products_tenant_id_idx").on(t.tenantId)],
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    interval: planIntervalEnum("interval").notNull(),
    intervalCount: integer("interval_count").notNull().default(1),
    trialDays: integer("trial_days").notNull().default(0),
    /** IDs do plano no gateway BYOG do tenant (`plan_xxx` Pagar.me, etc.). */
    gatewayPlanRefs: jsonb("gateway_plan_refs")
      .$type<Partial<Record<"pagarme" | "asaas", string>>>()
      .default({}),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("plans_product_id_idx").on(t.productId)],
);

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    planId: uuid("plan_id").references(() => plans.id, {
      onDelete: "restrict",
    }),
    pricingMode: offerPricingModeEnum("pricing_mode").notNull(),
    /** Valor em menor unidade da moeda (centavos). */
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: currencyCodeEnum("currency").notNull(),
    defaultLocale: checkoutLocaleEnum("default_locale").notNull().default("pt_BR"),
    /** Slug público para URL do checkout. */
    publicSlug: varchar("public_slug", { length: 160 }).notNull(),
    /** Se true, resolve moeda/idioma por IP/geo na camada de aplicação. */
    useGeoForCurrencyLocale: boolean("use_geo_for_currency_locale")
      .notNull()
      .default(false),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("offers_tenant_id_idx").on(t.tenantId),
    uniqueIndex("offers_tenant_public_slug_uidx").on(t.tenantId, t.publicSlug),
    check(
      "offers_pricing_mode_plan_ck",
      sql`
        (${t.pricingMode} = 'subscription' AND ${t.planId} IS NOT NULL)
        OR
        (${t.pricingMode} = 'one_time' AND ${t.planId} IS NULL)
      `,
    ),
  ],
);

export const orderBumps = pgTable(
  "order_bumps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    bumpProductId: uuid("bump_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 255 }).notNull(),
    subtitle: text("subtitle"),
    /** Se null, usa preço padrão do produto/oferta secundária configurada na app. */
    amountMinorOverride: bigint("amount_minor_override", { mode: "number" }),
    currencyOverride: currencyCodeEnum("currency_override"),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("order_bumps_offer_id_idx").on(t.offerId)],
);

export const upsellFlows = pgTable(
  "upsell_flows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    /** Oferta que dispara o fluxo após compra (opcional). */
    triggerOfferId: uuid("trigger_offer_id").references(() => offers.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("upsell_flows_tenant_id_idx").on(t.tenantId)],
);

export const upsellFlowSteps = pgTable(
  "upsell_flow_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => upsellFlows.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    targetOfferId: uuid("target_offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "restrict" }),
    /** TTL do token para cobrança 1-clique (segundos). */
    oneClickTokenTtlSeconds: integer("one_click_token_ttl_seconds")
      .notNull()
      .default(900),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("upsell_flow_steps_flow_id_idx").on(t.flowId),
    uniqueIndex("upsell_flow_steps_flow_order_uidx").on(t.flowId, t.stepOrder),
  ],
);

export const affiliates = pgTable(
  "affiliates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    defaultCommissionBps: integer("default_commission_bps").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("affiliates_tenant_id_idx").on(t.tenantId),
    uniqueIndex("affiliates_tenant_code_uidx").on(t.tenantId, t.code),
  ],
);

export const affiliateTracking = pgTable(
  "affiliate_tracking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id").references(() => offers.id, {
      onDelete: "set null",
    }),
    trackingCode: varchar("tracking_code", { length: 128 }).notNull(),
    landingQuerySnapshot: jsonb("landing_query_snapshot")
      .$type<Record<string, string>>()
      .default({}),
    cookieTtlDays: integer("cookie_ttl_days").notNull().default(30),
    clicks: integer("clicks").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    lastClickedAt: timestamp("last_clicked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("affiliate_tracking_affiliate_id_idx").on(t.affiliateId),
    uniqueIndex("affiliate_tracking_code_uidx").on(t.trackingCode),
  ],
);

export const splitRules = pgTable(
  "split_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    recipientKind: splitRecipientKindEnum("recipient_kind").notNull(),
    affiliateId: uuid("affiliate_id").references(() => affiliates.id, {
      onDelete: "cascade",
    }),
    /** Co-produtor = outro Tenant; repasse direto, sem taxa da plataforma. */
    coproducerTenantId: uuid("coproducer_tenant_id").references(
      () => tenants.id,
      { onDelete: "cascade" },
    ),
    /** 0–10000 = 0%–100%. */
    percentageBps: integer("percentage_bps").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("split_rules_offer_id_idx").on(t.offerId),
    check(
      "split_rules_recipient_ck",
      sql`
        (${t.recipientKind} = 'affiliate' AND ${t.affiliateId} IS NOT NULL AND ${t.coproducerTenantId} IS NULL)
        OR
        (${t.recipientKind} = 'coproducer' AND ${t.coproducerTenantId} IS NOT NULL AND ${t.affiliateId} IS NULL)
      `,
    ),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "restrict" }),
    affiliateTrackingId: uuid("affiliate_tracking_id").references(
      () => affiliateTracking.id,
      { onDelete: "set null" },
    ),
    status: orderStatusEnum("status").notNull().default("draft"),
    currency: currencyCodeEnum("currency").notNull(),
    subtotalAmountMinor: bigint("subtotal_amount_minor", { mode: "number" })
      .notNull(),
    totalAmountMinor: bigint("total_amount_minor", { mode: "number" }).notNull(),
    /** Chave de idempotência para criação do pedido / primeira cobrança. */
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("orders_tenant_id_idx").on(t.tenantId),
    uniqueIndex("orders_idempotency_key_uidx").on(t.idempotencyKey),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "restrict" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    gatewayProvider: gatewayProviderEnum("gateway_provider").notNull(),
    gatewaySubscriptionId: varchar("gateway_subscription_id", {
      length: 255,
    }).notNull(),
    status: subscriptionStatusEnum("status").notNull().default("incomplete"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("subscriptions_customer_id_idx").on(t.customerId),
    uniqueIndex("subscriptions_gateway_ref_uidx").on(
      t.gatewayProvider,
      t.gatewaySubscriptionId,
    ),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    subscriptionId: uuid("subscription_id").references(
      () => subscriptions.id,
      { onDelete: "set null" },
    ),
    type: transactionTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").notNull().default("pending"),
    paymentMethod: paymentMethodEnum("payment_method"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: currencyCodeEnum("currency").notNull(),
    gatewayProvider: gatewayProviderEnum("gateway_provider").notNull(),
    gatewayChargeId: varchar("gateway_charge_id", { length: 255 }),
    /** Obrigatório em toda operação financeira mutável. */
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    failureReason: text("failure_reason"),
    /** Evitar armazenar PCI; apenas metadados não sensíveis. */
    gatewayMetadata: jsonb("gateway_metadata")
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("transactions_order_id_idx").on(t.orderId),
    index("transactions_subscription_id_idx").on(t.subscriptionId),
    index("transactions_gateway_charge_id_idx").on(
      t.gatewayProvider,
      t.gatewayChargeId,
    ),
    uniqueIndex("transactions_idempotency_key_uidx").on(t.idempotencyKey),
  ],
);

export const dunningConfigs = pgTable(
  "dunning_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Se definido, sobrescreve regras globais do tenant para o plano. */
    planId: uuid("plan_id").references(() => plans.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    maxRetryAttempts: integer("max_retry_attempts").notNull().default(4),
    /** Intervalos entre tentativas (horas). */
    retryIntervalsHours: jsonb("retry_intervals_hours")
      .$type<number[]>()
      .notNull()
      .default([24, 48, 72, 168]),
    cancelSubscriptionAfterDays: integer("cancel_subscription_after_days")
      .notNull()
      .default(21),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("dunning_configs_tenant_id_idx").on(t.tenantId),
    uniqueIndex("dunning_configs_tenant_default_uidx")
      .on(t.tenantId)
      .where(sql`${t.planId} IS NULL`),
    uniqueIndex("dunning_configs_tenant_plan_uidx")
      .on(t.tenantId, t.planId)
      .where(sql`${t.planId} IS NOT NULL`),
  ],
);

/* ---------- Relations (consultas tipadas) ---------- */

export const tenantsRelations = relations(tenants, ({ many }) => ({
  gateways: many(tenantGateways),
  customers: many(customers),
  products: many(products),
  offers: many(offers),
  upsellFlows: many(upsellFlows),
  affiliates: many(affiliates),
  dunningConfigs: many(dunningConfigs),
  orders: many(orders),
  subscriptions: many(subscriptions),
  transactions: many(transactions),
}));

export const tenantGatewaysRelations = relations(tenantGateways, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantGateways.tenantId],
    references: [tenants.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  orders: many(orders),
  subscriptions: many(subscriptions),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  plans: many(plans),
  offers: many(offers),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  product: one(products, {
    fields: [plans.productId],
    references: [products.id],
  }),
  offers: many(offers),
  dunningConfigs: many(dunningConfigs),
}));

export const offersRelations = relations(offers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [offers.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [offers.productId],
    references: [products.id],
  }),
  plan: one(plans, {
    fields: [offers.planId],
    references: [plans.id],
  }),
  orderBumps: many(orderBumps),
  splitRules: many(splitRules),
  orders: many(orders),
}));

export const orderBumpsRelations = relations(orderBumps, ({ one }) => ({
  offer: one(offers, {
    fields: [orderBumps.offerId],
    references: [offers.id],
  }),
  bumpProduct: one(products, {
    fields: [orderBumps.bumpProductId],
    references: [products.id],
  }),
}));

export const upsellFlowsRelations = relations(upsellFlows, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [upsellFlows.tenantId],
    references: [tenants.id],
  }),
  triggerOffer: one(offers, {
    fields: [upsellFlows.triggerOfferId],
    references: [offers.id],
  }),
  steps: many(upsellFlowSteps),
}));

export const upsellFlowStepsRelations = relations(upsellFlowSteps, ({ one }) => ({
  flow: one(upsellFlows, {
    fields: [upsellFlowSteps.flowId],
    references: [upsellFlows.id],
  }),
  targetOffer: one(offers, {
    fields: [upsellFlowSteps.targetOfferId],
    references: [offers.id],
  }),
}));

export const affiliatesRelations = relations(affiliates, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [affiliates.tenantId],
    references: [tenants.id],
  }),
  trackingLinks: many(affiliateTracking),
  splitRules: many(splitRules),
}));

export const affiliateTrackingRelations = relations(
  affiliateTracking,
  ({ one, many }) => ({
    affiliate: one(affiliates, {
      fields: [affiliateTracking.affiliateId],
      references: [affiliates.id],
    }),
    offer: one(offers, {
      fields: [affiliateTracking.offerId],
      references: [offers.id],
    }),
    orders: many(orders),
  }),
);

export const splitRulesRelations = relations(splitRules, ({ one }) => ({
  offer: one(offers, {
    fields: [splitRules.offerId],
    references: [offers.id],
  }),
  affiliate: one(affiliates, {
    fields: [splitRules.affiliateId],
    references: [affiliates.id],
  }),
  coproducerTenant: one(tenants, {
    fields: [splitRules.coproducerTenantId],
    references: [tenants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  offer: one(offers, {
    fields: [orders.offerId],
    references: [offers.id],
  }),
  affiliateTracking: one(affiliateTracking, {
    fields: [orders.affiliateTrackingId],
    references: [affiliateTracking.id],
  }),
  transactions: many(transactions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [subscriptions.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [subscriptions.customerId],
    references: [customers.id],
  }),
  offer: one(offers, {
    fields: [subscriptions.offerId],
    references: [offers.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [transactions.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [transactions.orderId],
    references: [orders.id],
  }),
  subscription: one(subscriptions, {
    fields: [transactions.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const dunningConfigsRelations = relations(dunningConfigs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [dunningConfigs.tenantId],
    references: [tenants.id],
  }),
  plan: one(plans, {
    fields: [dunningConfigs.planId],
    references: [plans.id],
  }),
}));
