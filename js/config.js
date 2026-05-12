// ============================================================
//  PLANR — CONFIGURATION
//  Replace the values below with your Supabase project details
//  Found at: https://supabase.com → Your Project → Settings → API
// ============================================================

const SUPABASE_URL = 'https://tnxbfkcijuilzdbulamd.supabase.co';        // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_SOG1ptoVvZZR3uGeLs4WPw_4Y0F2val'; // starts with "eyJ..."

// Admin credentials (for hidden admin panel only)
// Change these to your desired admin username/password
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'fhzadmin2026';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
