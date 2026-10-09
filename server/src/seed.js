import mongoose from 'mongoose';
import dns from 'node:dns';
import User from './modules/users/user.model.js';
import Driver from './modules/drivers/driver.model.js';
import Vehicle from './modules/vehicles/vehicle.model.js';
import WaterRequest from './modules/requests/request.model.js';
import Task from './modules/tasks/task.model.js';
import VehicleLocation from './modules/tracking/vehicleLocation.model.js';
import AuditLog from './modules/audit/audit.model.js';
import Notification from './modules/notifications/notification.model.js';
import { calculatePriorityScore } from './modules/requests/priority.service.js';
import env from './config/env.js';
import logger from './lib/logger.js';

const KANPUR_AREAS = [
  { name: 'Kakadeo, Kanpur', lat: 26.4770, lng: 80.2925, landmark: 'Near Coaching Hub, Block M' },
  { name: 'Shastri Nagar, Kanpur', lat: 26.4712, lng: 80.3065, landmark: 'Near Central Park Market' },
  { name: 'Swaroop Nagar, Kanpur', lat: 26.4855, lng: 80.3235, landmark: 'Opposite Medical College Road' },
  { name: 'Govind Nagar, Kanpur', lat: 26.4410, lng: 80.3050, landmark: 'Sector 5 Community Centre' },
  { name: 'Kidwai Nagar, Kanpur', lat: 26.4320, lng: 80.3390, landmark: 'Block H, Near Water Tank' },
  { name: 'Kalyanpur, Kanpur', lat: 26.4985, lng: 80.2580, landmark: 'Near GT Road Crossing' },
  { name: 'Barra, Kanpur', lat: 26.4250, lng: 80.3120, landmark: 'Barra 2 Main Road' },
  { name: 'Panki, Kanpur', lat: 26.4620, lng: 80.2450, landmark: 'Near Industrial Area Phase 1' },
  { name: 'Naubasta, Kanpur', lat: 26.4150, lng: 80.3380, landmark: 'Bamba Road Junction' },
  { name: 'Civil Lines, Kanpur', lat: 26.4750, lng: 80.3450, landmark: 'Near Municipal Water Works' },
];

const DEMO_PASSWORD = 'Password@123';

async function upsertDemoUser({ name, email, phone, role }) {
  const normalizedEmail = email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail }).select('+password');
  if (existing) {
    existing.name = name;
    existing.phone = phone;
    existing.role = role;
    existing.isActive = true;
    await existing.save();
    return existing;
  }

  return User.create({
    name,
    email: normalizedEmail,
    phone,
    password: DEMO_PASSWORD,
    role,
  });
}

async function upsertDemoTask(requestId, values) {
  return Task.findOneAndUpdate(
    { requestId },
    { $set: values },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export const seedDatabase = async ({ disconnect = true } = {}) => {
  logger.info('Connecting to database for seeding...');
  if (env.mongodbUri.startsWith('mongodb+srv://')) {
    dns.setServers(env.mongodbDnsServers);
  }
  const alreadyConnected = mongoose.connection.readyState === 1;
  if (!alreadyConnected) {
    await mongoose.connect(env.mongodbUri);
  }

  logger.info('Upserting demo data without deleting existing records...');

  logger.info('Creating Administrator account...');
  const adminUser = await upsertDemoUser({
    name: 'Ramesh Sharma (Chief Operations)',
    email: 'admin@waterfleet.gov.in',
    phone: '+919876500001',
    role: 'ADMIN',
  });

  logger.info('Creating 10 Citizens...');
  const citizenData = [
    { name: 'Priya Singh', email: 'priya.singh@gmail.com', phone: '+919876510001' },
    { name: 'Amit Verma', email: 'amit.verma@gmail.com', phone: '+919876510002' },
    { name: 'Neha Gupta', email: 'neha.gupta@gmail.com', phone: '+919876510003' },
    { name: 'Rajesh Patel', email: 'rajesh.patel@gmail.com', phone: '+919876510004' },
    { name: 'Sunita Mishra', email: 'sunita.mishra@gmail.com', phone: '+919876510005' },
    { name: 'Vikas Yadav', email: 'vikas.yadav@gmail.com', phone: '+919876510006' },
    { name: 'Ananya Tiwari', email: 'ananya.tiwari@gmail.com', phone: '+919876510007' },
    { name: 'Deepak Srivastava', email: 'deepak.srivastava@gmail.com', phone: '+919876510008' },
    { name: 'Pooja Pandey', email: 'pooja.pandey@gmail.com', phone: '+919876510009' },
    { name: 'Rahul Chauhan', email: 'rahul.chauhan@gmail.com', phone: '+919876510010' },
  ];

  const citizens = [];
  for (const c of citizenData) {
    const user = await upsertDemoUser({
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: 'CITIZEN',
    });
    citizens.push(user);
  }

  logger.info('Creating 5 Drivers...');
  const driverNames = [
    { name: 'Suresh Kumar', phone: '+919876520001', license: 'DL-UP78-2015-001' },
    { name: 'Manoj Tiwari', phone: '+919876520002', license: 'DL-UP78-2017-002' },
    { name: 'Dinesh Rawat', phone: '+919876520003', license: 'DL-UP78-2016-003' },
    { name: 'Ashok Pal', phone: '+919876520004', license: 'DL-UP78-2018-004' },
    { name: 'Rajendra Yadav', phone: '+919876520005', license: 'DL-UP78-2019-005' },
  ];

  const drivers = [];
  for (let i = 0; i < driverNames.length; i++) {
    const d = driverNames[i];
    const user = await upsertDemoUser({
      name: d.name,
      email: `driver${i + 1}@waterfleet.gov.in`,
      phone: d.phone,
      role: 'DRIVER',
    });

    const driverDoc = await Driver.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          licenseNumber: d.license,
          status: 'AVAILABLE',
          totalTasks: 12 + i * 4,
          completedTasks: 11 + i * 4,
          rating: 4.8,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    drivers.push(driverDoc);
  }

  logger.info('Creating 5 Vehicles (Tankers)...');
  const vehicleSpecs = [
    { number: 'UP78-WT-1001', capacity: 10000, water: 10000, lat: 26.4710, lng: 80.3060 }, // Shastri Nagar
    { number: 'UP78-WT-1002', capacity: 12000, water: 12000, lat: 26.4775, lng: 80.2930 }, // Kakadeo
    { number: 'UP78-WT-1003', capacity: 8000,  water: 8000,  lat: 26.4415, lng: 80.3045 }, // Govind Nagar
    { number: 'UP78-WT-1004', capacity: 15000, water: 15000, lat: 26.4860, lng: 80.3240 }, // Swaroop Nagar
    { number: 'UP78-WT-1005', capacity: 6000,  water: 6000,  lat: 26.4325, lng: 80.3385 }, // Kidwai Nagar
  ];

  const vehicles = [];
  for (let i = 0; i < vehicleSpecs.length; i++) {
    const spec = vehicleSpecs[i];
    const vehicle = await Vehicle.findOneAndUpdate(
      { vehicleNumber: spec.number },
      {
        $set: {
          type: 'WATER_TANKER',
          capacityLiters: spec.capacity,
          currentWaterLevel: spec.water,
          status: 'AVAILABLE',
          driverId: drivers[i]._id,
          currentLocation: { lat: spec.lat, lng: spec.lng },
          lastLocationUpdate: new Date(),
          fuelLevel: 85 + (i * 3) % 15,
          isActive: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    // Link vehicle to driver
    drivers[i].currentVehicleId = vehicle._id;
    await drivers[i].save();
    vehicles.push(vehicle);
  }

  logger.info('Creating 10 Water Requests across Kanpur...');
  const requestConfigs = [
    { citizenIdx: 0, areaIdx: 0, severity: 'CRITICAL', liters: 5000, people: 120, status: 'PENDING', desc: 'Main residential block supply pipe ruptured 48 hours ago. Severe emergency.' },
    { citizenIdx: 1, areaIdx: 1, severity: 'HIGH', liters: 4000, people: 75, status: 'PENDING', desc: 'Overhead tank completely dry in Shastri Nagar lane 4.' },
    { citizenIdx: 2, areaIdx: 2, severity: 'CRITICAL', liters: 8000, people: 200, status: 'APPROVED', desc: 'Community clinic and adjoining housing colony out of drinking water.' },
    { citizenIdx: 3, areaIdx: 3, severity: 'MEDIUM', liters: 3000, people: 40, status: 'APPROVED', desc: 'Low pressure water supply since 3 days.' },
    { citizenIdx: 4, areaIdx: 4, severity: 'HIGH', liters: 4500, people: 90, status: 'ASSIGNED', desc: 'Kidwai Nagar block H water pump motor failed.' },
    { citizenIdx: 5, areaIdx: 5, severity: 'CRITICAL', liters: 6000, people: 150, status: 'EN_ROUTE', desc: 'Govt primary school and kindergarten need immediate clean water.' },
    { citizenIdx: 6, areaIdx: 6, severity: 'MEDIUM', liters: 2500, people: 35, status: 'DELIVERING', desc: 'Contaminated borewell water report in Barra 2.' },
    { citizenIdx: 7, areaIdx: 7, severity: 'LOW', liters: 2000, people: 25, status: 'COMPLETED', desc: 'Regular scheduled water supply top-up for housing society.' },
    { citizenIdx: 8, areaIdx: 8, severity: 'HIGH', liters: 5000, people: 110, status: 'COMPLETED', desc: 'Pipeline valve broken near Naubasta junction.' },
    { citizenIdx: 9, areaIdx: 9, severity: 'MEDIUM', liters: 3500, people: 60, status: 'PENDING', desc: 'Civil lines ward 8 water tanker request for maintenance period.' },
  ];

  const requests = [];
  for (let i = 0; i < requestConfigs.length; i++) {
    const rc = requestConfigs[i];
    const area = KANPUR_AREAS[rc.areaIdx];
    const citizen = citizens[rc.citizenIdx];
    const priorityScore = calculatePriorityScore({
      severity: rc.severity,
      estimatedAffectedPeople: rc.people,
      requestedLiters: rc.liters,
      isEmergency: rc.severity === 'CRITICAL',
      createdAt: new Date(Date.now() - (10 - i) * 3600000),
    });

    const request = await WaterRequest.findOneAndUpdate(
      { citizenId: citizen._id, address: `${area.landmark}, ${area.name}` },
      {
        $set: {
          location: { lat: area.lat, lng: area.lng },
          severity: rc.severity,
          requestedLiters: rc.liters,
          estimatedAffectedPeople: rc.people,
          isEmergency: rc.severity === 'CRITICAL',
          description: rc.desc,
          status: rc.status,
          assignedTaskId: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'DELIVERING', 'COMPLETED'].includes(rc.status)
            ? undefined
            : null,
          priorityScore,
          approvedAt: ['APPROVED', 'ASSIGNED', 'EN_ROUTE', 'DELIVERING', 'COMPLETED'].includes(rc.status) ? new Date(Date.now() - 3600000) : null,
        },
        $setOnInsert: {
          createdAt: new Date(Date.now() - (10 - i) * 3600000),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    requests.push(request);
  }

  logger.info('Creating demo tasks to demonstrate operational lifecycle...');
  // Task 1: ASSIGNED (Vehicle 0, Driver 0, Request 4 - Kidwai Nagar)
  vehicles[0].status = 'ASSIGNED';
  drivers[0].status = 'BUSY';
  await vehicles[0].save();
  await drivers[0].save();

  const task1 = await upsertDemoTask(requests[4]._id, {
    vehicleId: vehicles[0]._id,
    driverId: drivers[0]._id,
    assignedBy: adminUser._id,
    status: 'ASSIGNED',
    assignedAt: new Date(Date.now() - 15 * 60000),
    distanceKm: 3.2,
    estimatedArrival: new Date(Date.now() + 15 * 60000),
  });
  requests[4].assignedTaskId = task1._id;
  await requests[4].save();

  // Keep the Kalyanpur tanker available instead of creating an automatic
  // assignment that can appear as an unrelated customer delivery.
  vehicles[1].currentLocation = { lat: 26.4775, lng: 80.2930 };
  vehicles[1].lastLocationUpdate = new Date();
  await vehicles[1].save();

  // Task 3: DELIVERING (Vehicle 2, Driver 2, Request 6 - Barra)
  vehicles[2].status = 'DELIVERING';
  drivers[2].status = 'BUSY';
  vehicles[2].currentLocation = { lat: 26.4250, lng: 80.3120 };
  vehicles[2].lastLocationUpdate = new Date();
  await vehicles[2].save();
  await drivers[2].save();

  const task3 = await upsertDemoTask(requests[6]._id, {
    vehicleId: vehicles[2]._id,
    driverId: drivers[2]._id,
    assignedBy: adminUser._id,
    status: 'DELIVERING',
    assignedAt: new Date(Date.now() - 40 * 60000),
    acceptedAt: new Date(Date.now() - 38 * 60000),
    startedAt: new Date(Date.now() - 30 * 60000),
    arrivedAt: new Date(Date.now() - 12 * 60000),
    deliveryStartedAt: new Date(Date.now() - 8 * 60000),
    distanceKm: 0.1,
  });
  requests[6].assignedTaskId = task3._id;
  await requests[6].save();

  // Task 4: COMPLETED (Vehicle 3, Driver 3, Request 7 - Panki)
  const task4 = await upsertDemoTask(requests[7]._id, {
    vehicleId: vehicles[3]._id,
    driverId: drivers[3]._id,
    assignedBy: adminUser._id,
    status: 'COMPLETED',
    assignedAt: new Date(Date.now() - 120 * 60000),
    acceptedAt: new Date(Date.now() - 118 * 60000),
    startedAt: new Date(Date.now() - 105 * 60000),
    arrivedAt: new Date(Date.now() - 80 * 60000),
    deliveryStartedAt: new Date(Date.now() - 75 * 60000),
    completedAt: new Date(Date.now() - 45 * 60000),
    deliveryLiters: 2000,
    notes: 'Delivered successfully to residential society water reservoir tank.',
  });
  requests[7].assignedTaskId = task4._id;
  await requests[7].save();

  // Task 5: COMPLETED (Vehicle 4, Driver 4, Request 8 - Naubasta)
  const task5 = await upsertDemoTask(requests[8]._id, {
    vehicleId: vehicles[4]._id,
    driverId: drivers[4]._id,
    assignedBy: adminUser._id,
    status: 'COMPLETED',
    assignedAt: new Date(Date.now() - 180 * 60000),
    acceptedAt: new Date(Date.now() - 175 * 60000),
    startedAt: new Date(Date.now() - 160 * 60000),
    arrivedAt: new Date(Date.now() - 130 * 60000),
    deliveryStartedAt: new Date(Date.now() - 120 * 60000),
    completedAt: new Date(Date.now() - 90 * 60000),
    deliveryLiters: 5000,
    notes: 'Emergency water delivered directly to ward distribution point.',
  });
  requests[8].assignedTaskId = task5._id;
  await requests[8].save();

  logger.info('Upserting demo audit logs...');
  const auditEntries = [
    {
      actorId: adminUser._id,
      actorRole: 'ADMIN',
      action: 'SYSTEM_SEEDED',
      entityType: 'SYSTEM',
      entityId: adminUser._id,
      metadata: { city: 'Kanpur', source: 'demo-seed' },
    },
    {
      actorId: adminUser._id,
      actorRole: 'ADMIN',
      action: 'TASK_CREATED',
      entityType: 'TASK',
      entityId: task1._id,
      metadata: { vehicle: 'UP78-WT-1001', request: requests[4].address },
    },
  ];
  for (const entry of auditEntries) {
    await AuditLog.findOneAndUpdate(
      { action: entry.action, entityType: entry.entityType, entityId: entry.entityId },
      { $set: entry },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  logger.info('Upserting demo notifications...');
  const notifications = [
    {
      userId: adminUser._id,
      title: 'High Priority Alert',
      message: 'New critical water shortage reported in Kakadeo, Kanpur (5000L, 120 affected people)',
      type: 'WARNING',
      relatedEntity: { entityType: 'REQUEST', entityId: requests[0]._id },
      isRead: false,
    },
    {
      userId: citizens[4]._id,
      title: 'Tanker Assigned',
      message: 'Water tanker UP78-WT-1001 has been dispatched for your request at Kidwai Nagar.',
      type: 'SUCCESS',
      relatedEntity: { entityType: 'REQUEST', entityId: requests[4]._id },
      isRead: false,
    },
  ];
  for (const notification of notifications) {
    await Notification.findOneAndUpdate(
      { userId: notification.userId, title: notification.title, 'relatedEntity.entityId': notification.relatedEntity.entityId },
      { $set: notification },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  logger.info('✅ Database successfully seeded with Kanpur Water Scarcity operational data!');
  logger.info('----------------------------------------------------');
  logger.info('Admin credentials:   admin@waterfleet.gov.in / Password@123');
  logger.info('Driver credentials:  driver1@waterfleet.gov.in / Password@123');
  logger.info('Citizen credentials: priya.singh@gmail.com / Password@123');
  logger.info('----------------------------------------------------');

  if (disconnect && !alreadyConnected) {
    await mongoose.disconnect();
  }
};

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Seeding failed');
      process.exit(1);
    });
}
