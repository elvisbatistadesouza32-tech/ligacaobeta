
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛠️ SQL DE MANUTENÇÃO (Execute no SQL Editor do Supabase se o erro persistir):
 * 
 * -- Garante que strings vazias sejam tratadas como NULL para não "esconder" leads
 * UPDATE public.leads SET assigned_to = NULL WHERE assigned_to::text = '';
 * 
 * -- Garante que a coluna aceite UUIDs corretamente
 * ALTER TABLE public.leads ALTER COLUMN assigned_to TYPE UUID USING (CASE WHEN assigned_to = '' THEN NULL ELSE assigned_to::UUID END);
 */
