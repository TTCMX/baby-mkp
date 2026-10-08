-- Who runs the site, shown in the Terms, the Privacy notice and the help page
-- (Admin → Ajustes → Datos legales y contacto).
insert into public.platform_settings (key, value, description) values
  ('legal_name', '""', 'Responsable del sitio (persona o razón social) para Términos y Aviso de privacidad'),
  ('legal_address', '""', 'Domicilio del responsable (Aviso de privacidad)'),
  ('support_email', '""', 'Correo de atención a clientes y de derechos ARCO'),
  ('support_whatsapp', '""', 'WhatsApp de atención (opcional)')
on conflict (key) do nothing;
