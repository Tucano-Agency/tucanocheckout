import { eq } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { offers, orders, products } from "@/infrastructure/db/schema";

export type PublicOrderStatus = {
  readonly orderId: string;
  readonly status: typeof orders.$inferSelect.status;
  readonly productName: string;
  readonly amountMinor: number;
  readonly currency: typeof orders.$inferSelect.currency;
};

export async function getPublicOrderStatus(
  db: Database,
  orderId: string,
): Promise<PublicOrderStatus | null> {
  const [row] = await db
    .select({
      order: orders,
      productName: products.name,
    })
    .from(orders)
    .innerJoin(offers, eq(orders.offerId, offers.id))
    .innerJoin(products, eq(offers.productId, products.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return null;

  return {
    orderId: row.order.id,
    status: row.order.status,
    productName: row.productName,
    amountMinor: row.order.totalAmountMinor,
    currency: row.order.currency,
  };
}
