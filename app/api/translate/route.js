import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 解析前端传来的 JSON
    const body = await request.json();

    // 构造发给 Groq 的请求体
    const groqPayload = {
      model: 'llama-3.3-70b-versatile',
      messages: body.messages,
      temperature: body.temperature || 0.1,
      response_format: body.response_format
    };

    // 转发给 Groq
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(groqPayload),
    });

    if (!groqRes.ok) {
      const errorText = await groqRes.text();
      return NextResponse.json({ error: `Groq API Error: ${errorText}` }, { status: groqRes.status });
    }

    const data = await groqRes.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Translation Proxy Error:", error);
    return NextResponse.json({ error: "服务器内部错误，转发失败" }, { status: 500 });
  }
}