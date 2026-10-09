import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import logger from './logger.js';

let ioInstance = null;

export const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: [env.corsOrigin, 'http://localhost:5173', 'http://localhost:3000', '*'],
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // Authentication middleware for socket connections
  ioInstance.use((socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers?.authorization) {
        token = socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '');
      }

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, env.jwtSecret);
      socket.user = decoded; // { userId, email, role }
      next();
    } catch (err) {
      logger.warn({ error: err.message }, 'Socket authentication failed');
      next(new Error('Authentication error: Invalid token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const user = socket.user;
    logger.info({ userId: user?.userId, role: user?.role, socketId: socket.id }, 'Socket client connected');

    // Always join individual user room
    if (user?.userId) {
      socket.join(`user:${user.userId}`);
    }

    // Auto-join rooms based on user role
    if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
      socket.join('admin-room');
      logger.info({ socketId: socket.id }, 'Joined admin-room');
    }

    if (user?.role === 'DRIVER') {
      socket.join(`driver:${user.userId}`);
    }

    if (user?.role === 'CITIZEN') {
      socket.join(`citizen:${user.userId}`);
    }

    // Dynamic room join for specific task tracking
    socket.on('join:task', (taskId) => {
      if (!taskId) return;
      import('../modules/tracking/tracking.service.js')
        .then(({ canSubscribeToTask }) => canSubscribeToTask(taskId, user))
        .then((allowed) => {
          if (!allowed) {
            logger.warn({ socketId: socket.id, taskId, userId: user?.userId }, 'Rejected unauthorized task room subscription');
            socket.emit('task:subscription-error', { taskId, error: 'Unauthorized task subscription' });
            return;
          }
          socket.join(`task:${taskId}`);
          logger.debug({ socketId: socket.id, taskId }, 'Client joined task room');
        })
        .catch((err) => {
          logger.error({ socketId: socket.id, taskId, error: err.message }, 'Task room authorization failed');
          socket.emit('task:subscription-error', { taskId, error: 'Unable to authorize task subscription' });
        });
    });

    socket.on('leave:task', (taskId) => {
      if (taskId) {
        socket.leave(`task:${taskId}`);
        logger.debug({ socketId: socket.id, taskId }, 'Client left task room');
      }
    });

    // Realtime driver location stream event
    socket.on('driver:location', async (payload, callback) => {
      try {
        if (user?.role !== 'DRIVER') {
          if (callback) callback({ error: 'Unauthorized: Driver only' });
          return;
        }

        const { recordLocation } = await import('../modules/tracking/tracking.service.js');
        const result = await recordLocation({
          driverUserId: user.userId,
          taskId: payload.taskId,
          vehicleId: payload.vehicleId,
          lat: payload.lat,
          lng: payload.lng,
          accuracy: payload.accuracy,
          speed: payload.speed,
          heading: payload.heading,
          batteryLevel: payload.batteryLevel,
          isCharging: payload.isCharging,
          isSimulation: payload.isSimulation === true,
          timestamp: payload.timestamp,
        });

        if (callback) callback({ success: true, data: result });
      } catch (err) {
        logger.error({ error: err.message, userId: user.userId }, 'Socket driver:location error');
        if (callback) callback({ error: err.message });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, userId: user?.userId, reason }, 'Socket client disconnected');
    });
  });

  return ioInstance;
};

export const getIO = () => {
  return ioInstance;
};
