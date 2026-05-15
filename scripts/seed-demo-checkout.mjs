/**
 * Seed mínimo para testar a UI de checkout localmente.
 * DATABASE_URL vem do .env via npm (Node 20+): npm run seed:demo
 * Ou: DATABASE_URL='postgresql://...' npm run seed:demo
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL");
  process.exit(1);
}

const sql = postgres(url);

const tenantId = crypto.randomUUID();
const productId = crypto.randomUUID();
const offerId = crypto.randomUUID();

await sql`
  INSERT INTO tenants (id, name, slug, support_email, platform_subscription_status)
  VALUES (${tenantId}, 'Demo Produtor', 'demo', 'suporte@demo.local', 'active')
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`;

const [tenant] = await sql`
  SELECT id FROM tenants WHERE slug = 'demo' LIMIT 1
`;

const tid = tenant?.id ?? tenantId;

await sql`
  INSERT INTO products (id, tenant_id, name, description, kind, is_active)
  VALUES (
    ${productId},
    ${tid},
    'Curso Lançamento',
    'Acesso completo ao treinamento premium.',
    'digital',
    true
  )
  ON CONFLICT DO NOTHING
`;

const [product] = await sql`
  SELECT id FROM products WHERE tenant_id = ${tid} AND name = 'Curso Lançamento' LIMIT 1
`;

const pid = product?.id ?? productId;

await sql`
  INSERT INTO offers (
    id, tenant_id, product_id, pricing_mode, amount_minor, currency,
    public_slug, is_active
  )
  VALUES (
    ${offerId},
    ${tid},
    ${pid},
    'one_time',
    9700,
    'BRL',
    'produto-lancamento',
    true
  )
  ON CONFLICT DO NOTHING
`;

console.log("Seed OK.");
console.log("Checkout: http://localhost:3000/checkout/demo/produto-lancamento");
console.log("Configure tenant_gateways + TUCANO_GATEWAY_MASTER_KEY para cobranças reais.");

await sql.end();
