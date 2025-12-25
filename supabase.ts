
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hjqxrgnbspsopgvgrmwg.supabase.co';
const supabaseKey = 'sb_publishable_RFbqWYX96ZEI4a0fIb3OfA_auw8uu3h';

export const supabase = createClient(supabaseUrl, supabaseKey);
