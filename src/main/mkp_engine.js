const fs = require('fs');

const DEFAULT_WIPING_GCODE = `
;Tower_Layer_Gcode
EXTRUDER_REFILL
G1 X20 Y10.19
NOZZLE_HEIGHT_ADJUST
G1 F9600
G1 X20 Y20 E.25658
G1 X29.81 Y20 E.25658
G1 E-.21 F5400
;WIPE_START
G1 F9600
G1 X28.81 Y20 E-.09
;WIPE_END
G1 X23.71 Y25.679 F30000
G1 X20 Y29.81
G1 E.3 F5400
G1 F9600
G1 X20 Y20 E.25658
G1 X10.19 Y20 E.25658
G1 E-.21 F5400
;WIPE_START
G1 F9600
G1 X11.19 Y20 E-.09
;WIPE_END
G1 X17.943 Y23.556 F30000
G1 X29.8 Y29.8
G1 X29.8 Y29.398
G1 E.3 F5400
G1 F9600
;START_HERE
G1 X10.602 Y29.398 E.60441
G1 X10.602 Y10.602 E.60441
G1 X29.398 Y10.602 E.60441
G1 X29.398 Y29.338 E.60248
G1 X29.79 Y29.79
G1 X10.21 Y29.79 E.58322
G1 X10.21 Y10.21 E.58322
G1 X29.79 Y10.21 E.58322
G1 X29.79 Y29.73 E.58143
;END_HERE
G92 E0
G1 E-.21 F5400
;WIPE_START
G1 F9600
G1 X28.8 Y29.762 E-.1
;WIPE_END
EXTRUDER_RETRACT
G1 X28.7 Y29.76
TOWER_ZP_ST
;Tower_Layer_Gcode Finished
`.trim().split(/\r?\n/);

const DEFAULT_TOWER_BASE_LAYER_GCODE = `
; MKP tower base template
G92 E0
G1 X20 Y20 E1.0
G1 X25 Y20 E0.5
G92 E0
`.trim().split(/\r?\n/);

const PSEUDO_RANDOM_TABLE = ['3', '7', '2', '8', '1', '5', '9', '4', '6'];
const MAX_ORCA_IRONING_EXTRUSION = 7.9;
let pseudoRandomIndex = 0;

function parseCliArguments(argv = []) {
  const gcodeIndex = argv.indexOf('--Gcode');
  const jsonIndex = argv.indexOf('--Json');
  const tomlIndex = argv.indexOf('--Toml');
  const gcodePath = gcodeIndex >= 0 ? argv[gcodeIndex + 1] : null;
  const jsonPath = jsonIndex >= 0 ? argv[jsonIndex + 1] : null;
  const tomlPath = tomlIndex >= 0 ? argv[tomlIndex + 1] : null;

  if (!gcodePath) {
    throw new Error('Missing required --Gcode argument');
  }

  if (jsonPath && tomlPath) {
    throw new Error('Use either --Json or --Toml, not both');
  }

  if (jsonPath) {
    return {
      configFormat: 'json',
      configPath: jsonPath,
      gcodePath
    };
  }

  if (tomlPath) {
    return {
      configFormat: 'toml',
      configPath: tomlPath,
      gcodePath
    };
  }

  throw new Error('Missing required --Json or --Toml argument');
}

function parseConfigText(text, format) {
  if (format === 'json') {
    return normalizeConfig(JSON.parse(text));
  }

  if (format === 'toml') {
    return normalizeConfig(parseToml(text));
  }

  throw new Error(`Unsupported config format: ${format}`);
}

function loadEngineConfig(configPath, configFormat) {
  const format = configFormat || inferConfigFormatFromPath(configPath);
  const text = fs.readFileSync(configPath, 'utf8');
  return parseConfigText(text, format);
}

function inferConfigFormatFromPath(configPath = '') {
  return String(configPath).toLowerCase().endsWith('.toml') ? 'toml' : 'json';
}

function normalizeConfig(source = {}) {
  const toolhead = source.toolhead || {};
  const wiping = source.wiping || {};
  const machine = source.machine || {};
  const templates = source.templates || {};
  const postProcessing = source.postProcessing || {};

  return {
    toolhead: {
      speedLimit: getNumber(toolhead, ['speedLimit', 'speed_limit'], 69),
      offset: {
        x: getNumber(toolhead.offset || {}, ['x'], 0),
        y: getNumber(toolhead.offset || {}, ['y'], 0),
        z: getNumber(toolhead.offset || {}, ['z'], 0)
      },
      customMountGcode: getString(toolhead, ['customMountGcode', 'custom_mount_gcode'], ';MKPSupport: Mount Gcode'),
      customUnmountGcode: getString(toolhead, ['customUnmountGcode', 'custom_unmount_gcode'], 'M117 MKPSupport: Unmount Gcode')
    },
    wiping: {
      haveWipingComponents: getBoolean(
        wiping,
        ['haveWipingComponents', 'have_wiping_components', 'useWipingTowers', 'use_wiping_towers'],
        false
      ),
      switchTowerType: getNumber(wiping, ['switchTowerType', 'switch_tower_type'], 1),
      wiperX: getNumber(wiping, ['wiperX', 'wiper_x'], 0),
      wiperY: getNumber(wiping, ['wiperY', 'wiper_y'], 0),
      wipeTowerPrintSpeed: getNumber(wiping, ['wipeTowerPrintSpeed', 'wipetower_speed'], 0),
      nozzleCoolingFlag: getBoolean(wiping, ['nozzleCoolingFlag', 'nozzle_cooling_flag'], false),
      ironApplyFlag: getBoolean(wiping, ['ironApplyFlag', 'iron_apply_flag'], false),
      userDryTime: getNumber(wiping, ['userDryTime', 'user_dry_time'], 0),
      forceThickBridgeFlag: getBoolean(wiping, ['forceThickBridgeFlag', 'force_thick_bridge_flag'], false),
      supportExtrusionMultiplier: getNumber(wiping, ['supportExtrusionMultiplier', 'support_extrusion_multiplier'], 1)
    },
    templates: {
      wipingGcode: Array.isArray(templates.wipingGcode) ? templates.wipingGcode.slice() : DEFAULT_WIPING_GCODE.slice(),
      towerBaseLayerGcode: Array.isArray(templates.towerBaseLayerGcode)
        ? templates.towerBaseLayerGcode.slice()
        : DEFAULT_TOWER_BASE_LAYER_GCODE.slice()
    },
    machine: {
      nozzleDiameter: getNumber(machine, ['nozzleDiameter', 'nozzle_diameter'], 0.4),
      bounds: machine.bounds || null
    },
    postProcessing: {
      ironExtrudeRatio: getNumber(postProcessing, ['ironExtrudeRatio', 'iron_extrude_ratio'], 1),
      towerExtrudeRatio: getNumber(postProcessing, ['towerExtrudeRatio', 'tower_extrude_ratio'], 1),
      ironingPathOffsetMm: getNumber(postProcessing, ['ironingPathOffsetMm', 'ironing_path_offset_mm'], 0)
    }
  };
}

function getNumber(source, keys, fallback) {
  for (const key of keys) {
    const value = source && source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return fallback;
}

function getBoolean(source, keys, fallback) {
  for (const key of keys) {
    const value = source && source[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return fallback;
}

function getString(source, keys, fallback) {
  for (const key of keys) {
    const value = source && source[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return fallback;
}

function parseToml(text) {
  const result = {};
  let target = result;
  let multiline = null;
  const lines = String(text || '').split(/\r?\n/);

  for (const rawLine of lines) {
    if (multiline) {
      const endIndex = rawLine.indexOf('"""');
      if (endIndex >= 0) {
        multiline.buffer.push(rawLine.slice(0, endIndex));
        multiline.target[multiline.key] = finalizeTomlMultiline(multiline.buffer);
        multiline = null;
      } else {
        multiline.buffer.push(rawLine);
      }
      continue;
    }

    const trimmed = stripTomlComment(rawLine).trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const sectionName = trimmed.slice(1, -1).trim();
      result[sectionName] = result[sectionName] || {};
      target = result[sectionName];
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();

    if (rawValue.startsWith('"""')) {
      const remainder = rawValue.slice(3);
      const closingIndex = remainder.indexOf('"""');
      if (closingIndex >= 0) {
        target[key] = finalizeTomlMultiline([remainder.slice(0, closingIndex)]);
      } else {
        multiline = {
          buffer: remainder ? [remainder] : [],
          key,
          target
        };
      }
      continue;
    }

    target[key] = parseTomlValue(rawValue);
  }

  return result;
}

function stripTomlComment(line) {
  let inString = false;
  let stringChar = '';
  let braceDepth = 0;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const prev = index > 0 ? line[index - 1] : '';

    if ((char === '"' || char === "'") && prev !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      braceDepth += 1;
      continue;
    }

    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (char === '#' && braceDepth === 0) {
      return line.slice(0, index);
    }
  }

  return line;
}

function parseTomlValue(rawValue) {
  const value = rawValue.trim();

  if (value.startsWith('{') && value.endsWith('}')) {
    return parseInlineTable(value.slice(1, -1));
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
    return Number(value);
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function parseInlineTable(value) {
  const result = {};
  const parts = value.split(',');

  for (const part of parts) {
    const equalsIndex = part.indexOf('=');
    if (equalsIndex < 0) {
      continue;
    }
    const key = part.slice(0, equalsIndex).trim();
    const raw = part.slice(equalsIndex + 1).trim();
    result[key] = parseTomlValue(raw);
  }

  return result;
}

function finalizeTomlMultiline(lines) {
  return lines.join('\n').replace(/\n$/, '');
}

function formatXYZEString(text) {
  return String(text).replace(/([XYEZ])([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g, (match, axis, value) => {
    return `${axis}${parseFloat(value).toFixed(3)}`;
  });
}

function getPseudoRandom() {
  const value = PSEUDO_RANDOM_TABLE[pseudoRandomIndex];
  pseudoRandomIndex = (pseudoRandomIndex + 1) % PSEUDO_RANDOM_TABLE.length;
  return value;
}

function resetPseudoRandom() {
  pseudoRandomIndex = 0;
}

function processGcodeOffset(line, xOffset, yOffset, zOffset, mode = 'normal', options = {}) {
  const { command: originalCommand, comment } = splitCommandAndComment(line);
  let command = originalCommand;
  const feedIndex = command.indexOf('F');

  if (feedIndex >= 0) {
    command = command.slice(0, feedIndex).trimEnd();
  }

  command = formatXYZEString(command);
  command = command.replace(/([XYEZ])([+-]?(?:\d+\.\d+))/g, (match, axis, rawValue) => {
    const value = Number(rawValue);

    if (axis === 'X') {
      const nextValue = roundTo(value + xOffset, 3);
      assertMachineBounds('X', nextValue, options.machineBounds);
      return `X${nextValue.toFixed(3)}`;
    }

    if (axis === 'Y') {
      const nextValue = roundTo(value + yOffset, 3);
      assertMachineBounds('Y', nextValue, options.machineBounds);
      return `Y${nextValue.toFixed(3)}`;
    }

    if (axis === 'Z') {
      const nextValue = mode === 'ironing' ? value : roundTo(value + zOffset, 3);
      return `Z${nextValue.toFixed(3)}`;
    }

    if (axis === 'E') {
      if (mode === 'ironing') {
        return `E${roundTo(value * (options.ironExtrudeRatio || 1), 3).toFixed(3)}`;
      }

      if (mode === 'tower') {
        return `E${roundTo(value * (options.towerExtrudeRatio || 1), 3).toFixed(3)}`;
      }

      return '__MKP_REMOVE_E__';
    }

    return match;
  });

  command = command.replace(/\s*__MKP_REMOVE_E__\b/g, '');
  command = command.trimEnd();

  if (comment) {
    return command ? `${command} ${comment}` : comment;
  }

  return command;
}

function assertMachineBounds(axis, value, bounds) {
  if (!bounds || typeof bounds !== 'object') {
    return;
  }

  if (axis === 'X') {
    if (typeof bounds.minX === 'number' && value < bounds.minX) {
      throw new Error(`Offset X coordinate ${value} exceeds machine minimum ${bounds.minX}`);
    }
    if (typeof bounds.maxX === 'number' && value > bounds.maxX) {
      throw new Error(`Offset X coordinate ${value} exceeds machine maximum ${bounds.maxX}`);
    }
  }

  if (axis === 'Y') {
    if (typeof bounds.minY === 'number' && value < bounds.minY) {
      throw new Error(`Offset Y coordinate ${value} exceeds machine minimum ${bounds.minY}`);
    }
    if (typeof bounds.maxY === 'number' && value > bounds.maxY) {
      throw new Error(`Offset Y coordinate ${value} exceeds machine maximum ${bounds.maxY}`);
    }
  }
}

function splitCommandAndComment(line) {
  const text = String(line);
  const commentIndex = text.indexOf(';');

  if (commentIndex < 0) {
    return {
      command: text.trimEnd(),
      comment: ''
    };
  }

  return {
    command: text.slice(0, commentIndex).trimEnd(),
    comment: text.slice(commentIndex).trim()
  };
}

function isInterfaceMotionLine(line) {
  const { command } = splitCommandAndComment(line);
  return /^G1\b/.test(command) && /(?:\bX|\bY)/.test(command);
}

function isInterfaceExtrusionLine(line) {
  const { command } = splitCommandAndComment(line);
  if (!/^G1\b/.test(command) || !/(?:\bX|\bY)/.test(command) || /\bZ/.test(command)) {
    return false;
  }

  const extrusionMatch = command.match(/\bE([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);
  if (!extrusionMatch) {
    return false;
  }

  const extrusionValue = Number(extrusionMatch[1]);
  return Number.isFinite(extrusionValue) && extrusionValue >= 0;
}

function getInterfaceExtrusionValue(line) {
  const { command } = splitCommandAndComment(line);
  if (!/^G1\b/.test(command) || !/(?:\bX|\bY)/.test(command) || /\bZ/.test(command)) {
    return 0;
  }

  const extrusionMatch = command.match(/\bE([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);
  if (!extrusionMatch) {
    return 0;
  }

  const extrusionValue = Number(extrusionMatch[1]);
  return Number.isFinite(extrusionValue) && extrusionValue > 0 ? extrusionValue : 0;
}

function isTravelOnlyFeedMove(line) {
  const { command } = splitCommandAndComment(line);
  return /^G1\b/.test(command)
    && /(?:\bX|\bY)/.test(command)
    && /\bF[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(command)
    && !/\bE[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(command);
}

function deleteWipe(interfaceLines = []) {
  if (!Array.isArray(interfaceLines) || interfaceLines.length === 0) {
    return [];
  }

  let endIndex = -1;
  for (let index = interfaceLines.length - 1; index >= 0; index -= 1) {
    if (String(interfaceLines[index]).includes('; WIPE_END')) {
      endIndex = index;
      break;
    }

    if (index < interfaceLines.length - 15) {
      break;
    }
  }

  let hasExtrusionAfterWipe = false;
  if (endIndex >= 0) {
    for (let index = endIndex; index < interfaceLines.length; index += 1) {
      if (isInterfaceExtrusionLine(interfaceLines[index])) {
        hasExtrusionAfterWipe = true;
        break;
      }
    }
  }

  let nextLines = interfaceLines.slice();
  if (endIndex > 0 && !hasExtrusionAfterWipe) {
    let startIndex = 0;
    for (let index = interfaceLines.length - 1; index >= 0; index -= 1) {
      if (String(interfaceLines[index]).includes('; WIPE_START')) {
        startIndex = index;
        break;
      }
    }
    nextLines = nextLines.slice(0, startIndex);
    nextLines.push(';ZJUMP_START');
  } else {
    if (nextLines.length > 0 && isTravelOnlyFeedMove(nextLines[nextLines.length - 1])) {
      nextLines = nextLines.slice(0, -1);
    }
    nextLines.push(';ZJUMP_START');
  }

  for (let index = nextLines.length - 1; index >= 0; index -= 1) {
    if (String(nextLines[index]).includes('; WIPE_END')) {
      nextLines.splice(index + 1, 0, ';ZJUMP_START');
      break;
    }
  }

  return nextLines;
}

function hasValidInterfaceSet(interfaceLines = []) {
  return interfaceLines.some((line) => isInterfaceExtrusionLine(line));
}

function finalizeInterfaceSegment(interfaceLines = []) {
  const cleanedLines = deleteWipe(interfaceLines);
  return hasValidInterfaceSet(cleanedLines) ? cleanedLines : [];
}

function findNextInterfaceMotionLine(interfaceLines = [], startIndex = 0) {
  for (let index = startIndex; index < interfaceLines.length; index += 1) {
    if (isInterfaceMotionLine(interfaceLines[index])) {
      return interfaceLines[index];
    }
  }
  return null;
}

function findLastInterfaceMotionLine(interfaceLines = []) {
  for (let index = interfaceLines.length - 1; index >= 0; index -= 1) {
    if (isInterfaceMotionLine(interfaceLines[index])) {
      return interfaceLines[index];
    }
  }
  return null;
}

function sumInterfaceExtrusion(interfaceLines = []) {
  return roundTo(
    interfaceLines.reduce((sum, line) => sum + getInterfaceExtrusionValue(line), 0),
    3
  );
}

function formatCompactNumber(value, decimals = 3) {
  return trimTrailingZeros(Number(value).toFixed(decimals));
}

function classifyIroningFeature(nextLine, config, currentZ) {
  if (!config.wiping.ironApplyFlag) {
    return {
      shouldTrack: false,
      ignoreReason: 'ironing-disabled'
    };
  }

  if (!String(nextLine).includes('; LINE_WIDTH:')) {
    return {
      shouldTrack: true,
      ignoreReason: null
    };
  }

  if (currentZ < (config.machine.nozzleDiameter || 0.4)) {
    return {
      shouldTrack: true,
      ignoreReason: null
    };
  }

  return {
    shouldTrack: false,
    ignoreReason: 'top-surface-ironing'
  };
}

function detectTrackedFeatureKind(line, nextLine, config, currentZ) {
  if (line.includes('; FEATURE: Support interface')) {
    return 'support-interface';
  }

  if (line.includes('; FEATURE: Ironing') && classifyIroningFeature(nextLine, config, currentZ).shouldTrack) {
    return 'ironing';
  }

  return null;
}

function buildSkippedIroningRecovery(interfaceBuffer, currentZ, runtimeState = {}, extrusionSum = 0) {
  if (!interfaceBuffer.length) {
    return [];
  }

  const lines = [];
  const retractLength = Number(runtimeState.retractLength) || 0;
  const lastMove = findLastInterfaceMotionLine(interfaceBuffer);

  if (retractLength > 0) {
    lines.push(`G1 E-${formatCompactNumber(retractLength)}`);
  }

  lines.push(`;Warning: Excessive ironing detected. Ironing cancelled. E_Sum=${formatCompactNumber(extrusionSum)}`);

  if (lastMove) {
    const { command } = splitCommandAndComment(lastMove);
    if (/\bZ/.test(command)) {
      lines.push(lastMove);
    } else {
      lines.push(`G1 Z${roundTo(currentZ + 1, 3).toFixed(3)};Skip Ironing`);
      lines.push(lastMove);
    }
  } else {
    lines.push(`G1 Z${roundTo(currentZ + 1, 3).toFixed(3)};Skip Ironing`);
  }

  lines.push(`G1 Z${roundTo(currentZ, 3).toFixed(3)}`);

  if (retractLength > 0) {
    lines.push(`G1 E${formatCompactNumber(retractLength)}`);
  }

  return lines;
}

function buildTrackedFeatureInjection(interfaceBuffer, featureKind, currentZ, config, runtimeState = {}) {
  const cleanedInterface = finalizeInterfaceSegment(interfaceBuffer);
  if (!cleanedInterface.length) {
    return [];
  }

  if (featureKind === 'ironing') {
    const extrusionSum = sumInterfaceExtrusion(cleanedInterface);
    if (extrusionSum > MAX_ORCA_IRONING_EXTRUSION) {
      return buildSkippedIroningRecovery(cleanedInterface, currentZ, runtimeState, extrusionSum);
    }
  }

  return buildInterfaceInjection(cleanedInterface, currentZ, config, runtimeState);
}

function createProcessingReport(config, runtimeOptions = {}, gcodeContent = '') {
  const startedAtMs = Date.now();
  const report = {
    status: 'running',
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: null,
    durationMs: 0,
    inputPath: runtimeOptions.inputPath || null,
    outputPath: runtimeOptions.outputPath || null,
    configPath: runtimeOptions.configPath || null,
    configFormat: runtimeOptions.configFormat || null,
    summary: {
      totalInputLines: String(gcodeContent || '').split(/\r?\n/).length,
      totalOutputLines: 0,
      supportInterfaceCandidates: 0,
      supportSurfaceIroningCandidates: 0,
      ignoredTopSurfaceIroningSegments: 0,
      skippedInvalidSegments: 0,
      skippedExcessiveIroningSegments: 0,
      injectedSegments: 0
    },
    configSnapshot: {
      speedLimit: config.toolhead.speedLimit,
      offset: { ...config.toolhead.offset },
      nozzleDiameter: config.machine.nozzleDiameter,
      ironApplyFlag: config.wiping.ironApplyFlag,
      switchTowerType: config.wiping.switchTowerType,
      supportExtrusionMultiplier: config.wiping.supportExtrusionMultiplier,
      ironingPathOffsetMm: config.postProcessing.ironingPathOffsetMm
    },
    steps: [],
    _startedAtMs: startedAtMs
  };

  pushReportStep(report, {
    kind: 'config',
    title: '加载并归一化后处理配置',
    human: '已读取当前 preset，并整理成 JS 引擎统一使用的配置结构。',
    technical: `normalizeConfig() -> configFormat=${runtimeOptions.configFormat || 'runtime'} speedLimit=${config.toolhead.speedLimit} ironApplyFlag=${config.wiping.ironApplyFlag} switchTowerType=${config.wiping.switchTowerType} supportExtrusionMultiplier=${config.wiping.supportExtrusionMultiplier}`,
    data: {
      inputPath: report.inputPath,
      outputPath: report.outputPath,
      configPath: report.configPath
    }
  });

  pushReportStep(report, {
    kind: 'config',
    title: '检查高级熨烫路径偏移参数',
    human: config.postProcessing.ironingPathOffsetMm === 0
      ? '未启用高级熨烫路径扩展或收缩，当前继续直接使用原始支撑面路径。'
      : `已读取高级熨烫路径偏移 ${formatCompactNumber(config.postProcessing.ironingPathOffsetMm)} mm。当前版本会记录并展示该参数，完整的几何扩展与边界裁剪仍在继续迁移。`,
    technical: `postProcessing.ironingPathOffsetMm=${formatCompactNumber(config.postProcessing.ironingPathOffsetMm)}; positive=expand, negative=shrink; boundary clipping pending`,
    data: {
      ironingPathOffsetMm: config.postProcessing.ironingPathOffsetMm
    }
  });

  return report;
}

function pushReportStep(report, step = {}) {
  if (!report) {
    return;
  }

  report.steps.push({
    kind: step.kind || 'info',
    title: step.title || 'Untitled step',
    human: step.human || '',
    technical: step.technical || '',
    data: step.data || null
  });
}

function finalizeProcessingReport(report, outputGcode, status = 'completed', error = null) {
  if (!report) {
    return null;
  }

  const finishedAtMs = Date.now();
  report.status = status;
  report.finishedAt = new Date(finishedAtMs).toISOString();
  report.durationMs = finishedAtMs - (report._startedAtMs || finishedAtMs);
  report.summary.totalOutputLines = String(outputGcode || '').split(/\r?\n/).length;

  if (error) {
    pushReportStep(report, {
      kind: 'error',
      title: '后处理失败',
      human: '本次后处理没有顺利完成，请查看技术细节定位原因。',
      technical: `Error: ${error.message || String(error)}`,
      data: {
        name: error.name || 'Error'
      }
    });
  } else {
    pushReportStep(report, {
      kind: 'output',
      title: '生成最终 G-code 输出',
      human: '已完成路径扫描、判断和后处理修正，最终 G-code 已准备好写出。',
      technical: `applyPostProcessingPasses() finished; outputLines=${report.summary.totalOutputLines}; durationMs=${report.durationMs}`,
      data: {
        outputPath: report.outputPath
      }
    });
  }

  delete report._startedAtMs;
  return report;
}

function describeFeatureKind(featureKind) {
  return featureKind === 'ironing' ? '支撑面熨烫路径' : '支撑面接口路径';
}

function countInterfaceMotionLines(interfaceLines = []) {
  return interfaceLines.filter((line) => isInterfaceMotionLine(line)).length;
}

function buildTrackedFeatureInjectionWithReport(options = {}) {
  const {
    interfaceBuffer = [],
    featureKind,
    startLine,
    endLine,
    currentZ,
    config,
    runtimeState = {},
    report
  } = options;

  if (featureKind === 'support-interface') {
    report.summary.supportInterfaceCandidates += 1;
  } else if (featureKind === 'ironing') {
    report.summary.supportSurfaceIroningCandidates += 1;
  }

  const rawExtrusionSum = sumInterfaceExtrusion(interfaceBuffer);
  const cleanedInterface = finalizeInterfaceSegment(interfaceBuffer);
  const cleanedExtrusionSum = sumInterfaceExtrusion(cleanedInterface);
  const rawMotionCount = countInterfaceMotionLines(interfaceBuffer);
  const cleanedMotionCount = countInterfaceMotionLines(cleanedInterface);
  const segmentData = {
    featureKind,
    marker: featureKind === 'ironing' ? '; FEATURE: Ironing' : '; FEATURE: Support interface',
    startLine,
    endLine,
    zHeight: currentZ,
    rawMotionCount,
    cleanedMotionCount,
    rawExtrusionSum,
    cleanedExtrusionSum
  };

  if (!cleanedInterface.length) {
    report.summary.skippedInvalidSegments += 1;
    pushReportStep(report, {
      kind: 'decision',
      title: `跳过无效的${describeFeatureKind(featureKind)}`,
      human: `找到了候选${describeFeatureKind(featureKind)}，但清理擦嘴尾迹后已经没有有效的 XY 挤出，所以不会注入涂胶动作。`,
      technical: `${segmentData.marker} lines ${startLine}-${endLine}; deleteWipe() + hasValidInterfaceSet() => invalid; rawE=${formatCompactNumber(rawExtrusionSum)} cleanedE=${formatCompactNumber(cleanedExtrusionSum)}`,
      data: segmentData
    });
    return [];
  }

  if (featureKind === 'ironing' && cleanedExtrusionSum > MAX_ORCA_IRONING_EXTRUSION) {
    report.summary.skippedExcessiveIroningSegments += 1;
    pushReportStep(report, {
      kind: 'decision',
      title: '取消过量的支撑面熨烫段',
      human: `这段支撑面熨烫的挤出总量达到 ${formatCompactNumber(cleanedExtrusionSum)}，超过安全阈值，所以本次会自动取消涂胶并执行 Skip Ironing 恢复动作。`,
      technical: `Accepted Orca support-surface ironing candidate first, then cancelled because E_sum=${formatCompactNumber(cleanedExtrusionSum)} > ${MAX_ORCA_IRONING_EXTRUSION}; emit retract + Skip Ironing + Z restore`,
      data: {
        ...segmentData,
        threshold: MAX_ORCA_IRONING_EXTRUSION
      }
    });
    return buildSkippedIroningRecovery(cleanedInterface, currentZ, runtimeState, cleanedExtrusionSum);
  }

  report.summary.injectedSegments += 1;
  pushReportStep(report, {
    kind: 'decision',
    title: `复用${describeFeatureKind(featureKind)}进行涂胶`,
    human: `已确认这是一段有效的${describeFeatureKind(featureKind)}，会按照工具头偏移复制路径并注入涂胶动作。`,
    technical: `${segmentData.marker} lines ${startLine}-${endLine}; cleanedMotionCount=${cleanedMotionCount}; cleanedE=${formatCompactNumber(cleanedExtrusionSum)}; buildInterfaceInjection()`,
    data: segmentData
  });

  return buildInterfaceInjection(cleanedInterface, currentZ, config, runtimeState);
}

function processGcodeContentInternal(gcodeContent, engineConfig = {}, runtimeOptions = {}) {
  const config = normalizeConfig(engineConfig);
  const lines = String(gcodeContent || '').split(/\r?\n/);
  const result = [];
  const report = createProcessingReport(config, runtimeOptions, gcodeContent);
  let activeFeatureKind = null;
  let interfaceBuffer = [];
  let activeFeatureStartLine = 0;
  let currentZ = 0;
  const runtimeState = {
    currentFanSpeed: 0,
    currentLayerThickness: 0,
    nozzleSwitchTemperature: null,
    retractLength: 0
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const line = rawLine.trimEnd();
    const nextLine = lineIndex + 1 < lines.length ? lines[lineIndex + 1].trimEnd() : '';

    if (line.startsWith('; Z_HEIGHT:')) {
      currentZ = numStrip(line)[0] || currentZ;
    }

    if (line.startsWith('; LAYER_HEIGHT:')) {
      runtimeState.currentLayerThickness = numStrip(line)[0] || runtimeState.currentLayerThickness;
    }

    if (line.startsWith('; retraction_length =')) {
      runtimeState.retractLength = numStrip(line)[0] || runtimeState.retractLength;
    }

    if (line.startsWith('; nozzle_temperature =')) {
      runtimeState.nozzleSwitchTemperature = numStrip(line)[0] || runtimeState.nozzleSwitchTemperature;
    }

    if (line.startsWith('M106 P1 S')) {
      runtimeState.currentFanSpeed = numStrip(line)[2] || runtimeState.currentFanSpeed;
    } else if (line.startsWith('M106 S')) {
      runtimeState.currentFanSpeed = numStrip(line)[1] || runtimeState.currentFanSpeed;
    }

    const trackedFeatureKind = detectTrackedFeatureKind(line, nextLine, config, currentZ);
    const leavesTrackedFeature = Boolean(activeFeatureKind) && line.startsWith('; FEATURE:') && !trackedFeatureKind;
    const switchesTrackedFeature = Boolean(activeFeatureKind)
      && Boolean(trackedFeatureKind)
      && trackedFeatureKind !== activeFeatureKind;

    if (line.includes('; FEATURE: Ironing')) {
      const ironingDecision = classifyIroningFeature(nextLine, config, currentZ);
      if (!ironingDecision.shouldTrack && ironingDecision.ignoreReason === 'top-surface-ironing') {
        report.summary.ignoredTopSurfaceIroningSegments += 1;
        pushReportStep(report, {
          kind: 'scan',
          title: '忽略顶部熨烫路径',
          human: '找到了熨烫段，但这更像是顶部熨烫而不是支撑面熨烫，所以不会拿来做涂胶路径。',
          technical: `Ignored Orca ironing at line ${lineIndex + 1}; next marker contains ; LINE_WIDTH: and currentZ=${formatCompactNumber(currentZ)} >= nozzleDiameter=${formatCompactNumber(config.machine.nozzleDiameter || 0.4)}`,
          data: {
            line: lineIndex + 1,
            currentZ,
            nozzleDiameter: config.machine.nozzleDiameter || 0.4
          }
        });
      } else if (!ironingDecision.shouldTrack && ironingDecision.ignoreReason === 'ironing-disabled') {
        pushReportStep(report, {
          kind: 'scan',
          title: '熨烫路径复用未启用',
          human: '检测到了熨烫段，但当前 preset 没有开启“复用支撑面熨烫路径”这一策略，所以这里不会参与涂胶。',
          technical: `Ignored Orca ironing at line ${lineIndex + 1}; wiping.ironApplyFlag=false`,
          data: {
            line: lineIndex + 1
          }
        });
      }
    }

    if (leavesTrackedFeature || switchesTrackedFeature) {
      result.push(...buildTrackedFeatureInjectionWithReport({
        interfaceBuffer,
        featureKind: activeFeatureKind,
        startLine: activeFeatureStartLine,
        endLine: lineIndex,
        currentZ,
        config,
        runtimeState,
        report
      }));
      interfaceBuffer = [];
      activeFeatureKind = null;
      activeFeatureStartLine = 0;
    }

    if (trackedFeatureKind) {
      activeFeatureKind = trackedFeatureKind;
      if (!activeFeatureStartLine) {
        activeFeatureStartLine = lineIndex + 1;
      }
    }

    result.push(line);

    if (activeFeatureKind && line) {
      interfaceBuffer.push(line);
    }
  }

  if (activeFeatureKind && interfaceBuffer.length > 0) {
    result.push(...buildTrackedFeatureInjectionWithReport({
      interfaceBuffer,
      featureKind: activeFeatureKind,
      startLine: activeFeatureStartLine,
      endLine: lines.length,
      currentZ,
      config,
      runtimeState,
      report
    }));
  }

  const outputGcode = applyPostProcessingPasses(result.join('\n'), config);
  finalizeProcessingReport(report, outputGcode);
  return {
    outputGcode,
    report
  };
}

function processGcodeContentDetailed(gcodeContent, engineConfig = {}, runtimeOptions = {}) {
  return processGcodeContentInternal(gcodeContent, engineConfig, runtimeOptions);
}

function processGcodeContent(gcodeContent, engineConfig = {}) {
  return processGcodeContentInternal(gcodeContent, engineConfig).outputGcode;
}

function buildInterfaceInjection(interfaceBuffer, currentZ, config, runtimeState = {}) {
  if (!interfaceBuffer.length) {
    return [];
  }

  const lines = [];
  const offset = config.toolhead.offset || { x: 0, y: 0, z: 0 };
  const speedLimit = Math.floor((config.toolhead.speedLimit || 0) * 60);

  lines.push('; ===== MKP Support Electron Glueing Start =====');
  lines.push('M106 S255 ; enable cooling during glueing');
  appendNozzleCooldown(lines, config, runtimeState);
  lines.push(`G1 Z${(currentZ + offset.z + 3).toFixed(3)} ; lift to avoid collision`);
  pushMultilineGcode(lines, config.toolhead.customMountGcode);

  if (speedLimit > 0) {
    lines.push(`G1 F${speedLimit}`);
  }

  for (let index = 0; index < interfaceBuffer.length; index += 1) {
    const bufferedLine = interfaceBuffer[index];

    if (String(bufferedLine).includes(';ZJUMP_START')) {
      const nextMove = findNextInterfaceMotionLine(interfaceBuffer, index + 1);
      if (!nextMove) {
        continue;
      }

      lines.push(`G1 Z${(currentZ + offset.z + 3).toFixed(3)} ; avoid spoiling before the next interface segment`);
      lines.push(
        `${processGcodeOffset(
          nextMove,
          offset.x,
          offset.y,
          offset.z,
          'normal',
          { machineBounds: config.machine.bounds }
        )} ; jump to the next interface segment`
      );
      lines.push(`G1 Z${(currentZ + offset.z).toFixed(3)} ; resume glue height`);
      continue;
    }

    if (isInterfaceMotionLine(bufferedLine)) {
      lines.push(
        processGcodeOffset(
          bufferedLine,
          offset.x,
          offset.y,
          offset.z,
          'normal',
          { machineBounds: config.machine.bounds }
        )
      );
    }
  }

  pushExpandedUnmountGcode(lines, config.toolhead.customUnmountGcode, runtimeState);
  lines.push(';Toolhead Unmounted');
  appendPostGlueRecovery(lines, currentZ, config, runtimeState);
  lines.push(`G1 Z${currentZ.toFixed(3)} ; resume print height`);
  lines.push('; ===== MKP Support Electron Glueing End =====');

  return lines;
}

function pushMultilineGcode(target, block) {
  const lines = String(block || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  target.push(...lines);
}

function appendNozzleCooldown(target, config, runtimeState) {
  const nozzleSwitchTemperature = runtimeState.nozzleSwitchTemperature;

  if (!config.wiping.nozzleCoolingFlag || !Number.isFinite(nozzleSwitchTemperature)) {
    return;
  }

  target.push(';Pervent Leakage');
  target.push(`M104 S${nozzleSwitchTemperature - 30}`);
}

function pushExpandedUnmountGcode(target, block, runtimeState = {}) {
  const lines = String(block || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  for (const line of lines) {
    if (line.includes('M106 P1 S[AUTO]')) {
      target.push(`M106 P1 S${runtimeState.currentFanSpeed || 0}`);
      continue;
    }

    if (line.includes('M106 S[AUTO]')) {
      target.push(`M106 S${runtimeState.currentFanSpeed || 0}`);
      continue;
    }

    target.push(line);
  }
}

function appendPostGlueRecovery(target, currentZ, config, runtimeState) {
  const nozzleSwitchTemperature = runtimeState.nozzleSwitchTemperature;
  const useWipingTowers = Boolean(config.wiping.haveWipingComponents);
  const userDryTime = config.wiping.userDryTime || 0;

  if (!useWipingTowers) {
    target.push('; FEATURE: Outer wall');

    if (config.wiping.nozzleCoolingFlag && Number.isFinite(nozzleSwitchTemperature)) {
      target.push(`M104 S${nozzleSwitchTemperature}`);
    }

    if (userDryTime !== 0) {
      target.push(';User Dry Time Activated');
      target.push(`G4 P${Math.round(userDryTime * 1000)}`);
    }

    return;
  }

  target.push(
    processGcodeOffset(
      'G1 X20 Y10.19',
      config.wiping.wiperX - 5,
      config.wiping.wiperY - 5,
      currentZ + 3,
      'normal',
      { machineBounds: config.machine.bounds }
    )
  );
  target.push(';Prepare for next tower');

  if (config.wiping.nozzleCoolingFlag && Number.isFinite(nozzleSwitchTemperature)) {
    if (userDryTime !== 0) {
      target.push(`M104 S${nozzleSwitchTemperature}`);
    } else {
      target.push(`M109 S${nozzleSwitchTemperature}`);
    }
  }

  if (userDryTime !== 0) {
    target.push(';User Dry Time Activated');
    target.push(`G4 P${Math.round(userDryTime * 1000)}`);
  }

  target.push(...buildWipingTowerLayerGcode({
    currentLayerHeight: currentZ,
    localLayerThickness: runtimeState.currentLayerThickness || 0,
    machineBounds: config.machine.bounds,
    nozzleDiameter: config.machine.nozzleDiameter || 0.4,
    retractLength: runtimeState.retractLength || 0,
    switchTowerType: config.wiping.switchTowerType || 1,
    towerHeight: currentZ,
    travelSpeed: config.toolhead.speedLimit || 0,
    wipeTowerPrintSpeed: config.wiping.wipeTowerPrintSpeed || 0,
    wipingGcode: config.templates.wipingGcode,
    wiperX: config.wiping.wiperX || 0,
    wiperY: config.wiping.wiperY || 0
  }));
}

function resolveWipingTowerPrintSpeedMmPerSec(switchTowerType, wipeTowerPrintSpeed) {
  const requestedSpeed = Number(wipeTowerPrintSpeed) || 0;
  if (requestedSpeed <= 0) {
    return 0;
  }

  return Number(switchTowerType) === 1 ? Math.min(requestedSpeed, 35) : requestedSpeed;
}

function buildTowerBaseLayerGcode(options = {}) {
  const firstLayerHeight = options.firstLayerHeight || 0;
  const firstLayerSpeed = options.firstLayerSpeed || 0;
  const retractLength = options.retractLength || 0;
  const travelSpeed = options.travelSpeed || 0;
  const wiperX = options.wiperX || 0;
  const wiperY = options.wiperY || 0;
  const towerBaseLayerGcode = Array.isArray(options.towerBaseLayerGcode)
    ? options.towerBaseLayerGcode
    : DEFAULT_TOWER_BASE_LAYER_GCODE;
  const towerExtrudeRatio = roundTo((firstLayerHeight / 0.2) * 0.8, 3);
  const lines = [];

  lines.push(`G1 F${Math.round(travelSpeed * 60)}`);

  for (const line of towerBaseLayerGcode) {
    if (line.includes('EXTRUDER_REFILL')) {
      lines.push('G92 E0');
      lines.push(`G1 E${retractLength}`);
      lines.push('G92 E0');
      continue;
    }

    if (line.includes('NOZZLE_HEIGHT_ADJUST')) {
      lines.push(`G1 Z${roundTo(firstLayerHeight, 3).toFixed(3)};Tower Z`);
      continue;
    }

    if (line.includes('EXTRUDER_RETRACT')) {
      lines.push('G92 E0');
      continue;
    }

    if (line.includes('G92 E0')) {
      lines.push('G92 E0');
      continue;
    }

    if (line.includes('G1 F9600')) {
      lines.push(`G1 F${Math.round(firstLayerSpeed * 60)}`);
      continue;
    }

    if (line.includes('G1 ') && !line.includes('G1 E') && !line.includes('G1 F')) {
      lines.push(
        processGcodeOffset(
          line,
          wiperX - 5,
          wiperY - 5,
          0,
          'tower',
          {
            machineBounds: options.machineBounds,
            towerExtrudeRatio
          }
        )
      );
    }
  }

  lines.push(`G1 F${Math.round(travelSpeed * 60)}`);

  return lines;
}

function buildWipingTowerLayerGcode(options = {}) {
  const currentLayerHeight = options.currentLayerHeight || 0;
  const localLayerThickness = options.localLayerThickness || 0;
  const nozzleDiameter = options.nozzleDiameter || 0.4;
  const retractLength = options.retractLength || 0;
  const defaultSuggestedLayerHeight = localLayerThickness > 0
    ? Math.max(localLayerThickness, roundTo(0.2 * nozzleDiameter, 3))
    : roundTo(0.65 * nozzleDiameter, 3);
  const suggestedLayerHeight = Number.isFinite(options.suggestedLayerHeight)
    ? options.suggestedLayerHeight
    : defaultSuggestedLayerHeight;
  const switchTowerType = options.switchTowerType || 1;
  const towerHeight = options.towerHeight || 0;
  const travelSpeed = options.travelSpeed || 0;
  const wipeTowerPrintSpeed = options.wipeTowerPrintSpeed || 0;
  const wipingGcode = Array.isArray(options.wipingGcode)
    ? options.wipingGcode
    : DEFAULT_WIPING_GCODE;
  const wiperX = options.wiperX || 0;
  const wiperY = options.wiperY || 0;
  const towerExtrudeRatio = roundTo(suggestedLayerHeight / 0.2, 3);
  const lines = [];

  lines.push(`G1 F${Math.round(travelSpeed * 60)}`);
  lines.push('; FEATURE: Inner wall');
  lines.push('; LINE_WIDTH: 0.42');
  lines.push(`;Extruding Ratio: ${towerExtrudeRatio}`);
  lines.push(`; LAYER_HEIGHT: ${formatCompactNumber(suggestedLayerHeight)}`);

  if (roundTo(suggestedLayerHeight, 3) === roundTo(0.65 * nozzleDiameter, 3)) {
    lines.push(
      `${processGcodeOffset(
        'G1 X20 Y20',
        wiperX - 5,
        wiperY - 5,
        towerHeight + 3,
        'tower',
        {
          machineBounds: options.machineBounds,
          towerExtrudeRatio
        }
      )} Z${roundTo(currentLayerHeight + 0.6, 3).toFixed(3)}`
    );
  }

  for (const line of wipingGcode) {
    if (line.includes('G1 F9600')) {
      lines.push(`G1 F${Math.round(resolveWipingTowerPrintSpeedMmPerSec(switchTowerType, wipeTowerPrintSpeed) * 60)}`);
      continue;
    }

    if (line.includes('TOWER_ZP_ST')) {
      continue;
    }

    if (line.includes('NOZZLE_HEIGHT_ADJUST')) {
      lines.push(`G1 Z${formatCompactNumber(towerHeight)};Tower Z`);
      continue;
    }

    if (line.includes('EXTRUDER_REFILL')) {
      lines.push('G92 E0');
      lines.push(`G1 E${formatCompactNumber(retractLength)}`);
      lines.push('G92 E0');
      continue;
    }

    if (line.includes('EXTRUDER_RETRACT')) {
      lines.push('G92 E0');
      lines.push(`G1 E-${formatCompactNumber(roundTo(Math.abs(retractLength - 0.31), 3))}`);
      lines.push('G92 E0');
      continue;
    }

    if (line.includes('G1 E-.21 F5400') || line.includes('G1 E.3 F5400') || line.includes('G92 E0')) {
      lines.push(line.trimEnd());
      continue;
    }

    lines.push(
      processGcodeOffset(
        line,
        wiperX - 5,
        wiperY - 5,
        0,
        'tower',
        {
          machineBounds: options.machineBounds,
          towerExtrudeRatio
        }
      )
    );
  }

  lines.push(`G1 F${Math.round(travelSpeed * 60)}`);
  lines.push(
    `${processGcodeOffset(
      'G1 X33 Y33',
      wiperX - 5,
      wiperY - 5,
      towerHeight + 0.7,
      'tower',
      {
        machineBounds: options.machineBounds,
        towerExtrudeRatio
      }
    )} Z${roundTo(towerHeight + 0.7, 3).toFixed(3)} ;Leaving Wiping Tower`
  );

  if (localLayerThickness > 0) {
    lines.push(`; LAYER_HEIGHT: ${formatCompactNumber(localLayerThickness)}`);
  }

  return lines;
}

function applyPostProcessingPasses(gcodeContent, engineConfig = {}) {
  const config = normalizeConfig(engineConfig);
  const lines = String(gcodeContent || '').split(/\r?\n/);
  const result = [];
  const multiplier = config.wiping.supportExtrusionMultiplier || 1;
  const nozzleDiameter = config.machine.nozzleDiameter || 0.4;
  let currentLayerHeight = 0;
  let currentThickness = 0;
  let suggestedRatio = 1;
  let thickBridgeActive = false;
  let supportActive = false;

  for (const rawLine of lines) {
    let line = rawLine.trimEnd();

    if (line.startsWith('; Z_HEIGHT:')) {
      currentLayerHeight = numStrip(line)[0] || currentLayerHeight;
    }

    if (line.startsWith('; LAYER_HEIGHT:')) {
      currentThickness = numStrip(line)[0] || currentThickness;
      suggestedRatio = calculateSuggestedRatio(currentThickness, nozzleDiameter);
    }

    if (line.startsWith('; FEATURE:')) {
      if (config.wiping.forceThickBridgeFlag && line.includes('; FEATURE: Support transition')) {
        thickBridgeActive = true;
        if (currentThickness > 0) {
          result.push(`; LAYER_HEIGHT: ${formatLayerHeight(currentThickness * suggestedRatio)}`);
        }
      } else if (thickBridgeActive) {
        thickBridgeActive = false;
        if (currentThickness > 0) {
          result.push(`; LAYER_HEIGHT: ${formatLayerHeight(currentThickness)}`);
        }
      }

      supportActive = line.includes('; FEATURE: Support')
        && !line.includes('; FEATURE: Support transition')
        && !line.includes('; FEATURE: Support interface');
    }

    if (thickBridgeActive) {
      line = scaleExtrusion(line, suggestedRatio, {
        appendComment: ';MKP thick bridge',
        minExtrusion: 0.05
      });
    }

    if (supportActive && currentLayerHeight > 0.3 && Math.abs(multiplier - 1) > 0.01) {
      line = scaleExtrusion(line, multiplier);
    }

    result.push(line);
  }

  return result.join('\n');
}

function scaleExtrusion(line, ratio, options = {}) {
  const { appendComment = '', minExtrusion = 0 } = options;
  const { command, comment } = splitCommandAndComment(line);

  if (!isPositiveExtrusionMove(command)) {
    return line;
  }

  const match = command.match(/\bE([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);
  if (!match) {
    return line;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0 || value <= minExtrusion) {
    return line;
  }

  const scaledValue = roundTo(value * ratio, 5);
  const nextCommand = command.replace(match[0], `E${formatScaledExtrusion(scaledValue)}`);
  const suffix = appendComment || comment;
  const joinedSuffix = [appendComment, comment].filter(Boolean).join(' ');

  if (joinedSuffix) {
    return `${nextCommand}${appendComment ? appendComment : ''}${appendComment && comment ? ` ${comment}` : (!appendComment && comment ? ` ${comment}` : '')}`;
  }

  if (suffix) {
    return `${nextCommand} ${suffix}`;
  }

  return nextCommand;
}

function isPositiveExtrusionMove(command) {
  return /^G1\b/.test(command)
    && /(?:\bX|\bY)/.test(command)
    && /\bE[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(command);
}

function formatScaledExtrusion(value) {
  const text = trimTrailingZeros(value.toFixed(5));
  if (value > 0 && value < 1 && text.startsWith('0')) {
    return text.slice(1);
  }
  return text;
}

function calculateSuggestedRatio(thickness, nozzleDiameter) {
  if (!thickness || !nozzleDiameter) {
    return 1;
  }

  if (thickness >= 0.5 * nozzleDiameter) {
    return 1;
  }

  if (thickness <= 0.2 * nozzleDiameter) {
    return (0.6 * nozzleDiameter) / thickness;
  }

  return 1 + (((0.6 * nozzleDiameter) / thickness) - 1)
    * (((0.5 * nozzleDiameter) - thickness) / ((0.5 * nozzleDiameter) - (0.2 * nozzleDiameter)));
}

function formatLayerHeight(value) {
  return roundTo(value, 3).toFixed(3);
}

function trimTrailingZeros(text) {
  return text.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '.0');
}

function roundTo(value, decimals) {
  return Number(Number(value).toFixed(decimals));
}

function numStrip(line) {
  const matches = String(line).match(/\d+\.?\d*/g) || [];
  return matches.map(Number);
}

function processGcode(gcodePath, configPath, options = {}) {
  return processGcodeDetailed(gcodePath, configPath, options).outputGcode;
}

function processGcodeDetailed(gcodePath, configPath, options = {}) {
  const config = loadEngineConfig(configPath, options.configFormat);
  const gcodeContent = fs.readFileSync(gcodePath, 'utf8');
  const outputPath = options.outputPath
    || (String(gcodePath).toLowerCase().endsWith('.gcode')
      ? gcodePath.replace(/\.gcode$/i, '_processed.gcode')
      : `${gcodePath}_processed.gcode`);
  return processGcodeContentDetailed(gcodeContent, config, {
    configFormat: options.configFormat,
    configPath,
    inputPath: gcodePath,
    outputPath
  });
}

function buildPostprocessTraceExport(report, mode = 'technical') {
  const lines = [];
  const normalizedMode = mode === 'human' ? 'human' : 'technical';
  const heading = normalizedMode === 'human' ? 'Human-readable' : 'Technical';

  lines.push('# MKP Post-processing Trace');
  lines.push('');
  lines.push(`- Mode: ${heading}`);
  lines.push(`- Status: ${report?.status || 'unknown'}`);
  lines.push(`- Input: ${report?.inputPath || 'N/A'}`);
  lines.push(`- Output: ${report?.outputPath || 'N/A'}`);
  lines.push(`- Config: ${report?.configPath || 'N/A'}`);
  lines.push(`- DurationMs: ${report?.durationMs || 0}`);
  lines.push('');

  (report?.steps || []).forEach((step, index) => {
    lines.push(`## ${index + 1}. ${step.title}`);
    lines.push('');
    lines.push(normalizedMode === 'human' ? (step.human || '') : (step.technical || ''));
    if (step.data) {
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(step.data, null, 2));
      lines.push('```');
    }
    lines.push('');
  });

  return lines.join('\n').trim();
}

module.exports = {
  applyPostProcessingPasses,
  buildPostprocessTraceExport,
  buildTowerBaseLayerGcode,
  buildWipingTowerLayerGcode,
  deleteWipe,
  formatXYZEString,
  getPseudoRandom,
  hasValidInterfaceSet,
  loadEngineConfig,
  normalizeConfig,
  numStrip,
  parseCliArguments,
  parseConfigText,
  processGcode,
  processGcodeDetailed,
  processGcodeContent,
  processGcodeContentDetailed,
  processGcodeOffset,
  resetPseudoRandom
};
