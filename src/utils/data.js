// src/utils/data.js

export const brands = [
  { id: 'bambu', name: '拓竹', shortName: 'Bambu Lab', subtitle: 'Bambu版', favorite: true },
  { id: 'creality', name: '创想三维', shortName: 'Creality', subtitle: '', favorite: false },
  { id: 'prusa', name: '快造科技', shortName: 'Prusa', subtitle: '', favorite: false },
  { id: 'anycubic', name: '纵维立方', shortName: 'Anycubic', subtitle: 'Klipper版', favorite: false },
  { id: 'diy', name: 'DIY', shortName: 'DIY', subtitle: '', favorite: false },
];

export const printersByBrand = {
  bambu: [
    { id: 'a1', name: 'Bambu Lab A1', shortName: 'A1', image: 'assets/images/a1.webp', favorite: true, disabled: false, supportedVersions: ['standard', 'quick'] },
    { id: 'a1mini', name: 'Bambu Lab A1 mini', shortName: 'A1mini', image: 'assets/images/a1mini.webp', favorite: false, disabled: false, supportedVersions: ['standard', 'quick'] },
    { id: 'p1s', name: 'Bambu Lab P1S', shortName: 'P1S', image: 'assets/images/p1s.webp', favorite: false, disabled: false, supportedVersions: ['lite'] },
    { id: 'x1', name: 'Bambu Lab X1', shortName: 'X1', image: 'assets/images/x1.webp', favorite: false, disabled: false, supportedVersions: ['lite'] }
  ],
  creality: [
    { id: 'k1c', name: 'Creality K1C', shortName: 'K1C', image: 'assets/images/k1c.webp', favorite: false, disabled: true, supportedVersions: [] },
    { id: 'k2c', name: 'Creality K2C', shortName: 'K2C', image: 'assets/images/k2c.webp', favorite: false, disabled: true, supportedVersions: [] },
  ],
  prusa: [],
  anycubic: [
    { id: 's1c', name: 'Anycubic S1C', shortName: 'S1C', image: 'assets/images/s1c.webp', favorite: false, disabled: false, supportedVersions: ['standard'] },
  ],
  diy: [
    { id: 'voron24', name: 'VORON 2.4', shortName: 'V2.4', image: 'assets/images/voron24.webp', favorite: false, disabled: false, supportedVersions: ['standard'] },
  ],
};

export const faqData = [
  // ... 你的 FAQ 数据先放在这，等我们做方向 B 的时候用
];

// 一个用来翻译版本名称和对应 CSS 类的辅助字典
export const VERSION_DICT = {
  standard: { name: '标准版', bgClass: 'theme-standard-bg', textClass: 'theme-standard-text' },
  quick: { name: '快拆版', bgClass: 'theme-quick-bg', textClass: 'theme-quick-text' },
  lite: { name: 'Lite版', bgClass: 'theme-lite-bg', textClass: 'theme-lite-text' }
};