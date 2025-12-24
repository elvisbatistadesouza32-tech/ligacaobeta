
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ SOLUÇÃO DEFINITIVA - SQL PARA O SUPABASE EDITOR:
 * 
 * -- 1. Garantir que a coluna 'tipo' nunca seja nula e tenha padrão
 * ALTER TABLE public.usuarios ALTER COLUMN tipo SET DEFAULT 'vendedor';
 * UPDATE public.usuarios SET tipo = 'vendedor' WHERE tipo IS NULL OR tipo = '';
 * 
 * -- 2. Converter IDs errados para NULL nos leads antes de mudar tipo para UUID
 * UPDATE public.leads SET assigned_to = NULL 
 * WHERE assigned_to NOT SIMILAR TO '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
 * 
 * -- 3. Forçar coluna assigned_to para UUID real
 * ALTER TABLE public.leads ALTER COLUMN assigned_to TYPE UUID USING assigned_to::UUID;
 * 
 * -- 4. Criar FK correta
 * ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;
 * ALTER TABLE public.leads ADD CONSTRAINT leads_assigned_to_fkey 
 * FOREIGN KEY (assigned_to) REFERENCES public.usuarios(id) ON DELETE SET NULL;
 * 
 * -- 5. Recarregar cache
 * NOTIFY pgrst, 'reload schema';
 */
