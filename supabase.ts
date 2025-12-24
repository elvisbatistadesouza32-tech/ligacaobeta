
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🚀 COMANDOS SQL OBRIGATÓRIOS (Execute no SQL Editor do Supabase):
 * 
 * -- 1. Transformar 'assigned_to' em UUID real (corrige falhas de filtro)
 * -- Importante: Se houver lixo na coluna, o comando abaixo limpa para NULL antes
 * UPDATE public.leads 
 * SET assigned_to = NULL 
 * WHERE assigned_to IS NOT NULL 
 * AND assigned_to !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
 * 
 * -- 2. Alterar o tipo da coluna definitivamente
 * ALTER TABLE public.leads 
 * ALTER COLUMN assigned_to TYPE UUID USING assigned_to::UUID;
 * 
 * -- 3. Adicionar a Chave Estrangeira para garantir integridade
 * ALTER TABLE public.leads 
 * ADD CONSTRAINT leads_assigned_to_fkey 
 * FOREIGN KEY (assigned_to) REFERENCES public.usuarios(id) ON DELETE SET NULL;
 * 
 * -- 4. Garantir que a coluna 'tipo' nos usuários seja minúscula por padrão
 * ALTER TABLE public.usuarios ALTER COLUMN tipo SET DEFAULT 'vendedor';
 * UPDATE public.usuarios SET tipo = 'vendedor' WHERE tipo IS NULL OR tipo = '';
 * 
 */
