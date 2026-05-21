import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          // 允许上传常见的音频和图片格式
          allowedContentTypes: [
            'audio/mp4', 'audio/mpeg', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/ogg', 'video/mp4',
            'image/jpeg', 'image/png', 'image/webp', 'image/gif' 
          ],
          tokenPayload: JSON.stringify({}),
          // ✨ 核心修复：在这里向前端下发“允许添加随机后缀”的权限令牌
          addRandomSuffix: true, 
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("云端 Blob 上传完毕:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}