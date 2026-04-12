import { cn } from '../../lib/cn'

export type SecondaryWorkspaceId = 'custom-telemetry' | 'camera-wall'

interface SecondaryWorkspaceBarProps {
  open: boolean
  activeWorkspace: SecondaryWorkspaceId | null
  onToggle: () => void
  onSelectWorkspace: (workspace: SecondaryWorkspaceId) => void
  onCloseWorkspace: () => void
}

const workspaces: Array<{
  id: SecondaryWorkspaceId
  label: string
  hint: string
}> = [
  {
    id: 'custom-telemetry',
    label: 'Custom Telemetry',
    hint: 'browse every published topic and pin live cards',
  },
  {
    id: 'camera-wall',
    label: 'Camera Wall',
    hint: 'open dedicated live view panels for robot camera streams',
  },
]

export function SecondaryWorkspaceBar({
  open,
  activeWorkspace,
  onToggle,
  onSelectWorkspace,
  onCloseWorkspace,
}: SecondaryWorkspaceBarProps) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)]/86 px-4 py-3" style={{ boxShadow: 'var(--card-shadow)' }}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Secondary Workspace Access
          </div>
          <div className="mt-1 text-[0.92rem] font-semibold tracking-[-0.02em] text-[var(--text)]">
            Keep the main pages focused and open only the extra telemetry surfaces when needed.
          </div>
          <div className="mt-1 text-[0.8rem] leading-6 text-[var(--text-muted)]">
            The home rail now owns remote operation. This bar stays reserved for raw telemetry exploration and dedicated camera walls.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeWorkspace ? (
            <div className="rounded-full border border-[var(--accent)]/28 bg-[var(--accent-soft)]/72 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)]">
              Workspace active
            </div>
          ) : null}

          {activeWorkspace ? (
            <button
              type="button"
              onClick={onCloseWorkspace}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)]/78 px-4 py-2 text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-alt)]"
            >
              Return to main pages
            </button>
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            className="rounded-full border border-[var(--primary)]/28 bg-[var(--primary-soft)]/78 px-4 py-2 text-[0.76rem] font-semibold uppercase tracking-[0.14em] text-[var(--text)] transition-colors hover:bg-[var(--primary-soft)]"
          >
            {open ? 'Hide secondary bar' : 'Open secondary bar'}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {workspaces.map((workspace) => {
            const active = workspace.id === activeWorkspace

            return (
              <button
                key={workspace.id}
                type="button"
                onClick={() => onSelectWorkspace(workspace.id)}
                className={cn(
                  'rounded-[20px] border px-4 py-3 text-left transition-colors',
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]/84 text-[var(--text)]'
                    : 'border-[var(--border)] bg-[var(--surface-alt)]/82 text-[var(--text-muted)] hover:bg-[var(--surface-alt)]',
                )}
              >
                <div className="text-[0.8rem] font-semibold uppercase tracking-[0.15em]">{workspace.label}</div>
                <div className="mt-1 text-[0.78rem] leading-5 opacity-90">{workspace.hint}</div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
