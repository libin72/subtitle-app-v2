import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ success: false, error: '缺少 ID' }, { status: 400 });

  try {
    const project = await prisma.project.findUnique({
      where: { id: id }
    });
    return NextResponse.json({ success: true, project });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}