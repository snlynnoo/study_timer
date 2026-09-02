import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://yjdxtzwbwqbumdwrnkgz.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_DfroN4AGpc8DW0_0SmcLKA_9CTmA9RO";

// Wrap global fetch to gracefully handle transient JWT clock skew (PGRST303: "JWT issued at future")
const resilientFetch: typeof fetch = async (input, init) => {
  let response = await fetch(input, init);

  if (!response.ok && (response.status === 400 || response.status === 401 || response.status === 403)) {
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      if (text.includes("PGRST303") || text.toLowerCase().includes("jwt issued at future")) {
        console.warn("[Supabase] Detected clock skew (JWT issued at future). Retrying request in 1.5s...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
        response = await fetch(input, init);
      }
    } catch {
      // ignore parsing error
    }
  }

  return response;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: resilientFetch,
  },
});
