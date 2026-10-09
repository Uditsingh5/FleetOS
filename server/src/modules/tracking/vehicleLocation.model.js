import mongoose from 'mongoose';

const vehicleLocationSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

vehicleLocationSchema.index({ vehicleId: 1, timestamp: -1 });
vehicleLocationSchema.index({ taskId: 1, timestamp: -1 });

const VehicleLocation = mongoose.model('VehicleLocation', vehicleLocationSchema);

export default VehicleLocation;
