const SUPABASE_URL = 'https://tnxbfkcijuilzdbulamd.supabase.co';   // your actual URL
const SUPABASE_ANON_KEY = 'sb_publishable_SOG1ptoVvZZR3uGeLs4WPw_4Y0F2val';              // your actual key

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'your_password';

// Only initialize if not already initialized
if (!window._supabaseClient) {
  window._supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const supabase = window._supabaseClient;
