
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ SQL PARA CORRIGIR O BANCO DE DADOS:
 * Execute este comando no "SQL Editor" do seu Supabase para criar/ajustar a tabela:
 * 
 * -- 1. Criar tabela de leads (se não existir) ou adicionar coluna faltante
 * CREATE TABLE IF NOT EXISTS leads (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   name TEXT,
 *   phone TEXT NOT NULL,
 *   concurso TEXT, -- Esta é a coluna que estava faltando
 *   status TEXT DEFAULT 'PENDING',
 *   assigned_to UUID REFERENCES usuarios(id),
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 2. Se a tabela já existir e faltar apenas a coluna, execute:
 * -- ALTER TABLE leads ADD COLUMN IF NOT EXISTS concurso TEXT;
 * 
 * -- 3. Tabela de chamadas
 * CREATE TABLE IF NOT EXISTS calls (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   lead_id UUID REFERENCES leads(id),
 *   seller_id UUID REFERENCES usuarios(id),
 *   status TEXT NOT NULL,
 *   duration_seconds INTEGER DEFAULT 0,
 *   recording_url TEXT,
 *   timestamp TIMESTAMPTZ DEFAULT NOW()
 * );
 */
