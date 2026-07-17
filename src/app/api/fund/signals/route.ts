import { json, options } from "@/lib/api";
import { getSignals } from "@/lib/signals";

export const revalidate = 600;
export const OPTIONS = options;

// The fund's signal desk — real momentum/trend/RSI reads on the tokenized-stock universe.
export async function GET() {
  const signals = await getSignals();
  return json({
    updatedAt: new Date().toISOString(),
    note: "Technical reads (momentum, trend, RSI) on the tokenized-stock universe the fund trades. Not investment advice.",
    count: signals.length,
    signals,
  });
}
