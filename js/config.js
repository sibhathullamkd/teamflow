var SUPABASE_URL = 'https://tnxbfkcijuilzdbulamd.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_SOG1ptoVvZZR3uGeLs4WPw_4Y0F2val';
var ADMIN_USERNAME = 'admin';
var ADMIN_PASSWORD = 'fhzadmin2026';

if (!window._supabaseClient) {
  window._supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
var supabase = window._supabaseClient;
