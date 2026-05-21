import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 把 blocks 和 sentences 也一起返回，让前端能解析出封面图！
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { 
        id: true, 
        title: true, 
        audioName: true,
        newsDate: true, 
        updatedAt: true,
        blocks: true,      // 👈 放行 blocks 数据！
        sentences: true    // 👈 放行 sentences 数据！
      }
    });
    return NextResponse.json({ success: true, projects });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}