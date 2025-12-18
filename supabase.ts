
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ SETUP DO BANCO DE DADOS (SQL EDITOR DO SUPABASE):
 * 
 * -- 1. Habilitar UUID
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
 * -- 3. Tabela de Leads
 * -- O campo 'status' possui um DEFAULT 'PENDING' para não precisar ser enviado no INSERT.
 * CREATE TABLE IF NOT EXISTS leads (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   nome TEXT,
 *   telefone TEXT,
 *   concurso TEXT,
 *   status TEXT DEFAULT 'PENDING',
 *   assigned_to UUID REFERENCES usuarios(id),
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 4. Tabela de Chamadas (Calls)
 * CREATE TABLE IF NOT EXISTS calls (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
 *   seller_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
 *   status TEXT NOT NULL,
 *   duration_seconds INTEGER DEFAULT 0,
 *   timestamp TIMESTAMPTZ DEFAULT NOW(),
 *   recording_url TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 5. Habilitar Realtime
 * alter publication supabase_realtime add table usuarios;
 * alter publication supabase_realtime add table leads;
 * alter publication supabase_realtime add table calls;
 * 
 * -- 6. CRÍTICO: Recarregar o cache do schema para resolver erros de "table not found"
 * NOTIFY pgrst, 'reload schema';
 */
