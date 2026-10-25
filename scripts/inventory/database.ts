// SELECT-only drift and baseline evidence; no introspection files in lib/db.
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { pool } from "../../lib/db/src/index";
import * as schema from "../../lib/db/src/schema/index";
const require = createRequire(new URL("../../lib/db/package.json", import.meta.url));
const { is } = require("drizzle-orm");
const { PgTable, getTableConfig, isPgEnum } = require("drizzle-orm/pg-core");
const client = await pool.connect();
try {
  await client.query("BEGIN READ ONLY");
  const actual = (await client.query("SELECT table_name,column_name,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
  const expected = Object.values(schema).filter(x=>is(x,PgTable)).map(x=>getTableConfig(x));
  const normalize = (s: string) => s.replace(/\"public\"\./g,"").replaceAll('"',"").replace("timestamp with time zone","timestamptz").replace("timestamp without time zone","timestamp").replace("double precision","float8").replace("integer","int4").replace("boolean","bool");
  const differences: unknown[] = [];
  for (const table of expected) for (const col of table.columns) {
    const dbcol = actual.find(r=>r.table_name===table.name && r.column_name===col.name);
    if (!dbcol) differences.push({table:table.name,column:col.name,problem:"MISSING"});
    else {
      const wanted = normalize(col.getSQLType());
      if (wanted !== dbcol.udt_name) differences.push({table:table.name,column:col.name,problem:"TYPE",expected:wanted,actual:dbcol.udt_name});
      if (col.notNull !== (dbcol.is_nullable==="NO")) differences.push({table:table.name,column:col.name,problem:"NULLABILITY",expectedNotNull:col.notNull,actual:dbcol.is_nullable});
    }
  }
  const enumRows = (await client.query("SELECT t.typname, e.enumlabel, e.enumsortorder FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON t.typnamespace=n.oid WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder")).rows;
  const enums = Object.values(schema).filter(x=>isPgEnum(x)).map((e: any)=>({name:e.enumName,expected:e.enumValues,actual:enumRows.filter(r=>r.typname===e.enumName).map(r=>r.enumlabel)}));
  for (const e of enums) if (JSON.stringify(e.expected)!==JSON.stringify(e.actual)) differences.push({enum:e.name,problem:"ENUM",expected:e.expected,actual:e.actual});
  const ready = (await client.query("SELECT id,measurement FROM projects WHERE status='model_ready' ORDER BY id")).rows;
  await writeFile("scripts/inventory/ready-projects.json", JSON.stringify(ready,null,2)+"\n");
  const report = {checkedAt:new Date().toISOString(),method:"BEGIN READ ONLY; information_schema columns and pg_enum compared with live Drizzle table/enum metadata; no push, no pull-generated workspace files.",expectedTables:expected.map(t=>({name:t.name,columns:t.columns.length})),actualColumns:actual,enumChecks:enums,differences,scopeLimit:"Compares required tables/columns, native types, nullability and enum order/values. Does not certify index/default/check/FK expression semantic equivalence."};
  await writeFile("scripts/inventory/db-drift.json", JSON.stringify(report,null,2)+"\n");
  await client.query("COMMIT");
  console.log(JSON.stringify({tables:expected.length,columns:actual.length,readyProjects:ready.length,differences},null,2));
} finally { client.release(); await pool.end(); }
