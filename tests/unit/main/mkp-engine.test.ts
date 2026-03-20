import { describe, expect, it } from 'vitest';

const {
  applyPostProcessingPasses,
  buildPostprocessStepLogLines,
  buildPostprocessTraceExport,
  buildTowerPreparationTravelGcode,
  buildTowerBaseLayerGcode,
  buildWipingTowerLayerGcode,
  deleteWipe,
  getEngineRuntimeMetadata,
  getPseudoRandom,
  hasValidInterfaceSet,
  parseCliArguments,
  parseConfigText,
  processGcodeContent,
  processGcodeContentDetailed,
  processGcodeOffset,
  resetPseudoRandom
} = require('../../../src/main/mkp_engine');

describe('mkp main-process engine', () => {
  it('parses JSON CLI config arguments for post-processing mode and rejects TOML shortcuts', () => {
    expect(
      parseCliArguments(['electron', 'main.js', '--Json', 'preset.json', '--Gcode', 'part.gcode'])
    ).toEqual({
      configFormat: 'json',
      configPath: 'preset.json',
      gcodePath: 'part.gcode'
    });

    expect(() =>
      parseCliArguments(['electron', 'main.js', '--Toml', 'preset.toml', '--Gcode', 'part.gcode'])
    ).toThrow(/no longer supports --Toml/i);

    expect(() =>
      parseCliArguments(['electron', 'main.js', '--Json', 'preset.json', '--Toml', 'preset.toml', '--Gcode', 'part.gcode'])
    ).toThrow(/no longer supports --Toml/i);
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
switch_tower_type = 2
wiper_x = 16
wiper_y = 26
wipetower_speed = 42
nozzle_cooling_flag = true
iron_apply_flag = false
user_dry_time = 8
force_thick_bridge_flag = true
support_extrusion_multiplier = 1.35

[postProcessing]
iron_extrude_ratio = 0.85
tower_extrude_ratio = 1.1
ironing_path_offset_mm = -0.15
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
      switchTowerType: 2,
      supportExtrusionMultiplier: 1.35,
      userDryTime: 8,
      wiperX: 16,
      wiperY: 26,
      wipeTowerPrintSpeed: 42,
      towerGeometry: {
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
      }
    });

    expect(config.templates.wipingGcode.length).toBeGreaterThan(0);
    expect(config.templates.towerBaseLayerGcode.length).toBeGreaterThan(0);
    expect(config.postProcessing).toEqual({
      futureLollipopMode: false,
      ironExtrudeRatio: 0.85,
      ironingPathOffsetMm: -0.15,
      legacyWallBufferRecovery: false,
      towerExtrudeRatio: 1.1
    });
  });

  it('defaults switch_tower_type to slow-line tower mode when presets do not define it yet', () => {
    const config = parseConfigText(
      JSON.stringify({
        wiping: {
          have_wiping_components: true
        }
      }),
      'json'
    );

    expect(config.wiping.switchTowerType).toBe(1);
  });

  it('normalizes advanced wipe tower geometry fields so renderer preview and CLI generation share one runtime contract', () => {
    const config = parseConfigText(
      JSON.stringify({
        wiping: {
          tower_width: 26,
          tower_depth: 24,
          tower_brim_width: 2,
          tower_outer_wall_width: 1.5,
          tower_outer_wall_depth: 1,
          tower_slanted_outer_wall_enabled: true,
          tower_slanted_outer_wall_width: 2.5,
          tower_slanted_outer_wall_depth: 3
        }
      }),
      'json'
    );

    expect(config.wiping.towerGeometry).toEqual({
      baseDepth: 36,
      baseWidth: 38,
      brimWidth: 2,
      coreDepth: 24,
      coreWidth: 26,
      layerDepth: 32,
      layerWidth: 34,
      outerWallDepth: 1,
      outerWallWidth: 1.5,
      slantedOuterWallDepth: 3,
      slantedOuterWallEnabled: true,
      slantedOuterWallWidth: 2.5
    });
  });

  it('accepts normalized towerGeometry contracts when builder helpers receive already-normalized runtime config', () => {
    const base = buildTowerBaseLayerGcode({
      firstLayerHeight: 0.28,
      firstLayerSpeed: 20,
      retractLength: 0.8,
      towerBaseLayerGcode: ['G1 X10 Y10 E.10000'],
      towerGeometry: {
        coreWidth: 20,
        coreDepth: 20,
        brimWidth: 3,
        outerWallWidth: 1,
        outerWallDepth: 2,
        slantedOuterWallEnabled: true,
        slantedOuterWallWidth: 2,
        slantedOuterWallDepth: 1,
        layerWidth: 26,
        layerDepth: 26,
        baseWidth: 32,
        baseDepth: 34
      },
      travelSpeed: 150,
      wiperX: 30,
      wiperY: 40
    });

    expect(base).toContain('G1 X30.000 Y40.000 E0.112');
  });

  it('defaults legacy presets to wiping-tower mode unless a new explicit tower toggle disables it', () => {
    const legacyConfig = parseConfigText(
      JSON.stringify({
        wiping: {
          have_wiping_components: false
        }
      }),
      'json'
    );

    expect(legacyConfig.wiping.haveWipingComponents).toBe(true);

    const explicitOffConfig = parseConfigText(
      JSON.stringify({
        wiping: {
          have_wiping_components: false,
          use_wiping_towers: false
        }
      }),
      'json'
    );

    expect(explicitOffConfig.wiping.haveWipingComponents).toBe(true);
  });

  it('keeps public parsed presets on tower-only mode in the runtime report even if legacy fields request non-tower or fast-line values', () => {
    const parsedConfig = parseConfigText(
      JSON.stringify({
        wiping: {
          have_wiping_components: false,
          use_wiping_towers: false,
          switch_tower_type: 2
        }
      }),
      'json'
    );

    const detailed = processGcodeContentDetailed(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall'
      ].join('\n'),
      parsedConfig
    );

    expect(parsedConfig.wiping.haveWipingComponents).toBe(true);
    expect(parsedConfig.wiping.switchTowerType).toBe(2);
    expect(detailed.report.configSnapshot.effectiveSwitchTowerType).toBe(1);
    expect(detailed.report.steps.some((step: any) => String(step.technical || '').includes('haveWipingComponents=true'))).toBe(true);
    expect(detailed.report.steps.some((step: any) => String(step.technical || '').includes('effectiveSwitchTowerType=1'))).toBe(true);
  });

  it('clamps wipe-tower coordinates against the full tower footprint instead of trusting the raw anchor point', () => {
    const config = parseConfigText(
      JSON.stringify({
        wiping: {
          wiper_x: -20,
          wiper_y: 300
        },
        machine: {
          bounds: {
            minX: 0,
            maxX: 256,
            minY: 0,
            maxY: 256
          }
        }
      }),
      'json'
    );

    expect(config.wiping.wiperX).toBe(5);
    expect(config.wiping.wiperY).toBe(228);
  });

  it('snaps wipe-tower coordinates to integer anchors before later dead-zone handling', () => {
    const config = parseConfigText(
      JSON.stringify({
        machine: {
          bounds: {
            minX: 0,
            maxX: 180,
            minY: 0,
            maxY: 180
          }
        },
        wiping: {
          wiper_x: 17.6,
          wiper_y: 42.4
        }
      }),
      'json'
    );

    expect(config.wiping.wiperX).toBe(18);
    expect(config.wiping.wiperY).toBe(42);
  });

  it('records the effective wipe-tower coordinates when a raw preset position is clamped', () => {
    const parsedConfig = parseConfigText(
      JSON.stringify({
        wiping: {
          wiper_x: -20,
          wiper_y: 300
        },
        machine: {
          bounds: {
            minX: 0,
            maxX: 256,
            minY: 0,
            maxY: 256
          }
        }
      }),
      'json'
    );

    const detailed = processGcodeContentDetailed(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall'
      ].join('\n'),
      parsedConfig
    );

    expect(detailed.report.configSnapshot.wiperX).toBe(5);
    expect(detailed.report.configSnapshot.wiperY).toBe(228);
    expect(detailed.report.configSnapshot.towerPositionAdjusted).toBe(true);
    expect(
      detailed.report.steps.some((step: any) => /towerPlacement raw=\(-20(?:\.0)?,300(?:\.0)?\) effective=\(5(?:\.0)?,228(?:\.0)?\)/.test(String(step.technical || '')))
    ).toBe(true);
  });

  it('applies the P1/X1 MKP safety range and official L-shaped dead zones before accepting tower coordinates', () => {
    const config = parseConfigText(
      JSON.stringify({
        printer: 'p1',
        wiping: {
          wiper_x: 10,
          wiper_y: 10
        }
      }),
      'json'
    );

    expect(config.machine.printerId).toBe('p1');
    expect(config.machine.bounds).toEqual({
      minX: 0,
      maxX: 256,
      minY: 0,
      maxY: 256
    });
    expect(config.wiping.wiperX).toBe(42);
    expect(config.wiping.wiperY).toBe(13);
    expect(config.machine.wipingTowerPosition.adjusted).toBe(true);
    expect(config.machine.wipingTowerPosition.blockedZoneIds).toEqual([
      'mkp-safety',
      'official-front-strip'
    ]);
  });

  it('treats the P1/X1 official front purge line as a thin front L-zone instead of a tall left-side strip', () => {
    const config = parseConfigText(
      JSON.stringify({
        printer: 'x1',
        wiping: {
          wiper_x: 220,
          wiper_y: 10
        }
      }),
      'json'
    );

    expect(config.wiping.wiperX).toBe(220);
    expect(config.wiping.wiperY).toBe(13);
    expect(config.machine.wipingTowerPosition.adjusted).toBe(true);
    expect(config.machine.wipingTowerPosition.blockedZoneIds).toEqual(['official-front-strip']);
  });

  it('records blocked-zone adjustments in the runtime report when a P1/X1 tower anchor lands inside a forbidden area', () => {
    const parsedConfig = parseConfigText(
      JSON.stringify({
        printer: 'x1',
        wiping: {
          wiper_x: 220,
          wiper_y: 10
        }
      }),
      'json'
    );

    const detailed = processGcodeContentDetailed(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall'
      ].join('\n'),
      parsedConfig
    );

    expect(detailed.report.configSnapshot.towerPositionAdjusted).toBe(true);
    expect(
      detailed.report.steps.some((step: any) => String(step.technical || '').includes('blockedZones=official-front-strip'))
    ).toBe(true);
    expect(
      detailed.report.steps.some((step: any) => String(step.human || '').includes('forbidden placement area'))
    ).toBe(true);
  });

  it('upgrades legacy minimal tower templates embedded in old JSON presets to the full Python defaults', () => {
    const config = parseConfigText(
      JSON.stringify({
        templates: {
          towerBaseLayerGcode: [
            '; MKP tower base template',
            'G92 E0',
            'G1 X20 Y20 E1.0',
            'G1 X25 Y20 E0.5',
            'G92 E0'
          ],
          wipingGcode: [
            '; MKP wiping tower template',
            'G92 E0',
            'G1 X20 Y20 E0.8',
            'G1 X24 Y20 E0.4',
            'G92 E0'
          ]
        }
      }),
      'json'
    );

    expect(config.templates.wipingGcode[0]).toBe(';Tower_Layer_Gcode');
    expect(config.templates.wipingGcode).toContain(';START_HERE');
    expect(config.templates.wipingGcode).toContain(';Tower_Layer_Gcode Finished');
    expect(config.templates.towerBaseLayerGcode[0]).toBe(';Tower_Base_Layer_Gcode');
    expect(config.templates.towerBaseLayerGcode).toContain('EXTRUDER_RETRACT');
    expect(config.templates.towerBaseLayerGcode).toContain(';Tower Base Layer Finished');
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

    expect(result).toContain(';Pre-glue preparation');
    expect(result).toContain('M400\nT1');
    expect(result).toContain('G1 X1.900 Y12.000');
    expect(result).toContain('T0');
    expect(result).not.toContain('; ===== MKP Support Electron Glueing Start =====');
    expect(result).not.toContain('; ===== MKP Support Electron Glueing End =====');
  });

  it('adds Python-style mount and glue-start markers around each injected glue cycle', () => {
    const result = processGcodeContent(
      [
        '; Z_HEIGHT: 0.60',
        'G1 X5 Y5 F12000',
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
          supportExtrusionMultiplier: 1
        }
      }
    );

    const mountingIndex = result.indexOf(';Mounting Toolhead');
    const mountedIndex = result.indexOf(';Toolhead Mounted');
    const glueStartIndex = result.indexOf(';Glueing Started');
    const inPositionIndex = result.indexOf(';Inposition');
    const firstGlueMoveIndex = result.indexOf('G1 X1.900 Y12.000');

    expect(mountingIndex).toBeGreaterThanOrEqual(0);
    expect(mountedIndex).toBeGreaterThan(mountingIndex);
    expect(glueStartIndex).toBeGreaterThan(mountedIndex);
    expect(inPositionIndex).toBeGreaterThan(glueStartIndex);
    expect(firstGlueMoveIndex).toBeGreaterThan(inPositionIndex);
  });

  it('matches the 5.8.5 pre-glue envelope by emitting legacy comments and omitting JS-only block wrappers', () => {
    const result = processGcodeContent(
      [
        '; travel_speed = 700',
        '; Z_HEIGHT: 0.20',
        '; LAYER_HEIGHT: 0.20',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall',
        '; Z_HEIGHT: 0.40',
        '; LAYER_HEIGHT: 0.20',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 70
        }
      }
    );

    const thicknessIndex = result.indexOf('; Current Layer Thickness:0.2');
    const preGlueIndex = result.indexOf(';Pre-glue preparation');
    const risingIndex = result.indexOf(';Rising Nozzle a little');
    const mountingIndex = result.indexOf(';Mounting Toolhead');

    expect(thicknessIndex).toBeGreaterThanOrEqual(0);
    expect(preGlueIndex).toBeGreaterThan(thicknessIndex);
    expect(risingIndex).toBeGreaterThan(preGlueIndex);
    expect(mountingIndex).toBeGreaterThan(risingIndex);
    expect(result).not.toContain('; ===== MKP Support Electron Glueing Start =====');
    expect(result).not.toContain('; ===== MKP Support Electron Glueing End =====');
  });

  it('does not duplicate header-like print sections inside the pure JS engine path', () => {
    const result = processGcodeContent(
      [
        '; post_process = "mkp.exe" --Json "preset.json" --Gcode',
        '; MACHINE_START_GCODE_END',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 0.20',
        '; layer num/total_layer_count: 1/1',
        '; FEATURE: Support interface',
        'G1 X1 Y1 E.500',
        '; FEATURE: Outer wall',
        'G1 X2 Y2 E.500',
        '; MACHINE_END_GCODE_START'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 69
        }
      }
    );

    expect((result.match(/^; post_process =/gm) || []).length).toBe(1);
    expect((result.match(/^; MACHINE_START_GCODE_END$/gm) || []).length).toBe(1);
    expect((result.match(/^; MACHINE_END_GCODE_START$/gm) || []).length).toBe(1);
    expect((result.match(/^; Z_HEIGHT:/gm) || []).length).toBe(1);
  });

  it('aggregates multiple support-interface feature blocks from the same layer into a single glue cycle', () => {
    const result = processGcodeContent(
      [
        '; Z_HEIGHT: 0.80',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.200',
        '; FEATURE: Support',
        'G1 X11 Y11 E.200',
        '; FEATURE: Support interface',
        'G1 X12 Y12 E.200',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 69
        }
      }
    );

    expect((result.match(/^;Mounting Toolhead$/gm) || []).length).toBe(1);
  });

  it('defers support-interface glue injection until the layer-num boundary, matching the Python flow', () => {
    const result = processGcodeContent(
      [
        '; Z_HEIGHT: 0.80',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.200',
        '; FEATURE: Outer wall',
        'G1 X50 Y50 E.200',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 69
        }
      }
    );

    const glueStartIndex = result.indexOf(';Pre-glue preparation');
    const outerWallMoveIndex = result.indexOf('G1 X50 Y50 E.200');
    const layerBoundaryIndex = result.indexOf('; layer num/total_layer_count: 2/33');

    expect(glueStartIndex).toBeGreaterThan(outerWallMoveIndex);
    expect(glueStartIndex).toBeLessThan(layerBoundaryIndex);
  });

  it('treats Orca support-surface ironing as a glue target when ironing-path reuse is enabled', () => {
    const result = processGcodeContent(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Ironing',
        'G1 X.9 Y10 E.500 F1200',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        machine: { nozzleDiameter: 0.4 },
        toolhead: {
          customMountGcode: 'M400\nT1',
          customUnmountGcode: 'T0',
          offset: { x: 1, y: 2, z: 0.3 },
          speedLimit: 69
        },
        wiping: {
          ironApplyFlag: true,
          supportExtrusionMultiplier: 1
        }
      }
    );

    expect(result).toContain(';Pre-glue preparation');
    expect(result).toContain('G1 X1.900 Y12.000');
    expect(result).not.toContain('; ===== MKP Support Electron Glueing Start =====');
    expect(result).not.toContain('; ===== MKP Support Electron Glueing End =====');
  });

  it('does not treat top-surface ironing as a glue target when Orca emits line-width metadata for a normal-height layer', () => {
    const result = processGcodeContent(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Ironing',
        '; LINE_WIDTH: 0.42',
        'G1 X.9 Y10 E.500 F1200',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        machine: { nozzleDiameter: 0.4 },
        toolhead: {
          customMountGcode: 'M400\nT1',
          customUnmountGcode: 'T0',
          offset: { x: 1, y: 2, z: 0.3 },
          speedLimit: 69
        },
        wiping: {
          ironApplyFlag: true,
          supportExtrusionMultiplier: 1
        }
      }
    );

    expect(result).not.toContain('; ===== MKP Support Electron Glueing Start =====');
    expect(result).not.toContain('T1');
    expect(result).not.toContain('T0');
  });

  it('trims trailing wipe tails from an extracted interface segment and keeps a z-jump marker', () => {
    expect(
      deleteWipe([
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; WIPE_START',
        'G1 X30 Y30 F1200',
        '; WIPE_END',
        'G1 X35 Y35 F1200'
      ])
    ).toEqual([
      '; FEATURE: Support interface',
      'G1 X10 Y10 E.500',
      ';ZJUMP_START'
    ]);
  });

  it('detects whether an extracted interface set still contains a real positive XY extrusion move', () => {
    expect(
      hasValidInterfaceSet([
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        ';ZJUMP_START'
      ])
    ).toBe(true);

    expect(
      hasValidInterfaceSet([
        '; FEATURE: Support interface',
        'G1 X10 Y10 F1200',
        ';ZJUMP_START'
      ])
    ).toBe(false);
  });

  it('replays inserted z-jump markers between interface sub-segments after wipe cleanup', () => {
    const result = processGcodeContent(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; WIPE_END',
        'G1 X14 Y14 E.300',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 1, y: 2, z: 0.3 },
          speedLimit: 69
        }
      }
    );

    expect(result).toContain('G1 X11.000 Y12.000');
    expect(result).toContain('G1 F4140\nG1 Z3.900 ; avoid spoiling before the next interface segment');
    expect(result).toContain('G1 X15.000 Y16.000 ; jump to the next interface segment\nG1 Z0.300 ; resume glue height\nG1 F4140');
  });

  it('skips mount and unmount injection when the extracted interface segment has no valid XY extrusion left', () => {
    const result = processGcodeContent(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X10 Y10 F1200',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 69
        }
      }
    );

    expect(result).not.toContain('; ===== MKP Support Electron Glueing Start =====');
    expect(result).not.toContain('M400');
    expect(result).not.toContain('M401');
  });

  it('cancels excessive Orca ironing segments and emits skip-recovery moves instead of glue injection', () => {
    const result = processGcodeContent(
      [
        '; retraction_length = 0.8',
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Ironing',
        'G1 X10 Y10 E4.000',
        'G1 X12 Y12 E4.100',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        machine: { nozzleDiameter: 0.4 },
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 69
        },
        wiping: {
          ironApplyFlag: true,
          supportExtrusionMultiplier: 1
        }
      }
    );

    expect(result).not.toContain('; ===== MKP Support Electron Glueing Start =====');
    expect(result).not.toContain('M400');
    expect(result).not.toContain('M401');
    expect(result).toContain('G1 E-0.8');
    expect(result).toContain(';Warning: Excessive ironing detected. Ironing cancelled. E_Sum=8.1');
    expect(result).toContain('G1 Z1.600;Skip Ironing');
    expect(result).toContain('G1 Z0.600');
    expect(result).toContain('G1 E0.8');
  });

  it('builds a human-readable and technical post-processing report for support-interface injection', () => {
    const result = processGcodeContentDetailed(
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
        postProcessing: {
          ironingPathOffsetMm: 0.2
        }
      },
      {
        inputPath: 'D:\\print\\part.gcode',
        outputPath: 'D:\\print\\part_processed.gcode',
        configPath: 'D:\\print\\preset.json',
        configFormat: 'json'
      }
    );

    expect(result.outputGcode).toContain(';Pre-glue preparation');
    expect(result.report.summary.injectedSegments).toBe(1);
    expect(result.report.runtime.engineRevision).toBe(getEngineRuntimeMetadata().engineRevision);
    expect(result.report.steps.some((step: any) => step.title.includes('支撑面'))).toBe(true);
    expect(result.report.steps.some((step: any) => String(step.technical || '').includes('Support interface'))).toBe(true);
    expect(result.report.steps.some((step: any) => String(step.technical || '').includes('ironingPathOffsetMm=0.2'))).toBe(true);
  });

  it('reports ignored top-surface ironing and excessive Orca ironing cancellation decisions', () => {
    const topSurface = processGcodeContentDetailed(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Ironing',
        '; LINE_WIDTH: 0.42',
        'G1 X.9 Y10 E.500 F1200',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        machine: { nozzleDiameter: 0.4 },
        wiping: {
          ironApplyFlag: true
        }
      }
    );

    expect(topSurface.report.summary.ignoredTopSurfaceIroningSegments).toBe(1);
    expect(topSurface.report.steps.some((step: any) => String(step.human || '').includes('顶部熨烫'))).toBe(true);

    const excessive = processGcodeContentDetailed(
      [
        '; retraction_length = 0.8',
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Ironing',
        'G1 X10 Y10 E4.000',
        'G1 X12 Y12 E4.100',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        machine: { nozzleDiameter: 0.4 },
        wiping: {
          ironApplyFlag: true
        }
      }
    );

    expect(excessive.report.summary.skippedExcessiveIroningSegments).toBe(1);
    expect(excessive.report.steps.some((step: any) => String(step.technical || '').includes('E_sum=8.1'))).toBe(true);
    expect(excessive.report.steps.some((step: any) => String(step.human || '').includes('自动取消'))).toBe(true);
  });

  it('exports technical trace markdown from the structured post-processing report', () => {
    const detailed = processGcodeContentDetailed(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X.9 Y10 E.500 F1200',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        toolhead: {
          offset: { x: 1, y: 2, z: 0.3 }
        }
      },
      {
        inputPath: 'D:\\print\\part.gcode',
        outputPath: 'D:\\print\\part_processed.gcode',
        configPath: 'D:\\print\\preset.json'
      }
    );

    const exportText = buildPostprocessTraceExport(detailed.report, 'technical');

    expect(exportText).toContain('# MKP Post-processing Trace');
    expect(exportText).toContain('Mode: Technical');
    expect(exportText).toContain('part_processed.gcode');
    expect(exportText).toContain('EngineRevision:');
    expect(exportText).toContain('Support interface');
  });

  it('builds compact CLI log lines from the structured post-processing report', () => {
    const detailed = processGcodeContentDetailed(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X.9 Y10 E.500 F1200',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        toolhead: {
          offset: { x: 1, y: 2, z: 0.3 }
        }
      },
      {
        inputPath: 'D:\\print\\part.gcode',
        outputPath: 'D:\\print\\part_processed.gcode',
        configPath: 'D:\\print\\preset.json',
        runtimeInfo: {
          appVersion: '0.2.10',
          execPath: 'C:\\Apps\\MKP SupportE.exe'
        }
      }
    );

    const lines = buildPostprocessStepLogLines(detailed.report);

    expect(lines[0]).toContain('[INFO] [CLI] report status=completed');
    expect(lines[0]).toContain('engineRevision=');
    expect(lines.some((line: string) => line.includes('title=加载并归一化后处理配置'))).toBe(true);
    expect(lines.some((line: string) => line.includes('technical=normalizeConfig()'))).toBe(true);
    expect(lines.some((line: string) => line.includes('data={"inputPath":"D:\\\\print\\\\part.gcode"'))).toBe(true);
  });

  it('includes tower-position clamp steps in compact CLI logs when the raw preset position is corrected', () => {
    const detailed = processGcodeContentDetailed(
      [
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500 F1200',
        '; FEATURE: Outer wall'
      ].join('\n'),
      parseConfigText(
        JSON.stringify({
          wiping: {
            wiper_x: -20,
            wiper_y: 300
          },
          machine: {
            bounds: {
              minX: 0,
              maxX: 256,
              minY: 0,
              maxY: 256
            }
          }
        }),
        'json'
      )
    );

    const lines = buildPostprocessStepLogLines(detailed.report);

    expect(lines.some((line: string) => line.includes('title=Clamp wipe tower position'))).toBe(true);
    expect(lines.some((line: string) => line.includes('towerPlacement raw=(-20.0,300.0) effective=(5.0,228.0)'))).toBe(true);
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

  it('matches the 5.8.5 non-tower flow by rebuilding pressure from sparse or solid infill before resuming model print', () => {
    const result = processGcodeContent(
      [
        '; travel_speed = 700',
        '; Z_HEIGHT: 0.20',
        '; LAYER_HEIGHT: 0.20',
        '; FEATURE: Outer wall',
        'G1 X5 Y5 E.100',
        '; Z_HEIGHT: 0.40',
        '; LAYER_HEIGHT: 0.20',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall',
        'G1 X11 Y11 E.200',
        '; FEATURE: Internal solid infill',
        'G1 X60 Y60 E.700',
        'G1 X61 Y61 E.400',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 69
        },
        wiping: {
          supportExtrusionMultiplier: 1,
          useWipingTowers: false
        }
      }
    );

    const infillRecoveryStart = result.indexOf(';Print sparse/solid infill first');
    const resumePrintHeight = result.indexOf('G1 Z0.400 ; resume print height');
    const recoverySegment = result.slice(infillRecoveryStart, resumePrintHeight);

    expect(infillRecoveryStart).toBeGreaterThanOrEqual(0);
    expect(resumePrintHeight).toBeGreaterThan(infillRecoveryStart);
    expect(recoverySegment).toContain('G1 F42000');
    expect(recoverySegment).toContain('G1 X60 Y60');
    expect(recoverySegment).not.toContain('G1 X60 Y60 E.700');
    expect(recoverySegment).toContain('G1 Z0.300');
    expect(recoverySegment).toContain('G1 F600');
    expect(recoverySegment).toContain('G1 X61 Y61 E.400');
  });

  it('prepares the next wiping tower without inlining the tower shell inside the first-pass glue block', () => {
    resetPseudoRandom();

    const result = processGcodeContent(
      [
        '; nozzle_temperature = 220',
        '; LAYER_HEIGHT: 0.20',
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
          switchTowerType: 1,
          wipeTowerPrintSpeed: 42,
          wiperX: 30,
          wiperY: 40
        },
        templates: {
          wipingGcode: [
            'G1 F9600',
            'NOZZLE_HEIGHT_ADJUST',
            'G1 X20 Y20 E.25658'
          ]
        }
      }
    );

    expect(result).toContain('G1 X40.000 Y40.190');
    expect(result).toContain(';Prepare for next tower');
    expect(result).toContain('M109 S220');
    expect(result).toContain('G1 X45.000 Y55.000');
    expect(result).not.toContain(';Leaving Wiping Tower');
    expect(result).not.toContain('; FEATURE: Inner wall');
    expect(result).not.toContain('resume print height');
  });

  it('keeps slow-line tower recovery active by default even if a future fast-line tower value is present', () => {
    const result = processGcodeContent(
      [
        '; nozzle_temperature = 220',
        '; LAYER_HEIGHT: 0.20',
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall',
        '; Z_HEIGHT: 0.80',
        '; LAYER_HEIGHT: 0.20',
        '; layer num/total_layer_count: 2/33',
        '; update layer progress'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 69
        },
        wiping: {
          supportExtrusionMultiplier: 1,
          useWipingTowers: true,
          switchTowerType: 2,
          wipeTowerPrintSpeed: 42,
          wiperX: 30,
          wiperY: 40
        },
        templates: {
          wipingGcode: [
            'G1 F9600',
            'G1 X20 Y20 E.25658'
          ]
        }
      }
    );

    expect(result).toContain('; FEATURE: Inner wall');
    expect(result).toContain('G1 F2100');
    expect(result).not.toContain('G1 F2520');
  });

  it('keeps a future fast-line tower interface behind an explicit opt-in flag', () => {
    const result = processGcodeContent(
      [
        '; nozzle_temperature = 220',
        '; LAYER_HEIGHT: 0.20',
        '; Z_HEIGHT: 0.60',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall',
        '; Z_HEIGHT: 0.80',
        '; LAYER_HEIGHT: 0.20',
        '; layer num/total_layer_count: 2/33',
        '; update layer progress'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 69
        },
        wiping: {
          supportExtrusionMultiplier: 1,
          useWipingTowers: true,
          switchTowerType: 2,
          wipeTowerPrintSpeed: 42,
          wiperX: 30,
          wiperY: 40
        },
        postProcessing: {
          futureLollipopMode: true
        },
        templates: {
          wipingGcode: [
            'G1 F9600',
            'G1 X20 Y20 E.25658'
          ]
        }
      }
    );

    expect(result).toContain('; FEATURE: Inner wall');
    expect(result).toContain('G1 F2520');
    expect(result).not.toContain('G1 F2100');
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

  it('replays the Python dry-wipe travel sequence before tower extrusion', () => {
    resetPseudoRandom();

    expect(
      buildTowerPreparationTravelGcode({
        currentLayerHeight: 0.2,
        filamentType: 'PLA',
        wiperX: 20,
        wiperY: 20
      })
    ).toEqual([
      'G1 Z0.200',
      'G1 X25.000 Y33.000',
      'G1 X35.000 Y35.000',
      'G1 X25.000 Y33.000',
      'G1 X35.000 Y35.000',
      'G1 X25.000 Y33.000',
      'G1 X35.000 Y35.000',
      'G1 X25.000 Y33.000',
      'G1 X25.000 Y25.000',
      'G1 X30.000 Y27.000'
    ]);
  });

  it('matches the Python live tower-prep wipe sequence after the one-time bootstrap pseudo-random advance', () => {
    resetPseudoRandom();
    getPseudoRandom();

    expect(
      buildTowerPreparationTravelGcode({
        currentLayerHeight: 0.4,
        filamentType: 'PLA',
        wiperX: 20,
        wiperY: 20
      })
    ).toEqual([
      'G1 Z0.400',
      'G1 X25.000 Y37.000',
      'G1 X35.000 Y35.000',
      'G1 X25.000 Y37.000',
      'G1 X35.000 Y35.000',
      'G1 X25.000 Y37.000',
      'G1 X35.000 Y35.000',
      'G1 X25.000 Y37.000',
      'G1 X25.000 Y25.000',
      'G1 X30.000 Y22.000'
    ]);
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
      'G1 X40.000 Y50.000 E0.288',
      'G92 E0',
      'G92 E0',
      'G1 F9000'
    ]);
  });

  it('builds slow-line follow-up tower layers with the Python speed cap semantics', () => {
    const result = buildWipingTowerLayerGcode({
      currentLayerHeight: 0.8,
      localLayerThickness: 0.2,
      nozzleDiameter: 0.4,
      retractLength: 0.8,
      suggestedLayerHeight: 0.13,
      switchTowerType: 1,
      towerHeight: 0.65,
      travelSpeed: 150,
      wipeTowerPrintSpeed: 42,
      wipingGcode: [
        'G1 F9600',
        'NOZZLE_HEIGHT_ADJUST',
        'EXTRUDER_REFILL',
        'G1 X20 Y20 E.25658',
        'EXTRUDER_RETRACT'
      ],
      wiperX: 30,
      wiperY: 40
    });

    expect(result).toEqual([
      'G1 F9000',
      '; FEATURE: Inner wall',
      '; LINE_WIDTH: 0.42',
      ';Extruding Ratio: 0.65',
      '; LAYER_HEIGHT: 0.13',
      'G1 F2100',
      'G1 Z0.65;Tower Z',
      'G92 E0',
      'G1 E0.8',
      'G92 E0',
      'G1 X40.000 Y50.000 E0.167',
      'G92 E0',
      'G1 E-0.49',
      'G92 E0',
      'G1 F9000',
      'G1 X53.000 Y63.000 Z1.350 ;Leaving Wiping Tower',
      '; LAYER_HEIGHT: 0.2'
    ]);
  });

  it('expands tower base and layer coordinates from the shared advanced geometry contract when the tower shell is enlarged', () => {
    const base = buildTowerBaseLayerGcode({
      firstLayerHeight: 0.28,
      firstLayerSpeed: 20,
      retractLength: 0.8,
      towerBaseLayerGcode: [
        'G1 X10 Y10 E.10000',
        'G1 X30 Y30 E.10000'
      ],
      towerGeometry: {
        coreWidth: 20,
        coreDepth: 20,
        brimWidth: 3,
        outerWallWidth: 1,
        outerWallDepth: 2,
        slantedOuterWallEnabled: true,
        slantedOuterWallWidth: 2,
        slantedOuterWallDepth: 1,
        layerWidth: 26,
        layerDepth: 26,
        baseWidth: 32,
        baseDepth: 34
      },
      travelSpeed: 150,
      wiperX: 30,
      wiperY: 40
    });

    const layer = buildWipingTowerLayerGcode({
      currentLayerHeight: 0.8,
      localLayerThickness: 0.2,
      nozzleDiameter: 0.4,
      retractLength: 0.8,
      suggestedLayerHeight: 0.13,
      switchTowerType: 1,
      towerHeight: 0.65,
      travelSpeed: 150,
      wipeTowerPrintSpeed: 42,
      wipingGcode: [
        'G1 F9600',
        'G1 X10.602 Y29.398 E.60441'
      ],
      towerGeometry: {
        coreWidth: 20,
        coreDepth: 20,
        brimWidth: 3,
        outerWallWidth: 1,
        outerWallDepth: 2,
        slantedOuterWallEnabled: true,
        slantedOuterWallWidth: 2,
        slantedOuterWallDepth: 1,
        layerWidth: 26,
        layerDepth: 26,
        baseWidth: 32,
        baseDepth: 34
      },
      wiperX: 30,
      wiperY: 40
    });

    expect(base).toContain('G1 X30.000 Y40.000 E0.112');
    expect(base).toContain('G1 X62.000 Y72.000 E0.112');
    expect(layer).toContain('G1 X30.783 Y65.217 E0.393');
  });

  it('defaults direct tower-layer generation back to slow-line speed until fast-line is explicitly enabled', () => {
    const result = buildWipingTowerLayerGcode({
      currentLayerHeight: 0.8,
      nozzleDiameter: 0.4,
      retractLength: 0.8,
      suggestedLayerHeight: 0.13,
      switchTowerType: 2,
      towerHeight: 0.65,
      travelSpeed: 150,
      wipeTowerPrintSpeed: 42,
      wipingGcode: [
        'G1 F9600',
        'G1 X20 Y20 E.25658'
      ],
      wiperX: 30,
      wiperY: 40
    });

    expect(result).toContain('G1 F2100');
    expect(result).not.toContain('G1 F2520');
  });

  it('builds fast-line follow-up tower layers only when the future lollipop flag is enabled', () => {
    const result = buildWipingTowerLayerGcode({
      currentLayerHeight: 0.8,
      nozzleDiameter: 0.4,
      retractLength: 0.8,
      suggestedLayerHeight: 0.13,
      switchTowerType: 2,
      futureLollipopMode: true,
      towerHeight: 0.65,
      travelSpeed: 150,
      wipeTowerPrintSpeed: 42,
      wipingGcode: [
        'G1 F9600',
        'G1 X20 Y20 E.25658'
      ],
      wiperX: 30,
      wiperY: 40
    });

    expect(result).toContain('G1 F2520');
    expect(result).not.toContain('G1 F2100');
  });

  it('uses the full Python tower shell defaults, including the stronger tower priming passes', () => {
    const result = buildWipingTowerLayerGcode({
      currentLayerHeight: 0.2,
      localLayerThickness: 0.2,
      nozzleDiameter: 0.4,
      retractLength: 0.8,
      towerHeight: 0.4,
      travelSpeed: 70,
      wipeTowerPrintSpeed: 200,
      wiperX: 20,
      wiperY: 20
    });

    expect(result).toContain(';Extruding Ratio: 1');
    expect(result).toContain('; LAYER_HEIGHT: 0.2');
    expect(result).toContain('G1 X30.000 Y30.000 E0.340 ;MoreExtrusion');
    expect(result).toContain('G1 X39.810 Y30.000 E0.340 ;MoreExtrusion');
    expect(result).toContain('G1 X20.602 Y39.398 E0.604');
    expect(result).toContain('G1 X39.790 Y39.730 E0.581');
    expect(result).toContain('G1 X38.700 Y39.760');
    expect(result).toContain('G1 X43.000 Y43.000 Z1.100 ;Leaving Wiping Tower');
    expect(result).not.toContain('G1 X30.000 Y30.000 Z0.800');
  });

  it('replays the full default Python-like wiping tower shell when the delayed layer-progress injection fires', () => {
    const result = processGcodeContent(
      [
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; LAYER_HEIGHT: 0.20',
        '; Z_HEIGHT: 0.20',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall',
        '; Z_HEIGHT: 0.40',
        '; LAYER_HEIGHT: 0.20',
        '; layer num/total_layer_count: 2/33',
        '; update layer progress',
        'G1 X80 Y90 F42000',
        'G1 Z0.4',
        'G1 E0.8 F1800'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 200,
          wiperX: 20,
          wiperY: 20
        }
      }
    );

    expect(result).toContain(';Prepare for next tower');
    expect(result).toContain('; FEATURE: Inner wall');
    expect(result).toContain('G1 X30.000 Y30.000 E0.340 ;MoreExtrusion');
    expect(result).toContain('G1 X20.602 Y39.398 E0.604');
    expect(result).toContain('G1 X39.790 Y39.730 E0.581');
    expect(result).toContain('G1 X38.700 Y39.760');
    expect(result).toContain(';Leaving Wiping Tower');
    expect(result).not.toContain('resume print height');
  });

  it('drops wipe and brush unmount branches in tower mode, then delays refill until after dry tower-prep travel', () => {
    resetPseudoRandom();

    const result = processGcodeContent(
      [
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; LAYER_HEIGHT: 0.20',
        '; Z_HEIGHT: 0.20',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall',
        '; Z_HEIGHT: 0.40',
        '; LAYER_HEIGHT: 0.20',
        '; layer num/total_layer_count: 2/33',
        '; update layer progress'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: [
            'M106 S[AUTO]',
            'G1 X25 Y175 F30000 ;Brush',
            'G1 X-13.5;Wipe',
            'L802',
            'G92 E0',
            'G1 E10.5 F1500',
            'G1 E30 F1500;Wipe',
            'G92 E0',
            'G1 F30000',
            'G1 X0;Wipe'
          ].join('\n'),
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 42,
          wiperX: 20,
          wiperY: 20
        },
        machine: {
          nozzleDiameter: 0.4
        }
      }
    );

    const prepareIndex = result.indexOf(';Prepare for next tower');
    const travelIndex = result.indexOf('G1 X25.000 Y33.000');
    const refillIndex = result.indexOf('G1 E10.5 F1500');
    const towerIndex = result.indexOf(';Tower_Layer_Gcode');
    const layerProgressIndex = result.indexOf('; update layer progress');

    expect(result).not.toContain(';Brush');
    expect(result).not.toContain('G1 E30 F1500;Wipe');
    expect(result).not.toContain('G1 X0;Wipe');
    expect(prepareIndex).toBeGreaterThanOrEqual(0);
    expect(travelIndex).toBeGreaterThan(prepareIndex);
    expect(refillIndex).toBeGreaterThan(travelIndex);
    expect(towerIndex).toBeGreaterThan(refillIndex);
    expect(layerProgressIndex).toBeGreaterThan(towerIndex);
  });

  it('does not leave any XY extrusion moves between tower preparation and the end of the glue block', () => {
    const result = processGcodeContent(
      [
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; LAYER_HEIGHT: 0.20',
        '; Z_HEIGHT: 0.20',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall',
        '; Z_HEIGHT: 0.40',
        '; LAYER_HEIGHT: 0.20',
        '; layer num/total_layer_count: 2/33',
        '; update layer progress'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: [
            'M106 S[AUTO]',
            'G1 X25 Y175 F30000 ;Brush',
            'G1 X-13.5;Wipe',
            'L802',
            'G92 E0',
            'G1 E10.5 F1500',
            'G1 E30 F1500;Wipe',
            'G92 E0',
            'G1 F30000',
            'G1 X0;Wipe'
          ].join('\n'),
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 42,
          wiperX: 20,
          wiperY: 20
        },
        machine: {
          nozzleDiameter: 0.4
        }
      }
    );

    const prepareIndex = result.indexOf(';Prepare for next tower');
    const layerBoundaryIndex = result.indexOf('; layer num/total_layer_count', prepareIndex);
    const towerTravelSegment = result.slice(prepareIndex, layerBoundaryIndex);

    expect(prepareIndex).toBeGreaterThanOrEqual(0);
    expect(layerBoundaryIndex).toBeGreaterThan(prepareIndex);
    expect(towerTravelSegment).not.toMatch(/G1\s+X[^\n]*\sE[^\n]*/);
    expect(towerTravelSegment).not.toMatch(/G1\s+Y[^\n]*\sE[^\n]*/);
  });

  it('matches Python by stripping expanded head_wrap_detect blocks while preserving the closing SKIPPABLE_END marker', () => {
    const result = applyPostProcessingPasses(
      [
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 0.40',
        '; LAYER_HEIGHT: 0.20',
        '; SKIPTYPE: head_wrap_detect',
        'M622.1 S1',
        'M1002 judge_flag g39_detection_flag',
        'G39.3 S1',
        '; SKIPPABLE_END',
        '; FEATURE: Outer wall',
        'G1 X10 Y10 E.200'
      ].join('\n'),
      {
        postProcessing: {
          legacyWallBufferRecovery: true
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1
        }
      }
    );

    expect(result).not.toContain('; SKIPTYPE: head_wrap_detect');
    expect(result).not.toContain('M1002 judge_flag g39_detection_flag');
    expect(result).not.toContain('G39.3 S1');
    expect((result.match(/; SKIPPABLE_END/g) || []).length).toBe(1);
    expect(result).toContain('; FEATURE: Outer wall');
  });

  it('matches Python by keeping the first recovery G3 Z move after tower replay, then removing the next one on later tower replays', () => {
    const result = processGcodeContent(
      [
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; LAYER_HEIGHT: 0.20',
        '; Z_HEIGHT: 0.20',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall',
        '; Z_HEIGHT: 0.40',
        '; LAYER_HEIGHT: 0.20',
        '; layer num/total_layer_count: 2/33',
        '; update layer progress',
        'G17',
        'G3 Z.8 I-.782 J.932 P1 F42000',
        'G1 X90 Y101.81 Z.8',
        'G1 Z.4',
        '; FEATURE: Support interface',
        'G1 X12 Y12 E.500',
        '; FEATURE: Outer wall',
        '; Z_HEIGHT: 0.60',
        '; LAYER_HEIGHT: 0.20',
        '; layer num/total_layer_count: 3/33',
        '; update layer progress',
        'G17',
        'G1 X95.754 Y107.564 Z.8',
        'G3 Z.8 I-.097 J1.213 P1 F42000',
        'G1 X78.322 Y92.631 Z.8',
        'G1 Z.4'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 42,
          wiperX: 20,
          wiperY: 20
        },
        machine: {
          nozzleDiameter: 0.4
        }
      }
    );

    expect(result).toContain(';Tower_Layer_Gcode');
    expect(result).toContain('G3 Z.8 I-.782 J.932 P1 F42000');
    expect(result).not.toContain('G3 Z.8 I-.097 J1.213 P1 F42000');
    expect(result).toContain('G1 X90 Y101.81 Z.8');
    expect(result).toContain('G1 X95.754 Y107.564 Z.8');
    expect(result).toContain('G1 X78.322 Y92.631 Z.8');
    expect(result).toContain('G1 Z.4');
  });

  it('restores AUTO fan placeholders to zero when the last raw-layer fan speed is zero', () => {
    const result = processGcodeContent(
      [
        '; printer_model = Bambu Lab A1 mini',
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; Z_HEIGHT: 0.2',
        '; LAYER_HEIGHT: 0.2',
        'M106 S255',
        '; layer num/total_layer_count: 1/33',
        'M106 S0',
        'G1 X78.322 Y92.631 F42000',
        '; FEATURE: Support interface',
        'G1 X81.369 Y92.631 E.09363',
        '; FEATURE: Outer wall',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 0.4',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'G1 E-10 F1800\nL801',
          customUnmountGcode: ';CustomRetract\nM106 S[AUTO]\nM401',
          offset: { x: -0.3, y: 18.1, z: 3.8 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 42,
          wiperX: 20,
          wiperY: 20
        }
      }
    );

    expect(result).toContain(';CustomRetract\nM106 S0\nM401');
    expect(result).not.toContain(';CustomRetract\nM106 S255\nM401');
  });

  it('replays the Python-style waiting, lift and in-position moves before support glueing', () => {
    const result = processGcodeContent(
      [
        '; printer_model = Bambu Lab A1 mini',
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; Z_HEIGHT: 0.2',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 1/33',
        'M106 S0',
        'G1 X78.322 Y92.631 F42000',
        '; FEATURE: Support interface',
        'G1 X81.369 Y92.631 E.09363',
        'G1 X81.369 Y91.754 E.02695',
        '; FEATURE: Outer wall',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 0.4',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: [
            ';CustomLock',
            ';A1M',
            'G92 E0',
            'G1 E-10 F1800',
            'G92 E0',
            'L801',
            'M204 S10000',
            'G1 X168 F42000',
            'G1 X175 F10000',
            'G1 X185 F10000',
            'G1 X168 F42000',
            'G1 F30000'
          ].join('\n'),
          customUnmountGcode: ';CustomRetract\nM106 S[AUTO]\nM401',
          offset: { x: -0.3, y: 18.1, z: 3.8 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 42,
          wiperX: 20,
          wiperY: 20
        }
      }
    );

    expect(result).toContain('G1 X160.000 Z1.400 E-10.0 F42000');
    expect(result).toContain('G1 Z10.200');
    expect(result).toContain('G1 Z8.200;L801');
    expect(result).not.toContain('\nL801\n');
    expect(result).toContain('G1 Z7.000');
    expect(result).toContain('G1 X78.022 Y110.731');
    expect(result).toContain('G1 Z4.000');
  });

  it('adds the Python-style glue-finish lift and first-pass settling wait before unmounting', () => {
    const result = processGcodeContent(
      [
        '; printer_model = Bambu Lab A1 mini',
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; Z_HEIGHT: 0.2',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 1/33',
        'M106 S0',
        'G1 X78.322 Y92.631 F42000',
        '; FEATURE: Support interface',
        'G1 X81.369 Y92.631 E.09363',
        'G1 X81.369 Y91.754 E.02695',
        '; FEATURE: Outer wall',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 0.4',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: [
            ';CustomLock',
            ';A1M',
            'G92 E0',
            'G1 E-10 F1800',
            'G92 E0',
            'L801',
            'M204 S10000',
            'G1 X168 F42000',
            'G1 X175 F10000',
            'G1 X185 F10000',
            'G1 X168 F42000',
            'G1 F30000'
          ].join('\n'),
          customUnmountGcode: ';CustomRetract\nM106 S[AUTO]\nM401',
          offset: { x: -0.3, y: 18.1, z: 3.8 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 42,
          wiperX: 20,
          wiperY: 20
        }
      }
    );

    expect(result).toContain(';Glueing Finished');
    expect(result).toContain('G1 F42000\nG1 Z7.200\n;Lift-z:7.200');
    expect(result).toContain(';Waiting for Glue Settling\nG4 P6000');
    expect(result).toContain(';Unmounting Toolhead\n;CustomRetract');
  });

  it('locks the in-position move to the last pre-support travel even if later travel appears before the layer boundary', () => {
    const result = processGcodeContent(
      [
        '; printer_model = Bambu Lab A1 mini',
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; Z_HEIGHT: 0.2',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 1/33',
        'M106 S0',
        'G1 X78.322 Y92.631 F42000',
        '; FEATURE: Support interface',
        'G1 X81.369 Y92.631 E.09363',
        'G1 X81.369 Y91.754 E.02695',
        '; FEATURE: Outer wall',
        'G1 X100 Y100 F42000',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 0.4',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: [
            ';CustomLock',
            ';A1M',
            'G92 E0',
            'G1 E-10 F1800',
            'G92 E0',
            'L801',
            'M204 S10000',
            'G1 X168 F42000',
            'G1 X175 F10000',
            'G1 X185 F10000',
            'G1 X168 F42000',
            'G1 F30000'
          ].join('\n'),
          customUnmountGcode: ';CustomRetract\nM106 S[AUTO]\nM401',
          offset: { x: -0.3, y: 18.1, z: 3.8 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 42,
          wiperX: 20,
          wiperY: 20
        }
      }
    );

    const hoverIndex = result.indexOf('G1 Z7.000');
    const glueStartIndex = result.indexOf(';Glueing Started');
    const inPositionIndex = result.indexOf(';Inposition');
    const feedIndex = result.indexOf('G1 F42000', inPositionIndex);
    const lockedTravelIndex = result.indexOf('G1 X78.022 Y110.731');

    expect(hoverIndex).toBeGreaterThanOrEqual(0);
    expect(glueStartIndex).toBeGreaterThan(hoverIndex);
    expect(inPositionIndex).toBeGreaterThan(glueStartIndex);
    expect(feedIndex).toBeGreaterThan(inPositionIndex);
    expect(lockedTravelIndex).toBeGreaterThan(feedIndex);
    expect(result).not.toContain('G1 X99.700 Y118.100');
  });

  it('does not replay trailing slicer travel moves from a support interface as glue motion', () => {
    const result = processGcodeContent(
      [
        '; printer_model = Bambu Lab A1 mini',
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; Z_HEIGHT: 2.6',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 1/33',
        'G1 X78.322 Y92.631 F42000',
        '; FEATURE: Support interface',
        'G1 X84.246 Y82.983 E.02695',
        'G1 X92.877 Y82.983 E.26523',
        'G1 X90.689 Y84.623 F42000',
        'M106 S255',
        '; FEATURE: Support transition',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 2.8',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: -0.3, y: 18.1, z: 3.8 },
          speedLimit: 70
        },
        wiping: {
          useWipingTowers: false,
          haveWipingComponents: false,
          supportExtrusionMultiplier: 1
        }
      }
    );

    expect(result).toContain('G1 X83.946 Y101.083');
    expect(result).toContain('G1 X92.577 Y101.083');
    expect(result).not.toContain('G1 X90.389 Y102.723');
  });

  it('preserves internal travel bridges when a support interface continues extruding afterward', () => {
    const result = processGcodeContent(
      [
        '; printer_model = Bambu Lab A1 mini',
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; Z_HEIGHT: 2.6',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 1/33',
        'G1 X78.322 Y92.631 F42000',
        '; FEATURE: Support interface',
        'G1 X80.352 Y87.123 E.03175',
        'G1 X81.229 Y87.123 E.02695',
        'G1 X81.229 Y93.047 E.18203',
        'G1 X80.352 Y93.047 F42000',
        'G1 X80.352 Y90.777 E.06974',
        'G1 X79.475 Y92.877 E.04743',
        '; FEATURE: Outer wall',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 2.8',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: -0.3, y: 18.1, z: 3.8 },
          speedLimit: 70
        },
        wiping: {
          useWipingTowers: false,
          haveWipingComponents: false,
          supportExtrusionMultiplier: 1
        }
      }
    );

    expect(result).toContain('G1 X80.929 Y111.147');
    expect(result).toContain('G1 X80.052 Y111.147');
    expect(result).toContain('G1 X80.052 Y108.877');
  });

  it('keeps terminal wipe-path XY moves that come from support-interface negative extrusion lines', () => {
    const result = processGcodeContent(
      [
        '; printer_model = Bambu Lab A1 mini',
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; Z_HEIGHT: 1.6',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 1/33',
        'G1 X78.322 Y92.631 F42000',
        '; FEATURE: Support interface',
        'G1 X82.106 Y91.181 E.05734',
        'G1 X82.983 Y90.789 E.02953',
        'G1 X82.983 Y93.047 E.06939',
        '; WIPE_START',
        'G1 X82.983 Y91.047 E-.76',
        '; WIPE_END',
        'G1 E-.04 F1800',
        'G1 X82.106 Y86.953 E.05000',
        '; FEATURE: Outer wall',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 1.8',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: -0.3, y: 18.1, z: 3.8 },
          speedLimit: 70
        },
        wiping: {
          useWipingTowers: false,
          haveWipingComponents: false,
          supportExtrusionMultiplier: 1
        }
      }
    );

    expect(result).toContain('G1 X82.683 Y109.147');
  });

  it('uses Python-style travel speed and last-layer glue height when a support segment jumps between islands', () => {
    const result = processGcodeContent(
      [
        '; printer_model = Bambu Lab A1 mini',
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; Z_HEIGHT: 0.8',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 1/33',
        'M106 S0',
        'G1 X78.598 Y87.123 F42000',
        '; FEATURE: Support interface',
        'G1 X80.052 Y105.223 E.05000',
        'G1 X83.561 Y111.147 E.05000',
        ';ZJUMP_START',
        'G1 X78.598 Y91.984 Z1.0 E.05000',
        'G1 Z0.8',
        'G1 X80.929 Y108.790 E.05000',
        '; FEATURE: Outer wall',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 1.0',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 2/33'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: -0.3, y: 18.1, z: 3.8 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 42,
          wiperX: 20,
          wiperY: 20
        }
      }
    );

    expect(result).toContain('G1 F42000\nG1 Z7.800 ; avoid spoiling before the next interface segment');
    expect(result).toContain('G1 X78.298 Y110.084 Z7.800 ; jump to the next interface segment\nG1 Z4.600 ; resume glue height\nG1 F4200');
    expect(result).toContain('G1 X78.298 Y110.084 Z4.800\nG1 Z4.600');
    expect(result).not.toContain('G1 Z4.800 ; resume glue height');
  });

  it('keeps the original slicer recovery travel after leaving the delayed wiping tower', () => {
    const result = processGcodeContent(
      [
        '; initial_layer_print_height = 0.2',
        '; retraction_length = 0.8',
        '; travel_speed = 70',
        '; LAYER_HEIGHT: 0.20',
        '; Z_HEIGHT: 0.20',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall',
        '; Z_HEIGHT: 0.40',
        '; LAYER_HEIGHT: 0.20',
        '; layer num/total_layer_count: 2/33',
        '; update layer progress',
        'G1 X88 Y99 F42000',
        'G1 Z0.4',
        'G1 E0.8 F1800',
        '; FEATURE: Support interface'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 200,
          wiperX: 20,
          wiperY: 20
        }
      }
    );

    const leavingTowerIndex = result.indexOf(';Leaving Wiping Tower');
    const updateLayerProgressIndex = result.indexOf('; update layer progress');
    const recoveryTravelIndex = result.indexOf('G1 X88 Y99 F42000');
    const recoveryPrimeIndex = result.indexOf('G1 E0.8 F1800');

    expect(leavingTowerIndex).toBeGreaterThanOrEqual(0);
    expect(updateLayerProgressIndex).toBeGreaterThan(leavingTowerIndex);
    expect(recoveryTravelIndex).toBeGreaterThan(updateLayerProgressIndex);
    expect(recoveryPrimeIndex).toBeGreaterThan(recoveryTravelIndex);
  });

  it('injects the first wiping-tower base layer before the first change-layer marker', () => {
    const result = processGcodeContent(
      [
        '; initial_layer_print_height = 0.2',
        '; initial_layer_speed = 50',
        '; retraction_length = 0.8',
        '; travel_speed = 700',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 0.2',
        '; LAYER_HEIGHT: 0.2',
        '; layer num/total_layer_count: 1/33',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall'
      ].join('\n'),
      {
        toolhead: {
          customMountGcode: 'M400',
          customUnmountGcode: 'M401',
          offset: { x: 0, y: 0, z: 0.3 },
          speedLimit: 70
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1,
          switchTowerType: 1,
          wipeTowerPrintSpeed: 200,
          wiperX: 20,
          wiperY: 20
        }
      }
    );

    const baseStart = result.indexOf('G1 X29.681 Y30.319');
    const firstChangeLayer = result.indexOf('; CHANGE_LAYER');

    expect(baseStart).toBeGreaterThanOrEqual(0);
    expect(firstChangeLayer).toBeGreaterThan(baseStart);
    expect(result).toContain('G1 Z0.200;Tower Z');
    expect(result).toContain('G1 F3000');
    expect(result).toContain('G1 X21.762 Y21.762');
  });

  it('replays the old delayed-wall behavior by moving a wall block behind internal solid infill after a support-interface layer', () => {
    const result = applyPostProcessingPasses(
      [
        '; initial_layer_print_height = 0.2',
        '; travel_speed = 700',
        '; Z_HEIGHT: 0.4',
        '; LAYER_HEIGHT: 0.2',
        '; FEATURE: Support interface',
        'G1 X10 Y10 E.500',
        '; FEATURE: Outer wall',
        'G1 X11 Y11 E.200',
        '; WIPE_START',
        'G1 X10 Y10 E-.76',
        '; WIPE_END',
        'G1 E-.04 F1800',
        'M204 S10000',
        'G17',
        'G3 Z.8 I-.116 J-1.211 P1  F42000',
        'G1 X77.405 Y88.96 Z.8',
        'G1 Z.4',
        'G1 E.8 F1800',
        '; FEATURE: Inner wall',
        'G1 X77.722 Y89.113 E.01167',
        '; FEATURE: Outer wall',
        'G1 X77.214 Y88.432 E.0067',
        '; WIPE_START',
        'G1 X77.214 Y88.432 E-.07698',
        '; WIPE_END',
        'G1 E-.04 F1800',
        'G1 X78.395 Y89.937 F42000',
        'G1 Z.4',
        'G1 E.8 F1800',
        '; FEATURE: Internal solid infill',
        'G1 X77.806 Y89.617 E.02162',
        '; CHANGE_LAYER',
        '; Z_HEIGHT: 0.6',
        '; LAYER_HEIGHT: 0.2',
        '; WIPE_START',
        'G1 X77.807 Y90.303 E-.24192',
        '; WIPE_END',
        'G1 E-.04 F1800',
        '; layer num/total_layer_count: 3/33'
      ].join('\n'),
      {
        postProcessing: {
          legacyWallBufferRecovery: true
        },
        wiping: {
          haveWipingComponents: true,
          supportExtrusionMultiplier: 1
        }
      }
    );

    const wallsAheadIndex = result.indexOf(';Walls Ahead!');
    const differentExtrusionIndex = result.indexOf(';Different Extrusion!');
    const internalSolidIndex = result.indexOf('; FEATURE: Internal solid infill');
    const wallsReleasedIndex = result.indexOf(';Walls Released');
    const delayedWallTravelIndex = result.indexOf('G1 X77.405 Y88.96 Z.8');
    const layerBoundaryIndex = result.indexOf('; layer num/total_layer_count: 3/33');

    expect(wallsAheadIndex).toBeGreaterThanOrEqual(0);
    expect(differentExtrusionIndex).toBeGreaterThan(wallsAheadIndex);
    expect(internalSolidIndex).toBeGreaterThan(differentExtrusionIndex);
    expect(wallsReleasedIndex).toBeGreaterThan(internalSolidIndex);
    expect(delayedWallTravelIndex).toBeGreaterThan(wallsReleasedIndex);
    expect(layerBoundaryIndex).toBeGreaterThan(delayedWallTravelIndex);
    expect(result).toContain('G1 F42000.0;Wall Move Command');

    const prefixBeforeInternal = result.slice(0, internalSolidIndex);
    expect(prefixBeforeInternal).not.toContain('G1 X77.405 Y88.96 Z.8');
  });
});
