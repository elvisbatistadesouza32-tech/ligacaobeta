
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ COMO CORRIGIR O ERRO "EMAIL NOT CONFIRMED":
 * 
 * 1. Acesse o Dashboard do seu Supabase.
 * 2. Vá em: Authentication -> Settings.
 * 3. Procure por: "Confirm Email".
 * 4. DESATIVE a opção para que usuários possam logar imediatamente sem confirmar e-mail.
 * 
 * --------------------------------------------------
 * 
 * SCHEMA SQL ATUALIZADO (Execute no SQL Editor):
 * 
 * CREATE TABLE usuarios (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   nome TEXT NOT NULL,
 *   email TEXT UNIQUE NOT NULL,
 *   tipo TEXT DEFAULT 'vendedor', -- 'adm' ou 'vendedor'
 *   online BOOLEAN DEFAULT false,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */
