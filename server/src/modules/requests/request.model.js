import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const waterRequestSchema = new mongoose.Schema(
  {
    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: {
      type: locationSchema,
      required: [true, 'Location is required'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    priorityScore: {
      type: Number,
      default: 0,
    },
    requestedLiters: {
      type: Number,
      required: [true, 'Requested liters is required'],
      min: [100, 'Minimum request is 100 liters'],
      max: [50000, 'Maximum request is 50,000 liters'],
    },
    estimatedAffectedPeople: {
      type: Number,
      default: 1,
      min: [1, 'At least 1 person must be affected'],
    },
    isEmergency: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: [
        'PENDING',
        'VALIDATING',
        'APPROVED',
        'ASSIGNED',
        'EN_ROUTE',
        'ARRIVED',
        'DELIVERING',
        'COMPLETED',
        'REJECTED',
        'CANCELLED',
      ],
      default: 'PENDING',
    },
    assignedTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
waterRequestSchema.index({ status: 1 });
waterRequestSchema.index({ severity: 1 });
waterRequestSchema.index({ citizenId: 1 });
waterRequestSchema.index({ createdAt: -1 });
waterRequestSchema.index({ priorityScore: -1 });
waterRequestSchema.index({ 'location.lat': 1, 'location.lng': 1 });

const WaterRequest = mongoose.model('WaterRequest', waterRequestSchema);

export default WaterRequest;
