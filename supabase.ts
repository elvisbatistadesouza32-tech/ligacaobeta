
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ SQL FINAL PARA O BANCO DE DADOS (EXECUTE NO SQL EDITOR):
 * 
 * -- 1. Criar ou Recriar tabela de leads com colunas em português
 * CREATE TABLE IF NOT EXISTS leads (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   nome TEXT,
 *   telefone TEXT NOT NULL, -- Coluna renomeada de phone para telefone
 *   concurso TEXT,
 *   status TEXT DEFAULT 'PENDING',
 *   assigned_to UUID REFERENCES usuarios(id),
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 2. Se a tabela já existir e você precisar apenas renomear as colunas:
 * -- ALTER TABLE leads RENAME COLUMN name TO nome;
 * -- ALTER TABLE leads RENAME COLUMN phone TO telefone;
 * -- ALTER TABLE leads ADD COLUMN IF NOT EXISTS concurso TEXT;
 */
