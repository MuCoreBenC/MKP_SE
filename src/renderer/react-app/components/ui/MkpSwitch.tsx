import { useId } from 'react';

type MkpSwitchProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  id?: string;
  name?: string;
  className?: string;
  ariaLabel?: string;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function MkpSwitch({
  checked,
  onChange,
  disabled = false,
  compact = false,
  id,
  name,
  className,
  ariaLabel
}: MkpSwitchProps) {
  const fallbackId = useId();
  const resolvedId = id || `mkp-switch-${fallbackId}`;

  return (
    <label className={joinClassNames('mkp-switch', compact && 'mkp-switch-compact', className)}>
      <input
        id={resolvedId}
        name={name}
        type="checkbox"
        role="switch"
        className="mkp-switch-input"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-checked={checked}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className="mkp-switch-track" />
    </label>
  );
}
