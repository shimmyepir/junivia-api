import mongoose, { Document, Schema } from 'mongoose';

export interface IPuzzleGroup extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  originalImageUrl: string;
  originalImageKey: string;
  splitCount: number;
  gridRows: number;
  gridCols: number;
  isActive: boolean;
  spotifyPlaylistUrl?: string;
  audiobookUrl?: string;
  audiobookKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const puzzleGroupSchema = new Schema<IPuzzleGroup>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    originalImageUrl: {
      type: String,
      required: [true, 'Original image URL is required'],
    },
    originalImageKey: {
      type: String,
      required: [true, 'Original image key is required'],
    },
    splitCount: {
      type: Number,
      required: [true, 'Split count is required'],
      min: [2, 'Split count must be at least 2'],
      max: [5, 'Split count cannot exceed 5'],
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
    isActive: {
      type: Boolean,
      default: true,
    },
    spotifyPlaylistUrl: {
      type: String,
      trim: true,
    },
    audiobookUrl: {
      type: String,
    },
    audiobookKey: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const PuzzleGroup = mongoose.model<IPuzzleGroup>('PuzzleGroup', puzzleGroupSchema);
