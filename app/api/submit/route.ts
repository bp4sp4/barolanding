import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendConsultationEmail } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 환경 변수가 없을 때를 대비한 클라이언트 생성
const getSupabaseClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, contact, privacyAgreed, clickSource } = body

    // 필수 필드 검증
    if (!name || !contact) {
      return NextResponse.json(
        { error: '이름과 연락처를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!privacyAgreed) {
      return NextResponse.json(
        { error: '개인정보 처리방침에 동의해주세요.' },
        { status: 400 }
      )
    }

    // Supabase 클라이언트 가져오기
    const supabase = getSupabaseClient()
    
    if (!supabase) {
      return NextResponse.json(
        { error: '데이터베이스 연결 설정이 필요합니다.' },
        { status: 500 }
      )
    }

    // Supabase에 데이터 저장
    const { data, error } = await supabase
      .from('consultations')
      .insert([
        {
          name,
          contact,
          is_completed: false, // 신청 시에는 미완료 상태
          click_source: clickSource || 'unknown', // 클릭 출처 추적
        },
      ])
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: '데이터 저장 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 이메일 알림 전송 (비동기, 실패해도 상담 신청은 성공 처리)
    if (process.env.NAVER_EMAIL && process.env.NAVER_APP_PASSWORD) {
      sendConsultationEmail({
        name,
        contact,
        click_source: clickSource || null,
      }).catch((emailError) => {
        console.error("Failed to send email notification:", emailError);
        // 이메일 실패는 로그만 남기고 사용자에게는 에러를 반환하지 않음
      });
    }

    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    )
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
