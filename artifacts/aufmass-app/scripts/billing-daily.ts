import { pool } from "@workspace/db";
import { runDailyBilling } from "../lib/billing/service";

async function main(): Promise<void> {
  try {
    const result = await runDailyBilling();
    console.log(JSON.stringify(result));
    const anthropicOk = [
      "provisional",
      "reconciled",
      "job_already_running",
    ].includes(result.anthropic.status);
    const moonshotOk = [
      "captured",
      "already_captured",
      "job_already_running",
    ].includes(result.moonshot.status);
    if (!anthropicOk || !moonshotOk) {
      // Scheduled Deployments must visibly fail so their configured retries
      // and alerting run; provider failures are still persisted before exit.
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

void main();
