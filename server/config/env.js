import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'cubiki-dev-secret-change-in-production',
  mongoUri: process.env.MONGO_URI || '',
  isProduction: process.env.NODE_ENV === 'production',
};
