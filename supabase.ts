
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * SCHEMA SQL ATUALIZADO (Execute no SQL Editor do Supabase):
 * 
 * -- Adicionar coluna de senha se já criou a tabela antes:
 * -- ALTER TABLE usuarios ADD COLUMN password TEXT;
 * 
 * CREATE TYPE user_role AS ENUM ('ADMIN', 'SELLER');
 * CREATE TYPE user_status AS ENUM ('ONLINE', 'OFFLINE');
 * CREATE TYPE call_status AS ENUM ('ANSWERED', 'NO_ANSWER', 'INVALID_NUMBER');
 * 
 * CREATE TABLE usuarios (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   name TEXT NOT NULL,
 *   email TEXT UNIQUE NOT NULL,
 *   password TEXT NOT NULL, -- Coluna para senhas individuais
 *   role user_role DEFAULT 'SELLER',
 *   status user_status DEFAULT 'OFFLINE',
 *   avatar TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- Resto das tabelas (leads, calls) permanecem iguais...
 */
