import { PrismaClient } from '../app/generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const defaults = [
    {
      name: 'Traction',
      category: 'BODYWEIGHT_LESTE',
      weightLabel: 'Leste (kg)',
      quickWeights: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
      weightStep: 5,
    },
    {
      name: 'Dips',
      category: 'BODYWEIGHT_LESTE',
      weightLabel: 'Leste (kg)',
      quickWeights: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
      weightStep: 5,
    },
  ];

  for (const exerciseType of defaults) {
    await prisma.exerciseType.upsert({
      where: { name: exerciseType.name },
      update: {},
      create: exerciseType,
    });
  }

  console.log('Types de séance par défaut créés : Traction, Dips');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
