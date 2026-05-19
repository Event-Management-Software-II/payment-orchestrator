require('dotenv').config();
const prisma = require('../prisma');

const companies = [
  {
    id: 'company-tickets-001',
    name: 'Ticket Sales System Inc.',
    taxId: '900123456-7',
    isActive: true,
    apiKey: 'sk_tickets_abc123def456',
  },
  {
    id: 'company-events-002',
    name: 'UPTC Cultural Events',
    taxId: '800987654-3',
    isActive: true,
    apiKey: 'sk_events_xyz789uvw012',
  },
];

const seed = async () => {
  for (const company of companies) {
    await prisma.company.upsert({
      where: { id: company.id },
      update: company,
      create: company,
    });
    console.log(`Company created/updated: ${company.name}`);
  }

  console.log('\nSeed completed successfully');
  console.log('\nTest API keys:');
  companies.forEach((company) => console.log(`  ${company.name}: ${company.apiKey}`));
};

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
