```markdown
# MKP SupportE React Architecture & API Reference

This document outlines the core architecture, global APIs, and React development conventions for the MKP SupportE project. AI agents (like Codex) must strictly adhere to these patterns when generating or refactoring code.

## 1. Core Principles (Strict Directives)
* **Data-Driven View**: DO NOT use `document.getElementById`, `classList.add/remove`, or `innerHTML`. All UI changes must be driven by React `useState` or `props`.
* **Promise-Based UI**: Global overlays (Modals, Context Menus) are encapsulated as Promise-based APIs. Do not write inline overlay DOM structures.
* **Tailwind-First**: Use Tailwind utility classes. For dynamic themes, use the pre-defined `theme-*` classes.

## 2. Global Modal System (MKPModal)
**Import**: `import { MKPModal } from '@/components/GlobalModal'`

Replaces native `alert`, `confirm`, and `prompt`. It pauses execution via async/await.

### API Reference
```javascript
// 1. Alert (Returns undefined)
await MKPModal.alert({ 
  title: 'Error', 
  msg: 'Operation failed.', 
  type: 'error' // 'info' | 'success' | 'warning' | 'error'
});

// 2. Confirm (Returns boolean)
const isConfirmed = await MKPModal.confirm({
  title: 'Delete Preset',
  msg: 'Are you sure?',
  type: 'warning',
  confirmText: 'Delete',
  cancelText: 'Cancel'
});
if (isConfirmed) { /* proceed */ }

// 3. Prompt (Returns string or null)
const inputVal = await MKPModal.prompt({
  title: 'Rename',
  value: 'OldName',
  placeholder: 'Enter new name'
});
```

## 3. Global Context Menu (MKPContextMenu)
**Import**: `import { MKPContextMenu } from '@/components/GlobalContextMenu'`

Replaces native right-click menus. Automatically handles screen edge collision and outside-click dismissal.

### API Reference
```jsx
// 1. Bind to JSX
<button onContextMenu={(e) => handleRightClick(e, itemData)}>Right Click Me</button>

// 2. Handle Event
const handleRightClick = async (e, data) => {
  e.preventDefault(); // Required
  
  const menuItems = [
    { action: 'edit', label: 'Edit' },
    { type: 'separator' },
    { action: 'delete', label: 'Delete', disabled: !data.canDelete }
  ];

  const action = await MKPContextMenu.show(e.clientX, e.clientY, menuItems);
  
  if (action === 'delete') {
    // execute delete
  }
};
```

## 4. Theme & Color Engine
Global styles are controlled by CSS variables injected at the `:root` level.

* **State**: `themeMode` ('light', 'dark', 'oled', 'system') and `themeColor` (e.g., 'blue', 'emerald').
* **CSS Variable**: `--primary-rgb` (The current active theme color).
* **Utility Classes (Use these instead of hardcoded colors)**:
  * `theme-text`: Applies `--primary-rgb` to text.
  * `theme-border`: Applies `--primary-rgb` to borders.
  * `theme-bg-solid` / `theme-btn-solid`: Solid background with text color white, includes hover states.
  * `theme-bg-soft` / `theme-btn-soft`: 10% opacity background of `--primary-rgb`.
  * `theme-bg-subtle`: 4% opacity background for card/section bases.

## 5. Icon System
**Import**: `import { Icon, CustomIcon } from '@/components/Icons'`

DO NOT use raw SVG strings or `document.write` for icons.

### API Reference
```jsx
// Standard 24x24 icons (inherits text color)
<Icon name="home" className="w-5 h-5 text-gray-500 hover:theme-text" />

// Custom viewBox / Pre-colored icons (QQ, Bilibili, Calibration)
<CustomIcon name="logo_qq" className="w-6 h-6" />

// Image-based logos
<Icon name="bambu_logo" className="w-8 h-8" />
```

## 6. Data & Rendering (Static Data)
**Import**: `import { brands, printersByBrand, faqData } from '@/utils/data'`

Never hardcode massive arrays in JSX components. Map over imported data arrays.
For list filtering (search), use `useState` for the query string and `Array.filter()` before `Array.map()`.

## 7. Logger System
**Import**: `import { Logger } from '@/utils/logger'`

Unifies console logging and Electron local file logging.

### API Reference
```javascript
Logger.info("Process started", { id: 123 });
Logger.warn("Resource missing");
Logger.error("Fatal exception", errorObj);
```

## 8. Safe JSX Text Highlighting
When implementing search features on complex JSX structures (like the FAQ answers), use the recursive highlighting engine to avoid breaking React elements.

* **Component**: `<HighlightText text={string} query={searchString} />` (For pure strings).
* **Function**: `highlightReactText(jsxNode, searchString)` (For traversing and highlighting text inside deep JSX trees without breaking nested components or event bindings).