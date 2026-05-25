import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yeexedluqmvekewrukpq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllZXhlZGx1cW12ZWtld3J1a3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NTc4MTgsImV4cCI6MjA5NTIzMzgxOH0.unlcT8NSZNbk56sGweUyYAVT-NbavjJ9dlUnw7WAA3Q'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
