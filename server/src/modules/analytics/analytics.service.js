import WaterRequest from '../requests/request.model.js';
import Vehicle from '../vehicles/vehicle.model.js';
import Driver from '../drivers/driver.model.js';
import Task from '../tasks/task.model.js';

/**
 * High-level system overview KPIs
 */
export const getOverview = async () => {
  const [
    totalRequests,
    completedRequests,
    pendingRequests,
    criticalRequests,
    totalVehicles,
    activeVehicles,
    totalDrivers,
    availableDrivers,
    deliveryAgg,
    timeAgg,
  ] = await Promise.all([
    WaterRequest.countDocuments(),
    WaterRequest.countDocuments({ status: 'COMPLETED' }),
    WaterRequest.countDocuments({ status: { $in: ['PENDING', 'APPROVED'] } }),
    WaterRequest.countDocuments({ severity: 'CRITICAL', status: { $ne: 'COMPLETED' } }),
    Vehicle.countDocuments({ isActive: true }),
    Vehicle.countDocuments({ status: { $in: ['ASSIGNED', 'EN_ROUTE', 'DELIVERING'] }, isActive: true }),
    Driver.countDocuments({ isActive: true }),
    Driver.countDocuments({ status: 'AVAILABLE', isActive: true }),
    // Total delivered water
    Task.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, totalDelivered: { $sum: '$deliveryLiters' } } },
    ]),
    // Average delivery duration in minutes
    Task.aggregate([
      { $match: { status: 'COMPLETED', startedAt: { $ne: null }, completedAt: { $ne: null } } },
      {
        $project: {
          durationMinutes: {
            $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000 * 60],
          },
        },
      },
      { $group: { _id: null, avgDuration: { $avg: '$durationMinutes' } } },
    ]),
  ]);

  const totalDeliveredLiters = deliveryAgg[0]?.totalDelivered || 0;
  const avgDeliveryTimeMinutes = Math.round((timeAgg[0]?.avgDuration || 35) * 10) / 10;

  return {
    totalRequests,
    completedRequests,
    pendingRequests,
    criticalRequests,
    totalVehicles,
    activeVehicles,
    totalDrivers,
    availableDrivers,
    totalDeliveredLiters,
    avgDeliveryTimeMinutes,
    fulfillmentRate: totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0,
  };
};

/**
 * Requests analytics by status, severity, and timeline
 */
export const getRequestsAnalytics = async () => {
  const [bySeverity, byStatus, overTime] = await Promise.all([
    WaterRequest.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    WaterRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    WaterRequest.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
          critical: {
            $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 14 },
    ]),
  ]);

  return {
    bySeverity: bySeverity.map((item) => ({ severity: item._id, count: item.count })),
    byStatus: byStatus.map((item) => ({ status: item._id, count: item.count })),
    overTime: overTime.map((item) => ({ date: item._id, count: item.count, critical: item.critical })),
  };
};

/**
 * Fleet and driver performance metrics
 */
export const getFleetAnalytics = async () => {
  const [vehiclesByStatus, driversByStatus, vehicleUtilization] = await Promise.all([
    Vehicle.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Driver.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Vehicle.find({ isActive: true })
      .select('vehicleNumber capacityLiters currentWaterLevel status')
      .lean(),
  ]);

  return {
    vehiclesByStatus: vehiclesByStatus.map((item) => ({ status: item._id, count: item.count })),
    driversByStatus: driversByStatus.map((item) => ({ status: item._id, count: item.count })),
    vehicles: vehicleUtilization.map((v) => ({
      _id: v._id,
      vehicleNumber: v.vehicleNumber,
      capacityLiters: v.capacityLiters,
      currentWaterLevel: v.currentWaterLevel,
      status: v.status,
      utilizationPercent: v.capacityLiters > 0 ? Math.round((v.currentWaterLevel / v.capacityLiters) * 100) : 0,
    })),
  };
};

/**
 * Water supply metrics
 */
export const getWaterAnalytics = async () => {
  const [waterDeliveredPerDay, activeTankerWater] = await Promise.all([
    Task.aggregate([
      { $match: { status: 'COMPLETED', completedAt: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          totalLiters: { $sum: '$deliveryLiters' },
          trips: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 14 },
    ]),
    Vehicle.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalCapacity: { $sum: '$capacityLiters' },
          currentWaterInFleet: { $sum: '$currentWaterLevel' },
        },
      },
    ]),
  ]);

  return {
    waterDeliveredPerDay: waterDeliveredPerDay.map((item) => ({
      date: item._id,
      liters: item.totalLiters,
      trips: item.trips,
    })),
    capacity: activeTankerWater[0] || { totalCapacity: 0, currentWaterInFleet: 0 },
  };
};

/**
 * Area water scarcity density heatmap data
 */
export const getScarcityHeatmap = async () => {
  const requests = await WaterRequest.find({
    status: { $in: ['PENDING', 'APPROVED', 'ASSIGNED', 'EN_ROUTE', 'DELIVERING'] },
  })
    .select('address location severity requestedLiters estimatedAffectedPeople priorityScore')
    .lean();

  // Aggregate by area / neighborhood
  const areas = {};

  requests.forEach((req) => {
    // Extract primary area name from address (e.g., "Kakadeo, Kanpur" -> "Kakadeo")
    const areaName = req.address ? req.address.split(',')[0].trim() : 'Unknown';
    if (!areas[areaName]) {
      areas[areaName] = {
        area: areaName,
        lat: req.location?.lat,
        lng: req.location?.lng,
        requestCount: 0,
        totalRequestedLiters: 0,
        totalAffectedPeople: 0,
        criticalCount: 0,
        avgPriorityScore: 0,
        scores: [],
      };
    }

    areas[areaName].requestCount += 1;
    areas[areaName].totalRequestedLiters += req.requestedLiters || 0;
    areas[areaName].totalAffectedPeople += req.estimatedAffectedPeople || 0;
    if (req.severity === 'CRITICAL') areas[areaName].criticalCount += 1;
    areas[areaName].scores.push(req.priorityScore || 50);
  });

  const hotspotList = Object.values(areas).map((area) => {
    const avgScore = Math.round(area.scores.reduce((a, b) => a + b, 0) / area.scores.length);
    delete area.scores;
    return {
      ...area,
      avgPriorityScore: avgScore,
      scarcityIndex: Math.min(100, Math.round((area.requestCount * 15 + area.criticalCount * 25 + avgScore * 0.4))),
    };
  });

  // Sort by highest scarcity index
  hotspotList.sort((a, b) => b.scarcityIndex - a.scarcityIndex);

  return {
    hotspots: hotspotList,
    points: requests.map((r) => ({
      lat: r.location?.lat,
      lng: r.location?.lng,
      severity: r.severity,
      weight: r.severity === 'CRITICAL' ? 1.0 : r.severity === 'HIGH' ? 0.75 : r.severity === 'MEDIUM' ? 0.5 : 0.25,
      address: r.address,
      priorityScore: r.priorityScore,
    })),
  };
};
