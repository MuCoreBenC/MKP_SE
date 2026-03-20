const fs = require('fs');

const WIPE_TOWER_FOOTPRINT = Object.freeze({
  minXOffset: -5,
  maxXOffset: 28,
  minYOffset: -5,
  maxYOffset: 28
});

const DEFAULT_TOWER_GEOMETRY = Object.freeze({
  coreWidth: 20,
  coreDepth: 20,
  brimWidth: 0,
  outerWallWidth: 0,
  outerWallDepth: 0,
  slantedOuterWallEnabled: false,
  slantedOuterWallWidth: 0,
  slantedOuterWallDepth: 0,
  layerWidth: 20,
  layerDepth: 20,
  baseWidth: 20,
  baseDepth: 20
});

const BAMBU_X1_P1_FRONT_DEAD_ZONES = Object.freeze([
  Object.freeze({ id: 'mkp-safety', label: 'MKP safety restriction', kind: 'safety', minX: 6, maxX: 41, minY: 6, maxY: 52 }),
  Object.freeze({ id: 'official-front-strip', label: 'Official front purge strip', kind: 'official', minX: 18, maxX: 240, minY: 6, maxY: 12 }),
  Object.freeze({ id: 'official-front-hook', label: 'Official front L return', kind: 'official', minX: 231, maxX: 240, minY: 6, maxY: 18 })
]);

const TOWER_DEAD_ZONE_CLEARANCE = 1;

const BAMBU_X1_P1_TOWER_PROFILE = Object.freeze({
  id: 'bambu-x1-p1',
  bounds: Object.freeze({ minX: 0, maxX: 256, minY: 0, maxY: 256 }),
  manualSafeRange: Object.freeze({ minX: 6, maxX: 250, minY: 6, maxY: 250 }),
  deadZones: Object.freeze([
    Object.freeze({ id: 'mkp-safety', label: 'MKP safety restriction', kind: 'safety', minX: 6, maxX: 41, minY: 6, maxY: 52 }),
    Object.freeze({ id: 'official-left-l', label: 'Official left L dead zone', kind: 'official', minX: 6, maxX: 18, minY: 6, maxY: 250 }),
    Object.freeze({ id: 'official-bottom-l', label: 'Official bottom L dead zone', kind: 'official', minX: 6, maxX: 28, minY: 6, maxY: 28 })
  ])
});

const TOWER_PLACEMENT_PROFILES = Object.freeze({
  p1: BAMBU_X1_P1_TOWER_PROFILE,
  p1s: BAMBU_X1_P1_TOWER_PROFILE,
  x1: BAMBU_X1_P1_TOWER_PROFILE
});

const DEFAULT_WIPING_GCODE = `
;Tower_Layer_Gcode
EXTRUDER_REFILL
G1 X20 Y10.19
NOZZLE_HEIGHT_ADJUST
G1 F9600
G1 X20 Y20 E.34 ;MoreExtrusion
G1 X29.81 Y20 E.34 ;MoreExtrusion
G1 E-.21 F5400
;WIPE_START
G1 F9600
G1 X28.81 Y20 E-.09
;WIPE_END
G1 X23.71 Y25.679 F30000
G1 X20 Y29.81
G1 E.3 F5400
G1 F9600
G1 X20 Y20 E.34 ;MoreExtrusion
G1 X10.19 Y20 E.34 ;MoreExtrusion
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
;Tower_Base_Layer_Gcode
G1 X19.681 Y20.319
NOZZLE_HEIGHT_ADJUST
EXTRUDER_REFILL
G1 F9600
G1 X19.681 Y20.319 E.02318
G1 X20.319 Y20.319 E.02318
G1 X20.319 Y19.681 E.02318
G1 X19.681 Y19.681 E.02318
G1 X19.304 Y19.304 F30000
G1 F9600
G1 X20.696 Y19.304 E.05059
G1 X20.696 Y20.696 E.05059
G1 X19.304 Y20.696 E.05059
G1 X19.304 Y19.304 E.05059
G1 X18.927 Y18.927 F30000
G1 F9600
G1 X21.073 Y18.927 E.078
G1 X21.073 Y21.073 E.078
G1 X18.927 Y21.073 E.078
G1 X18.927 Y18.927 E.078
G1 X18.55 Y18.55 F30000
G1 F9600
G1 X18.55 Y21.45 E.1054
G1 X21.45 Y21.45 E.1054
G1 X21.45 Y18.55 E.1054
G1 X18.55 Y18.55 E.1054
G1 X18.173 Y18.173 F30000
G1 F9600
G1 X18.173 Y21.827 E.13281
G1 X21.827 Y21.827 E.13281
G1 X21.827 Y18.173 E.13281
G1 X18.173 Y18.173 E.13281
G1 X17.796 Y17.796 F30000
G1 F9600
G1 X22.204 Y17.796 E.16022
G1 X22.204 Y22.204 E.16022
G1 X17.796 Y22.204 E.16022
G1 X17.796 Y17.796 E.16022
G1 X17.419 Y17.419 F30000
G1 F9600
G1 X22.581 Y17.419 E.18763
G1 X22.581 Y22.581 E.18763
G1 X17.419 Y22.581 E.18763
G1 X17.419 Y17.419 E.18763
G1 X17.042 Y17.042 F30000
G1 F9600
G1 X22.958 Y17.042 E.21504
G1 X22.958 Y22.958 E.21504
G1 X17.042 Y22.958 E.21504
G1 X17.042 Y17.042 E.21504
G1 X16.664 Y16.664 F30000
G1 F9600
G1 X16.664 Y23.336 E.24245
G1 X23.336 Y23.336 E.24245
G1 X23.336 Y16.664 E.24245
G1 X16.664 Y16.664 E.24245
G1 X16.287 Y16.287 F30000
G1 F9600
G1 X16.287 Y23.713 E.26986
G1 X23.713 Y23.713 E.26986
G1 X23.713 Y16.287 E.26986
G1 X16.287 Y16.287 E.26986
G1 X15.91 Y15.91 F30000
G1 F9600
G1 X24.09 Y15.91 E.29726
G1 X24.09 Y24.09 E.29726
G1 X15.91 Y24.09 E.29726
G1 X15.91 Y15.91 E.29726
G1 X15.533 Y15.533 F30000
G1 F9600
G1 X15.533 Y24.467 E.32467
G1 X24.467 Y24.467 E.32467
G1 X24.467 Y15.533 E.32467
G1 X15.533 Y15.533 E.32467
G1 X15.156 Y15.156 F30000
G1 F9600
G1 X15.156 Y24.844 E.35208
G1 X24.844 Y24.844 E.35208
G1 X24.844 Y15.156 E.35208
G1 X15.156 Y15.156 E.35208
G1 X14.779 Y14.779 F30000
G1 F9600
G1 X25.221 Y14.779 E.37949
G1 X25.221 Y25.221 E.37949
G1 X14.779 Y25.221 E.37949
G1 X14.779 Y14.779 E.37949
G1 X14.402 Y14.402 F30000
G1 F9600
G1 X14.402 Y25.598 E.4069
G1 X25.598 Y25.598 E.4069
G1 X25.598 Y14.402 E.4069
G1 X14.402 Y14.402 E.4069
G1 X14.025 Y14.025 F30000
G1 F9600
G1 X14.025 Y25.975 E.43431
G1 X25.975 Y25.975 E.43431
G1 X25.975 Y14.025 E.43431
G1 X14.025 Y14.025 E.43431
G1 X13.648 Y13.648 F30000
G1 F9600
G1 X26.352 Y13.648 E.46172
G1 X26.352 Y26.352 E.46172
G1 X13.648 Y26.352 E.46172
G1 X13.648 Y13.648 E.46172
G1 X13.271 Y13.271 F30000
G1 F9600
G1 X13.271 Y26.729 E.48913
G1 X26.729 Y26.729 E.48913
G1 X26.729 Y13.271 E.48913
G1 X13.271 Y13.271 E.48913
G1 X12.894 Y12.894 F30000
G1 F9600
G1 X12.894 Y27.106 E.51653
G1 X27.106 Y27.106 E.51653
G1 X27.106 Y12.894 E.51653
G1 X12.894 Y12.894 E.51653
G1 X12.517 Y12.517 F30000
G1 F9600
G1 X12.517 Y27.483 E.54394
G1 X27.483 Y27.483 E.54394
G1 X27.483 Y12.517 E.54394
G1 X12.517 Y12.517 E.54394
G1 X12.14 Y12.14 F30000
G1 F9600
G1 X12.14 Y27.86 E.57135
G1 X27.86 Y27.86 E.57135
G1 X27.86 Y12.14 E.57135
G1 X12.14 Y12.14 E.57135
G1 X11.762 Y11.762 F30000
G1 F9600
G1 X28.238 Y11.762 E.59876
G1 X28.238 Y28.238 E.59876
G1 X11.762 Y28.238 E.59876
G1 X11.762 Y11.762 E.59876
G1 X11.385 Y11.385 F30000
G1 F9600
G1 X28.615 Y11.385 E.62617
G1 X28.615 Y28.615 E.62617
G1 X11.385 Y28.615 E.62617
G1 X11.385 Y11.385 E.62617
G1 X11.008 Y11.008 F30000
G1 F9600
G1 X28.992 Y11.008 E.65358
G1 X28.992 Y28.992 E.65358
G1 X11.008 Y28.992 E.65358
G1 X11.008 Y11.008 E.65358
G1 X10.631 Y10.631 F30000
G1 F9600
G1 X29.369 Y10.631 E.68099
G1 X29.369 Y29.369 E.68099
G1 X10.631 Y29.369 E.68099
G1 X10.631 Y10.631 E.68099
G1 X10.254 Y10.254 F30000
G1 F9600
G1 X29.746 Y10.254 E.70839
G1 X29.746 Y29.746 E.70839
G1 X10.254 Y29.746 E.70839
G1 X10.254 Y10.254 E.70839
G1 X9.877 Y9.877 F30000
G1 F9600
G1 X30.123 Y9.877 E.7358
G1 X30.123 Y30.123 E.7358
G1 X9.877 Y30.123 E.7358
G1 X9.877 Y9.877 E.7358
G1 X9.5 Y9.5 F30000
G1 F9600
G1 X9.5 Y30.5 E.76321
G1 X30.5 Y30.5 E.76321
G1 X30.5 Y9.5 E.76321
G1 X9.5 Y9.5 E.76321
G1 X9.123 Y9.123 F30000
G1 F9600
G1 X9.123 Y30.877 E.79062
G1 X30.877 Y30.877 E.79062
G1 X30.877 Y9.123 E.79062
G1 X9.123 Y9.123 E.79062
G1 X8.746 Y8.746 F30000
G1 F9600
G1 X31.254 Y8.746 E.81803
G1 X31.254 Y31.254 E.81803
G1 X8.746 Y31.254 E.81803
G1 X8.746 Y8.746 E.81803
G1 X8.369 Y8.369 F30000
G1 F9600
G1 X8.369 Y31.631 E.84544
G1 X31.631 Y31.631 E.84544
G1 X31.631 Y8.369 E.84544
G1 X8.369 Y8.369 E.84544
G1 X7.992 Y7.992 F30000
G1 F9600
G1 X32.008 Y7.992 E.87285
G1 X32.008 Y32.008 E.87285
G1 X7.992 Y32.008 E.87285
G1 X7.992 Y7.992 E.87285
G1 X7.615 Y7.615 F30000
G1 F9600
G1 X7.615 Y32.385 E.90025
G1 X32.385 Y32.385 E.90025
G1 X32.385 Y7.615 E.90025
G1 X7.615 Y7.615 E.90025
G1 X7.238 Y7.238 F30000
G1 F9600
G1 X32.762 Y7.238 E.92766
G1 X32.762 Y32.762 E.92766
G1 X7.238 Y32.762 E.92766
G1 X7.238 Y7.238 E.92766
G1 X6.86 Y6.86 F30000
G1 F9600
G1 X33.14 Y6.86 E.95507
G1 X33.14 Y33.14 E.95507
G1 X6.86 Y33.14 E.95507
G1 X6.86 Y6.86 E.95507
G1 X6.86 Y5.9 F30000
EXTRUDER_RETRACT
;Tower Base Layer Finished
`.trim().split(/\r?\n/);

const MKP_ENGINE_RUNTIME_REVISION = '2026-03-18-two-stage-tower-clean-export-v1';
const FIRST_GLUE_SETTLING_MS = 6000;
const PSEUDO_RANDOM_TABLE = ['3', '7', '2', '8', '1', '5', '9', '4', '6'];
const MAX_ORCA_IRONING_EXTRUSION = 7.9;
let pseudoRandomIndex = 1;

function getEngineRuntimeMetadata(overrides = {}) {
  return {
    ...overrides,
    engineModule: 'src/main/mkp_engine.js',
    engineRevision: MKP_ENGINE_RUNTIME_REVISION
  };
}

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

  if (tomlPath) {
    throw new Error('CLI no longer supports --Toml. Convert the TOML preset to JSON in Settings and use --Json.');
  }

  if (jsonPath) {
    return {
      configFormat: 'json',
      configPath: jsonPath,
      gcodePath
    };
  }

  throw new Error('Missing required --Json argument');
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

function getNonNegativeNumber(source, keys, fallback = 0) {
  return roundTo(Math.max(0, getNumber(source, keys, fallback)), 3);
}

function resolveTowerGeometryEnabled(source = {}, valueKeys = []) {
  const toggleKeys = ['slantedOuterWallEnabled', 'towerSlantedOuterWallEnabled', 'tower_slanted_outer_wall_enabled'];

  for (const key of toggleKeys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = source[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    if (typeof value === 'number') {
      return value > 0;
    }
  }

  return valueKeys.some((key) => getNonNegativeNumber(source, [key], 0) > 0);
}

function normalizeTowerGeometry(source = {}) {
  const coreWidth = Math.max(
    DEFAULT_TOWER_GEOMETRY.coreWidth,
    getNonNegativeNumber(source, ['coreWidth', 'towerWidth', 'tower_width'], DEFAULT_TOWER_GEOMETRY.coreWidth)
  );
  const coreDepth = Math.max(
    DEFAULT_TOWER_GEOMETRY.coreDepth,
    getNonNegativeNumber(source, ['coreDepth', 'towerDepth', 'tower_depth'], DEFAULT_TOWER_GEOMETRY.coreDepth)
  );
  const brimWidth = getNonNegativeNumber(
    source,
    ['brimWidth', 'towerBrimWidth', 'tower_brim_width'],
    DEFAULT_TOWER_GEOMETRY.brimWidth
  );
  const outerWallWidth = getNonNegativeNumber(
    source,
    ['outerWallWidth', 'towerOuterWallWidth', 'tower_outer_wall_width'],
    DEFAULT_TOWER_GEOMETRY.outerWallWidth
  );
  const outerWallDepth = getNonNegativeNumber(
    source,
    ['outerWallDepth', 'towerOuterWallDepth', 'tower_outer_wall_depth'],
    outerWallWidth
  );
  const slantedOuterWallEnabled = resolveTowerGeometryEnabled(
    source,
    ['slantedOuterWallWidth', 'slantedOuterWallDepth', 'tower_slanted_outer_wall_width', 'tower_slanted_outer_wall_depth']
  );
  const slantedOuterWallWidth = slantedOuterWallEnabled
    ? getNonNegativeNumber(
      source,
      ['slantedOuterWallWidth', 'towerSlantedOuterWallWidth', 'tower_slanted_outer_wall_width'],
      DEFAULT_TOWER_GEOMETRY.slantedOuterWallWidth
    )
    : 0;
  const slantedOuterWallDepth = slantedOuterWallEnabled
    ? getNonNegativeNumber(
      source,
      ['slantedOuterWallDepth', 'towerSlantedOuterWallDepth', 'tower_slanted_outer_wall_depth'],
      slantedOuterWallWidth
    )
    : 0;
  const layerWidth = coreWidth + ((outerWallWidth + slantedOuterWallWidth) * 2);
  const layerDepth = coreDepth + ((outerWallDepth + slantedOuterWallDepth) * 2);
  const baseWidth = layerWidth + (brimWidth * 2);
  const baseDepth = layerDepth + (brimWidth * 2);

  return {
    coreWidth: roundTo(coreWidth, 3),
    coreDepth: roundTo(coreDepth, 3),
    brimWidth: roundTo(brimWidth, 3),
    outerWallWidth: roundTo(outerWallWidth, 3),
    outerWallDepth: roundTo(outerWallDepth, 3),
    slantedOuterWallEnabled,
    slantedOuterWallWidth: roundTo(slantedOuterWallWidth, 3),
    slantedOuterWallDepth: roundTo(slantedOuterWallDepth, 3),
    layerWidth: roundTo(layerWidth, 3),
    layerDepth: roundTo(layerDepth, 3),
    baseWidth: roundTo(baseWidth, 3),
    baseDepth: roundTo(baseDepth, 3)
  };
}

function buildWipingTowerSafeFootprint(towerGeometry = DEFAULT_TOWER_GEOMETRY) {
  const width = Number.isFinite(Number(towerGeometry?.baseWidth)) ? Number(towerGeometry.baseWidth) : DEFAULT_TOWER_GEOMETRY.baseWidth;
  const depth = Number.isFinite(Number(towerGeometry?.baseDepth)) ? Number(towerGeometry.baseDepth) : DEFAULT_TOWER_GEOMETRY.baseDepth;

  return {
    minXOffset: Math.min(WIPE_TOWER_FOOTPRINT.minXOffset, 0),
    maxXOffset: Math.max(WIPE_TOWER_FOOTPRINT.maxXOffset, roundTo(width, 3)),
    minYOffset: Math.min(WIPE_TOWER_FOOTPRINT.minYOffset, 0),
    maxYOffset: Math.max(WIPE_TOWER_FOOTPRINT.maxYOffset, roundTo(depth, 3))
  };
}

function scaleTowerTemplateCoordinate(value, targetSpan) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return numeric;
  return roundTo(20 + (((numeric - 20) / 10) * (targetSpan / 2)), 3);
}

function transformTowerTemplateLine(line, targetWidth, targetDepth) {
  let nextLine = String(line);

  if (/\bX-?\d/.test(nextLine)) {
    nextLine = nextLine.replace(/X(-?\d+(?:\.\d+)?)/, (_, rawX) => `X${formatCompactNumber(scaleTowerTemplateCoordinate(rawX, targetWidth))}`);
  }

  if (/\bY-?\d/.test(nextLine)) {
    nextLine = nextLine.replace(/Y(-?\d+(?:\.\d+)?)/, (_, rawY) => `Y${formatCompactNumber(scaleTowerTemplateCoordinate(rawY, targetDepth))}`);
  }

  return nextLine;
}

function resolveTowerTemplateAxisOffset(anchor, targetSpan = 20) {
  const safeSpan = Number.isFinite(Number(targetSpan)) ? Number(targetSpan) : 20;
  return roundTo(anchor - (20 - (safeSpan / 2)), 3);
}

function resolveTowerTemplateOffsets(wiperX, wiperY, targetWidth = 20, targetDepth = 20) {
  return {
    x: resolveTowerTemplateAxisOffset(wiperX, targetWidth),
    y: resolveTowerTemplateAxisOffset(wiperY, targetDepth)
  };
}

function normalizeConfig(source = {}) {
  const toolhead = source.toolhead || {};
  const wiping = source.wiping || {};
  const machine = source.machine || {};
  const templates = source.templates || {};
  const postProcessing = source.postProcessing || {};
  const printerId = String(source.printer || machine.printerId || '').trim().toLowerCase();
  const towerPlacementProfile = resolveTowerPlacementProfile(printerId);
  const machineBounds = normalizeMachineBounds(machine.bounds || null, towerPlacementProfile);
  const existingTowerPosition = machine.wipingTowerPosition || null;
  const towerGeometry = normalizeTowerGeometry(wiping);
  const rawWiperX = existingTowerPosition && typeof existingTowerPosition.rawWiperX === 'number'
    ? existingTowerPosition.rawWiperX
    : getNumber(wiping, ['wiperX', 'wiper_x'], 0);
  const rawWiperY = existingTowerPosition && typeof existingTowerPosition.rawWiperY === 'number'
    ? existingTowerPosition.rawWiperY
    : getNumber(wiping, ['wiperY', 'wiper_y'], 0);
  const wipingTowerPosition = resolveSafeWipingTowerPosition(rawWiperX, rawWiperY, machineBounds, towerPlacementProfile, towerGeometry);

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
      haveWipingComponents: resolveWipingTowerEnabled(wiping),
      switchTowerType: getNumber(wiping, ['switchTowerType', 'switch_tower_type'], 1),
      wiperX: wipingTowerPosition.wiperX,
      wiperY: wipingTowerPosition.wiperY,
      wipeTowerPrintSpeed: getNumber(wiping, ['wipeTowerPrintSpeed', 'wipetower_speed'], 0),
      nozzleCoolingFlag: getBoolean(wiping, ['nozzleCoolingFlag', 'nozzle_cooling_flag'], false),
      ironApplyFlag: getBoolean(wiping, ['ironApplyFlag', 'iron_apply_flag'], false),
      userDryTime: getNumber(wiping, ['userDryTime', 'user_dry_time'], 0),
      forceThickBridgeFlag: getBoolean(wiping, ['forceThickBridgeFlag', 'force_thick_bridge_flag'], false),
      supportExtrusionMultiplier: getNumber(wiping, ['supportExtrusionMultiplier', 'support_extrusion_multiplier'], 1),
      towerGeometry
    },
    templates: {
      wipingGcode: resolveTemplateLines(templates.wipingGcode, DEFAULT_WIPING_GCODE, '; MKP wiping tower template'),
      towerBaseLayerGcode: resolveTemplateLines(
        templates.towerBaseLayerGcode,
        DEFAULT_TOWER_BASE_LAYER_GCODE,
        '; MKP tower base template'
      )
    },
    machine: {
      printerId,
      nozzleDiameter: getNumber(machine, ['nozzleDiameter', 'nozzle_diameter'], 0.4),
      bounds: machineBounds,
      towerPlacementProfileId: towerPlacementProfile?.id || null,
      wipingTowerPosition
    },
    postProcessing: {
      ironExtrudeRatio: getNumber(postProcessing, ['ironExtrudeRatio', 'iron_extrude_ratio'], 1),
      towerExtrudeRatio: getNumber(postProcessing, ['towerExtrudeRatio', 'tower_extrude_ratio'], 1),
      ironingPathOffsetMm: getNumber(postProcessing, ['ironingPathOffsetMm', 'ironing_path_offset_mm'], 0),
      futureLollipopMode: getBoolean(
        postProcessing,
        ['futureLollipopMode', 'future_lollipop_mode', 'enableExperimentalLollipopMode'],
        false
      ),
      legacyWallBufferRecovery: getBoolean(
        postProcessing,
        ['legacyWallBufferRecovery', 'legacy_wall_buffer_recovery'],
        false
      )
    }
  };
}

function resolveTowerPlacementProfile(printerId = '') {
  return TOWER_PLACEMENT_PROFILES[String(printerId || '').trim().toLowerCase()] || null;
}

function normalizeMachineBounds(bounds, printerProfile = null) {
  if (
    bounds
    && typeof bounds === 'object'
    && typeof bounds.minX === 'number'
    && typeof bounds.maxX === 'number'
    && typeof bounds.minY === 'number'
    && typeof bounds.maxY === 'number'
    && bounds.maxX > bounds.minX
    && bounds.maxY > bounds.minY
  ) {
    return {
      minX: bounds.minX,
      maxX: bounds.maxX,
      minY: bounds.minY,
      maxY: bounds.maxY
    };
  }

  if (printerProfile?.bounds) {
    return { ...printerProfile.bounds };
  }

  return null;
}

function intersectTowerPlacementRanges(baseRange, limitRange) {
  if (!limitRange) {
    return {
      minX: baseRange.minX,
      maxX: baseRange.maxX,
      minY: baseRange.minY,
      maxY: baseRange.maxY
    };
  }

  const minX = Math.max(baseRange.minX, typeof limitRange.minX === 'number' ? limitRange.minX : baseRange.minX);
  const maxX = Math.min(baseRange.maxX, typeof limitRange.maxX === 'number' ? limitRange.maxX : baseRange.maxX);
  const minY = Math.max(baseRange.minY, typeof limitRange.minY === 'number' ? limitRange.minY : baseRange.minY);
  const maxY = Math.min(baseRange.maxY, typeof limitRange.maxY === 'number' ? limitRange.maxY : baseRange.maxY);

  return {
    minX: roundTo(minX, 3),
    maxX: roundTo(Math.max(minX, maxX), 3),
    minY: roundTo(minY, 3),
    maxY: roundTo(Math.max(minY, maxY), 3)
  };
}

function buildTowerPlacementSafeRange(bounds, manualSafeRange = null, towerGeometry = DEFAULT_TOWER_GEOMETRY) {
  if (!bounds) return null;
  const safeFootprint = buildWipingTowerSafeFootprint(towerGeometry);

  return intersectTowerPlacementRanges({
    minX: roundTo((bounds.minX ?? 0) - safeFootprint.minXOffset, 3),
    maxX: roundTo((bounds.maxX ?? 0) - safeFootprint.maxXOffset, 3),
    minY: roundTo((bounds.minY ?? 0) - safeFootprint.minYOffset, 3),
    maxY: roundTo((bounds.maxY ?? 0) - safeFootprint.maxYOffset, 3)
  }, manualSafeRange);
}

function normalizeTowerPlacementZone(zone) {
  if (!zone || typeof zone !== 'object') return null;
  if (![zone.minX, zone.maxX, zone.minY, zone.maxY].every((value) => typeof value === 'number')) {
    return null;
  }

  return {
    id: String(zone.id || ''),
    label: String(zone.label || zone.id || 'blocked-zone'),
    kind: String(zone.kind || 'safety'),
    minX: roundTo(Math.min(zone.minX, zone.maxX), 3),
    maxX: roundTo(Math.max(zone.minX, zone.maxX), 3),
    minY: roundTo(Math.min(zone.minY, zone.maxY), 3),
    maxY: roundTo(Math.max(zone.minY, zone.maxY), 3)
  };
}

function clipTowerPlacementZoneToRange(zone, safeRange) {
  if (!zone || !safeRange) return null;

  const minX = Math.max(zone.minX, safeRange.minX);
  const maxX = Math.min(zone.maxX, safeRange.maxX);
  const minY = Math.max(zone.minY, safeRange.minY);
  const maxY = Math.min(zone.maxY, safeRange.maxY);

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    ...zone,
    minX: roundTo(minX, 3),
    maxX: roundTo(maxX, 3),
    minY: roundTo(minY, 3),
    maxY: roundTo(maxY, 3)
  };
}

function resolveTowerPlacementDeadZoneSource(printerProfile) {
  if (printerProfile?.id === BAMBU_X1_P1_TOWER_PROFILE.id) {
    return BAMBU_X1_P1_FRONT_DEAD_ZONES;
  }
  return printerProfile?.deadZones || [];
}

function resolveTowerPlacementDeadZones(printerProfile, safeRange) {
  return resolveTowerPlacementDeadZoneSource(printerProfile)
    .map((zone) => normalizeTowerPlacementZone(zone))
    .map((zone) => clipTowerPlacementZoneToRange(zone, safeRange))
    .filter(Boolean);
}

function snapTowerAnchorCoordinate(value, safeRange, axis) {
  const safeMin = axis === 'x' ? safeRange?.minX : safeRange?.minY;
  const safeMax = axis === 'x' ? safeRange?.maxX : safeRange?.maxY;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return typeof safeMin === 'number' ? roundTo(safeMin, 3) : 0;
  }
  const snapped = Math.round(numeric);
  if (typeof safeMin !== 'number' || typeof safeMax !== 'number') {
    return roundTo(snapped, 3);
  }
  return roundTo(Math.max(safeMin, Math.min(safeMax, snapped)), 3);
}

function clampTowerValueToRange(value, safeRange, axis) {
  const numeric = Number(value);
  const safeMin = axis === 'x' ? safeRange.minX : safeRange.minY;
  const safeMax = axis === 'x' ? safeRange.maxX : safeRange.maxY;
  if (!Number.isFinite(numeric)) return safeMin;
  return roundTo(Math.max(safeMin, Math.min(safeMax, numeric)), 3);
}

function isTowerPlacementInsideZone(x, y, zone) {
  if (!zone) return false;
  return x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY;
}

function projectTowerPlacementOutOfZone(x, y, zone, safeRange) {
  const candidates = [];
  const nextLeft = roundTo(zone.minX - TOWER_DEAD_ZONE_CLEARANCE, 3);
  const nextRight = roundTo(zone.maxX + TOWER_DEAD_ZONE_CLEARANCE, 3);
  const nextBottom = roundTo(zone.minY - TOWER_DEAD_ZONE_CLEARANCE, 3);
  const nextTop = roundTo(zone.maxY + TOWER_DEAD_ZONE_CLEARANCE, 3);

  if (nextLeft >= safeRange.minX) {
    candidates.push({ x: nextLeft, y, distance: Math.abs(x - nextLeft) });
  }

  if (nextRight <= safeRange.maxX) {
    candidates.push({ x: nextRight, y, distance: Math.abs(x - nextRight) });
  }

  if (nextBottom >= safeRange.minY) {
    candidates.push({ x, y: nextBottom, distance: Math.abs(y - nextBottom) });
  }

  if (nextTop <= safeRange.maxY) {
    candidates.push({ x, y: nextTop, distance: Math.abs(y - nextTop) });
  }

  if (!candidates.length) {
    return {
      x: clampTowerValueToRange(x, safeRange, 'x'),
      y: clampTowerValueToRange(y, safeRange, 'y')
    };
  }

  candidates.sort((left, right) => left.distance - right.distance);
  return {
    x: roundTo(candidates[0].x, 3),
    y: roundTo(candidates[0].y, 3)
  };
}

function clampTowerAnchorToBounds(value, bounds, minKey, maxKey, minOffset, maxOffset) {
  let nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    nextValue = 0;
  }

  if (!bounds || typeof bounds !== 'object') {
    return roundTo(nextValue, 3);
  }

  const minBound = typeof bounds[minKey] === 'number' ? bounds[minKey] - minOffset : null;
  const maxBound = typeof bounds[maxKey] === 'number' ? bounds[maxKey] - maxOffset : null;

  if (typeof minBound === 'number') {
    nextValue = Math.max(minBound, nextValue);
  }

  if (typeof maxBound === 'number') {
    nextValue = Math.min(maxBound, nextValue);
  }

  if (typeof minBound === 'number' && typeof maxBound === 'number' && minBound > maxBound) {
    nextValue = minBound;
  }

  return roundTo(nextValue, 3);
}

function resolveSafeWipingTowerPosition(rawWiperX = 0, rawWiperY = 0, bounds = null, printerProfile = null, towerGeometry = DEFAULT_TOWER_GEOMETRY) {
  const normalizedRawWiperX = roundTo(Number.isFinite(Number(rawWiperX)) ? Number(rawWiperX) : 0, 3);
  const normalizedRawWiperY = roundTo(Number.isFinite(Number(rawWiperY)) ? Number(rawWiperY) : 0, 3);
  const safeFootprint = buildWipingTowerSafeFootprint(towerGeometry);
  const safeRange = buildTowerPlacementSafeRange(bounds, printerProfile?.manualSafeRange || null, towerGeometry);
  const deadZones = resolveTowerPlacementDeadZones(printerProfile, safeRange);
  const initialWiperX = safeRange
    ? snapTowerAnchorCoordinate(clampTowerValueToRange(normalizedRawWiperX, safeRange, 'x'), safeRange, 'x')
    : clampTowerAnchorToBounds(
      rawWiperX,
      bounds,
      'minX',
      'maxX',
      safeFootprint.minXOffset,
      safeFootprint.maxXOffset
    );
  const initialWiperY = safeRange
    ? snapTowerAnchorCoordinate(clampTowerValueToRange(normalizedRawWiperY, safeRange, 'y'), safeRange, 'y')
    : clampTowerAnchorToBounds(
      rawWiperY,
      bounds,
      'minY',
      'maxY',
      safeFootprint.minYOffset,
      safeFootprint.maxYOffset
    );
  const blockedZoneIds = deadZones
    .filter((zone) => isTowerPlacementInsideZone(initialWiperX, initialWiperY, zone))
    .map((zone) => zone.id);
  const blockedZoneIdSet = new Set(blockedZoneIds);
  let safeWiperX = initialWiperX;
  let safeWiperY = initialWiperY;
  let adjustedForDeadZone = false;

  for (let index = 0; index < deadZones.length * 4; index += 1) {
    const activeZone = deadZones.find((zone) => isTowerPlacementInsideZone(safeWiperX, safeWiperY, zone));
    if (!activeZone) break;
    blockedZoneIdSet.add(activeZone.id);

    const projected = projectTowerPlacementOutOfZone(safeWiperX, safeWiperY, activeZone, safeRange);
    if (!projected || (projected.x === safeWiperX && projected.y === safeWiperY)) {
      break;
    }

    safeWiperX = snapTowerAnchorCoordinate(projected.x, safeRange, 'x');
    safeWiperY = snapTowerAnchorCoordinate(projected.y, safeRange, 'y');
    adjustedForDeadZone = true;
  }

  return {
    rawWiperX: normalizedRawWiperX,
    rawWiperY: normalizedRawWiperY,
    wiperX: safeWiperX,
    wiperY: safeWiperY,
    adjusted: safeWiperX !== normalizedRawWiperX || safeWiperY !== normalizedRawWiperY,
    adjustedForBounds: initialWiperX !== normalizedRawWiperX || initialWiperY !== normalizedRawWiperY,
    adjustedForDeadZone,
    blockedZoneIds: Array.from(blockedZoneIdSet),
    safeRange,
    printerProfileId: printerProfile?.id || null
  };
}

function resolveWipingTowerEnabled(wiping = {}) {
  const explicitKeys = [
    'useWipingTowers',
    'enableWipingTower'
  ];

  for (const key of explicitKeys) {
    if (typeof wiping?.[key] === 'boolean') {
      return wiping[key];
    }
  }

  // Public JSON / TOML presets still carry old snake_case fields such as
  // `have_wiping_components` or `use_wiping_towers`, but the current shipping
  // product is tower-only. Keep camelCase runtime flags as an internal escape
  // hatch for tests and future experiments, while treating parsed preset input
  // as slow-line wipe tower by default.
  return true;
}

function resolveTemplateLines(templateLines, fallbackLines, legacyHeader) {
  if (!Array.isArray(templateLines) || templateLines.length === 0) {
    return fallbackLines.slice();
  }

  const normalized = templateLines.map((line) => String(line).trimEnd());
  if (isLegacyPlaceholderTemplate(normalized, legacyHeader)) {
    return fallbackLines.slice();
  }

  return normalized;
}

function resolveEffectiveSwitchTowerType(configOrOptions = {}) {
  const requestedSwitchTowerType = Number(
    configOrOptions?.wiping?.switchTowerType ?? configOrOptions?.switchTowerType ?? 1
  ) || 1;
  const futureLollipopMode = Boolean(
    configOrOptions?.postProcessing?.futureLollipopMode ?? configOrOptions?.futureLollipopMode
  );

  // Keep the future fast-line / lollipop hook parked until we have real
  // sample G-code and printer validation for that branch.
  return futureLollipopMode ? requestedSwitchTowerType : 1;
}

function isLegacyPlaceholderTemplate(lines, legacyHeader) {
  return Array.isArray(lines)
    && lines.length <= 5
    && String(lines[0] || '').trim() === legacyHeader;
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

function buildTowerPreparationTravelGcode(options = {}) {
  const currentLayerHeight = options.currentLayerHeight || 0;
  const machineBounds = options.machineBounds || null;
  const towerPosition = resolveSafeWipingTowerPosition(
    options.wiperX || 0,
    options.wiperY || 0,
    machineBounds,
    resolveTowerPlacementProfile(options.printerId),
    normalizeTowerGeometry(options.towerGeometry || {})
  );
  const wiperX = towerPosition.wiperX;
  const wiperY = towerPosition.wiperY;
  const filamentType = String(options.filamentType || 'PLA').toUpperCase();
  const isPla = filamentType.includes('PLA');
  const lines = [`G1 Z${roundTo(currentLayerHeight, 3).toFixed(3)}`];
  const variableWipeMove = `G1 X15 Y2${getPseudoRandom()}`;
  const prepTemplateOffsets = resolveTowerTemplateOffsets(wiperX, wiperY, 20, 20);
  const pushOffsetMove = (line) => {
    lines.push(
      processGcodeOffset(
        line,
        prepTemplateOffsets.x,
        prepTemplateOffsets.y,
        currentLayerHeight + 3,
        'normal',
        { machineBounds }
      )
    );
  };
  const pushVariableWipe = () => pushOffsetMove(variableWipeMove);

  if (isPla) {
    pushVariableWipe();
    pushOffsetMove('G1 X25 Y25');
    pushVariableWipe();
    pushOffsetMove('G1 X25 Y25');
  }

  pushVariableWipe();
  pushOffsetMove('G1 X25 Y25');
  pushVariableWipe();
  pushOffsetMove('G1 X15 Y15');
  pushOffsetMove(`G1 X20 Y1${getPseudoRandom()}`);

  return lines;
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

function isStandalonePositiveExtrusionLine(line) {
  const { command } = splitCommandAndComment(line);
  if (!/^G1\b/.test(command) || /(?:\bX|\bY|\bZ)/.test(command)) {
    return false;
  }

  const match = command.match(/\bE([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);
  return Boolean(match) && Number(match[1]) > 0;
}

function isInterfaceExtrusionLine(line) {
  const { command } = splitCommandAndComment(line);
  if (!/^G1\b/.test(command) || !/(?:\bX|\bY)/.test(command)) {
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
  if (!/^G1\b/.test(command) || !/(?:\bX|\bY)/.test(command)) {
    return 0;
  }

  const extrusionMatch = command.match(/\bE([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);
  if (!extrusionMatch) {
    return 0;
  }

  const extrusionValue = Number(extrusionMatch[1]);
  return Number.isFinite(extrusionValue) && extrusionValue > 0 ? extrusionValue : 0;
}

function isInterfaceZOnlyLine(line) {
  const { command } = splitCommandAndComment(line);
  return /^G1\b/.test(command)
    && /\bZ/.test(command)
    && !/(?:\bX|\bY)/.test(command)
    && !/\bF[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(command)
    && !/\bE[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(command);
}

function isTravelOnlyFeedMove(line) {
  const { command } = splitCommandAndComment(line);
  return /^G1\b/.test(command)
    && /(?:\bX|\bY)/.test(command)
    && /\bF[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(command)
    && !/\bE[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(command);
}

function isTravelMoveWithoutExtrusion(line) {
  const { command } = splitCommandAndComment(line);
  return /^G1\b/.test(command)
    && /(?:\bX|\bY)/.test(command)
    && !/\bE[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(command);
}

function isRebuildPressureFeatureMarker(line) {
  return String(line || '').startsWith('; FEATURE: Sparse infill')
    || String(line || '').startsWith('; FEATURE: Internal solid infill');
}

function getXYExtrusionValue(line) {
  const { command } = splitCommandAndComment(line);
  if (!/^G1\b/.test(command) || !/(?:\bX|\bY)/.test(command)) {
    return 0;
  }

  const extrusionMatch = command.match(/\bE([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);
  if (!extrusionMatch) {
    return 0;
  }

  const extrusionValue = Number(extrusionMatch[1]);
  return Number.isFinite(extrusionValue) ? extrusionValue : 0;
}

function extractRebuildPressureBuffer(lines, startIndex) {
  const buffer = [];
  let extrusionSum = 0;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = String(lines[index] || '').trimEnd();
    const extrusionValue = getXYExtrusionValue(line);

    if (extrusionValue > 0) {
      extrusionSum += extrusionValue;
      buffer.push(line);
    } else if (isTravelMoveWithoutExtrusion(line) || isInterfaceZOnlyLine(line)) {
      buffer.push(line);
    }

    if (extrusionSum > 1) {
      break;
    }
  }

  return buffer;
}

function stripExtrusionFromMove(line) {
  const { command, comment } = splitCommandAndComment(line);
  const nextCommand = command
    .replace(/\s*\bE[+-]?(?:\d+(?:\.\d*)?|\.\d+)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (comment) {
    return nextCommand ? `${nextCommand} ${comment}` : comment;
  }

  return nextCommand;
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

  return trimTrailingTerminalTravelMoves(nextLines);
}

function trimTrailingTerminalTravelMoves(interfaceLines = []) {
  if (!Array.isArray(interfaceLines) || interfaceLines.length < 2) {
    return Array.isArray(interfaceLines) ? interfaceLines.slice() : [];
  }

  const lastIndex = interfaceLines.length - 1;
  if (!String(interfaceLines[lastIndex]).includes(';ZJUMP_START')) {
    return interfaceLines.slice();
  }

  let trimStart = lastIndex;
  while (trimStart > 0 && isIgnorableTrailingInterfaceLine(interfaceLines[trimStart - 1])) {
    trimStart -= 1;
  }

  while (trimStart > 0 && isTravelMoveWithoutExtrusion(interfaceLines[trimStart - 1])) {
    trimStart -= 1;
  }

  if (trimStart === lastIndex) {
    return interfaceLines.slice();
  }

  return [
    ...interfaceLines.slice(0, trimStart),
    interfaceLines[lastIndex]
  ];
}

function isIgnorableTrailingInterfaceLine(line) {
  const text = String(line || '').trim();
  if (!text) {
    return true;
  }

  if (text.includes(';ZJUMP_START') || text.includes('; WIPE_START') || text.includes('; WIPE_END')) {
    return false;
  }

  return !isInterfaceMotionLine(text) && !isInterfaceZOnlyLine(text);
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

function parseMachineTypeFromLine(line, currentMachineType = 'MKP') {
  const text = String(line || '');

  if (text.includes(';===== machine: A1 mini') || text.includes('; printer_model = Bambu Lab A1 mini')) {
    return 'A1mini';
  }

  if (text.includes(';===== machine: A1') && !text.includes('mini')) {
    return 'A1';
  }

  if (text.includes('; printer_model = Bambu Lab A1')) {
    return text.includes('mini') ? 'A1mini' : 'A1';
  }

  if (text.includes(';===== machine: P1') || text.includes('; printer_model = Bambu Lab P1')) {
    return 'P1Lite';
  }

  if (text.includes(';===== machine: X1') || text.includes('; printer_model = Bambu Lab X1')) {
    return 'X1';
  }

  return currentMachineType;
}

function resolveParsedNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function getGlueWaitingPointX(machineType = 'MKP') {
  if (machineType === 'A1mini') {
    return 160;
  }

  if (machineType === 'A1') {
    return 252;
  }

  return 20;
}

function parseMountRetractValue(customMountGcode = '') {
  const lines = String(customMountGcode || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  for (const line of lines) {
    const { command } = splitCommandAndComment(line);
    if (!/^G1\b/.test(command) || !/\bE[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(command)) {
      continue;
    }

    const match = command.match(/\bE([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);
    if (!match) {
      continue;
    }

    const value = Number(match[1]);
    if (!Number.isFinite(value)) {
      continue;
    }

    return value > 0 ? -value : value;
  }

  return 0;
}

function pushExpandedMountGcode(target, block, currentZ, offsetZ) {
  const lines = String(block || '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const l801LiftHeight = currentZ < 3
    ? roundTo(currentZ + offsetZ + 4, 3).toFixed(3)
    : roundTo(currentZ + offsetZ + 3, 3).toFixed(3);

  for (const line of lines) {
    const { command } = splitCommandAndComment(line);
    if (/^G1\b/.test(command) && /\bE[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.test(command)) {
      continue;
    }

    if (line.includes('L801')) {
      target.push(`G1 Z${l801LiftHeight};L801`);
      continue;
    }

    target.push(line);
  }
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
      printerId: config.machine.printerId || null,
      speedLimit: config.toolhead.speedLimit,
      offset: { ...config.toolhead.offset },
      nozzleDiameter: config.machine.nozzleDiameter,
      ironApplyFlag: config.wiping.ironApplyFlag,
      switchTowerType: config.wiping.switchTowerType,
      effectiveSwitchTowerType: resolveEffectiveSwitchTowerType(config),
      wiperX: config.wiping.wiperX,
      wiperY: config.wiping.wiperY,
      towerPositionAdjusted: Boolean(config.machine?.wipingTowerPosition?.adjusted),
      towerBlockedZones: Array.isArray(config.machine?.wipingTowerPosition?.blockedZoneIds)
        ? config.machine.wipingTowerPosition.blockedZoneIds.slice()
        : [],
      supportExtrusionMultiplier: config.wiping.supportExtrusionMultiplier,
      ironingPathOffsetMm: config.postProcessing.ironingPathOffsetMm,
      futureLollipopMode: config.postProcessing.futureLollipopMode
    },
    runtime: getEngineRuntimeMetadata(runtimeOptions.runtimeInfo || {}),
    steps: [],
    _startedAtMs: startedAtMs
  };

  pushReportStep(report, {
    kind: 'config',
    title: '加载并归一化后处理配置',
    human: '已读取当前 preset，并整理成 JS 引擎统一使用的配置结构。',
    technical: `normalizeConfig() -> configFormat=${runtimeOptions.configFormat || 'runtime'} speedLimit=${config.toolhead.speedLimit} haveWipingComponents=${config.wiping.haveWipingComponents} ironApplyFlag=${config.wiping.ironApplyFlag} switchTowerType=${config.wiping.switchTowerType} effectiveSwitchTowerType=${resolveEffectiveSwitchTowerType(config)} futureLollipopMode=${config.postProcessing.futureLollipopMode} supportExtrusionMultiplier=${config.wiping.supportExtrusionMultiplier}`,
    data: {
      inputPath: report.inputPath,
      outputPath: report.outputPath,
      configPath: report.configPath
    }
  });

  if (config.machine?.wipingTowerPosition?.adjusted) {
    const towerPosition = config.machine.wipingTowerPosition;
    const blockedZonesText = Array.isArray(towerPosition.blockedZoneIds) && towerPosition.blockedZoneIds.length
      ? ` blockedZones=${towerPosition.blockedZoneIds.join(',')}`
      : '';
    pushReportStep(report, {
      kind: 'config',
      title: 'Clamp wipe tower position',
      human: towerPosition.blockedZoneIds?.length
        ? 'The raw wipe-tower anchor landed in a forbidden placement area, so the engine moved it to the nearest safe coordinate.'
        : 'The raw wipe-tower anchor was outside the safe printable range, so the engine used the nearest safe coordinate.',
      technical: `towerPlacement raw=(${formatCompactNumber(towerPosition.rawWiperX)},${formatCompactNumber(towerPosition.rawWiperY)}) effective=(${formatCompactNumber(towerPosition.wiperX)},${formatCompactNumber(towerPosition.wiperY)})${blockedZonesText}`,
      data: towerPosition
    });
  }

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

  pushReportStep(report, {
    kind: 'runtime',
    title: 'Record runtime identity',
    human: 'Recorded which executable and engine revision handled this post-processing run.',
    technical: `runtime=${JSON.stringify(report.runtime)}`,
    data: report.runtime
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

function prepareTrackedFeatureInjectionWithReport(options = {}) {
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
      human: `找到了候选${describeFeatureKind(featureKind)}，但清理尾迹挤出后已经没有有效的 XY 挤出，所以不会注入涂胶动作。`,
      technical: `${segmentData.marker} lines ${startLine}-${endLine}; deleteWipe() + hasValidInterfaceSet() => invalid; rawE=${formatCompactNumber(rawExtrusionSum)} cleanedE=${formatCompactNumber(cleanedExtrusionSum)}`,
      data: segmentData
    });
    return {
      mode: 'ignore',
      lines: [],
      interfaceLines: []
    };
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
    return {
      mode: 'immediate',
      lines: buildSkippedIroningRecovery(cleanedInterface, currentZ, runtimeState, cleanedExtrusionSum),
      interfaceLines: []
    };
  }

  report.summary.injectedSegments += 1;
  pushReportStep(report, {
    kind: 'decision',
    title: `复用${describeFeatureKind(featureKind)}进行涂胶`,
    human: `已确认这是一段有效的${describeFeatureKind(featureKind)}，会先缓存到当前层，等命中 layer num 边界后再按 Python 逻辑统一注入涂胶动作。`,
    technical: `${segmentData.marker} lines ${startLine}-${endLine}; cleanedMotionCount=${cleanedMotionCount}; cleanedE=${formatCompactNumber(cleanedExtrusionSum)}; queued for layer-boundary buildInterfaceInjection()`,
    data: segmentData
  });

  return {
    mode: 'pending',
    lines: [],
    interfaceLines: cleanedInterface
  };
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
  let pendingLayerInterfaceBuffer = [];
  const runtimeState = {
    captureLastTravelBeforeGlue: true,
    currentFanSpeed: 0,
    currentLayerThickness: 0,
    filamentType: 'PLA',
    firstGlueSettlingPending: true,
    firstLayerHeight: 0,
    firstLayerSpeed: 0,
    firstTowerBaseInjected: false,
    lastLayerHeight: 0,
    lastTravelMove: '',
    machineType: 'MKP',
    nozzleSwitchTemperature: null,
    rebuildPressureBuffer: [],
    retractLength: 0,
    travelSpeed: 0
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const line = rawLine.trimEnd();
    const nextLine = lineIndex + 1 < lines.length ? lines[lineIndex + 1].trimEnd() : '';

    runtimeState.machineType = parseMachineTypeFromLine(line, runtimeState.machineType);

    if (line.startsWith('; Z_HEIGHT:')) {
      runtimeState.lastLayerHeight = currentZ;
      currentZ = numStrip(line)[0] || currentZ;
    }

    if (line.startsWith('; LAYER_HEIGHT:')) {
      runtimeState.currentLayerThickness = numStrip(line)[0] || runtimeState.currentLayerThickness;
    }

    if (line.startsWith('; filament_type =')) {
      runtimeState.filamentType = line;
    }

    if (line.startsWith('; initial_layer_print_height =')) {
      runtimeState.firstLayerHeight = numStrip(line)[0] || runtimeState.firstLayerHeight;
    }

    if (line.startsWith('; initial_layer_speed =')) {
      runtimeState.firstLayerSpeed = numStrip(line)[0] || runtimeState.firstLayerSpeed;
    }

    if (line.startsWith('; retraction_length =')) {
      runtimeState.retractLength = numStrip(line)[0] || runtimeState.retractLength;
    }

    if (line.startsWith('; travel_speed =')) {
      runtimeState.travelSpeed = numStrip(line)[0] || runtimeState.travelSpeed;
    }

    if (line.startsWith('; nozzle_temperature =')) {
      runtimeState.nozzleSwitchTemperature = numStrip(line)[0] || runtimeState.nozzleSwitchTemperature;
    }

    if (line.startsWith('M106 P1 S')) {
      runtimeState.currentFanSpeed = resolveParsedNumber(numStrip(line)[2], runtimeState.currentFanSpeed);
    } else if (line.startsWith('M106 S')) {
      runtimeState.currentFanSpeed = resolveParsedNumber(numStrip(line)[1], runtimeState.currentFanSpeed);
    }

    if (isRebuildPressureFeatureMarker(line)) {
      runtimeState.rebuildPressureBuffer = extractRebuildPressureBuffer(lines, lineIndex);
    }

    if (isTravelMoveWithoutExtrusion(line) && !activeFeatureKind && runtimeState.captureLastTravelBeforeGlue) {
      runtimeState.lastTravelMove = line;
    }

    const trackedFeatureKind = detectTrackedFeatureKind(line, nextLine, config, currentZ);
    const layerBoundaryReached = line.startsWith('; layer num/total_layer_count');
    const hardFeatureBoundary = line.startsWith('; CHANGE_LAYER')
      || line.startsWith(';LAYER_CHANGE')
      || layerBoundaryReached;
    const leavesTrackedFeature = Boolean(activeFeatureKind) && line.startsWith('; FEATURE:') && !trackedFeatureKind;
    const switchesTrackedFeature = Boolean(activeFeatureKind)
      && Boolean(trackedFeatureKind)
      && trackedFeatureKind !== activeFeatureKind;
    const endsTrackedFeatureAtBoundary = Boolean(activeFeatureKind) && hardFeatureBoundary;

    if (trackedFeatureKind) {
      runtimeState.captureLastTravelBeforeGlue = false;
    }

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

    if (leavesTrackedFeature || switchesTrackedFeature || endsTrackedFeatureAtBoundary) {
      const preparedInjection = prepareTrackedFeatureInjectionWithReport({
        interfaceBuffer,
        featureKind: activeFeatureKind,
        startLine: activeFeatureStartLine,
        endLine: lineIndex,
        currentZ,
        config,
        runtimeState,
        report
      });

      if (preparedInjection.mode === 'immediate') {
        result.push(...preparedInjection.lines);
      } else if (preparedInjection.mode === 'pending' && preparedInjection.interfaceLines.length > 0) {
        pendingLayerInterfaceBuffer.push(...preparedInjection.interfaceLines);
      }

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

    if (
      line.startsWith('; CHANGE_LAYER')
      && config.wiping.haveWipingComponents
      && !runtimeState.firstTowerBaseInjected
    ) {
      const firstLayerHeight = runtimeState.firstLayerHeight || runtimeState.currentLayerThickness;
      const firstLayerSpeed = runtimeState.firstLayerSpeed || 50;
      const travelSpeed = runtimeState.travelSpeed || config.toolhead.speedLimit || 0;

      if (firstLayerHeight > 0 && travelSpeed > 0) {
        result.push(...buildTowerBaseLayerGcode({
          firstLayerHeight,
          firstLayerSpeed,
          printerId: config.machine.printerId,
          retractLength: runtimeState.retractLength || 0,
          towerGeometry: config.wiping.towerGeometry,
          towerBaseLayerGcode: config.templates.towerBaseLayerGcode,
          travelSpeed,
          wiperX: config.wiping.wiperX || 0,
          wiperY: config.wiping.wiperY || 0,
          machineBounds: config.machine.bounds
        }));
        runtimeState.firstTowerBaseInjected = true;
      }
    }

    if (layerBoundaryReached && pendingLayerInterfaceBuffer.length > 0) {
      result.push(...buildInterfaceInjection(pendingLayerInterfaceBuffer, currentZ, config, runtimeState));
      pushReportStep(report, {
        kind: 'replay',
        title: 'Emit deferred glue block at layer boundary',
        human: '命中 layer num 边界后，按 Python 逻辑统一输出本层缓存的涂胶动作。',
        technical: `Layer boundary line ${lineIndex + 1}; pendingInterfaceLines=${pendingLayerInterfaceBuffer.length}; buildInterfaceInjection()`,
        data: {
          line: lineIndex + 1,
          currentZ,
          pendingInterfaceLines: pendingLayerInterfaceBuffer.length
        }
      });
      pendingLayerInterfaceBuffer = [];
    }

    result.push(line);

    if (layerBoundaryReached) {
      runtimeState.captureLastTravelBeforeGlue = true;
      runtimeState.rebuildPressureBuffer = [];
    }

    if (activeFeatureKind && line) {
      interfaceBuffer.push(line);
    }
  }

  if (activeFeatureKind && interfaceBuffer.length > 0) {
    const preparedInjection = prepareTrackedFeatureInjectionWithReport({
      interfaceBuffer,
      featureKind: activeFeatureKind,
      startLine: activeFeatureStartLine,
      endLine: lines.length,
      currentZ,
      config,
      runtimeState,
      report
    });

    if (preparedInjection.mode === 'immediate') {
      result.push(...preparedInjection.lines);
    } else if (preparedInjection.mode === 'pending' && preparedInjection.interfaceLines.length > 0) {
      pendingLayerInterfaceBuffer.push(...preparedInjection.interfaceLines);
    }
  }

  if (pendingLayerInterfaceBuffer.length > 0) {
    result.push(...buildInterfaceInjection(pendingLayerInterfaceBuffer, currentZ, config, runtimeState));
    pushReportStep(report, {
      kind: 'replay',
      title: 'Emit deferred glue block at EOF fallback',
      human: '文件末尾仍有待输出的涂胶缓存，已执行兜底输出。',
      technical: `EOF fallback; pendingInterfaceLines=${pendingLayerInterfaceBuffer.length}; buildInterfaceInjection()`,
      data: {
        currentZ,
        pendingInterfaceLines: pendingLayerInterfaceBuffer.length
      }
    });
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
  const useWipingTowers = Boolean(config.wiping.haveWipingComponents);
  const travelSpeed = Math.floor((runtimeState.travelSpeed || config.toolhead.speedLimit || 0) * 60);
  const glueWaitingPointX = getGlueWaitingPointX(runtimeState.machineType);
  const mkpRetract = parseMountRetractValue(config.toolhead.customMountGcode);
  const lastLayerHeight = Number.isFinite(runtimeState.lastLayerHeight)
    ? runtimeState.lastLayerHeight
    : Math.max(currentZ - (runtimeState.currentLayerThickness || 0), 0);
  const risingHeight = roundTo(currentZ < 3 ? currentZ + offset.z + 6 : currentZ + offset.z + 3, 3).toFixed(3);
  const mountedHoverHeight = roundTo(lastLayerHeight + offset.z + 3, 3).toFixed(3);
  const glueHeight = roundTo(lastLayerHeight + offset.z, 3).toFixed(3);
  const postGlueLiftHeight = roundTo(currentZ + offset.z + 3, 3).toFixed(3);

  lines.push(';Pre-glue preparation');
  lines.push('M106 S255');
  appendNozzleCooldown(lines, config, runtimeState);

  if (travelSpeed > 0 && glueWaitingPointX > 0 && mkpRetract !== 0) {
    lines.push(
      `G1 X${glueWaitingPointX.toFixed(3)} Z${roundTo(currentZ + 1, 3).toFixed(3)} E${formatCompactNumber(mkpRetract)} F${travelSpeed}`
    );
  }

  lines.push(';Rising Nozzle a little');
  lines.push(`G1 Z${risingHeight}`);
  lines.push(';Mounting Toolhead');
  pushExpandedMountGcode(lines, config.toolhead.customMountGcode, currentZ, offset.z);
  lines.push(';Toolhead Mounted');

  if (lastLayerHeight > 0 || offset.z !== 0) {
    lines.push(`G1 Z${mountedHoverHeight}`);
  }

  if (travelSpeed > 0 && runtimeState.lastTravelMove) {
    lines.push(';Glueing Started');
    lines.push(';Inposition');
    lines.push(`G1 F${travelSpeed}`);
    lines.push(
      processGcodeOffset(
        runtimeState.lastTravelMove,
        offset.x,
        offset.y,
        offset.z + 3,
        'normal',
        { machineBounds: config.machine.bounds }
      )
    );
    lines.push(`G1 Z${glueHeight}`);
  }

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

      if (travelSpeed > 0) {
        lines.push(`G1 F${travelSpeed}`);
      }
      lines.push(`G1 Z${(currentZ + offset.z + 3).toFixed(3)} ; avoid spoiling before the next interface segment`);
      lines.push(
        `${processGcodeOffset(
          nextMove,
          offset.x,
          offset.y,
          offset.z + 3,
          'normal',
          { machineBounds: config.machine.bounds }
        )} ; jump to the next interface segment`
      );
      lines.push(`G1 Z${glueHeight} ; resume glue height`);
      if (speedLimit > 0) {
        lines.push(`G1 F${speedLimit}`);
      }
      continue;
    }

    if (isInterfaceMotionLine(bufferedLine) || isInterfaceZOnlyLine(bufferedLine)) {
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

  lines.push(';Glueing Finished');
  if (travelSpeed > 0) {
    lines.push(`G1 F${travelSpeed}`);
  }
  lines.push(`G1 Z${postGlueLiftHeight}`);
  lines.push(`;Lift-z:${postGlueLiftHeight}`);

  if (runtimeState.firstGlueSettlingPending) {
    lines.push(';Waiting for Glue Settling');
    lines.push(`G4 P${FIRST_GLUE_SETTLING_MS}`);
    runtimeState.firstGlueSettlingPending = false;
  }

  lines.push(';Unmounting Toolhead');

  const delayedTowerRefillLines = pushExpandedUnmountGcode(
    lines,
    config.toolhead.customUnmountGcode,
    runtimeState,
    {
      useWipingTowers
    }
  );
  lines.push(';Toolhead Unmounted');
  appendPostGlueRecovery(lines, currentZ, config, runtimeState, delayedTowerRefillLines);

  if (!useWipingTowers) {
    lines.push(`G1 Z${currentZ.toFixed(3)} ; resume print height`);
  }

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

function pushExpandedUnmountGcode(target, block, runtimeState = {}, options = {}) {
  const useWipingTowers = Boolean(options.useWipingTowers);
  const delayedTowerRefillLines = [];
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

    if (useWipingTowers) {
      if (line.includes(';Brush') || line.includes(';Wipe')) {
        continue;
      }

      if (isStandalonePositiveExtrusionLine(line)) {
        delayedTowerRefillLines.push(line);
        continue;
      }
    }

    target.push(line);
  }

  return delayedTowerRefillLines;
}

function appendPostGlueRecovery(target, currentZ, config, runtimeState, delayedTowerRefillLines = []) {
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

    if (Array.isArray(runtimeState.rebuildPressureBuffer) && runtimeState.rebuildPressureBuffer.length > 0) {
      const firstRecoveryMove = stripExtrusionFromMove(runtimeState.rebuildPressureBuffer[0]);
      const lastLayerHeight = Number.isFinite(runtimeState.lastLayerHeight)
        ? runtimeState.lastLayerHeight
        : Math.max(currentZ - (runtimeState.currentLayerThickness || 0), 0);

      target.push(';Print sparse/solid infill first');
      if (runtimeState.travelSpeed > 0) {
        target.push(`G1 F${Math.round(runtimeState.travelSpeed * 60)}`);
      }
      if (firstRecoveryMove) {
        target.push(firstRecoveryMove);
      }
      target.push(`G1 Z${roundTo(lastLayerHeight + 0.1, 3).toFixed(3)}`);
      target.push('G1 F600');

      for (let index = 1; index < runtimeState.rebuildPressureBuffer.length; index += 1) {
        target.push(String(runtimeState.rebuildPressureBuffer[index]).trimEnd());
      }
    }

    return;
  }

  const recoveryTemplateOffsets = resolveTowerTemplateOffsets(config.wiping.wiperX, config.wiping.wiperY, 20, 20);
  target.push(
    processGcodeOffset(
      'G1 X20 Y10.19',
      recoveryTemplateOffsets.x,
      recoveryTemplateOffsets.y,
      currentZ + 3,
      'normal',
      { machineBounds: config.machine.bounds }
    )
  );
  target.push(';Prepare for next tower');
  target.push(...buildTowerPreparationTravelGcode({
    currentLayerHeight: currentZ,
    filamentType: runtimeState.filamentType,
    machineBounds: config.machine.bounds,
    printerId: config.machine.printerId,
    towerGeometry: config.wiping.towerGeometry,
    wiperX: config.wiping.wiperX || 0,
    wiperY: config.wiping.wiperY || 0
  }));

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

  if (delayedTowerRefillLines.length > 0) {
    target.push(...delayedTowerRefillLines);
  }
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
  const towerGeometry = normalizeTowerGeometry(options.towerGeometry || {});
  const towerPosition = resolveSafeWipingTowerPosition(
    options.wiperX || 0,
    options.wiperY || 0,
    options.machineBounds || null,
    resolveTowerPlacementProfile(options.printerId),
    towerGeometry
  );
  const wiperX = towerPosition.wiperX;
  const wiperY = towerPosition.wiperY;
  const towerBaseLayerGcode = Array.isArray(options.towerBaseLayerGcode)
    ? options.towerBaseLayerGcode
    : DEFAULT_TOWER_BASE_LAYER_GCODE;
  const towerExtrudeRatio = roundTo((firstLayerHeight / 0.2) * 0.8, 3);
  const baseTemplateOffsets = resolveTowerTemplateOffsets(
    wiperX,
    wiperY,
    towerGeometry.baseWidth,
    towerGeometry.baseDepth
  );
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
      const templateLine = transformTowerTemplateLine(line, towerGeometry.baseWidth, towerGeometry.baseDepth);
        lines.push(
          processGcodeOffset(
            templateLine,
            baseTemplateOffsets.x,
            baseTemplateOffsets.y,
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
  const towerGeometry = normalizeTowerGeometry(options.towerGeometry || {});
  const defaultSuggestedLayerHeight = localLayerThickness > 0
    ? Math.max(localLayerThickness, roundTo(0.2 * nozzleDiameter, 3))
    : roundTo(0.65 * nozzleDiameter, 3);
  const suggestedLayerHeight = Number.isFinite(options.suggestedLayerHeight)
    ? options.suggestedLayerHeight
    : defaultSuggestedLayerHeight;
  const switchTowerType = resolveEffectiveSwitchTowerType(options);
  const towerHeight = options.towerHeight || 0;
  const travelSpeed = options.travelSpeed || 0;
  const wipeTowerPrintSpeed = options.wipeTowerPrintSpeed || 0;
  const wipingGcode = Array.isArray(options.wipingGcode)
    ? options.wipingGcode
    : DEFAULT_WIPING_GCODE;
  const towerPosition = resolveSafeWipingTowerPosition(
    options.wiperX || 0,
    options.wiperY || 0,
    options.machineBounds || null,
    resolveTowerPlacementProfile(options.printerId),
    towerGeometry
  );
  const wiperX = towerPosition.wiperX;
  const wiperY = towerPosition.wiperY;
  const towerExtrudeRatio = roundTo(suggestedLayerHeight / 0.2, 3);
  const layerTemplateOffsets = resolveTowerTemplateOffsets(
    wiperX,
    wiperY,
    towerGeometry.layerWidth,
    towerGeometry.layerDepth
  );
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
          layerTemplateOffsets.x,
          layerTemplateOffsets.y,
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

    const templateLine = transformTowerTemplateLine(line, towerGeometry.layerWidth, towerGeometry.layerDepth);
    lines.push(
      processGcodeOffset(
        templateLine,
        layerTemplateOffsets.x,
        layerTemplateOffsets.y,
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
  const leavingTowerLine = transformTowerTemplateLine('G1 X33 Y33', towerGeometry.layerWidth, towerGeometry.layerDepth);
  lines.push(
    `${processGcodeOffset(
      leavingTowerLine,
      layerTemplateOffsets.x,
      layerTemplateOffsets.y,
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
  let firstLayerHeight = 0;
  let retractLength = 0;
  let suggestedRatio = 1;
  let thickBridgeActive = false;
  let supportActive = false;
  let travelSpeed = config.toolhead.speedLimit || 0;
  let pendingTowerInjection = false;
  let stripHeadWrapDetectBlock = false;
  let stripNextTowerRecoveryG3 = false;
  let emittedFollowUpTowerCount = 0;

  for (const rawLine of lines) {
    let line = rawLine.trimEnd();

    if (line.startsWith('; SKIPTYPE: head_wrap_detect')) {
      stripHeadWrapDetectBlock = true;
      continue;
    }

    if (stripHeadWrapDetectBlock) {
      if (line.includes('; SKIPPABLE_END')) {
        stripHeadWrapDetectBlock = false;
        result.push(line);
      }
      continue;
    }

    if (stripNextTowerRecoveryG3 && line.includes('G3 Z')) {
      stripNextTowerRecoveryG3 = false;
      continue;
    }

    if (line.startsWith('; initial_layer_print_height =')) {
      firstLayerHeight = numStrip(line)[0] || firstLayerHeight;
    }

    if (line.startsWith('; retraction_length =')) {
      retractLength = numStrip(line)[0] || retractLength;
    }

    if (line.startsWith('; travel_speed =')) {
      travelSpeed = numStrip(line)[0] || travelSpeed;
    }

    if (line.startsWith('; Z_HEIGHT:')) {
      currentLayerHeight = numStrip(line)[0] || currentLayerHeight;
    }

    if (line.startsWith('; LAYER_HEIGHT:')) {
      currentThickness = numStrip(line)[0] || currentThickness;
      suggestedRatio = calculateSuggestedRatio(currentThickness, nozzleDiameter);
      result.push(`; Current Layer Thickness:${formatCompactNumber(currentThickness)}`);
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

    if (config.wiping.haveWipingComponents && line.includes(';Prepare for next tower')) {
      pendingTowerInjection = true;
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

    // Python prints the follow-up tower shell in its second pass when layer progress updates.
    if (
      pendingTowerInjection
      && config.wiping.haveWipingComponents
      && line.includes('; update layer progress')
      && currentLayerHeight > 0
      && (firstLayerHeight <= 0 || roundTo(currentLayerHeight, 3) !== roundTo(firstLayerHeight, 3))
    ) {
      result.push(...buildWipingTowerLayerGcode({
        currentLayerHeight,
        localLayerThickness: currentThickness || 0,
        machineBounds: config.machine.bounds,
        nozzleDiameter: config.machine.nozzleDiameter || 0.4,
        printerId: config.machine.printerId,
        retractLength,
        switchTowerType: config.wiping.switchTowerType || 1,
        futureLollipopMode: config.postProcessing.futureLollipopMode,
        towerHeight: currentLayerHeight,
        towerGeometry: config.wiping.towerGeometry,
        travelSpeed,
        wipeTowerPrintSpeed: config.wiping.wipeTowerPrintSpeed || 0,
        wipingGcode: config.templates.wipingGcode,
        wiperX: config.wiping.wiperX || 0,
        wiperY: config.wiping.wiperY || 0
      }));
      pendingTowerInjection = false;
      emittedFollowUpTowerCount += 1;
      stripNextTowerRecoveryG3 = emittedFollowUpTowerCount > 1;
    }

    result.push(line);
  }

  const output = result.join('\n');

  if (!config.postProcessing.legacyWallBufferRecovery) {
    return output;
  }

  return applyLegacyWallBufferPass(output, config);
}

function applyLegacyWallBufferPass(gcodeContent, config = {}) {
  const lines = String(gcodeContent || '').split(/\r?\n/);
  const result = [];
  const bufferedWallBlocks = [];
  let layerHasSupportInterface = false;
  let releaseBufferedWallsAfterLayerChange = false;
  let travelSpeedMmPerSec = Number(config.toolhead?.speedLimit) || 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();

    if (line.startsWith('; travel_speed =')) {
      travelSpeedMmPerSec = numStrip(line)[0] || travelSpeedMmPerSec;
    }

    if (line.includes('; FEATURE: Support interface')) {
      layerHasSupportInterface = true;
    }

    if (layerHasSupportInterface && isWallRecoveryStart(lines, index)) {
      const wallBlockEnd = findWallRecoveryBlockEnd(lines, index);
      const bufferedLines = lines.slice(index, wallBlockEnd);
      const nextFeatureKind = findNextFeatureKind(lines, wallBlockEnd);

      if (bufferedLines.length > 0) {
        result.push(';Walls Ahead!');
        if (nextFeatureKind && !isWallLikeFeature(nextFeatureKind)) {
          result.push(';Different Extrusion!');
        }
        bufferedWallBlocks.push(bufferedLines);
        index = wallBlockEnd - 1;
        continue;
      }
    }

    result.push(line);

    if (line.startsWith('; CHANGE_LAYER')) {
      layerHasSupportInterface = false;
      if (bufferedWallBlocks.length > 0) {
        releaseBufferedWallsAfterLayerChange = true;
      }
    }

    if (
      releaseBufferedWallsAfterLayerChange
      && line === 'G1 E-.04 F1800'
      && bufferedWallBlocks.length > 0
    ) {
      result.push(';Walls Released');
      result.push(`G1 F${formatWallMoveFeedrate(travelSpeedMmPerSec)};Wall Move Command`);
      while (bufferedWallBlocks.length > 0) {
        result.push(...bufferedWallBlocks.shift());
      }
      releaseBufferedWallsAfterLayerChange = false;
    }
  }

  return result.join('\n');
}

function isWallRecoveryStart(lines, index) {
  const line = String(lines[index] || '').trimEnd();
  if (!isTravelMoveWithoutExtrusion(line)) {
    return false;
  }

  const nextFeatureKind = findNextFeatureKind(lines, index);
  return isWallLikeFeature(nextFeatureKind);
}

function findWallRecoveryBlockEnd(lines, startIndex) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = String(lines[index] || '').trimEnd();

    if (line.startsWith('; CHANGE_LAYER') || line.startsWith(';LAYER_CHANGE')) {
      return index;
    }

    if (index > startIndex && isTravelMoveWithoutExtrusion(line)) {
      const nextFeatureKind = findNextFeatureKind(lines, index);
      if (nextFeatureKind && !isWallLikeFeature(nextFeatureKind)) {
        return index;
      }
    }
  }

  return lines.length;
}

function findNextFeatureKind(lines, startIndex) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = String(lines[index] || '').trimEnd();
    if (line.startsWith('; FEATURE:')) {
      return line;
    }

    if (line.startsWith('; CHANGE_LAYER') || line.startsWith(';LAYER_CHANGE')) {
      break;
    }
  }

  return '';
}

function isWallLikeFeature(line) {
  const featureLine = String(line || '').trimEnd();
  return featureLine.startsWith('; FEATURE: Inner wall')
    || featureLine.startsWith('; FEATURE: Outer wall')
    || featureLine.startsWith('; FEATURE: Overhang wall');
}

function formatWallMoveFeedrate(travelSpeedMmPerSec) {
  const feedrate = Math.max(0, Number(travelSpeedMmPerSec) || 0) * 60;
  return feedrate.toFixed(1);
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
    outputPath,
    runtimeInfo: options.runtimeInfo || null
  });
}

function buildPostprocessStepLogLines(report) {
  const lines = [];
  const runtime = report?.runtime || {};

  lines.push(
    `[INFO] [CLI] report status=${report?.status || 'unknown'} durationMs=${report?.durationMs || 0} engineRevision=${runtime.engineRevision || MKP_ENGINE_RUNTIME_REVISION} input=${report?.inputPath || 'N/A'} output=${report?.outputPath || 'N/A'}`
  );

  (report?.steps || []).forEach((step, index) => {
    lines.push(
      `[INFO] [CLI] step ${index + 1}/${report.steps.length} kind=${step.kind || 'info'} title=${step.title || 'Untitled'} technical=${step.technical || ''}`
    );

    if (step.data) {
      lines.push(`[INFO] [CLI] step ${index + 1} data=${JSON.stringify(step.data)}`);
    }
  });

  return lines;
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
  lines.push(`- EngineRevision: ${report?.runtime?.engineRevision || MKP_ENGINE_RUNTIME_REVISION}`);
  lines.push(`- EngineModule: ${report?.runtime?.engineModule || 'src/main/mkp_engine.js'}`);
  lines.push(`- AppVersion: ${report?.runtime?.appVersion || 'N/A'}`);
  lines.push(`- IsPackaged: ${String(report?.runtime?.isPackaged ?? 'N/A')}`);
  lines.push(`- ExecPath: ${report?.runtime?.execPath || 'N/A'}`);
  lines.push(`- AppPath: ${report?.runtime?.appPath || 'N/A'}`);
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
  buildPostprocessStepLogLines,
  buildPostprocessTraceExport,
  buildTowerPreparationTravelGcode,
  buildTowerBaseLayerGcode,
  buildWipingTowerLayerGcode,
  deleteWipe,
  formatXYZEString,
  getEngineRuntimeMetadata,
  getPseudoRandom,
  hasValidInterfaceSet,
  loadEngineConfig,
  normalizeConfig,
  numStrip,
  parseCliArguments,
  parseConfigText,
  parseToml,
  processGcode,
  processGcodeDetailed,
  processGcodeContent,
  processGcodeContentDetailed,
  processGcodeOffset,
  resetPseudoRandom
};
