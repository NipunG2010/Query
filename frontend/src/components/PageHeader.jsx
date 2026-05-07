export default function PageHeader({ overline, title, subtitle, actions }) {
  return (
    <div className="px-8 pt-10 pb-6 border-b border-terminal-border">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          {overline && <div className="overline mb-3">{overline}</div>}
          <h1 className="font-mono text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1] text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-terminal-zinc text-[13px] max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
