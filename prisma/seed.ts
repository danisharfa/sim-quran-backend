import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  const username = 'admin';
  const hashedPassword = await hash('admin123', 10);

  await prisma.user.upsert({
    where: { username },
    update: { password: hashedPassword },
    create: { username, password: hashedPassword },
  });
}

main()
  .then(() => {
    console.log('Seed completed: admin user ensured');
  })
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
