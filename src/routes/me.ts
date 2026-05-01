import { Router, Response } from "express";
import { UserProgress } from "../models/UserProgress.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /me/stats
 * Lifetime + this-week stats for the current user.
 * Time-played is derived from createdAt → completedAt deltas on completed
 * puzzles (we don't record per-piece timing, so this approximates "active
 * play time"; long-paused sessions inflate it but it's good enough for the
 * profile screen).
 */
router.get("/stats", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const completed = await UserProgress.find({ userId, isCompleted: true })
      .select({ completedAt: 1, createdAt: 1 })
      .lean();

    let lifetimeMs = 0;
    let thisWeekMs = 0;
    let thisWeekCount = 0;

    const now = Date.now();
    const startOfThisWeek = now - 7 * DAY_MS;

    for (const p of completed) {
      if (!p.completedAt) continue;
      const span = Math.max(0, p.completedAt.getTime() - p.createdAt.getTime());
      lifetimeMs += span;
      if (p.completedAt.getTime() >= startOfThisWeek) {
        thisWeekMs += span;
        thisWeekCount += 1;
      }
    }

    const streakDays = computeStreak(completed.map((p) => p.completedAt).filter(Boolean) as Date[]);

    res.json({
      lifetime: {
        solved: completed.length,
        streakDays,
        timePlayedSeconds: Math.round(lifetimeMs / 1000),
      },
      thisWeek: {
        timePlayedSeconds: Math.round(thisWeekMs / 1000),
        completedCount: thisWeekCount,
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Returns the count of consecutive UTC-days, ending today or yesterday, that
// have at least one completed puzzle. Yesterday is allowed as the anchor so
// today not having played yet doesn't reset a streak the user actually has.
function computeStreak(dates: Date[]): number {
  if (!dates.length) return 0;

  const dayKeys = new Set<string>();
  for (const d of dates) {
    dayKeys.add(toUtcDayKey(d));
  }

  const todayKey = toUtcDayKey(new Date());
  const yesterdayKey = toUtcDayKey(new Date(Date.now() - DAY_MS));

  let cursor: Date;
  if (dayKeys.has(todayKey)) cursor = new Date();
  else if (dayKeys.has(yesterdayKey)) cursor = new Date(Date.now() - DAY_MS);
  else return 0;

  let streak = 0;
  while (dayKeys.has(toUtcDayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

function toUtcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

export const meRouter = router;
