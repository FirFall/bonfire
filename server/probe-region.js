// Temporary probe: find which Supabase pooler region serves this project (deleted after).
const { Client } = require("pg");
const REF = "xmansccwyxtbbhyvnijt";
const PW = "TS_23e6r7&,BT&5";
const REGIONS = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-west-1", "eu-west-2", "eu-central-1", "ap-southeast-1", "ap-northeast-1", "ap-southeast-2"];

(async () => {
  for (const region of REGIONS) {
    for (const port of [5432, 6543]) {
      const client = new Client({
        host: `aws-0-${region}.pooler.supabase.com`,
        port,
        user: `postgres.${REF}`,
        password: PW,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      });
      const t0 = Date.now();
      try {
        await client.connect();
        const r = await client.query("SELECT current_database() AS db, version() AS v");
        console.log(`WORKS: ${region}:${port} (${Date.now() - t0}ms) -> ${r.rows[0].db}`);
        await client.end();
        process.exit(0);
      } catch (e) {
        console.log(`no: ${region}:${port} - ${e.message.split("\n")[0]}`);
        try { await client.end(); } catch {}
      }
    }
  }
  console.log("NONE WORKED");
  process.exit(1);
})();
