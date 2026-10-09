import * as trackingService from './tracking.service.js';
import { sendSuccess } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const pingLocation = asyncHandler(async (req, res) => {
  const { taskId, vehicleId, lat, lng, accuracy, speed, heading, batteryLevel, isCharging, isSimulation, timestamp } = req.body;
  const result = await trackingService.recordLocation({
    driverUserId: req.user.userId,
    taskId,
    vehicleId,
    lat: Number(lat),
    lng: Number(lng),
    accuracy: accuracy ? Number(accuracy) : null,
    speed: speed ? Number(speed) : null,
    heading: heading ? Number(heading) : null,
    batteryLevel: batteryLevel ? Number(batteryLevel) : null,
    isCharging: isCharging === true || isCharging === 'true',
    isSimulation: isSimulation === true,
    timestamp,
  });
  sendSuccess(res, result, 'Location recorded');
});

export const getFleetLocations = asyncHandler(async (req, res) => {
  const mode = req.query.mode || 'all';
  const fleet = await trackingService.getAdminFleetLocations(mode);
  sendSuccess(res, fleet);
});

export const getTaskTracking = asyncHandler(async (req, res) => {
  const trackingData = await trackingService.getTaskTracking(req.params.taskId, req.user);
  sendSuccess(res, trackingData);
});

export const getVehicleBreadcrumbs = asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;
  const { taskId } = req.query;
  const breadcrumbs = await trackingService.getVehicleBreadcrumbs(vehicleId, taskId);
  sendSuccess(res, breadcrumbs);
});

// Simulation management endpoints
export const getSimulationStatus = asyncHandler(async (req, res) => {
  const { simulationEngine } = await import('./simulation.service.js');
  sendSuccess(res, simulationEngine.getStatus());
});

export const toggleSimulation = asyncHandler(async (req, res) => {
  const { simulationEngine } = await import('./simulation.service.js');
  const active = simulationEngine.toggle();
  sendSuccess(res, { active, message: active ? 'Demo drivers simulation started' : 'Demo drivers simulation stopped' });
});

export const startSimulation = asyncHandler(async (req, res) => {
  const { simulationEngine } = await import('./simulation.service.js');
  simulationEngine.start();
  sendSuccess(res, { active: true, message: 'Demo drivers simulation active' });
});

export const stopSimulation = asyncHandler(async (req, res) => {
  const { simulationEngine } = await import('./simulation.service.js');
  simulationEngine.stop();
  sendSuccess(res, { active: false, message: 'Demo drivers simulation stopped' });
});

export const pauseSimulation = asyncHandler(async (req, res) => {
  const { simulationEngine } = await import('./simulation.service.js');
  simulationEngine.pause();
  sendSuccess(res, simulationEngine.getStatus());
});

export const resumeSimulation = asyncHandler(async (req, res) => {
  const { simulationEngine } = await import('./simulation.service.js');
  simulationEngine.resume();
  sendSuccess(res, simulationEngine.getStatus());
});
