
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ SQL DE CORREÇÃO DEFINITIVA (Execute no SQL Editor do Supabase):
 * 
 * -- 1. Garantir que a coluna 'id' em usuarios é a chave primária UUID
 * ALTER TABLE public.usuarios ALTER COLUMN id TYPE UUID USING id::UUID;
 * ALTER TABLE public.usuarios ADD PRIMARY KEY (id);
 * 
 * -- 2. Limpar a coluna assigned_to de leads (remover lixo/strings vazias)
 * UPDATE public.leads 
 * SET assigned_to = NULL 
 * WHERE assigned_to IS NOT NULL 
 * AND (assigned_to = '' OR assigned_to = 'none' OR length(assigned_to) < 32);
 * 
 * -- 3. Forçar a coluna 'assigned_to' a ser UUID real
 * ALTER TABLE public.leads 
 * ALTER COLUMN assigned_to TYPE UUID USING assigned_to::UUID;
 * 
 * -- 4. Criar o Vínculo de Segurança (Foreign Key)
 * ALTER TABLE public.leads 
 * ADD CONSTRAINT fk_leads_assigned_to 
 * FOREIGN KEY (assigned_to) REFERENCES public.usuarios(id) 
 * ON DELETE SET NULL;
 * 
 * -- 5. Habilitar o Realtime para estas tabelas (Caso não esteja)
 * alter publication supabase_realtime add table leads;
 * alter publication supabase_realtime add table usuarios;
 */
