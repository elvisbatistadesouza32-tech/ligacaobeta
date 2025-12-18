
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ CÓDIGO PARA COPIAR E COLAR NO SQL EDITOR DO SUPABASE:
 * 
 * -- 1. Habilitar extensões necessárias
 * CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
 * 
 * -- 2. Criar tabela de usuários
 * CREATE TABLE IF NOT EXISTS usuarios (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   nome TEXT,
 *   email TEXT UNIQUE,
 *   tipo TEXT DEFAULT 'vendedor',
 *   online BOOLEAN DEFAULT false,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 3. Criar tabela de leads
 * CREATE TABLE IF NOT EXISTS leads (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   nome TEXT,
 *   telefone TEXT,
 *   concurso TEXT,
 *   status TEXT DEFAULT 'PENDING',
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 4. REPARO CRÍTICO: Adicionar a coluna 'assigned_to' se ela não existir
 * DO $$ 
 * BEGIN 
 *   IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='assigned_to') THEN
 *     ALTER TABLE leads ADD COLUMN assigned_to UUID REFERENCES usuarios(id) ON DELETE SET NULL;
 *   END IF;
 * END $$;
 * 
 * -- 5. Criar tabela de chamadas
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
 * -- 6. Configurar Realtime
 * DROP PUBLICATION IF EXISTS supabase_realtime;
 * CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
 * 
 * -- 7. FORÇAR RECARREGAMENTO DO SCHEMA (MUITO IMPORTANTE!)
 * NOTIFY pgrst, 'reload schema';
 */
