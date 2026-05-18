require('dotenv').config();
const { sequelize, Empresa, syncDB } = require('../models');
const { v4: uuidv4 } = require('uuid');

const seed = async () => {
  await syncDB();

  const empresas = [
    {
      id: 'emp-boletas-001',
      nombre: 'Sistema de Venta de Boletas SA',
      nit: '900123456-7',
      activa: true,
      api_key: 'sk_boletas_abc123def456',
    },
    {
      id: 'emp-eventos-002',
      nombre: 'Eventos Culturales UPTC',
      nit: '800987654-3',
      activa: true,
      api_key: 'sk_eventos_xyz789uvw012',
    },
  ];

  for (const empresa of empresas) {
    await Empresa.upsert(empresa);
    console.log(`✅ Empresa creada/actualizada: ${empresa.nombre}`);
  }

  console.log('\n🌱 Seed completado exitosamente');
  console.log('\n📋 API Keys para pruebas:');
  empresas.forEach(e => console.log(`  ${e.nombre}: ${e.api_key}`));
  process.exit(0);
};

seed().catch(err => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
