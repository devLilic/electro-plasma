import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

function cn(...tokens: Array<string | false | null | undefined>) {
  return tokens.filter(Boolean).join(' ')
}

export function AppShell(props: { children: ReactNode; className?: string }) {
  return (
    <main className={cn('plasma-workspace min-h-screen bg-plasma-bg text-plasma-text', props.className)}>
      {props.children}
    </main>
  )
}

export function TopBar(props: { children: ReactNode; className?: string }) {
  return (
    <header className={cn(
      'mb-4 border-b border-plasma-divider bg-plasma-surface px-5 py-4 text-[#E2E8F0] shadow-none backdrop-blur',
      props.className,
    )}>
      {props.children}
    </header>
  )
}

export function Panel(props: { children: ReactNode; className?: string; elevated?: boolean }) {
  return (
    <section className={cn(props.elevated ? 'plasma-panel-elevated' : 'plasma-panel', props.className)}>
      {props.children}
    </section>
  )
}

export function SectionHeader(props: { eyebrow: string; title: string; meta?: string; className?: string }) {
  return (
    <div className={cn('mb-4 flex items-center justify-between', props.className)}>
      <div>
        <p className='plasma-micro-label text-plasma-externalConnected'>{props.eyebrow}</p>
        <h2 className='plasma-section-title mt-1'>{props.title}</h2>
      </div>
      {props.meta && (
        <span className='rounded-full border border-plasma-border px-3 py-1 text-xs text-plasma-textSecondary'>
          {props.meta}
        </span>
      )}
    </div>
  )
}

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger'

function buttonClassName(tone: ButtonTone, disabled?: boolean, compact?: boolean) {
  const base = cn(
    'plasma-button inline-flex items-center justify-center gap-2 border outline-none',
    'focus-visible:ring-2 focus-visible:ring-plasma-blue focus-visible:ring-offset-2 focus-visible:ring-offset-plasma-bg',
    compact ? 'min-h-9 rounded-control px-3 py-2' : 'min-h-10 rounded-button px-4 py-2.5',
    disabled && 'cursor-not-allowed opacity-50',
  )

  if (tone === 'primary') {
    return cn(base, 'border-plasma-blue bg-plasma-blue text-plasma-text hover:border-plasma-blueHover hover:bg-plasma-blueHover')
  }

  if (tone === 'secondary') {
    return cn(base, 'border-plasma-borderStrong bg-plasma-panelSecondary text-[#E2E8F0] hover:bg-[#273449]')
  }

  if (tone === 'danger') {
    return cn(base, 'border-plasma-red bg-plasma-red text-plasma-text hover:brightness-110')
  }

  return cn(base, 'border-transparent bg-transparent text-plasma-textSecondary hover:bg-[rgba(148,163,184,0.08)]')
}

function BaseButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { tone: ButtonTone; compact?: boolean },
) {
  const { className, tone, compact, type = 'button', ...rest } = props
  return (
    <button
      type={type}
      className={cn(buttonClassName(tone, props.disabled, compact), className)}
      {...rest}
    />
  )
}

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <BaseButton tone='primary' {...props} />
}

export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <BaseButton tone='secondary' {...props} />
}

export function GhostButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <BaseButton tone='ghost' {...props} />
}

export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ReactNode }) {
  const { label, icon, children, className, ...rest } = props
  return (
    <BaseButton
      tone='ghost'
      compact
      aria-label={label}
      title={label}
      className={cn('h-9 w-9 px-0', className)}
      {...rest}
    >
      {icon}
      {children}
    </BaseButton>
  )
}

export function StatusBadge(props: {
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  children: ReactNode
  className?: string
}) {
  const toneClassName = props.tone === 'success'
    ? 'bg-plasma-green/15 text-plasma-green'
    : props.tone === 'warning'
      ? 'bg-plasma-amber/15 text-plasma-amber'
      : props.tone === 'danger'
        ? 'bg-plasma-red/15 text-plasma-red'
        : props.tone === 'info'
          ? 'bg-plasma-externalConnected/15 text-plasma-externalConnected'
          : 'bg-plasma-textDisabled/15 text-plasma-textMuted'

  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold', toneClassName, props.className)}>
      {props.children}
    </span>
  )
}

export function Divider(props: HTMLAttributes<HTMLHRElement>) {
  return <hr {...props} className={cn('plasma-divider border-0 border-t', props.className)} />
}

export function ProgressBar(props: { value: number; className?: string; label?: string }) {
  const width = `${Math.max(0, Math.min(100, props.value))}%`
  return (
    <div className={cn('w-full', props.className)}>
      {props.label && <p className='plasma-micro-label mb-2 text-plasma-textMuted'>{props.label}</p>}
      <div className='h-2 overflow-hidden rounded-full bg-[#1E293B]'>
        <div
          className='h-2 rounded-full bg-[#3B82F6] transition-[width] duration-300'
          style={{
            width,
            boxShadow: '0 0 12px rgba(59,130,246,0.28)',
          }}
        />
      </div>
    </div>
  )
}

export function MetricChip(props: { label: string; value: string }) {
  return (
    <div className='plasma-card px-3 py-3'>
      <p className='plasma-micro-label text-plasma-externalConnected'>{props.label}</p>
      <p className='plasma-item-title mt-2'>{props.value}</p>
    </div>
  )
}

export function ConfigRow(props: { label: string; value: string }) {
  return (
    <div className='plasma-card px-3 py-3'>
      <p className='plasma-micro-label text-plasma-textMuted'>{props.label}</p>
      <p className='mt-2 break-all text-sm text-plasma-textSecondary'>{props.value}</p>
    </div>
  )
}

export function InfoCard(props: { label: string; value: string; meta: string }) {
  return (
    <div className='plasma-card px-4 py-3'>
      <p className='plasma-micro-label text-plasma-externalConnected'>{props.label}</p>
      <p className='plasma-item-title mt-2'>{props.value}</p>
      <p className='mt-1 text-xs text-plasma-textMuted'>{props.meta}</p>
    </div>
  )
}

export function EmptyState(props: { title: string; description: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('plasma-card flex flex-col items-center justify-center gap-3 px-6 py-8 text-center', props.className)}>
      <p className='plasma-item-title'>{props.title}</p>
      <p className='plasma-secondary-info max-w-sm text-plasma-textMuted'>{props.description}</p>
      {props.action}
    </div>
  )
}

export function Tooltip(props: { content: string; children: ReactNode; className?: string }) {
  return (
    <span title={props.content} className={cn('inline-flex', props.className)}>
      {props.children}
    </span>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'min-h-10 w-full rounded-control border border-plasma-border bg-plasma-surface px-3 py-2 text-sm text-plasma-text outline-none',
        'placeholder:text-plasma-textDisabled hover:border-plasma-borderStrong',
        'focus-visible:border-plasma-blue focus-visible:ring-2 focus-visible:ring-plasma-blue/25',
        props.disabled && 'cursor-not-allowed opacity-50',
        props.className,
      )}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'min-h-10 w-full rounded-control border border-plasma-border bg-plasma-surface px-3 py-2 text-sm text-plasma-text outline-none',
        'hover:border-plasma-borderStrong focus-visible:border-plasma-blue focus-visible:ring-2 focus-visible:ring-plasma-blue/25',
        props.disabled && 'cursor-not-allowed opacity-50',
        props.className,
      )}
    />
  )
}

export function Toggle(props: {
  checked: boolean
  onChange(checked: boolean): void
  label: ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <label className={cn('plasma-card inline-flex items-center justify-between gap-3 px-4 py-3 text-sm text-plasma-textSecondary', props.className, props.disabled && 'opacity-50')}>
      <span>{props.label}</span>
      <button
        type='button'
        role='switch'
        aria-checked={props.checked}
        disabled={props.disabled}
        onClick={() => !props.disabled && props.onChange(!props.checked)}
        className={cn(
          'relative h-6 w-11 rounded-full border transition outline-none',
          'focus-visible:ring-2 focus-visible:ring-plasma-blue focus-visible:ring-offset-2 focus-visible:ring-offset-plasma-bg',
          props.checked
            ? 'border-plasma-blue bg-plasma-blue'
            : 'border-plasma-borderStrong bg-plasma-panelSecondary',
        )}
      >
        <span className={cn(
          'absolute left-0.5 top-0.5 h-4.5 w-4.5 rounded-full bg-plasma-text transition-transform',
          props.checked && 'translate-x-5',
        )}
        />
      </button>
    </label>
  )
}

export function SegmentedControl<T extends string>(props: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange(value: T): void
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-button border border-plasma-border bg-plasma-panelSecondary p-1', props.className)}>
      {props.options.map((option) => {
        const active = option.value === props.value
        return (
          <button
            key={option.value}
            type='button'
            onClick={() => props.onChange(option.value)}
            className={cn(
              'rounded-control px-3 py-2 text-sm font-medium transition outline-none',
              'focus-visible:ring-2 focus-visible:ring-plasma-blue focus-visible:ring-offset-2 focus-visible:ring-offset-plasma-bg',
              active
                ? 'bg-plasma-blue text-plasma-text'
                : 'text-plasma-textSecondary hover:bg-[rgba(148,163,184,0.08)]',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
