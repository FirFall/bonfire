// Temporary connectivity smoke test against Supabase (deleted after testing).
require("./env").load();
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const r = await pool.query("SELECT current_database() AS db, current_user AS usr");
  console.log("CONNECTED:", JSON.stringify(r.rows[0]));
  await pool.end();
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
