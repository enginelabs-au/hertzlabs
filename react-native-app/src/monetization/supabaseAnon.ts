/** Supabase anon key for edge-function calls from the app (public). */
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12YXdremh3Z3Rsd3h3a3NzdnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NDE2OTcsImV4cCI6MjA5NzQxNzY5N30.mD0kFjNJFSlNEpOWHuO6tA0D1Oc_FHF2UqhDd2AMVOU';

export const SUPABASE_FUNCTION_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
} as const;
