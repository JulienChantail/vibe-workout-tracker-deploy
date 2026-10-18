import { PrismaClient } from '../app/generated/prisma';
import { PrismaMssql } from '@prisma/adapter-mssql';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // DATABASE_URL au format SQL Server : sqlserver://host:1433;database=...;user=...;password=...;encrypt=true
  const adapter = new PrismaMssql(process.env.DATABASE_URL!);
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
