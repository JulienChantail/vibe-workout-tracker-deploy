// Importe les données de l'ancienne version (PostgreSQL / Neon) dans la base
// SQL Server / Azure SQL de cette version.
//
//   NEON_DATABASE_URL='postgresql://...' node scripts/import-from-neon.mjs --dry-run   # simulation
//   NEON_DATABASE_URL='postgresql://...' node scripts/import-from-neon.mjs             # import réel
//
// La base cible est celle de DATABASE_URL. Le script peut être relancé sans
// créer de doublons : ce qui existe déjà (même id, même nom de profil, même nom
// de type de séance ou de modèle) est réutilisé. Tout est fait dans une seule
// transaction : en cas d'erreur, rien n'est écrit.
import pg from 'pg';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../app/generated/prisma/index.js';

const sourceUrl = process.env.NEON_DATABASE_URL;
const dryRun = process.argv.includes('--dry-run');

if (!sourceUrl) {
  console.error('NEON_DATABASE_URL manquante (URL de connexion de l\'ancienne base Neon).');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manquante (URL de connexion de la base Azure SQL).');
  process.exit(1);
}

// Prisma stocke les dates en UTC dans des colonnes "timestamp without time zone" :
// on les relit en UTC, quel que soit le fuseau horaire de la machine.
pg.types.setTypeParser(1114, (value) => new Date(value.replace(' ', 'T') + 'Z'));

const source = new pg.Client({ connectionString: sourceUrl });
const prisma = new PrismaClient({ adapter: new PrismaMssql(process.env.DATABASE_URL) });

async function readTable(table, orderBy) {
  const { rows } = await source.query(`SELECT * FROM "${table}" ORDER BY "${orderBy}"`);
  return rows;
}

async function main() {
  await source.connect();

  const users = await readTable('User', 'createdAt');
  const exerciseTypes = await readTable('ExerciseType', 'createdAt');
  const templates = await readTable('WorkoutTemplate', 'createdAt');
  const blocks = await readTable('TemplateBlock', 'order');
  const entries = await readTable('WorkoutEntry', 'date');
  const sets = await readTable('SetEntry', 'order');

  console.log(
    `Lu dans Neon : ${users.length} profils, ${exerciseTypes.length} types de séance, ` +
      `${templates.length} séances préenregistrées, ${entries.length} séances, ${sets.length} séries.`
  );

  // Ancien id -> id dans Azure SQL (différent quand l'élément existait déjà sous un autre id)
  const userIds = new Map();
  const typeIds = new Map();
  const templateIds = new Map();
  const report = { users: [0, 0], exerciseTypes: [0, 0], templates: [0, 0], entries: [0, 0] };

  await prisma.$transaction(
    async (tx) => {
      for (const u of users) {
        const existing =
          (await tx.user.findUnique({ where: { id: u.id } })) ??
          (await tx.user.findUnique({ where: { username: u.username } }));
        if (existing) {
          userIds.set(u.id, existing.id);
          report.users[1]++;
          continue;
        }
        if (!dryRun) {
          await tx.user.create({
            data: {
              id: u.id,
              username: u.username,
              passwordHash: u.passwordHash,
              bodyWeightKg: u.bodyWeightKg,
              createdAt: u.createdAt,
            },
          });
        }
        userIds.set(u.id, u.id);
        report.users[0]++;
      }

      for (const t of exerciseTypes) {
        const existing =
          (await tx.exerciseType.findUnique({ where: { id: t.id } })) ??
          (await tx.exerciseType.findUnique({ where: { name: t.name } }));
        if (existing) {
          typeIds.set(t.id, existing.id);
          report.exerciseTypes[1]++;
          continue;
        }
        if (!dryRun) {
          await tx.exerciseType.create({
            data: {
              id: t.id,
              name: t.name,
              category: t.category,
              weightLabel: t.weightLabel,
              quickWeights: JSON.stringify(t.quickWeights ?? []),
              weightStep: t.weightStep,
              createdAt: t.createdAt,
              updatedAt: t.updatedAt,
            },
          });
        }
        typeIds.set(t.id, t.id);
        report.exerciseTypes[0]++;
      }

      for (const t of templates) {
        const exerciseTypeId = typeIds.get(t.exerciseTypeId);
        const existing =
          (await tx.workoutTemplate.findUnique({ where: { id: t.id } })) ??
          (await tx.workoutTemplate.findUnique({
            where: { exerciseTypeId_name: { exerciseTypeId, name: t.name } },
          }));
        if (existing) {
          templateIds.set(t.id, existing.id);
          report.templates[1]++;
          continue;
        }
        if (!dryRun) {
          await tx.workoutTemplate.create({
            data: {
              id: t.id,
              exerciseTypeId,
              name: t.name,
              heavyWeight: t.heavyWeight,
              mediumWeight: t.mediumWeight,
              lightWeight: t.lightWeight,
              createdAt: t.createdAt,
              updatedAt: t.updatedAt,
              blocks: {
                create: blocks
                  .filter((b) => b.templateId === t.id)
                  .map((b) => ({ id: b.id, order: b.order, tier: b.tier, setType: b.setType, count: b.count })),
              },
            },
          });
        }
        templateIds.set(t.id, t.id);
        report.templates[0]++;
      }

      for (const e of entries) {
        if (await tx.workoutEntry.findUnique({ where: { id: e.id } })) {
          report.entries[1]++;
          continue;
        }
        if (!dryRun) {
          await tx.workoutEntry.create({
            data: {
              id: e.id,
              userId: userIds.get(e.userId),
              exerciseTypeId: typeIds.get(e.exerciseTypeId),
              templateId: e.templateId ? templateIds.get(e.templateId) : null,
              date: e.date,
              createdAt: e.createdAt,
              updatedAt: e.updatedAt,
              sets: {
                create: sets
                  .filter((s) => s.workoutEntryId === e.id)
                  .map((s) => ({ id: s.id, order: s.order, setType: s.setType, weight: s.weight, reps: s.reps })),
              },
            },
          });
        }
        report.entries[0]++;
      }
    },
    { maxWait: 60_000, timeout: 600_000 }
  );

  console.log(dryRun ? '\nSimulation (rien n\'a été écrit) :' : '\nImport terminé :');
  console.table({
    'Profils': { importés: report.users[0], 'déjà présents': report.users[1] },
    'Types de séance': { importés: report.exerciseTypes[0], 'déjà présents': report.exerciseTypes[1] },
    'Séances préenregistrées': { importés: report.templates[0], 'déjà présents': report.templates[1] },
    'Séances (avec leurs séries)': { importés: report.entries[0], 'déjà présents': report.entries[1] },
  });
}

main()
  .catch((error) => {
    console.error('\nÉchec de l\'import, aucune donnée n\'a été écrite :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.end().catch(() => {});
    await prisma.$disconnect();
  });
