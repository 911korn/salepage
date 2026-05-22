import dotenv from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

// dotenv/config only loads `.env`. We keep secrets in `.env.local` (gitignored)
// so explicitly load that here. Last call wins, so `.env.local` overrides `.env`.
dotenv.config({ path: path.join(__dirname, ".env"), override: false });
dotenv.config({ path: path.join(__dirname, ".env.local"), override: true });

const directUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!directUrl) {
  throw new Error(
    "DATABASE_URL / DATABASE_URL_UNPOOLED missing — check .env.local",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "prisma/schema.prisma"),
  migrations: {
    path: path.join(__dirname, "prisma/migrations"),
  },
  datasource: {
    url: directUrl,
  },
});
