import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://jqbhavgofbdvkeberovc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_TddZu6G_crUDWTr6im_oMw_2tBmMUjk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);