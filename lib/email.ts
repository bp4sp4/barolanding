import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

// 네이버 메일 SMTP transporter 생성 함수
function createTransporter() {
  if (!process.env.NAVER_EMAIL || !process.env.NAVER_APP_PASSWORD) {
    throw new Error("NAVER_EMAIL or NAVER_APP_PASSWORD not configured");
  }

  // 네이버 공식 설정: 포트 465, 보안 연결(SSL) 필요
  // 서버리스 환경에서도 네이버의 공식 포트 사용
  return nodemailer.createTransport({
    host: "smtp.naver.com",
    port: 465, // 네이버 공식 포트 (SSL 필요)
    secure: true, // SSL 사용 (네이버 공식 설정)
    auth: {
      user: process.env.NAVER_EMAIL, // 네이버 이메일 주소
      pass: process.env.NAVER_APP_PASSWORD, // 네이버 앱 비밀번호
    },
    // 배포 환경에서 연결 안정성을 위한 설정
    connectionTimeout: 20000, // 20초로 증가
    greetingTimeout: 20000, // 20초로 증가
    socketTimeout: 20000, // 20초로 증가
    debug: false, // 디버그 모드 비활성화
    logger: false, // 로거 비활성화
    pool: true, // 연결 풀 사용 (재사용)
    maxConnections: 1, // 최대 연결 수
    maxMessages: 3, // 연결당 최대 메시지 수
    tls: {
      // TLS/SSL 설정
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      ciphers: "SSLv3", // 호환성을 위한 설정
    },
  });
}

interface ConsultationEmailData {
  name: string;
  contact: string;
  click_source?: string | null;
}

export async function sendConsultationEmail(data: ConsultationEmailData) {
  try {
    // 환경 변수 확인 및 로깅
    console.log("sendConsultationEmail called with data:", {
      name: data.name,
      contact: data.contact,
      click_source: data.click_source,
    });

    if (!process.env.NAVER_EMAIL) {
      console.error("NAVER_EMAIL not configured");
      return { success: false, error: "NAVER_EMAIL not configured" };
    }

    if (!process.env.NAVER_APP_PASSWORD) {
      console.error("NAVER_APP_PASSWORD not configured");
      return { success: false, error: "NAVER_APP_PASSWORD not configured" };
    }

    const recipientEmail =
      process.env.CONSULTATION_EMAIL || process.env.NAVER_EMAIL;

    if (!recipientEmail) {
      console.error("Recipient email not configured");
      return { success: false, error: "Recipient email not configured" };
    }

    console.log("Email configuration:", {
      from: process.env.NAVER_EMAIL,
      to: recipientEmail,
      hasPassword: !!process.env.NAVER_APP_PASSWORD,
    });

    // Transporter 생성 및 연결 검증
    // 배포 환경에서 verify()가 실패할 수 있으므로 직접 전송 시도
    const transporter = createTransporter();
    console.log("Transporter created");

    // verify는 배포 환경에서 타임아웃될 수 있으므로 스킵하고 바로 전송 시도
    // verify()를 호출하면 "Greeting never received" 에러가 발생할 수 있음
    // 대신 직접 sendMail을 시도하고, 실패하면 그때 에러 처리
    console.log(
      "Skipping SMTP verify (can cause timeout in serverless environments)"
    );

    // 로고 이미지를 attachments로 첨부하고 cid로 인라인 표시
    // 배포 환경에서 파일 경로가 다를 수 있으므로 여러 경로 시도
    // 로고 파일이 없어도 이메일은 정상 전송되도록 에러를 잡아서 처리
    let attachments: any[] = [];
    let logoCid = "";

    try {
      const possibleLogoPaths = [
        path.join(process.cwd(), "public", "logo_black.png"),
        path.join(process.cwd(), ".next", "static", "logo_black.png"),
        path.join(process.cwd(), "logo_black.png"),
        path.join(__dirname, "..", "..", "public", "logo_black.png"),
      ];

      console.log("Current working directory:", process.cwd());
      console.log("Trying logo paths:", possibleLogoPaths);

      let logoFound = false;
      for (const logoPath of possibleLogoPaths) {
        try {
          if (fs.existsSync(logoPath)) {
            console.log("Logo file found at:", logoPath);
            logoCid = "logo_black";
            attachments.push({
              filename: "logo_black.png",
              path: logoPath,
              cid: logoCid, // Content-ID로 참조
            });
            logoFound = true;
            break;
          }
        } catch (pathError) {
          console.warn(`Failed to check logo path ${logoPath}:`, pathError);
        }
      }

      if (!logoFound) {
        console.warn(
          "Logo file not found in any of the attempted paths, continuing without logo"
        );
      }
    } catch (logoError) {
      // 로고 파일 처리 중 에러가 발생해도 이메일 전송은 계속
      console.warn(
        "Error processing logo file, continuing without logo:",
        logoError
      );
    }

    const mailOptions = {
      from: `"한평생 바로기업" <${process.env.NAVER_EMAIL}>`,
      to: recipientEmail,
      subject: `[상담 접수] ${data.name}님`,
      attachments: attachments,
      html: `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
            body { font-family: 'Pretendard', sans-serif; -webkit-font-smoothing: antialiased; }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #ffffff; color: #191f28;">
          <div style="max-width: 600px; margin: 0 auto; padding: 60px 24px;">
            ${
              logoCid
                ? `<div style="margin-bottom: 48px;">
              <img src="cid:${logoCid}" alt="한평생 바로기업" style="height: 32px; width: auto;" />
            </div>`
                : ""
            }

            <div style="margin-bottom: 40px;">
              <h1 style="font-size: 28px; font-weight: 700; line-height: 1.4; margin: 0; color: #191f28;">
                새로운 상담 신청이<br />도착했어요
              </h1>
            </div>

            <div style="background-color: #f9fafb; border-radius: 20px; padding: 32px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding-bottom: 20px; font-size: 15px; color: #4e5968; width: 100px;">성함/기업명</td>
                  <td style="padding-bottom: 20px; font-size: 17px; font-weight: 600; color: #191f28; text-align: right;">${
                    data.name
                  }</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 20px; font-size: 15px; color: #4e5968;">연락처</td>
                  <td style="padding-bottom: 20px; font-size: 17px; font-weight: 600; color: #3182f6; text-align: right;">
                    <a href="tel:${data.contact.replace(
                      /-/g,
                      ""
                    )}" style="color: #3182f6; text-decoration: none;">${
        data.contact
      }</a>
                  </td>
                </tr>
                ${
                  data.click_source
                    ? `
                <tr>
                  <td style="padding-bottom: 20px; font-size: 15px; color: #4e5968;">유입 경로</td>
                  <td style="padding-bottom: 20px; font-size: 17px; font-weight: 600; color: #191f28; text-align: right;">${data.click_source}</td>
                </tr>
                `
                    : ""
                }
                <tr style="border-top: 1px solid #ebedf0;">
                  <td style="padding-top: 20px; font-size: 14px; color: #8b95a1;">신청 시각</td>
                  <td style="padding-top: 20px; font-size: 14px; color: #8b95a1; text-align: right;">${new Date().toLocaleString(
                    "ko-KR"
                  )}</td>
                </tr>
              </table>
            </div>

            <div style="margin-top: 40px;">
              <a href="tel:${data.contact.replace(/-/g, "")}" 
                 style="display: inline-block; background-color: #3182f6; color: #ffffff; padding: 16px 32px; border-radius: 12px; font-size: 16px; font-weight: 600; text-decoration: none; width: calc(100% - 64px); text-align: center;">
                지금 바로 전화하기
              </a>
            </div>

            <div style="margin-top: 60px; padding-top: 32px; border-top: 1px solid #f2f4f6; text-align: left;">
              <p style="margin: 0; font-size: 13px; color: #8b95a1; line-height: 1.6;">
                본 메일은 한평생 바로기업 웹사이트를 통해 수신되었습니다.<br />
                서울시 도봉구 창동 마들로13길 61 씨드큐브 905호 | 02-2135-6221
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
새로운 상담 신청이 접수되었습니다.

이름(회사명): ${data.name}
연락처: ${data.contact}
${data.click_source ? `유입 경로: ${data.click_source}\n` : ""}
신청 시간: ${new Date().toLocaleString("ko-KR")}
      `,
    };

    console.log("Sending email with nodemailer...");
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any)?.code,
      command: (error as any)?.command,
      response: (error as any)?.response,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
