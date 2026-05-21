import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// 初始化 Prisma 客户端
const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // 1. 解析前端传过来的 JSON 数据
    const body = await request.json();
    const { id } = body;

    // 2. 校验 ID 是否存在
    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少要删除的项目 ID' }, 
        { status: 400 }
      );
    }

    // 3. 核心！呼叫 Prisma 从数据库中彻底删除这条记录
    await prisma.project.delete({
      where: { 
        id: id // 如果你的 schema 里 id 是 Int 类型，这里可能需要写 Number(id)
      }
    });

    // 4. 成功后，给前端返回成功的信号
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('删除项目失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器内部错误' }, 
      { status: 500 }
    );
  }
}