import { describe, expect, it } from 'vitest';

const {
  applyPostProcessingPasses,
  buildPostprocessTraceExport,
  buildTowerBaseLayerGcode,
  buildWipingTowerLayerGcode,
  deleteWipe,
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
      wipeTowerPrintSpeed: 42
    });

    expect(config.templates.wipingGcode.length).toBeGreaterThan(0);
    expect(config.templates.towerBaseLayerGcode.length).toBeGreaterThan(0);
    expect(config.postProcessing).toEqual({
      ironExtrudeRatio: 0.85,
      ironingPathOffsetMm: -0.15,
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

  it.fails('aggregates multiple support-interface feature blocks from the same layer into a single glue cycle', () => {
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

    expect((result.match(/^; ===== MKP Support Electron Glueing Start =====$/gm) || []).length).toBe(1);
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

    expect(result).toContain('; ===== MKP Support Electron Glueing Start =====');
    expect(result).toContain('G1 X1.900 Y12.000');
    expect(result).toContain('; ===== MKP Support Electron Glueing End =====');
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
    expect(result).toContain('G1 Z3.900 ; avoid spoiling before the next interface segment');
    expect(result).toContain('G1 X15.000 Y16.000 ; jump to the next interface segment');
    expect(result).toContain('G1 Z0.900 ; resume glue height');
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

    expect(result.outputGcode).toContain('; ===== MKP Support Electron Glueing Start =====');
    expect(result.report.summary.injectedSegments).toBe(1);
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
    expect(exportText).toContain('Support interface');
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

    expect(result).toContain('G1 X45.000 Y45.190');
    expect(result).toContain(';Prepare for next tower');
    expect(result).toContain('M109 S220');
    expect(result).toContain('; FEATURE: Inner wall');
    expect(result).toContain('G1 F2100');
    expect(result).toContain(';Leaving Wiping Tower');
  });

  it('uses full configured tower speed in post-glue recovery when fast-line lollipop mode is enabled', () => {
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
      'G1 X45.000 Y55.000 E0.167',
      'G92 E0',
      'G1 E-0.49',
      'G92 E0',
      'G1 F9000',
      'G1 X58.000 Y68.000 Z1.350 ;Leaving Wiping Tower',
      '; LAYER_HEIGHT: 0.2'
    ]);
  });

  it('builds fast-line follow-up tower layers without the slow-line speed cap', () => {
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

    expect(result).toContain('G1 F2520');
    expect(result).not.toContain('G1 F2100');
  });

  it('uses the current layer thickness and full Python tower shell template by default', () => {
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
    expect(result).toContain('G1 X25.602 Y44.398 E0.604');
    expect(result).toContain('G1 X44.790 Y44.730 E0.581');
    expect(result).toContain('G1 X43.700 Y44.760');
    expect(result).toContain('G1 X48.000 Y48.000 Z1.100 ;Leaving Wiping Tower');
    expect(result).not.toContain('G1 X35.000 Y35.000 Z0.800');
  });

  it('replays the full default Python-like wiping tower shell in the integrated recovery flow', () => {
    const result = processGcodeContent(
      [
        '; LAYER_HEIGHT: 0.20',
        '; Z_HEIGHT: 0.20',
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

    expect(result).toContain(';Prepare for next tower');
    expect(result).toContain('; FEATURE: Inner wall');
    expect(result).toContain('G1 X25.602 Y44.398 E0.604');
    expect(result).toContain('G1 X44.790 Y44.730 E0.581');
    expect(result).toContain('G1 X43.700 Y44.760');
    expect(result).not.toContain('G1 X35.000 Y35.000 Z0.800');
  });
});
