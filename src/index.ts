import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import {
  authRouter,
  initializeAdmin,
  puzzlesRouter,
  progressRouter,
  adminPuzzlesRouter,
} from "./routes/index.js";

const app = express();

// Middleware
app.use(morgan("dev"));
app.use(helmet());
app.use(
  cors({
    origin:
      env.NODE_ENV === "production"
        ? ["https://your-domain.com"]
        : [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:19006",
          ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok!!", timestamp: new Date().toISOString() });
});

// Routes
app.use("/auth", authRouter);
app.use("/puzzles", puzzlesRouter);
app.use("/progress", progressRouter);
app.use("/admin/puzzles", adminPuzzlesRouter);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: env.NODE_ENV === "development" ? err.message : undefined,
    });
  },
);

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    await initializeAdmin();

    app.listen(Number(env.PORT), () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT}`);
      console.log(`📚 Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
