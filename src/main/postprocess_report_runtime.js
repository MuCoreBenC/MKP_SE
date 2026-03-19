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
  } catch (error) {}

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
    } catch (error) {}
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

function launchDetachedPostprocessReportViewer(app, reportPath) {
  const child = spawn(
    process.execPath,
    buildAppLaunchArgs(app, ['--postprocess-report', '--Report', reportPath]),
    {
      detached: true,
      stdio: 'ignore'
    }
  );

  child.unref();
}

function createPendingPostprocessReportState(meta = {}) {
  return {
    status: 'running',
    startedAt: new Date().toISOString(),
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
      autoCloseSeconds: 10
    }
  };
}

function createFailedPostprocessReportState(meta = {}, error) {
  const message = error && error.message ? error.message : String(error || 'Unknown error');
  return {
    status: 'failed',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
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
      autoCloseSeconds: 0
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
