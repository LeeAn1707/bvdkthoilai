import { NextResponse } from 'next/server'
import { getCMS } from '@/lib/payload'
import { getVerifiedActiveUser, hasModulePermission } from '@/access'
import { SYSTEM_SURVEY_PRESETS } from '@/lib/surveyTemplatePresets'
import {
  getSavedSurveyTemplates,
  saveSurveyTemplate,
  deleteSavedSurveyTemplate,
} from '@/lib/savedSurveyTemplatesStore'

const authorize = async (request: Request, action: 'view' | 'create' | 'edit' | 'delete') => {
  const payload = await getCMS()
  const user = await getVerifiedActiveUser(payload, request.headers)
  return { payload, user, allowed: Boolean(user && hasModulePermission(user, 'surveys', action)) }
}

export async function GET(request: Request) {
  try {
    const { payload, user, allowed: canViewAdminTemplates } = await authorize(request, 'view')
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const templateId = searchParams.get('templateId')

    if ((templateId || campaignId) && !user) {
      return NextResponse.json({ error: 'Bạn cần đăng nhập để đọc chi tiết mẫu khảo sát.' }, { status: 401 })
    }
    if ((templateId || campaignId) && !canViewAdminTemplates) {
      return NextResponse.json({ error: 'Bạn không có quyền đọc chi tiết mẫu khảo sát.' }, { status: 403 })
    }

    // 1. Lấy chi tiết mẫu do người dùng tự lưu
    if (templateId) {
      const savedTemplates = getSavedSurveyTemplates()
      const found = savedTemplates.find((t) => t.id === templateId)
      if (!found) {
        return NextResponse.json({ error: 'Không tìm thấy mẫu khảo sát đã lưu.' }, { status: 404 })
      }
      return NextResponse.json({
        ok: true,
        template: found,
        questions: found.questions,
      })
    }

    // 2. Nếu truyền campaignId cụ thể -> trả về chi tiết danh sách câu hỏi của campaign đó để clone
    if (campaignId) {
      const camp = await payload.findByID({
        collection: 'survey-campaigns',
        id: Number(campaignId),
        depth: 2,
        overrideAccess: true,
      })

      if (!camp) {
        return NextResponse.json({ error: 'Không tìm thấy đợt khảo sát.' }, { status: 404 })
      }

      let questions: any[] = []
      if (camp.useCustomQuestions && Array.isArray(camp.customQuestions) && camp.customQuestions.length > 0) {
        questions = camp.customQuestions.map((cq: any, idx: number) => ({
          code: cq.code || `C${idx + 1}`,
          type: cq.type || 'rating5',
          question: cq.question,
          options: cq.options || '',
          required: cq.required !== false,
          order: cq.order || idx + 1,
        }))
      } else if (camp.templateVersion && typeof camp.templateVersion === 'object') {
        const v: any = camp.templateVersion
        questions = (v.questions || []).map((q: any, idx: number) => ({
          code: q.code || `C${idx + 1}`,
          type: q.type || 'rating5',
          question: q.question,
          options: q.options || '',
          required: q.required !== false,
          order: q.order || idx + 1,
        }))
      }

      return NextResponse.json({
        ok: true,
        campaign: {
          id: camp.id,
          title: camp.title,
          publicNote: camp.publicNote,
          showDemographics: camp.showDemographics,
          customOptions: camp.customOptions,
        },
        questions,
      })
    }

    // 3. Lấy danh sách các đợt khảo sát đã có trong hệ thống
    const campaignsResult = await payload.find({
      collection: 'survey-campaigns',
      limit: 100,
      sort: 'id',
      overrideAccess: true,
    })

    const campaigns = campaignsResult.docs
      .filter((c: any) => canViewAdminTemplates || c.active === true)
      .map((c: any) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      active: c.active,
      questionsCount: Array.isArray(c.customQuestions) ? c.customQuestions.length : 0,
      createdAt: c.createdAt,
      }))

    if (!canViewAdminTemplates) {
      return NextResponse.json({ ok: true, campaigns })
    }

    // 4. Lấy danh sách các mẫu tự lưu của người quản trị
    const savedTemplates = getSavedSurveyTemplates()

    return NextResponse.json({
      ok: true,
      presets: SYSTEM_SURVEY_PRESETS.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        type: p.type,
        icon: p.icon,
        questionsCount: p.questions.length,
      })),
      savedTemplates: savedTemplates.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        createdAt: t.createdAt,
        questionsCount: t.questions.length,
      })),
      campaigns,
    })
  } catch (error: any) {
    console.error('API SURVEY TEMPLATES ERROR:', error?.message || error)
    return NextResponse.json({ error: 'Lỗi xử lý danh sách mẫu khảo sát.' }, { status: 500 })
  }
}

// POST: Lưu mẫu khảo sát tái sử dụng mới
export async function POST(request: Request) {
  try {
    const { user, allowed } = await authorize(request, 'create')
    if (!user) {
      return NextResponse.json({ error: 'Bạn cần đăng nhập để lưu mẫu khảo sát.' }, { status: 401 })
    }
    if (!allowed && !hasModulePermission(user, 'surveys', 'edit')) {
      return NextResponse.json({ error: 'Bạn không có quyền lưu mẫu khảo sát.' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, questions } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Vui lòng nhập tên cho mẫu khảo sát.' }, { status: 400 })
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Danh sách câu hỏi không được để trống.' }, { status: 400 })
    }

    const saved = saveSurveyTemplate({
      title,
      description,
      questions,
    })

    return NextResponse.json({
      ok: true,
      message: 'Lưu mẫu khảo sát tái sử dụng thành công.',
      template: saved,
    })
  } catch (error: any) {
    console.error('API SURVEY TEMPLATES POST ERROR:', error?.message || error)
    return NextResponse.json({ error: 'Lỗi khi lưu mẫu khảo sát.' }, { status: 500 })
  }
}

// DELETE: Xóa mẫu khảo sát đã lỗi thời
export async function DELETE(request: Request) {
  try {
    const { user, allowed } = await authorize(request, 'delete')
    if (!user) {
      return NextResponse.json({ error: 'Bạn cần đăng nhập để xóa mẫu khảo sát.' }, { status: 401 })
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Bạn không có quyền xóa mẫu khảo sát.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Thiếu mã mẫu cần xóa.' }, { status: 400 })
    }

    const success = deleteSavedSurveyTemplate(id)
    if (!success) {
      return NextResponse.json({ error: 'Không tìm thấy mẫu hoặc mẫu đã bị xóa trước đó.' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      message: 'Đã xóa mẫu khảo sát thành công.',
    })
  } catch (error: any) {
    console.error('API SURVEY TEMPLATES DELETE ERROR:', error?.message || error)
    return NextResponse.json({ error: 'Lỗi khi xóa mẫu khảo sát.' }, { status: 500 })
  }
}
