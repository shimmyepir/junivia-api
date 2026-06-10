import mongoose, { Document, Schema } from 'mongoose';

export interface IUserProgress extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  puzzleId: mongoose.Types.ObjectId;
  placedPieceIds: string[]; // Array of piece IDs that have been correctly placed
  isCompleted: boolean;
  completedAt: Date | null;
  // The difficulty level the user chose for this puzzle and the resulting
  // grid they're playing. When unset, the puzzle's own gridRows/gridCols
  // (set by the admin) are the source of truth.
  level: string | null;
  gridRows: number | null;
  gridCols: number | null;
  // Lifetime counters that accumulate across every play session for this
  // user-puzzle pair.
  timePlayedSeconds: number;
  moves: number;
  lastPlayedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userProgressSchema = new Schema<IUserProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    puzzleId: {
      type: Schema.Types.ObjectId,
      ref: 'Puzzle',
      required: [true, 'Puzzle ID is required'],
    },
    placedPieceIds: {
      type: [String],
      default: [],
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    level: {
      type: String,
      default: null,
    },
    gridRows: {
      type: Number,
      default: null,
      min: 0,
    },
    gridCols: {
      type: Number,
      default: null,
      min: 0,
    },
    timePlayedSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    moves: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPlayedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one progress record per user per puzzle
userProgressSchema.index({ userId: 1, puzzleId: 1 }, { unique: true });

// Index for fetching user's progress
userProgressSchema.index({ userId: 1, isCompleted: 1 });

export const UserProgress = mongoose.model<IUserProgress>(
  'UserProgress',
  userProgressSchema
);

