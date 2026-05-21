import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. 从前端接收直传成功后的 URL 链接
    const { fileUrl } = await request.json();
    if (!fileUrl) throw new Error("没有接收到音频云端链接");

    // 2. 后端在服务器内部飞速拉取这段音频到内存中
    // （服务器内网下载，速度极快，且不占用 4.5MB 的网关上传限制）
    const audioResponse = await fetch(fileUrl);
    const audioBuffer = await audioResponse.arrayBuffer();

    // 3. 把音频打包，准备发给 Whisper 大模型
    const formData = new FormData();
    // 构造一个 Blob 发给模型，随便赋个合法的文件名
    formData.append('file', new Blob([audioBuffer]), 'audio.m4a');
    formData.append('model', 'whisper-large-v3'); // 如果你用的是 OpenAI 则改为 whisper-1
    formData.append('response_format', 'verbose_json'); // 必须带上，用来返回毫秒级时间轴

    // 4. 发送给大模型（这里以 Groq 为例，如果你用 OpenAI，请把链接换回 openai 的）
    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}` // 你的环境变量密钥
      },
      body: formData
    });

    const result = await groqRes.json();
    
    if (!groqRes.ok) {
      throw new Error(result.error?.message || '大模型解析失败');
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Transcribe API 异常:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}