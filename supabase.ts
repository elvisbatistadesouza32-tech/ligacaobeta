
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bpaofwfcvxgortbsscbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYW9md2Zjdnhnb3J0YnNzY2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTQ1ODUsImV4cCI6MjA4MTU5MDU4NX0.4cuEy-O48wR_omWfOQae0_rFXZGcFuyliJKRq7tVxZI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛡️ ARQUITETURA DE BANCO BLINDADA (SQL Editor do Supabase):
 * 
 * -- 1. TABELA PRINCIPAL DE LEADS
 * CREATE TABLE IF NOT EXISTS public.leads (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     created_at timestamptz DEFAULT now(),
 *     nome text NOT NULL,
 *     telefone text NOT NULL,
 *     concurso text DEFAULT 'Geral',
 *     status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CALLED', 'WON', 'LOST')),
 *     assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 *     updated_at timestamptz DEFAULT now()
 * );
 * 
 * -- 2. VIEW PARA FILA GERAL (Somente leads disponíveis)
 * CREATE OR REPLACE VIEW public.fila_geral AS
 * SELECT * FROM public.leads 
 * WHERE assigned_to IS NULL AND status = 'PENDING';
 * 
 * -- 3. FUNCTION DE DISTRIBUIÇÃO ATÔMICA (Previne Race Conditions)
 * CREATE OR REPLACE FUNCTION distribuir_leads_batch(quantidade int, vendedor_id uuid)
 * RETURNS void AS $$
 * BEGIN
 *   UPDATE public.leads
 *   SET assigned_to = vendedor_id,
 *       updated_at = now()
 *   WHERE id IN (
 *     SELECT id FROM public.leads
 *     WHERE assigned_to IS NULL AND status = 'PENDING'
 *     ORDER BY created_at ASC
 *     LIMIT quantidade
 *     FOR UPDATE SKIP LOCKED
 *   );
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 * 
 * -- 4. POLÍTICAS DE RLS (SEGURANÇA POR PERFIL)
 * ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
 * 
 * -- Admin pode tudo
 * CREATE POLICY "Admins possuem acesso total" ON public.leads
 * FOR ALL TO authenticated
 * USING ( (SELECT tipo FROM public.usuarios WHERE id = auth.uid()) = 'adm' );
 * 
 * -- Vendedor só vê o que é dele
 * CREATE POLICY "Vendedores veem seus próprios leads" ON public.leads
 * FOR SELECT TO authenticated
 * USING ( assigned_to = auth.uid() );
 * 
 * CREATE POLICY "Vendedores atualizam seus próprios leads" ON public.leads
 * FOR UPDATE TO authenticated
 * USING ( assigned_to = auth.uid() )
 * WITH CHECK ( assigned_to = auth.uid() );
 */
