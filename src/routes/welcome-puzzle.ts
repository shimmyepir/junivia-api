import { Router, Response } from "express";
import { WelcomePuzzle } from "../models/WelcomePuzzle.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

/**
 * GET /welcome-puzzle
 * Returns the singleton welcome puzzle for onboarding. 404 if not yet
 * configured.
 */
router.get("/", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const puzzle = await WelcomePuzzle.findOne().lean();
    if (!puzzle) {
      res.status(404).json({ error: "Welcome puzzle not configured" });
      return;
    }
    res.json({
      welcomePuzzle: {
        id: puzzle._id,
        title: puzzle.title,
        imageUrl: puzzle.imageUrl,
        audiobookUrl: puzzle.audiobookUrl || null,
        audioTitle: puzzle.audioTitle || null,
        gridRows: 3,
        gridCols: 3,
      },
    });
  } catch (error) {
    console.error("Get welcome puzzle error:", error);
    res.status(500).json({ error: "Failed to fetch welcome puzzle" });
  }
});

export const welcomePuzzleRouter = router;
