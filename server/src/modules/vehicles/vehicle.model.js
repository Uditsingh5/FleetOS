import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['WATER_TANKER', 'TRUCK', 'UTILITY_VEHICLE'],
      default: 'WATER_TANKER',
    },
    capacityLiters: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [0, 'Capacity cannot be negative'],
    },
    currentWaterLevel: {
      type: Number,
      default: 0,
      min: [0, 'Water level cannot be negative'],
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'EN_ROUTE', 'DELIVERING', 'MAINTENANCE', 'OFFLINE'],
      default: 'AVAILABLE',
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
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
    fuelLevel: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    lastMaintenanceDate: {
      type: Date,
      default: null,
    },
    nextMaintenanceDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ driverId: 1 });
vehicleSchema.index({ 'currentLocation.lat': 1, 'currentLocation.lng': 1 });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

export default Vehicle;
