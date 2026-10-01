import Link from 'next/link'

export function PageHero({
  eyebrow,
  title,
  description,
  breadcrumb,
  breadcrumbHref,
  breadcrumbParent,
  breadcrumbParentHref,
}: {
  eyebrow?: string
  title: string
  description?: string
  /** Nhãn cấp cuối trong breadcrumb (mặc định = title) */
  breadcrumb?: string
  /** Link cấp cuối (nếu không truyền thì span tĩnh) */
  breadcrumbHref?: string
  /** Tên cấp cha giữa Trang chủ và breadcrumb */
  breadcrumbParent?: string
  /** Href của cấp cha */
  breadcrumbParentHref?: string
}) {
  const breadcrumbText = breadcrumb || title

  return (
    <section className="page-hero">
      <div className="container">
        <nav className="page-hero-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Trang chủ</Link>
          {breadcrumbParent && (
            <>
              <span aria-hidden="true">/</span>
              {breadcrumbParentHref ? (
                <Link href={breadcrumbParentHref}>{breadcrumbParent}</Link>
              ) : (
                <span>{breadcrumbParent}</span>
              )}
            </>
          )}
          <span aria-hidden="true">/</span>
          {breadcrumbHref ? (
            <Link href={breadcrumbHref}>{breadcrumbText}</Link>
          ) : (
            <span>{breadcrumbText}</span>
          )}
        </nav>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </section>
  )
}
