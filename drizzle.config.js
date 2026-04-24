import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.js",
  out: "./drizzle",

  dbCredentials:  {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        port: 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      },
});