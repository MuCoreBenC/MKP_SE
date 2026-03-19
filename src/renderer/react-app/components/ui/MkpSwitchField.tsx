import type { ReactNode } from 'react';

import { MkpSwitch } from './MkpSwitch';

type MkpSwitchFieldProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  id?: string;
  name?: string;
  className?: string;
  ariaLabel?: string;
  statusOnText?: string;
  statusOffText?: string;
  leading?: ReactNode;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function MkpSwitchField({
  checked,
  onChange,
  disabled = false,
  compact = false,
  id,
  name,
  className,
  ariaLabel,
  statusOnText = '已开启',
  statusOffText = '已关闭',
  leading = null
}: MkpSwitchFieldProps) {
  return (
    <div className={joinClassNames('settings-toggle-control', className)}>
      {leading}
      <span className="param-switch-status">{checked ? statusOnText : statusOffText}</span>
      <MkpSwitch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        compact={compact}
        id={id}
        name={name}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}
