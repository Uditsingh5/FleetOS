import mongoose from 'mongoose';
import dns from 'node:dns';
import logger from '../lib/logger.js';
import env from './env.js';

const connectDB = async () => {
  try {
    if (env.mongodbUri.startsWith('mongodb+srv://')) {
      dns.setServers(env.mongodbDnsServers);
    }

    const conn = await mongoose.connect(env.mongodbUri);
    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection failed');
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error({ err }, 'MongoDB connection error');
});

export { connectDB };
export default connectDB;
