import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WaterRequest',
      required: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'CREATED',
        'ASSIGNED',
        'ACCEPTED',
        'EN_ROUTE',
        'ARRIVED',
        'DELIVERING',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
      ],
      default: 'CREATED',
    },
    assignedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    deliveryStartedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    estimatedArrival: { type: Date, default: null },
    actualArrival: { type: Date, default: null },
    route: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    distanceKm: {
      type: Number,
      default: null,
    },
    deliveryLiters: {
      type: Number,
      default: null,
    },
    notes: {
      type: String,
      default: null,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    failureReason: {
      type: String,
      default: null,
    },
    proofImageUrl: {
      type: String,
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
taskSchema.index({ status: 1 });
taskSchema.index({ driverId: 1 });
taskSchema.index({ vehicleId: 1 });
taskSchema.index({ requestId: 1 });
taskSchema.index({ assignedAt: -1 });

const Task = mongoose.model('Task', taskSchema);

export default Task;
