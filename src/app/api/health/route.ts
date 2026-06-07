import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

export async function GET() {
  const checks = {
    status: "ok" as "ok" | "degraded" | "error",
    timestamp: new Date().toISOString(),
    database: "unknown" as "ok" | "error",
    redis: "unknown" as "ok" | "error" | "unavailable",
  };

  // Database check
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
    checks.status = "degraded";
  }

  // Redis check
  try {
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "unavailable";
  }

  const statusCode = checks.status === "error" ? 503 : 200;
  return NextResponse.json(checks, { status: statusCode });
}
