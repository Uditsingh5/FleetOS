import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const driverSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    licenseNumber: {
      type: String,
      required: [true, 'License number is required'],
      trim: true,
    },
    licenseExpiry: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'BUSY', 'OFFLINE', 'ON_BREAK', 'SUSPENDED'],
      default: 'OFFLINE',
    },
    currentVehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    currentLocation: {
      type: locationSchema,
      default: null,
    },
    lastLocationUpdate: {
      type: Date,
      default: null,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5,
    },
    totalTasks: {
      type: Number,
      default: 0,
    },
    completedTasks: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
driverSchema.index({ status: 1 });
driverSchema.index({ currentVehicleId: 1 });

const Driver = mongoose.model('Driver', driverSchema);

export default Driver;
