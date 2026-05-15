import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://localhost:5432/tucano_checkout";

const client = postgres(connectionString, { max: 1 });

export const db = drizzle(client, { schema });

export type Database = typeof db;
