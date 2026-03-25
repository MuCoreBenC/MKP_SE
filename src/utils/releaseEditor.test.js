import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyReleaseEntityDraft,
  buildReleaseSummary,
  createEmptyPresetDraft,
  filterReleasePresets,
  parseReleaseMarkdown,
  resolveReleaseConfigSelection,
  sanitizeReleaseId,
} from './releaseEditor.js';

test('parseReleaseMarkdown renders headings, lists, and inline styles', () => {
  const html = parseReleaseMarkdown('# 新版本\n\n- 修复 **Bug**\n- 支持 `patch`');

  assert.match(html, /<h1>新版本<\/h1>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<strong>Bug<\/strong>/);
  assert.match(html, /<code>patch<\/code>/);
});

test('parseReleaseMarkdown renders links and fenced code blocks safely', () => {
  const html = parseReleaseMarkdown(
    '[更新说明](https://example.com/docs?a=1&b=2)\n\n```js\nconst result = 1 < 2;\n```',
  );

  assert.match(
    html,
    /<a href="https:\/\/example\.com\/docs\?a=1&amp;b=2" target="_blank" rel="noreferrer">更新说明<\/a>/,
  );
  assert.match(html, /<pre><code>const result = 1 &lt; 2;<\/code><\/pre>/);
});

test('buildReleaseSummary creates concise console lines', () => {
  const lines = buildReleaseSummary(
    {
      data: {
        version: '0.2.0',
        patchPath: 'cloud_data/patch_v0.2.0.zip',
        uploadCloudDataDir: 'release_upload/cloud_data',
        changedCount: 18,
      },
    },
    '2',
  );

  assert.deepEqual(lines, [
    '模式: 标准热更新',
    '版本: v0.2.0',
    '补丁: cloud_data/patch_v0.2.0.zip',
    '上传目录: release_upload/cloud_data',
    '包含文件: 18',
  ]);
});

test('filterReleasePresets matches by file and metadata', () => {
  const presets = [
    { file: 'a1_standard_v3.json', id: 'a1', type: 'standard', version: '3.0.0' },
    { file: 'p1_quick_v2.json', id: 'p1', type: 'quick', version: '2.0.0' },
  ];

  assert.deepEqual(filterReleasePresets(presets, 'quick'), [presets[1]]);
  assert.deepEqual(filterReleasePresets(presets, 'A1_STANDARD'), [presets[0]]);
});

test('createEmptyPresetDraft provides editable defaults', () => {
  assert.deepEqual(createEmptyPresetDraft(), {
    originalFileName: null,
    fileName: '',
    id: '',
    type: '',
    version: '',
    description: '',
    releaseNotesText: '',
    jsonText: '{\n  "version": "",\n  "presets": {}\n}',
  });
});

test('sanitizeReleaseId keeps english token format and falls back to prefix', () => {
  assert.equal(sanitizeReleaseId('Bambu Lab A1', 'printer'), 'bambu_lab_a1');
  assert.match(sanitizeReleaseId('***', 'brand'), /^brand_\d+$/);
});

test('resolveReleaseConfigSelection falls back to first valid brand and printer', () => {
  const config = {
    brands: [{ id: 'bambu' }, { id: 'creality' }],
    printersByBrand: {
      bambu: [{ id: 'a1' }, { id: 'p1' }],
      creality: [{ id: 'k1' }],
    },
  };

  assert.deepEqual(
    resolveReleaseConfigSelection(config, {
      type: 'printer',
      brandId: 'creality',
      printerId: 'missing',
    }),
    {
      type: 'printer',
      brandId: 'creality',
      printerId: 'k1',
    },
  );

  assert.deepEqual(resolveReleaseConfigSelection(config, { brandId: 'missing' }), {
    type: 'brand',
    brandId: 'bambu',
    printerId: 'a1',
  });
});

test('applyReleaseEntityDraft updates printer draft in memory', () => {
  const config = {
    brands: [{ id: 'bambu', name: 'Bambu Lab', shortName: 'Bambu Lab', subtitle: '' }],
    printersByBrand: {
      bambu: [
        {
          id: 'a1',
          name: 'Bambu Lab A1',
          shortName: 'A1',
          image: '',
          supportedVersions: ['standard'],
          defaultPresets: { standard: 'a1_standard.json' },
        },
      ],
    },
  };

  const { nextConfig, nextSelection } = applyReleaseEntityDraft(
    config,
    { type: 'printer', brandId: 'bambu', printerId: 'a1' },
    {
      id: 'a1',
      name: 'A1 Mini',
      subtitle: 'Bambu Lab A1 Mini',
      versions: 'standard,quick',
      presetsText: '{"standard":"a1_std.json","quick":"a1_quick.json"}',
      image: 'assets/images/a1-mini.webp',
    },
  );

  assert.deepEqual(nextSelection, {
    type: 'printer',
    brandId: 'bambu',
    printerId: 'a1',
  });
  assert.deepEqual(nextConfig.printersByBrand.bambu[0], {
    id: 'a1',
    name: 'Bambu Lab A1 Mini',
    shortName: 'A1 Mini',
    image: 'assets/images/a1-mini.webp',
    supportedVersions: ['standard', 'quick'],
    defaultPresets: {
      standard: 'a1_std.json',
      quick: 'a1_quick.json',
    },
  });
});

test('applyReleaseEntityDraft keeps previous preset mapping on invalid live json', () => {
  const config = {
    brands: [{ id: 'bambu', name: 'Bambu Lab', shortName: 'Bambu Lab', subtitle: '' }],
    printersByBrand: {
      bambu: [
        {
          id: 'a1',
          name: 'Bambu Lab A1',
          shortName: 'A1',
          image: '',
          supportedVersions: ['standard'],
          defaultPresets: { standard: 'a1_standard.json' },
        },
      ],
    },
  };

  const { nextConfig } = applyReleaseEntityDraft(
    config,
    { type: 'printer', brandId: 'bambu', printerId: 'a1' },
    {
      id: 'a1',
      name: 'A1',
      subtitle: 'Bambu Lab A1',
      versions: 'standard',
      presetsText: '{"standard"',
      image: '',
    },
  );

  assert.deepEqual(nextConfig.printersByBrand.bambu[0].defaultPresets, {
    standard: 'a1_standard.json',
  });
});

test('applyReleaseEntityDraft preserves preset catalog metadata while editing entity draft', () => {
  const config = {
    brands: [{ id: 'bambu', name: 'Bambu Lab', shortName: 'Bambu Lab', subtitle: '' }],
    printersByBrand: {
      bambu: [
        {
          id: 'a1',
          name: 'Bambu Lab A1',
          shortName: 'A1',
          image: '',
          supportedVersions: ['standard'],
          defaultPresets: { standard: 'a1_standard.json' },
        },
      ],
    },
    presets: [{ file: 'a1_standard.json', id: 'a1', type: 'standard', version: '1.0.0' }],
    paths: {
      dataJsPath: 'src/renderer/assets/js/data.js',
      presetsDir: 'cloud_data/presets',
    },
  };

  const { nextConfig } = applyReleaseEntityDraft(
    config,
    { type: 'printer', brandId: 'bambu', printerId: 'a1' },
    {
      id: 'a1',
      name: 'A1 Mini',
      subtitle: 'Bambu Lab A1 Mini',
      versions: 'standard,quick',
      presetsText: '{"standard":"a1_std.json","quick":"a1_quick.json"}',
      image: 'assets/images/a1-mini.webp',
    },
  );

  assert.deepEqual(nextConfig.presets, config.presets);
  assert.deepEqual(nextConfig.paths, config.paths);
});

test('applyReleaseEntityDraft can commit renamed brand id and move printer bucket', () => {
  const config = {
    brands: [{ id: 'bambu', name: 'Bambu Lab', shortName: 'Bambu Lab', subtitle: 'Original' }],
    printersByBrand: {
      bambu: [{ id: 'a1', name: 'Bambu Lab A1', shortName: 'A1' }],
    },
  };

  const { nextConfig, nextSelection } = applyReleaseEntityDraft(
    config,
    { type: 'brand', brandId: 'bambu', printerId: null },
    {
      id: 'Bambu Labs CN',
      name: 'Bambu Labs CN',
      subtitle: 'New subtitle',
      versions: '',
      presetsText: '',
      image: 'assets/images/bambu-cn.webp',
    },
    { commitId: true },
  );

  assert.deepEqual(nextSelection, {
    type: 'brand',
    brandId: 'bambu_labs_cn',
    printerId: null,
  });
  assert.deepEqual(nextConfig.brands, [
    {
      id: 'bambu_labs_cn',
      name: 'Bambu Labs CN',
      shortName: 'Bambu Labs CN',
      subtitle: 'New subtitle',
      image: 'assets/images/bambu-cn.webp',
    },
  ]);
  assert.equal(nextConfig.printersByBrand.bambu, undefined);
  assert.deepEqual(nextConfig.printersByBrand.bambu_labs_cn, [
    { id: 'a1', name: 'Bambu Lab A1', shortName: 'A1' },
  ]);
});
