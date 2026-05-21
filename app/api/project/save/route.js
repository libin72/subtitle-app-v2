import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// 初始化 Prisma 数据库客户端
const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, title, audioName, audioUrl, rawText, newsDate, blocks, sentences } = body;

    let project;
    if (id) {
      // 如果前端传来了 ID，说明是已经存在的草稿，执行更新操作
      project = await prisma.project.update({
        where: { id: id },
        data: {
          title, 
          audioName, 
          audioUrl, 
          rawText, 
          newsDate,
          blocks: blocks || [],          // 【修改点】直接存入原生数组，去掉 stringify
          sentences: sentences || []     // 【修改点】直接存入原生数组，去掉 stringify
        }
      });
    } else {
      // 如果没有 ID，说明是全新的草稿，执行新建操作
      project = await prisma.project.create({
        data: {
          title: title || '未命名草稿', 
          audioName: audioName || '', 
          audioUrl: audioUrl || '', 
          rawText: rawText || '', 
          newsDate: newsDate || '',
          blocks: blocks || [],          // 【修改点】直接存入原生数组
          sentences: sentences || []     // 【修改点】直接存入原生数组
        }
      });
    }

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("保存数据库失败:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}