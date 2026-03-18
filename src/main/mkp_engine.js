const fs = require('fs');

const DEFAULT_WIPING_GCODE = `
; MKP wiping tower template
G92 E0
G1 X20 Y20 E0.8
G1 X24 Y20 E0.4
G92 E0
`.trim().split(/\r?\n/);

const DEFAULT_TOWER_BASE_LAYER_GCODE = `
; MKP tower base template
G92 E0
G1 X20 Y20 E1.0
G1 X25 Y20 E0.5
G92 E0
`.trim().split(/\r?\n/);

const PSEUDO_RANDOM_TABLE = ['3', '7', '2', '8', '1', '5', '9', '4', '6'];
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
      towerExtrudeRatio: getNumber(postProcessing, ['towerExtrudeRatio', 'tower_extrude_ratio'], 1)
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

function processGcodeContent(gcodeContent, engineConfig = {}) {
  const config = normalizeConfig(engineConfig);
  const lines = String(gcodeContent || '').split(/\r?\n/);
  const result = [];
  let activeInterface = false;
  let interfaceBuffer = [];
  let currentZ = 0;
  const runtimeState = {
    currentFanSpeed: 0,
    nozzleSwitchTemperature: null
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('; Z_HEIGHT:')) {
      currentZ = numStrip(line)[0] || currentZ;
    }

    if (line.startsWith('; nozzle_temperature =')) {
      runtimeState.nozzleSwitchTemperature = numStrip(line)[0] || runtimeState.nozzleSwitchTemperature;
    }

    if (line.startsWith('M106 P1 S')) {
      runtimeState.currentFanSpeed = numStrip(line)[2] || runtimeState.currentFanSpeed;
    } else if (line.startsWith('M106 S')) {
      runtimeState.currentFanSpeed = numStrip(line)[1] || runtimeState.currentFanSpeed;
    }

    const startsTrackedFeature = line.includes('; FEATURE: Support interface') || line.includes('; FEATURE: Ironing');
    const leavesTrackedFeature = activeInterface && line.startsWith('; FEATURE:') && !startsTrackedFeature;

    if (startsTrackedFeature) {
      activeInterface = true;
    } else if (leavesTrackedFeature) {
      activeInterface = false;
      result.push(...buildInterfaceInjection(interfaceBuffer, currentZ, config, runtimeState));
      interfaceBuffer = [];
    }

    result.push(line);

    if (activeInterface && line && !line.startsWith(';')) {
      interfaceBuffer.push(line);
    }
  }

  if (activeInterface && interfaceBuffer.length > 0) {
    result.push(...buildInterfaceInjection(interfaceBuffer, currentZ, config, runtimeState));
  }

  return applyPostProcessingPasses(result.join('\n'), config);
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

  for (const bufferedLine of interfaceBuffer) {
    if (bufferedLine.startsWith('G1 ') && (bufferedLine.includes('X') || bufferedLine.includes('Y'))) {
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
  const config = loadEngineConfig(configPath, options.configFormat);
  const gcodeContent = fs.readFileSync(gcodePath, 'utf8');
  return processGcodeContent(gcodeContent, config);
}

module.exports = {
  applyPostProcessingPasses,
  buildTowerBaseLayerGcode,
  formatXYZEString,
  getPseudoRandom,
  loadEngineConfig,
  normalizeConfig,
  numStrip,
  parseCliArguments,
  parseConfigText,
  processGcode,
  processGcodeContent,
  processGcodeOffset,
  resetPseudoRandom
};
