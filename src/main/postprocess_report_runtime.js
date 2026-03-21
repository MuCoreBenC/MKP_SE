const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function getArgValue(argv = [], flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] || null : null;
}

function buildAppLaunchArgs(app, extraArgs = []) {
  return process.defaultApp ? [app.getAppPath(), ...extraArgs] : extraArgs;
}

function sanitizeBaseName(filePath) {
  return String(path.basename(filePath || 'part'))
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

function createPostprocessReportFilePath(gcodePath) {
  const baseName = sanitizeBaseName(gcodePath).replace(/\.gcode$/i, '') || 'part';
  return path.join(
    os.tmpdir(),
    `mkp_postprocess_report_${Date.now()}_${process.pid}_${baseName}.json`
  );
}

function resolvePostprocessOutputPath(gcodePath) {
  return String(gcodePath || '').trim();
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectLegacyPostprocessArtifactPaths(gcodePath, options = {}) {
  const normalizedPath = String(gcodePath || '').trim();
  if (!normalizedPath) {
    return [];
  }

  const tempDir = options.tempDir || os.tmpdir();
  const paths = new Set();
  const addPath = (candidatePath) => {
    const nextPath = String(candidatePath || '').trim();
    if (!nextPath || nextPath === normalizedPath) {
      return;
    }

    paths.add(nextPath);
  };

  if (/\.gcode$/i.test(normalizedPath)) {
    addPath(normalizedPath.replace(/\.gcode$/i, '_processed.gcode'));
    addPath(`${normalizedPath}_processed.gcode`);
    addPath(`${normalizedPath}_Output.gcode`);
    addPath(normalizedPath.replace(/\.gcode$/i, '_Output.gcode'));
  } else {
    addPath(`${normalizedPath}_processed.gcode`);
    addPath(`${normalizedPath}_Output.gcode`);
  }

  const baseName = sanitizeBaseName(normalizedPath).replace(/\.gcode$/i, '') || 'part';
  const reportPattern = new RegExp(`^mkp_postprocess_report_.*_${escapeRegExp(baseName)}\\.json$`, 'i');

  try {
    if (fs.existsSync(tempDir)) {
      fs.readdirSync(tempDir).forEach((entryName) => {
        if (reportPattern.test(entryName)) {
          addPath(path.join(tempDir, entryName));
        }
      });
    }
  } catch (error) {
    console.warn('[PostprocessReport] Failed to scan temp directory for legacy artifacts:', tempDir, error.message);
  }

  return Array.from(paths);
}

function cleanupLegacyPostprocessArtifacts(gcodePath, options = {}) {
  const preserve = new Set(
    (options.preservePaths || []).map((item) => String(item || '').trim()).filter(Boolean)
  );

  const removedPaths = [];
  collectLegacyPostprocessArtifactPaths(gcodePath, options).forEach((artifactPath) => {
    if (preserve.has(artifactPath)) {
      return;
    }

    try {
      if (fs.existsSync(artifactPath)) {
        fs.unlinkSync(artifactPath);
        removedPaths.push(artifactPath);
      }
    } catch (error) {
      console.warn('[PostprocessReport] Failed to remove legacy artifact:', artifactPath, error.message);
    }
  });

  return removedPaths;
}

function writePostprocessReportState(reportPath, state) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(state, null, 2), 'utf8');
  return reportPath;
}

function readPostprocessReportState(reportPath) {
  if (!reportPath || !fs.existsSync(reportPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

function launchDetachedPostprocessReportViewer(app, reportPath, options = {}) {
  const extraArgs = ['--postprocess-report', '--Report', reportPath];
  const uiVariant = String(options.uiVariant || '').trim();
  if (uiVariant) {
    extraArgs.push('--postprocess-report-ui', uiVariant);
  }

  const child = spawn(
    process.execPath,
    buildAppLaunchArgs(app, extraArgs),
    {
      detached: true,
      stdio: 'ignore'
    }
  );

  child.unref();
}

function createPendingPostprocessReportState(meta = {}) {
  const startedAt = new Date().toISOString();
  return {
    status: 'running',
    startedAt,
    finishedAt: null,
    durationMs: 0,
    inputPath: meta.inputPath || null,
    outputPath: meta.outputPath || null,
    configPath: meta.configPath || null,
    configFormat: meta.configFormat || null,
    runtime: meta.runtime || null,
    summary: {
      totalInputLines: 0,
      totalOutputLines: 0,
      supportInterfaceCandidates: 0,
      supportSurfaceIroningCandidates: 0,
      ignoredTopSurfaceIroningSegments: 0,
      skippedInvalidSegments: 0,
      skippedExcessiveIroningSegments: 0,
      injectedSegments: 0
    },
    progress: {
      percent: 12,
      phase: 'launching',
      label: '显示后处理窗口',
      detail: '正在显示执行窗口并加载正式报告界面。',
      currentStepTitle: '准备进入实时报告',
      updatedAt: startedAt
    },
    steps: [
      {
        kind: 'status',
        title: '等待后处理结果',
        human: '后处理已经启动，正在扫描 G-code、寻找支撑面和熨烫路径。',
        technical: 'Viewer launched before process completion; waiting for final report snapshot.',
        data: {
          inputPath: meta.inputPath || null,
          configPath: meta.configPath || null
        }
      }
    ],
    ui: {
      autoCloseSeconds: 10,
      minimumProgressDurationMs: 1000
    }
  };
}

function createFailedPostprocessReportState(meta = {}, error) {
  const message = error && error.message ? error.message : String(error || 'Unknown error');
  const finishedAt = new Date().toISOString();
  return {
    status: 'failed',
    startedAt: finishedAt,
    finishedAt,
    durationMs: 0,
    inputPath: meta.inputPath || null,
    outputPath: meta.outputPath || null,
    configPath: meta.configPath || null,
    configFormat: meta.configFormat || null,
    runtime: meta.runtime || null,
    summary: {
      totalInputLines: 0,
      totalOutputLines: 0,
      supportInterfaceCandidates: 0,
      supportSurfaceIroningCandidates: 0,
      ignoredTopSurfaceIroningSegments: 0,
      skippedInvalidSegments: 0,
      skippedExcessiveIroningSegments: 0,
      injectedSegments: 0
    },
    progress: {
      percent: 100,
      phase: 'failed',
      label: '后处理失败',
      detail: '执行过程中出现错误，请展开查看详细步骤。',
      currentStepTitle: '后处理失败',
      updatedAt: finishedAt
    },
    steps: [
      {
        kind: 'error',
        title: '后处理失败',
        human: '本次后处理没有完成，请查看技术细节中的错误信息。',
        technical: `CLI error: ${message}`,
        data: {
          message
        }
      }
    ],
    ui: {
      autoCloseSeconds: 0,
      minimumProgressDurationMs: 1000
    }
  };
}

module.exports = {
  cleanupLegacyPostprocessArtifacts,
  collectLegacyPostprocessArtifactPaths,
  createFailedPostprocessReportState,
  createPendingPostprocessReportState,
  createPostprocessReportFilePath,
  getArgValue,
  launchDetachedPostprocessReportViewer,
  readPostprocessReportState,
  resolvePostprocessOutputPath,
  writePostprocessReportState
};
