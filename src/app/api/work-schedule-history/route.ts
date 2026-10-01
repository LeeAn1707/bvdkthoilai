import { NextRequest, NextResponse } from 'next/server'
import { getCMS } from '@/lib/payload'

export async function GET(req: NextRequest) {
  try {
    const payload = await getCMS()
    const auth = await payload.auth({ headers: req.headers })
    const user = auth.user as any

    // Chỉ cho phép người dùng đăng nhập xem nhật ký chỉnh sửa
    if (!user) {
      return NextResponse.json({ error: 'Yêu cầu đăng nhập quản trị.' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const docId = searchParams.get('id')

    if (!docId) {
      return NextResponse.json({ logs: [] }, { status: 200 })
    }

    // Truy vấn audit-logs thuộc resource 'work-schedules' với documentId tương ứng
    const result = await payload.find({
      collection: 'audit-logs' as any,
      overrideAccess: true,
      where: {
        and: [
          { resource: { equals: 'work-schedules' } },
          { documentId: { equals: String(docId) } },
        ],
      },
      sort: '-createdAt',
      limit: 50,
      depth: 1,
    })

    return NextResponse.json(
      { logs: result.docs || [] },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      }
    )
  } catch (error) {
    console.error('Lỗi lấy lịch sử audit work-schedules:', error)
    return NextResponse.json(
      { error: 'Không thể tải lịch sử chỉnh sửa.' },
      { status: 500 }
    )
  }
}
