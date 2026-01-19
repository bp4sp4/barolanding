import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// 서버 사이드에서 사용하는 Supabase Admin 클라이언트
// SERVICE_ROLE_KEY를 사용하여 RLS를 우회하고 모든 권한으로 접근 가능
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
