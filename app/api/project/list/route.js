import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // 👈 从 lib 导入单例

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { 
        id: true, 
        title: true, 
        audioName: true,
        newsDate: true, 
        updatedAt: true,
        blocks: true,      
        sentences: true    
      }
    });
    return NextResponse.json({ success: true, projects });
  } catch (error) {
    console.error("Database Error:", error); // 这行很重要，在终端看报错！
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}