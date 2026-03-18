import { describe, expect, it } from 'vitest';

const {
  applyPostProcessingPasses,
  buildTowerBaseLayerGcode,
  getPseudoRandom,
  parseCliArguments,
  parseConfigText,
  processGcodeContent,
  processGcodeOffset,
  resetPseudoRandom
} = require('../../../src/main/mkp_engine');

describe('mkp main-process engine', () => {
  it('parses either JSON or TOML CLI config arguments for post-processing mode', () => {
    expect(
      parseCliArguments(['electron', 'main.js', '--Json', 'preset.json', '--Gcode', 'part.gcode'])
    ).toEqual({
      configFormat: 'json',
      configPath: 'preset.json',
      gcodePath: 'part.gcode'
    });

    expect(
      parseCliArguments(['electron', 'main.js', '--Toml', 'preset.toml', '--Gcode', 'part.gcode'])
    ).toEqual({
      configFormat: 'toml',
      configPath: 'preset.toml',
      gcodePath: 'part.gcode'
    });
  });

  it('normalizes TOML presets into the engine config shape used by JS post-processing', () => {
    const config = parseConfigText(
      `
[toolhead]
speed_limit = 69
offset = { x = 1.25, y = -2.5, z = 0.35 }
custom_mount_gcode = """
G1 X1
M400
"""
custom_unmount_gcode = """
G1 X2
M401
"""

[wiping]
have_wiping_components = true
wiper_x = 16
wiper_y = 26
wipetower_speed = 42
nozzle_cooling_flag = true
iron_apply_flag = false
user_dry_time = 8
force_thick_bridge_flag = true
support_extrusion_multiplier = 1.35
      `.trim(),
      'toml'
    );

    expect(config.toolhead).toEqual({
      customMountGcode: 'G1 X1\nM400',
      customUnmountGcode: 'G1 X2\nM401',
      offset: { x: 1.25, y: -2.5, z: 0.35 },
      speedLimit: 69
    });

    expect(config.wiping).toEqual({
      forceThickBridgeFlag: true,
      haveWipingComponents: true,
      ironApplyFlag: false,
      nozzleCoolingFlag: true,
      supportExtrusionMultiplier: 1.35,
      userDryTime: 8,
      wiperX: 16,
      wiperY: 26,
      wipeTowerPrintSpeed: 42
    });

    expect(config.templates.wipingGcode.length).toBeGreaterThan(0);
    expect(config.templates.towerBaseLayerGcode.length).toBeGreaterThan(0);
  });

  it('ports Python-like XYZE offset processing for normal moves', () => {
    const line = processGcodeOffset('G1 X.9 Y10 Z.2 E.300 F1200 ; path', 1, -2, 0.5, 'normal');

    expect(line).toBe('G1 X1.900 Y8.000 Z0.700 ; path');
  });

  it('keeps extrusion in ironing mode and scales it with the configured ratio', () => {
    const line = processGcodeOffset('G1 X1 Y2 Z.2 E.500', 0.5, 0.5, 1, 'ironing', {
      ironExtrudeRatio: 0.5
    });

    expect(line).toBe('G1 X1.500 Y2.500 Z0.200 E0.250');
  });

  it('applies support extrusion multiplier and thick-bridge adjustments in the post-processing pass', () => {
    const result = applyPostProcessingPasses(
      [
        '; Z_HEIGHT: 0.40',
        '; LAYER_HEIGHT: 0.10',
        '; FEATURE: Support',
        'G1 X10 Y10 E.200',
        '; FEATURE: Outer wall',
        'G1 X11 Y11 E.200',
        '; FEATURE: Support transition',
        'G1 X12 Y12 E.200',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        machine: { nozzleDiameter: 0.4 },
        wiping: {
          forceThickBridgeFlag: true,
          supportExtrusionMultiplier: 1.5
        }
      }
    );

    expect(result).toContain('G1 X10 Y10 E.3');
    expect(result).toContain('; LAYER_HEIGHT: 0.217');
    expect(result).toContain('G1 X12 Y12 E.43333;MKP thick bridge');
    expect(result).toContain('G1 X11 Y11 E.200');
  });

  it('injects the extracted support-interface path through the JS engine startup flow', () => {
    const result = processGcodeContent(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X.9 Y10 E.500 F1200',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400\nT1',
          customUnmountGcode: 'T0',
          offset: { x: 1, y: 2, z: 0.3 },
          speedLimit: 69
        },
        wiping: {
          forceThickBridgeFlag: false,
          supportExtrusionMultiplier: 1
        }
      }
    );

    expect(result).toContain('; ===== MKP Support Electron Glueing Start =====');
    expect(result).toContain('M400\nT1');
    expect(result).toContain('G1 X1.900 Y12.000');
    expect(result).toContain('T0');
    expect(result).toContain('; ===== MKP Support Electron Glueing End =====');
  });

  it('replays AUTO fan placeholders and restores nozzle temperature with dry time after glueing', () => {
    const result = processGcodeContent(
      [
        '; nozzle_temperature = 220',
        'M106 S180',
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M106 S[AUTO]\nM106 P1 S[AUTO]\nM401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 69
        },
        wiping: {
          nozzleCoolingFlag: true,
          supportExtrusionMultiplier: 1,
          userDryTime: 8,
          useWipingTowers: false
        }
      }
    );

    expect(result).toContain(';Pervent Leakage');
    expect(result).toContain('M104 S190');
    expect(result).toContain('M106 S180');
    expect(result).toContain('M106 P1 S180');
    expect(result).toContain(';Toolhead Unmounted');
    expect(result).toContain('; FEATURE: Outer wall');
    expect(result).toContain('M104 S220');
    expect(result).toContain(';User Dry Time Activated');
    expect(result).toContain('G4 P8000');
  });

  it('prepares the next wiping tower and blocks on nozzle restore when tower mode is enabled', () => {
    const result = processGcodeContent(
      [
        '; nozzle_temperature = 220',
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 69
        },
        wiping: {
          nozzleCoolingFlag: true,
          supportExtrusionMultiplier: 1,
          useWipingTowers: true,
          userDryTime: 0,
          wiperX: 30,
          wiperY: 40
        }
      }
    );

    expect(result).toContain('G1 X45.000 Y45.190');
    expect(result).toContain(';Prepare for next tower');
    expect(result).toContain('M109 S220');
  });

  it('keeps the Python pseudo-random wipe sequence deterministic across cycles', () => {
    resetPseudoRandom();

    expect([
      getPseudoRandom(),
      getPseudoRandom(),
      getPseudoRandom(),
      getPseudoRandom(),
      getPseudoRandom(),
      getPseudoRandom(),
      getPseudoRandom(),
      getPseudoRandom(),
      getPseudoRandom(),
      getPseudoRandom()
    ]).toEqual(['3', '7', '2', '8', '1', '5', '9', '4', '6', '3']);
  });

  it('expands the first tower-base template using the same placeholders as the Python engine', () => {
    const result = buildTowerBaseLayerGcode({
      firstLayerHeight: 0.28,
      firstLayerSpeed: 20,
      retractLength: 0.8,
      towerBaseLayerGcode: [
        'EXTRUDER_REFILL',
        'NOZZLE_HEIGHT_ADJUST',
        'G1 F9600',
        'G1 X20 Y20 E.25658',
        'EXTRUDER_RETRACT',
        'G92 E0'
      ],
      travelSpeed: 150,
      wiperX: 30,
      wiperY: 40
    });

    expect(result).toEqual([
      'G1 F9000',
      'G92 E0',
      'G1 E0.8',
      'G92 E0',
      'G1 Z0.280;Tower Z',
      'G1 F1200',
      'G1 X45.000 Y55.000 E0.288',
      'G92 E0',
      'G92 E0',
      'G1 F9000'
    ]);
  });
});
