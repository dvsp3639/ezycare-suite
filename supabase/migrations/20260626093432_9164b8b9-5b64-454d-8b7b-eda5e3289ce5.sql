-- Rotate admin passwords that were previously set to a hardcoded value in a
-- prior migration. New passwords are random and never stored in source.
-- Operators must reset these via the bootstrap-admin edge function or the
-- Cloud Users panel to gain access.
UPDATE auth.users
SET encrypted_password = crypt(encode(gen_random_bytes(24), 'base64'), gen_salt('bf')),
    updated_at = now()
WHERE email IN ('superadmin@ezyop.com', 'admin@gmail.com');