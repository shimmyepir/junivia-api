import { Router, Response } from "express";
import { z } from "zod";
import { Puzzle } from "../models/Puzzle.js";
import { UserProgress } from "../models/UserProgress.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Validation schema for progress update
const updateProgressSchema = z.object({
  placedPieceIds: z.array(z.string()),
  // Optional deltas the client accumulated since its last save. The server
  // adds them to the lifetime totals on this progress doc.
  additionalSeconds: z.coerce.number().min(0).max(86_400).optional(),
  additionalMoves: z.coerce.number().int().min(0).max(10_000).optional(),
});

/**
 * GET /progress
 * Get all progress for the current user
 */
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const progressRecords = await UserProgress.find({ userId })
      .populate("puzzleId", "title levelOrder gridRows gridCols")
      .lean();

    res.json({ progress: progressRecords });
  } catch (error) {
    console.error("Get all progress error:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

/**
 * GET /progress/:puzzleId
 * Get progress for a specific puzzle
 */
router.get(
  "/:puzzleId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { puzzleId } = req.params;

      const progress = await UserProgress.findOne({ userId, puzzleId }).lean();

      if (!progress) {
        res.json({
          progress: null,
          message: "No progress found for this puzzle",
        });
        return;
      }

      res.json({
        progress: {
          placedPieceIds: progress.placedPieceIds,
          isCompleted: progress.isCompleted,
          completedAt: progress.completedAt,
          level: progress.level ?? null,
          gridRows: progress.gridRows ?? null,
          gridCols: progress.gridCols ?? null,
          timePlayedSeconds: progress.timePlayedSeconds ?? 0,
          moves: progress.moves ?? 0,
          lastPlayedAt:
            progress.lastPlayedAt ?? progress.updatedAt ?? null,
        },
      });
    } catch (error) {
      console.error("Get progress error:", error);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  },
);

/**
 * PUT /progress/:puzzleId
 * Save or update progress for a puzzle
 */
router.put(
  "/:puzzleId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { puzzleId } = req.params;

      const validation = updateProgressSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { placedPieceIds, additionalSeconds, additionalMoves } =
        validation.data;

      // Verify the puzzle exists
      const puzzle = await Puzzle.findById(puzzleId).lean();

      if (!puzzle) {
        res.status(404).json({ error: "Puzzle not found" });
        return;
      }

      // Find existing progress to know if completedAt should be set vs kept,
      // and to read the user's chosen grid (their selected difficulty level).
      const existing = await UserProgress.findOne({ userId, puzzleId });

      // Total pieces is based on the grid the user is actually playing — their
      // chosen level if set, otherwise the puzzle's admin-defined grid.
      const rows = existing?.gridRows ?? puzzle.gridRows;
      const cols = existing?.gridCols ?? puzzle.gridCols;
      const totalPieces = rows * cols;

      // Check if puzzle is completed
      const isCompleted = placedPieceIds.length >= totalPieces;
      const now = new Date();
      const completedAt = isCompleted
        ? existing?.completedAt ?? now
        : null;

      const inc: Record<string, number> = {};
      if (additionalSeconds && additionalSeconds > 0) {
        inc.timePlayedSeconds = additionalSeconds;
      }
      if (additionalMoves && additionalMoves > 0) {
        inc.moves = additionalMoves;
      }

      const update: Record<string, unknown> = {
        $set: {
          placedPieceIds,
          isCompleted,
          completedAt,
          lastPlayedAt: now,
        },
      };
      if (Object.keys(inc).length > 0) {
        update.$inc = inc;
      }
      // $inc on a missing field initializes it to 0 then increments, so we
      // don't need $setOnInsert. (Mixing $inc + $setOnInsert on the same
      // field would error.)

      const progress = await UserProgress.findOneAndUpdate(
        { userId, puzzleId },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      res.json({
        message: isCompleted ? "Puzzle completed!" : "Progress saved",
        progress: {
          placedPieceIds: progress.placedPieceIds,
          isCompleted: progress.isCompleted,
          completedAt: progress.completedAt,
          level: progress.level ?? null,
          gridRows: progress.gridRows ?? null,
          gridCols: progress.gridCols ?? null,
          timePlayedSeconds: progress.timePlayedSeconds,
          moves: progress.moves,
          lastPlayedAt: progress.lastPlayedAt,
        },
      });
    } catch (error) {
      console.error("Update progress error:", error);
      res.status(500).json({ error: "Failed to save progress" });
    }
  },
);

// Validation schema for setting the chosen difficulty level.
const setLevelSchema = z.object({
  level: z.string().min(1).max(40),
  gridRows: z.coerce.number().int().min(2).max(20),
  gridCols: z.coerce.number().int().min(2).max(20),
});

/**
 * PUT /progress/:puzzleId/level
 * Set the difficulty level (and resulting grid) the user wants to play this
 * puzzle at. Changing to a different grid resets the in-progress pieces for
 * this puzzle, since piece IDs are grid-specific. Re-selecting the same grid
 * is a no-op for existing progress.
 */
router.put(
  "/:puzzleId/level",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { puzzleId } = req.params;

      const validation = setLevelSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { level, gridRows, gridCols } = validation.data;

      const puzzle = await Puzzle.findById(puzzleId).lean();
      if (!puzzle) {
        res.status(404).json({ error: "Puzzle not found" });
        return;
      }

      const existing = await UserProgress.findOne({ userId, puzzleId });

      // The grid the user was previously playing (their chosen level, or the
      // puzzle default when they hadn't picked one yet).
      const prevRows = existing?.gridRows ?? puzzle.gridRows;
      const prevCols = existing?.gridCols ?? puzzle.gridCols;
      const gridChanged = prevRows !== gridRows || prevCols !== gridCols;

      const set: Record<string, unknown> = {
        level,
        gridRows,
        gridCols,
        lastPlayedAt: new Date(),
      };

      // A different grid invalidates the placed pieces — start the puzzle over.
      if (gridChanged) {
        set.placedPieceIds = [];
        set.isCompleted = false;
        set.completedAt = null;
      }

      const progress = await UserProgress.findOneAndUpdate(
        { userId, puzzleId },
        { $set: set },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      res.json({
        message: "Level set",
        reset: gridChanged,
        progress: {
          placedPieceIds: progress.placedPieceIds,
          isCompleted: progress.isCompleted,
          completedAt: progress.completedAt,
          level: progress.level ?? null,
          gridRows: progress.gridRows ?? null,
          gridCols: progress.gridCols ?? null,
          timePlayedSeconds: progress.timePlayedSeconds ?? 0,
          moves: progress.moves ?? 0,
          lastPlayedAt: progress.lastPlayedAt,
        },
      });
    } catch (error) {
      console.error("Set level error:", error);
      res.status(500).json({ error: "Failed to set level" });
    }
  },
);

/**
 * DELETE /progress/:puzzleId
 * Reset progress for a puzzle
 */
router.delete(
  "/:puzzleId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { puzzleId } = req.params;

      await UserProgress.findOneAndDelete({ userId, puzzleId });

      res.json({ message: "Progress reset successfully" });
    } catch (error) {
      console.error("Reset progress error:", error);
      res.status(500).json({ error: "Failed to reset progress" });
    }
  },
);

export const progressRouter = router;
