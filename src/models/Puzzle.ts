import mongoose, { Document, Schema } from 'mongoose';

export interface IPuzzle extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  imageUrl: string;
  imageKey: string; // S3 object key for deletion
  gridRows: number;
  gridCols: number;
  levelOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const puzzleSchema = new Schema<IPuzzle>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required'],
    },
    imageKey: {
      type: String,
      required: [true, 'Image key is required'],
    },
    gridRows: {
      type: Number,
      required: [true, 'Grid rows is required'],
      min: [2, 'Grid must have at least 2 rows'],
      max: [20, 'Grid cannot exceed 20 rows'],
    },
    gridCols: {
      type: Number,
      required: [true, 'Grid cols is required'],
      min: [2, 'Grid must have at least 2 columns'],
      max: [20, 'Grid cannot exceed 20 columns'],
    },
    levelOrder: {
      type: Number,
      required: [true, 'Level order is required'],
      unique: true,
      min: [1, 'Level order must be at least 1'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
puzzleSchema.index({ isActive: 1, levelOrder: 1 });

export const Puzzle = mongoose.model<IPuzzle>('Puzzle', puzzleSchema);

