// src/components/Icons.jsx
import React from 'react';

// 把你刚才发我的海量字符串数据放在这里（精简展示，实际请全量粘贴）
const iconData = {
  home: `<path d="M362.365 117V337.078..."/>`,
  download: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>`,
  calibrate: `<path fill-rule="evenodd" clip-rule="evenodd" d="M419.357 -1953.13V-1815.14..."/>`,
  params: `<path d="M4 6h4m4 0h8" /><circle cx="10" cy="6" r="2" /><path d="M4 12h10m4 0h2" /><circle cx="16" cy="12" r="2" /><path d="M4 18h6m4 0h6" /><circle cx="12" cy="18" r="2" />`,
  versions: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h3.75..."/>`,
  faq: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.879 7.519..."/>`,
  about: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.25 11.25..."/>`,
  darkmode: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v2.25..."/>`,
  setting: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4..."/>`,
  // ... 其他的全部放进来 ...
};

// 🌟 核心组件：Icon
// 你可以在调用时随意改变它的大小 className="w-8 h-8 text-blue-500"
export function Icon({ name, className = "w-5 h-5 flex-shrink-0" }) {
  // 处理特殊的完整 HTML 标签（比如你写死的 <img>）
  if (name === 'bambu_logo' || name === 'bambu_color') {
    const imgSrc = name === 'bambu_logo' ? 'assets/images/bambu-logo.png' : 'assets/images/bambu-color.png';
    return <img src={imgSrc} className={`${className} object-contain`} alt={name} />;
  }

  // 获取对应的 SVG 内部路径
  const svgInner = iconData[name];

  if (!svgInner) {
    console.warn(`[Icons] 未找到名为 "${name}" 的图标`);
    return null;
  }

  // 渲染标准的 SVG 容器，并将内部路径注入
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" // 默认视口，大部分 UI 图标适用
      fill="none" 
      stroke="currentColor" 
      dangerouslySetInnerHTML={{ __html: svgInner }} 
    />
  );
}

// 针对你那些非 24x24 视口的特殊图标（如校准、QQ、闲鱼，它们的 viewBox 是 0 0 1024 1024）
// 我们专门做一个 CustomIcon
const customIconData = {
  calibrate_basic: `<path d="M714.2 341.4L587.4 214.5..." />`,
  logo_qq: `<path d="M824.8 613.2c-16-51.4..." />`,
  logo_bilibili: `<path fill="#fe5588" d="M278.8864 148.1728..." />`,
  logo_douyin: `<path d="M937.4 423.9c-84 0..." />`,
  logo_xianyu: `<path d="M424.45036 155S543.41036..." fill="#F69706" />...`,
  // ...
};

export function CustomIcon({ name, className = "w-5 h-5 flex-shrink-0" }) {
    const svgInner = customIconData[name];
    if (!svgInner) return null;

    return (
      <svg 
        className={className} 
        viewBox="0 0 1024 1024" // 匹配这些大图标的视口
        fill="currentColor" // 这些图标通常是填充色的
        dangerouslySetInnerHTML={{ __html: svgInner }} 
      />
    );
}