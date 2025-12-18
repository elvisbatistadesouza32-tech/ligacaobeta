
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ SQL PARA CORRIGIR O BANCO DE DADOS:
 * Copie e cole este comando no "SQL Editor" do seu Supabase:
 * 
 * -- 1. Ajustar ou Criar tabela de leads
 * CREATE TABLE IF NOT EXISTS leads (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   nome TEXT,          -- Alterado para 'nome'
 *   phone TEXT NOT NULL,
 *   concurso TEXT,      -- Campo de concurso
 *   status TEXT DEFAULT 'PENDING',
 *   assigned_to UUID REFERENCES usuarios(id),
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 2. Se a tabela já existir, rode estes comandos para garantir as colunas:
 * -- ALTER TABLE leads RENAME COLUMN name TO nome;
 * -- ALTER TABLE leads ADD COLUMN IF NOT EXISTS concurso TEXT;
 */
