
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ SCRIPT DE REPARO E SETUP (COPIE E COLE NO SQL EDITOR DO SUPABASE):
 * 
 * -- 1. Garante extensões e tabelas básicas
 * CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
 * 
 * -- 2. Tabela de Usuários
 * CREATE TABLE IF NOT EXISTS usuarios (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   nome TEXT,
 *   email TEXT UNIQUE,
 *   tipo TEXT DEFAULT 'vendedor',
 *   online BOOLEAN DEFAULT false,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 3. Tabela de Leads (Com correção de colunas)
 * CREATE TABLE IF NOT EXISTS leads (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   nome TEXT,
 *   telefone TEXT,
 *   concurso TEXT,
 *   status TEXT DEFAULT 'PENDING',
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- COMANDO CRÍTICO: Adiciona a coluna assigned_to se ela não existir
 * DO $$ 
 * BEGIN 
 *   IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='assigned_to') THEN
 *     ALTER TABLE leads ADD COLUMN assigned_to UUID REFERENCES usuarios(id);
 *   END IF;
 * END $$;
 * 
 * -- 4. Tabela de Chamadas
 * CREATE TABLE IF NOT EXISTS calls (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
 *   seller_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
 *   status TEXT NOT NULL,
 *   duration_seconds INTEGER DEFAULT 0,
 *   timestamp TIMESTAMPTZ DEFAULT NOW(),
 *   recording_url TEXT
 * );
 * 
 * -- 5. Habilitar Realtime e Atualizar Cache
 * alter publication supabase_realtime add table usuarios, leads, calls;
 * NOTIFY pgrst, 'reload schema';
 */
