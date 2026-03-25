import React from 'react';
import iconsSource from '../renderer/assets/js/icons.js?raw';

const DEFAULT_CLASS_NAME = 'w-5 h-5 flex-shrink-0';

const extraIcons = {
  menu: `<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg>`,
};

const svgAttributeMap = {
  viewbox: 'viewBox',
  fill: 'fill',
  stroke: 'stroke',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-miterlimit': 'strokeMiterlimit',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'preserveaspectratio': 'preserveAspectRatio',
};

function readAttribute(markup, attributeName) {
  const match = markup.match(new RegExp(`${attributeName}="([^"]*)"`, 'i'));
  return match?.[1];
}

function extractSvgProps(openingTag) {
  const props = {};
  const attributePattern = /([:@a-zA-Z0-9-]+)\s*=\s*"([^"]*)"/g;

  for (const match of openingTag.matchAll(attributePattern)) {
    const rawName = match[1];
    const value = match[2];
    const normalizedName = svgAttributeMap[rawName.toLowerCase()];

    if (!normalizedName || rawName === 'class' || rawName === 'xmlns') {
      continue;
    }

    props[normalizedName] = value;
  }

  return props;
}

function normalizeIcon(markup, name) {
  const trimmedMarkup = markup.trim();

  if (trimmedMarkup.startsWith('<img')) {
    return {
      kind: 'img',
      src: readAttribute(trimmedMarkup, 'src'),
      alt: readAttribute(trimmedMarkup, 'alt') || name,
    };
  }

  const svgMatch = trimmedMarkup.match(/^<svg\b([^>]*)>([\s\S]*?)<\/svg>$/i);

  if (!svgMatch) {
    return null;
  }

  return {
    kind: 'svg',
    inner: svgMatch[2],
    props: extractSvgProps(svgMatch[1]),
  };
}

const rawIcons = new Function(`${iconsSource}; return MKPIcons;`)();

const iconRegistry = Object.fromEntries(
  Object.entries({ ...rawIcons, ...extraIcons })
    .map(([name, markup]) => [name, normalizeIcon(markup, name)])
    .filter(([, icon]) => icon !== null),
);

function renderResolvedIcon(icon, name, className, restProps) {
  if (icon.kind === 'img') {
    return (
      <img
        src={icon.src}
        alt={icon.alt || name}
        className={`${className} object-contain`}
        {...restProps}
      />
    );
  }

  return (
    <svg
      {...icon.props}
      {...restProps}
      className={className}
      dangerouslySetInnerHTML={{ __html: icon.inner }}
    />
  );
}

export function Icon({ name, className = DEFAULT_CLASS_NAME, ...restProps }) {
  const icon = iconRegistry[name];

  if (!icon) {
    console.warn(`[Icons] 未找到名为 "${name}" 的图标`);
    return null;
  }

  return renderResolvedIcon(icon, name, className, restProps);
}

export function CustomIcon({ name, className = DEFAULT_CLASS_NAME, ...restProps }) {
  const icon = iconRegistry[name];

  if (!icon) {
    console.warn(`[Icons] 未找到名为 "${name}" 的图标`);
    return null;
  }

  return renderResolvedIcon(icon, name, className, restProps);
}

export const iconNames = Object.keys(iconRegistry);
