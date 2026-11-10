/** Bold uppercase heading with the red underline bar from the theme. */
export default function SectionTitle({ as: Tag = 'h2', children, sub, center = false, className = '' }) {
  return (
    <div className={`${center ? 'text-center' : ''} ${className}`}>
      <Tag className="section-title">{children}</Tag>
      <span className={`title-bar ${center ? 'title-bar-center' : ''}`} aria-hidden="true" />
      {sub && <p className={`mt-3 text-[15px] text-ink-3 ${center ? 'mx-auto max-w-xl' : ''}`}>{sub}</p>}
    </div>
  );
}
