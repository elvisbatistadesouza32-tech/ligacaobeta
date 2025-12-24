
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ SQL DE CORREÇÃO E REALTIME (Execute no SQL Editor do Supabase):
 * 
 * -- 1. Converter IDs para UUID e Primary Keys
 * ALTER TABLE public.usuarios ALTER COLUMN id TYPE UUID USING id::UUID;
 * ALTER TABLE public.usuarios ADD PRIMARY KEY (id);
 * 
 * -- 2. Corrigir coluna de atribuição em leads
 * ALTER TABLE public.leads ALTER COLUMN assigned_to TYPE UUID USING assigned_to::UUID;
 * 
 * -- 3. Limpar strings vazias que quebram o filtro
 * UPDATE public.leads SET assigned_to = NULL WHERE assigned_to::text = '';
 * 
 * -- 4. Habilitar Realtime para as tabelas principais
 * ALTER TABLE public.leads REPLICA IDENTITY FULL;
 * ALTER TABLE public.usuarios REPLICA IDENTITY FULL;
 * 
 * -- 5. Adicionar à publicação de Realtime
 * DROP PUBLICATION IF EXISTS supabase_realtime;
 * CREATE PUBLICATION supabase_realtime FOR TABLE public.leads, public.usuarios, public.calls;
 */
