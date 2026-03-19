import React from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MkpSwitch, MkpSwitchField } from '../../../../src/renderer/react-app/components/ui';

const REACT_APP_ROOT = 'D:/trae/MKP_SE/src/renderer/react-app';
const ALLOWED_RAW_SWITCH_FILES = new Set([
  'components/ui/MkpSwitch.tsx'
]);

function collectReactSourceFiles(rootDir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectReactSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('react switch contract smoke', () => {
  it('renders the shared React switch with the same slider markup contract used by the legacy renderer pages', () => {
    const html = renderToStaticMarkup(
      React.createElement(MkpSwitch, {
        checked: true,
        compact: true,
        ariaLabel: 'React switch contract'
      })
    );

    expect(html).toContain('class="mkp-switch mkp-switch-compact"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('class="mkp-switch-input"');
    expect(html).toContain('class="mkp-switch-track"');
    expect(html).toContain('checked=""');
  });

  it('renders the higher-level React switch field with the same status copy contract used by settings and params', () => {
    const html = renderToStaticMarkup(
      React.createElement(MkpSwitchField, {
        checked: false,
        ariaLabel: 'React switch field contract'
      })
    );

    expect(html).toContain('class="settings-toggle-control"');
    expect(html).toContain('class="param-switch-status"');
    expect(html).toContain('已关闭');
    expect(html).toContain('class="mkp-switch"');
    expect(html).toContain('class="mkp-switch-input"');
    expect(html).toContain('class="mkp-switch-track"');
  });

  it('forbids raw checkbox switch markup outside the shared React switch component so future toggles stay on one visual standard', () => {
    const reactFiles = collectReactSourceFiles(REACT_APP_ROOT);
    const violations: string[] = [];

    for (const filePath of reactFiles) {
      const relativePath = relative(REACT_APP_ROOT, filePath).replace(/\\/g, '/');
      if (ALLOWED_RAW_SWITCH_FILES.has(relativePath)) {
        continue;
      }

      const source = readFileSync(filePath, 'utf8');
      if (/type="checkbox"|role="switch"|mkp-switch-input|mkp-switch-track|className="mkp-switch/.test(source)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
