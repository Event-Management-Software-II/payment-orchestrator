INSERT INTO companies (id, name, "taxId", "isActive", "apiKey", "createdAt", "updatedAt")
VALUES
  ('company-tickets-001', 'Ticket Sales System Inc.', '900123456-7', true, 'sk_tickets_abc123def456', NOW(), NOW()),
  ('company-events-002',  'UPTC Cultural Events',     '800987654-3', true, 'sk_events_xyz789uvw012',  NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
