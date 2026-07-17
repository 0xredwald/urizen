import { json, options } from "@/lib/api";
import { STRATEGIES } from "@/lib/strategies";

export const revalidate = 60;
export const OPTIONS = options;

/** GET /api/fund/strategies — the autonomous mandates the fund runs. */
export async function GET() {
  return json({ count: STRATEGIES.length, strategies: STRATEGIES });
}
