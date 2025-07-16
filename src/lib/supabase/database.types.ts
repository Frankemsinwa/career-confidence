
// This file will be populated by the Supabase CLI.
// Run the following command to generate the types:
// npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> --schema public > src/lib/supabase/database.types.ts
//
// Replace <YOUR_PROJECT_ID> with your actual Supabase project ID.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {}
