import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body as { type: string; data: Record<string, string> };

    if (!type || !data) {
      return NextResponse.json({ error: "type과 data가 필요합니다." }, { status: 400 });
    }

    const prompt = buildPrompt(type, data);

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "당신은 한국어 사무 문서 작성 전문가입니다. 사용자가 제공한 정보를 바탕으로 전문적이고 체계적인 사무 문서를 작성합니다. 한국어로 작성하고 문서 형식을 명확하게 구분하세요.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ content });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    const status = message.includes("OPENAI_API_KEY") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

function buildPrompt(type: string, data: Record<string, string>): string {
  switch (type) {
    case "daily-report":
      return `다음 정보를 바탕으로 일일 업무보고서를 작성해주세요.

작성일: ${data.date || "오늘"}
작성자: ${data.author || "미입력"}
부서: ${data.department || "미입력"}

오늘 수행한 업무:
${data.completed || "미입력"}

진행 중인 업무:
${data.inProgress || "미입력"}

내일 예정 업무:
${data.planned || "미입력"}

특이사항/건의사항:
${data.notes || "없음"}

위 내용을 바탕으로 체계적인 일일 업무보고서 형식으로 작성해주세요. 제목, 날짜, 작성자 정보를 포함하고 각 항목을 명확히 구분하세요.`;

    case "weekly-report":
      return `다음 정보를 바탕으로 주간 업무보고서를 작성해주세요.

보고 주차: ${data.week || "미입력"}
작성자: ${data.author || "미입력"}
부서: ${data.department || "미입력"}

이번 주 주요 업무 실적:
${data.achievements || "미입력"}

이번 주 목표 대비 달성 현황:
${data.goalStatus || "미입력"}

다음 주 업무 계획:
${data.nextWeekPlan || "미입력"}

이슈/리스크 사항:
${data.issues || "없음"}

위 내용을 바탕으로 체계적인 주간 업무보고서 형식으로 작성해주세요. 표 형식이나 항목별 구분을 활용하고 전문적으로 작성하세요.`;

    case "meeting-minutes":
      return `다음 정보를 바탕으로 회의록을 작성해주세요.

회의명: ${data.meetingTitle || "미입력"}
회의 일시: ${data.meetingDate || "미입력"}
회의 장소: ${data.location || "미입력"}
참석자: ${data.attendees || "미입력"}
회의 주제: ${data.agenda || "미입력"}
주요 논의 내용: ${data.discussion || "미입력"}
결정 사항: ${data.decisions || "미입력"}
후속 조치 사항 (담당자/기한 포함): ${data.actionItems || "없음"}

위 내용을 바탕으로 공식적인 회의록 형식으로 작성해주세요. 결정 사항과 후속 조치를 명확히 구분하고 전문적으로 작성하세요.`;

    case "report":
      return `다음 정보를 바탕으로 업무 보고서를 작성해주세요.

보고서 제목: ${data.title || "미입력"}
작성일: ${data.date || "오늘"}
작성자/부서: ${data.authorDept || "미입력"}
보고 대상: ${data.recipient || "미입력"}
보고서 유형: ${data.reportType || "일반 보고서"}
배경/목적: ${data.background || "미입력"}
주요 내용: ${data.mainContent || "미입력"}
분석 및 시사점: ${data.analysis || "미입력"}
결론 및 건의사항: ${data.conclusion || "미입력"}
첨부: ${data.attachments || "없음"}

위 내용을 바탕으로 전문적인 업무 보고서 형식으로 작성해주세요. 제목, 개요, 본문, 결론 구조를 갖추고 명확하게 작성하세요.`;

    case "email":
      return `다음 정보를 바탕으로 업무 이메일을 작성해주세요.

발신자: ${data.sender || "미입력"}
수신자: ${data.recipient || "미입력"}
제목: ${data.subject || "미입력"}
이메일 유형: ${data.emailType || "일반"}
핵심 전달 내용: ${data.mainMessage || "미입력"}
요청/요구 사항: ${data.request || "없음"}
마감 기한: ${data.deadline || "미입력"}
첨부 파일: ${data.attachments || "없음"}
추가 메모: ${data.notes || "없음"}

위 내용을 바탕으로 정중하고 전문적인 업무 이메일을 작성해주세요. 인사말, 본문, 맺음말 구조를 갖추고 이메일 형식(수신자/발신자/제목 포함)으로 작성하세요.`;

    default:
      return `다음 정보를 바탕으로 사무 문서를 작성해주세요:\n${JSON.stringify(data, null, 2)}`;
  }
}
