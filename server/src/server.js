import http from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import { initSocket } from './lib/socket.js';
import env from './config/env.js';
import logger from './lib/logger.js';
import User from './modules/users/user.model.js';
import Driver from './modules/drivers/driver.model.js';

const ensureDemoData = async () => {
  if (!env.autoSeedDemoData) return;

  const demoUsers = [
    {
      name: 'Ramesh Sharma (Chief Operations)',
      email: 'admin@waterfleet.gov.in',
      password: 'Password@123',
      phone: '+919876500001',
      role: 'ADMIN',
    },
    {
      name: 'Suresh Kumar',
      email: 'driver1@waterfleet.gov.in',
      password: 'Password@123',
      phone: '+919876520001',
      role: 'DRIVER',
    },
    {
      name: 'Priya Singh',
      email: 'priya.singh@gmail.com',
      password: 'Password@123',
      phone: '+919876510001',
      role: 'CITIZEN',
    },
  ];

  for (const demoUser of demoUsers) {
    const user = await User.findOne({ email: demoUser.email });
    if (user) {
      user.password = demoUser.password;
      await user.save();

      if (demoUser.role === 'DRIVER') {
        await Driver.updateOne(
          { userId: user._id },
          {
            $setOnInsert: {
              licenseNumber: 'DL-UP78-DEMO-001',
              status: 'AVAILABLE',
            },
          },
          { upsert: true }
        );
      }
      continue;
    }

    const createdUser = await User.create(demoUser);
    logger.info({ email: demoUser.email }, 'Created missing demo login account');

    if (demoUser.role === 'DRIVER') {
      await Driver.create({
        userId: createdUser._id,
        licenseNumber: 'DL-UP78-DEMO-001',
        status: 'AVAILABLE',
      });
    }
  }
};

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Ensure first-run development environments have the accounts used by the demo login
    await ensureDemoData();

    // 3. Create HTTP server
    const server = http.createServer(app);

    // 4. Initialize Socket.IO
    initSocket(server);

    // 5. Start listening
    const PORT = env.port;
    server.listen(PORT, () => {
      logger.info(`🌊 WaterFleetOS Backend running in ${env.nodeEnv} mode on port ${PORT}`);
      logger.info(`📡 Socket.IO initialized and ready for connections`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Closing HTTP server gracefully...`);
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
