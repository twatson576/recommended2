import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cnlokdsscvpthrvvzlti.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNubG9rZHNzY3ZwdGhydnZ6bHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTAyODgsImV4cCI6MjA4OTA4NjI4OH0.QKetFdk_G_iW5BxH5kwXxOOakLkH_r3R-sSWdU4kfho";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
