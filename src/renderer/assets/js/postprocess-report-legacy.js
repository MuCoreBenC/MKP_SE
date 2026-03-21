(function () {
  const POLL_MS = 160;
  const DEFAULT_MIN_VISUAL_PROGRESS_MS = 1000;
  let reportState = null;
  let reportFingerprint = '';
  let expanded = false;
  let viewMode = 'human';
  let pollTimer = null;
  let countdownTimer = null;
  let countdownRemaining = 0;
  let visualProgress = 0;
  let visualProgressFrame = 0;

  const refs = {
    statusBadge: document.getElementById('statusBadge'),
    reportWindowTitle: document.getElementById('reportWindowTitle'),
    summaryTitle: document.getElementById('summaryTitle'),
    summaryText: document.getElementById('summaryText'),
    countdownText: document.getElementById('countdownText'),
    progressPanel: document.getElementById('progressPanel'),
    progressLabel: document.getElementById('progressLabel'),
    progressDetail: document.getElementById('progressDetail'),
    progressFill: document.getElementById('progressFill'),
    progressPercent: document.getElementById('progressPercent'),
    progressStepText: document.getElementById('progressStepText'),
    progressStages: Array.from(document.querySelectorAll('.progress-stage')),
    metricInjected: document.getElementById('metricInjected'),
    metricScan: document.getElementById('metricScan'),
    metricScanSub: document.getElementById('metricScanSub'),
    metricDuration: document.getElementById('metricDuration'),
    metricOutput: document.getElementById('metricOutput'),
    metricOutputSub: document.getElementById('metricOutputSub'),
    detailPanel: document.getElementById('detailPanel'),
    pathSummary: document.getElementById('pathSummary'),
    summaryCode: document.getElementById('summaryCode'),
    stepsContainer: document.getElementById('stepsContainer'),
    viewToggleButton: document.getElementById('viewToggleButton'),
    closeButton: document.getElementById('closeButton'),
    humanViewButton: document.getElementById('humanViewButton'),
    technicalViewButton: document.getElementById('technicalViewButton'),
    exportTraceButton: document.getElementById('exportTraceButton'),
    exportGcodeButton: document.getElementById('exportGcodeButton')
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clampPercent(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return Math.max(0, Math.min(100, Number(fallback) || 0));
    }

    return Math.max(0, Math.min(100, numeric));
  }

  function formatSeconds(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return '--';
    }

    return (durationMs / 1000).toFixed(durationMs >= 10000 ? 1 : 2);
  }

  function formatPathForCard(filePath) {
    if (!filePath) {
      return '待生成';
    }

    const normalized = String(filePath).replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || normalized;
  }

  function getVisualMinimumDurationMs(state) {
    const rawValue = Number(state?.ui?.minimumProgressDurationMs || DEFAULT_MIN_VISUAL_PROGRESS_MS);
    return Number.isFinite(rawValue) && rawValue > 0
      ? rawValue
      : DEFAULT_MIN_VISUAL_PROGRESS_MS;
  }

  function getLatestStep(state) {
    const steps = Array.isArray(state?.steps) ? state.steps : [];
    return steps.length > 0 ? steps[steps.length - 1] : null;
  }

  function buildReportFingerprint(state) {
    return JSON.stringify({
      status: state?.status || 'unknown',
      finishedAt: state?.finishedAt || null,
      durationMs: state?.durationMs || 0,
      steps: state?.steps?.length || 0,
      progressPercent: state?.progress?.percent ?? null,
      progressLabel: state?.progress?.label || '',
      progressDetail: state?.progress?.detail || '',
      progressCurrentStepTitle: state?.progress?.currentStepTitle || '',
      progressUpdatedAt: state?.progress?.updatedAt || '',
      injectedSegments: state?.summary?.injectedSegments || 0,
      skippedExcessiveIroningSegments: state?.summary?.skippedExcessiveIroningSegments || 0,
      ignoredTopSurfaceIroningSegments: state?.summary?.ignoredTopSurfaceIroningSegments || 0
    });
  }

  function setFeedback(text, kind = '') {
    refs.countdownText.textContent = text;
    refs.countdownText.className = 'feedback';
    if (kind) {
      refs.countdownText.classList.add(kind === 'success' ? 'is-success' : 'is-error');
    }
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    countdownRemaining = 0;
  }

  function stopVisualProgressLoop() {
    if (visualProgressFrame) {
      cancelAnimationFrame(visualProgressFrame);
      visualProgressFrame = 0;
    }
  }

  async function closeWindow() {
    if (window.mkpAPI?.closePostprocessReportWindow) {
      await window.mkpAPI.closePostprocessReportWindow();
    } else {
      window.close();
    }
  }

  function startAutoClose(seconds) {
    if (expanded || !Number.isFinite(seconds) || seconds <= 0) {
      return;
    }

    stopCountdown();
    countdownRemaining = seconds;
    setFeedback(`摘要模式下，窗口将在 ${countdownRemaining} 秒后自动关闭。`);

    countdownTimer = window.setInterval(async () => {
      countdownRemaining -= 1;
      if (countdownRemaining <= 0) {
        stopCountdown();
        await closeWindow();
        return;
      }

      setFeedback(`摘要模式下，窗口将在 ${countdownRemaining} 秒后自动关闭。`);
    }, 1000);
  }

  function buildSummaryCode(state) {
    const summary = state?.summary || {};
    return [
      `supportInterfaceCandidates=${summary.supportInterfaceCandidates || 0}`,
      `supportSurfaceIroningCandidates=${summary.supportSurfaceIroningCandidates || 0}`,
      `ignoredTopSurfaceIroningSegments=${summary.ignoredTopSurfaceIroningSegments || 0}`,
      `skippedInvalidSegments=${summary.skippedInvalidSegments || 0}`,
      `skippedExcessiveIroningSegments=${summary.skippedExcessiveIroningSegments || 0}`,
      `injectedSegments=${summary.injectedSegments || 0}`
    ].join('\n');
  }

  function getStatusText(status) {
    if (status === 'completed') return '已完成';
    if (status === 'failed') return '失败';
    return '运行中';
  }

  function getScanSummaryText(state) {
    const summary = state?.summary || {};

    if (state?.status === 'running') {
      return state?.progress?.label || '处理中';
    }

    if (state?.status === 'failed') {
      return '处理失败';
    }

    return [
      `${summary.supportInterfaceCandidates || 0} 支撑段`,
      `${summary.supportSurfaceIroningCandidates || 0} 熨烫段`,
      `${summary.ignoredTopSurfaceIroningSegments || 0} 已忽略`
    ].join(' / ');
  }

  function getSummaryTitle(state) {
    if (state?.status === 'completed') {
      return '后处理已完成，可以查看完整执行过程';
    }

    if (state?.status === 'failed') {
      return '后处理失败，请查看详细步骤';
    }

    return state?.progress?.label || '正在执行后处理';
  }

  function getSummaryText(state) {
    if (state?.status === 'completed') {
      return '窗口会保持当前摘要视图；如需查看完整过程，可展开切换到普通步骤或代码步骤，也可以直接导出轨迹或处理后的 G-code。';
    }

    if (state?.status === 'failed') {
      return '失败状态下不会自动关闭，方便直接定位出错步骤和技术细节。';
    }

    return state?.progress?.detail || '正在执行后处理，请稍候。';
  }

  function renderSteps(state) {
    const steps = Array.isArray(state?.steps) ? state.steps : [];
    if (steps.length === 0) {
      refs.stepsContainer.innerHTML = '<div class="step-card"><div class="step-body">暂时还没有可展示的步骤。</div></div>';
      return;
    }

    refs.stepsContainer.innerHTML = steps.map((step, index) => {
      const body = viewMode === 'human'
        ? `<div class="step-body">${escapeHtml(step.human || '暂无普通说明。')}</div>`
        : `<div class="step-technical"><pre>${escapeHtml(step.technical || '暂无技术细节。')}</pre></div>`;
      const dataBlock = viewMode === 'technical' && step.data
        ? `<div class="step-data"><pre>${escapeHtml(JSON.stringify(step.data, null, 2))}</pre></div>`
        : '';

      return `
        <article class="step-card">
          <div class="step-card-header">
            <div style="display:flex;gap:12px;min-width:0;flex:1;">
              <div class="step-index">${index + 1}</div>
              <div style="min-width:0;">
                <h2 class="step-title">${escapeHtml(step.title || '未命名步骤')}</h2>
              </div>
            </div>
            <div class="step-kind">${escapeHtml(step.kind || 'info')}</div>
          </div>
          ${body}
          ${dataBlock}
        </article>
      `;
    }).join('');
  }

  async function setExpanded(nextExpanded) {
    expanded = nextExpanded;
    refs.detailPanel.classList.toggle('is-visible', expanded);
    refs.viewToggleButton.textContent = expanded ? '收起详情' : '查看详情';

    if (window.mkpAPI?.setPostprocessReportExpanded) {
      await window.mkpAPI.setPostprocessReportExpanded(expanded);
    }

    if (expanded) {
      stopCountdown();
      setFeedback('详情已展开，窗口不会自动关闭。');
    } else if (reportState?.status === 'completed') {
      setFeedback('已回到摘要视图，若不再次展开，窗口会按规则自动关闭。');
    }
  }

  function getDesiredProgress(state) {
    if (!state) {
      return 0;
    }

    const actualPercent = clampPercent(
      state?.progress?.percent,
      state?.status === 'completed' || state?.status === 'failed' ? 100 : 0
    );

    if (state?.status === 'completed' || state?.status === 'failed') {
      const startedAtMs = Date.parse(state.startedAt || '');
      const minimumDurationMs = getVisualMinimumDurationMs(state);
      if (Number.isFinite(startedAtMs) && minimumDurationMs > 0) {
        const holdUntilMs = startedAtMs + minimumDurationMs;
        if (Date.now() < holdUntilMs) {
          const syntheticPercent = clampPercent(
            ((Date.now() - startedAtMs) / minimumDurationMs) * 100,
            actualPercent
          );
          return Math.max(
            Math.min(99, syntheticPercent),
            Math.min(99, visualProgress)
          );
        }
      }

      return 100;
    }

    return actualPercent;
  }

  function renderVisualProgress() {
    const safeProgress = clampPercent(visualProgress, 0);
    refs.progressFill.style.width = `${safeProgress.toFixed(2)}%`;
    refs.progressPercent.textContent = `${Math.round(safeProgress)}%`;
    renderLifecycleStages(safeProgress);
  }

  function renderLifecycleStages(displayPercent) {
    if (!Array.isArray(refs.progressStages) || refs.progressStages.length === 0) {
      return;
    }

    const safeProgress = clampPercent(displayPercent, 0);
    const status = reportState?.status || 'running';
    const isFailed = status === 'failed';

    refs.progressStages.forEach((stage, index) => {
      const rawStart = Number(stage.dataset.stageStart);
      const rawEnd = Number(stage.dataset.stageEnd);
      const stageStart = Number.isFinite(rawStart) ? rawStart : 0;
      const stageEnd = Number.isFinite(rawEnd) ? rawEnd : 100;
      const stageSpan = Math.max(1, stageEnd - stageStart);
      const isLastStage = index === refs.progressStages.length - 1;
      const stageReached = safeProgress >= stageStart;
      const stagePassed = safeProgress >= stageEnd;
      const stageProgress = safeProgress <= stageStart
        ? 0
        : safeProgress >= stageEnd
          ? 100
          : ((safeProgress - stageStart) / stageSpan) * 100;
      const isComplete = stagePassed && (!isFailed || !isLastStage);
      const isActive = stageReached && (!stagePassed || (isFailed && isLastStage));

      stage.style.setProperty('--stage-progress', `${Math.max(0, Math.min(100, stageProgress)).toFixed(2)}%`);
      stage.classList.toggle('is-complete', isComplete);
      stage.classList.toggle('is-active', isActive);
      stage.classList.toggle('is-pending', !isComplete && !isActive);
    });
  }

  function tickVisualProgress() {
    visualProgressFrame = 0;
    const desiredProgress = getDesiredProgress(reportState);
    const delta = desiredProgress - visualProgress;

    if (Math.abs(delta) > 0.05) {
      if (delta > 0) {
        visualProgress = Math.min(desiredProgress, visualProgress + Math.max(0.7, delta * 0.16));
      } else {
        visualProgress = desiredProgress;
      }
      renderVisualProgress();
    }

    const nextDesiredProgress = getDesiredProgress(reportState);
    const shouldContinue = Boolean(reportState) && (
      reportState.status === 'running'
      || Math.abs(nextDesiredProgress - visualProgress) > 0.2
      || ((reportState.status === 'completed' || reportState.status === 'failed') && visualProgress < 99.8)
    );

    if (shouldContinue) {
      visualProgressFrame = requestAnimationFrame(tickVisualProgress);
    }
  }

  function syncVisualProgress() {
    if (!reportState) {
      visualProgress = 0;
      renderVisualProgress();
      stopVisualProgressLoop();
      return;
    }

    const desiredProgress = getDesiredProgress(reportState);
    if (!visualProgress && desiredProgress <= 0) {
      renderVisualProgress();
    }

    if (!visualProgressFrame) {
      visualProgressFrame = requestAnimationFrame(tickVisualProgress);
    }
  }

  function renderState(state) {
    reportState = state;
    const status = state?.status || 'running';
    const latestStep = getLatestStep(state);
    const currentStepTitle = state?.progress?.currentStepTitle || latestStep?.title || '等待后处理开始';

    refs.statusBadge.textContent = getStatusText(status);
    refs.statusBadge.className = `status-badge ${status === 'completed' ? 'status-completed' : status === 'failed' ? 'status-failed' : 'status-running'}`;
    refs.reportWindowTitle.textContent = status === 'completed'
      ? 'MKP 后处理完成'
      : status === 'failed'
        ? 'MKP 后处理失败'
        : 'MKP 后处理中';
    refs.summaryTitle.textContent = getSummaryTitle(state);
    refs.summaryText.textContent = getSummaryText(state);

    refs.progressPanel.className = `report-progress ${status === 'completed' ? 'is-completed' : status === 'failed' ? 'is-failed' : 'is-running'}`;
    refs.progressLabel.textContent = state?.progress?.label || getSummaryTitle(state);
    refs.progressDetail.textContent = state?.progress?.detail || getSummaryText(state);
    refs.progressStepText.textContent = `当前步骤：${currentStepTitle}`;

    refs.metricInjected.textContent = String(state?.summary?.injectedSegments || 0);
    refs.metricScan.textContent = getScanSummaryText(state);
    refs.metricScanSub.textContent = `无效跳过 ${state?.summary?.skippedInvalidSegments || 0} 段 / 过量熨烫取消 ${state?.summary?.skippedExcessiveIroningSegments || 0} 段`;
    refs.metricDuration.textContent = formatSeconds(state?.durationMs || 0);
    refs.metricOutput.textContent = formatPathForCard(state?.outputPath);
    refs.metricOutputSub.textContent = state?.outputPath || '处理完成后会显示完整输出路径';

    refs.pathSummary.textContent = [
      `inputPath=${state?.inputPath || 'N/A'}`,
      `outputPath=${state?.outputPath || 'N/A'}`,
      `configPath=${state?.configPath || 'N/A'}`,
      `configFormat=${state?.configFormat || 'N/A'}`
    ].join('\n');

    refs.summaryCode.textContent = buildSummaryCode(state);
    refs.exportTraceButton.disabled = !Array.isArray(state?.steps) || state.steps.length === 0;
    refs.exportGcodeButton.disabled = !state?.outputPath || status !== 'completed';

    renderSteps(state);
    syncVisualProgress();

    if (status === 'running') {
      stopCountdown();
      setFeedback('处理中...');
    } else if (status === 'failed') {
      stopCountdown();
      setFeedback('失败状态下不会自动关闭，请先查看详细步骤。', 'error');
    } else if (expanded) {
      stopCountdown();
      setFeedback('详情已展开，窗口不会自动关闭。');
    }
  }

  async function refreshState() {
    if (!window.mkpAPI?.getPostprocessReportState) {
      return;
    }

    const state = await window.mkpAPI.getPostprocessReportState();
    if (!state) {
      return;
    }

    const nextFingerprint = buildReportFingerprint(state);
    const stateChanged = nextFingerprint !== reportFingerprint;

    if (stateChanged) {
      reportFingerprint = nextFingerprint;
      renderState(state);
    } else if (reportState) {
      syncVisualProgress();
    }

    if (state?.status === 'completed' && !expanded && !countdownTimer) {
      startAutoClose(Number(state?.ui?.autoCloseSeconds || 10));
    }
  }

  async function exportTrace() {
    if (!window.mkpAPI?.exportPostprocessTrace) {
      return;
    }

    const result = await window.mkpAPI.exportPostprocessTrace('technical');
    if (result?.success) {
      setFeedback(`步骤轨迹已导出到：${result.filePath}`, 'success');
      return;
    }

    if (!result?.canceled) {
      setFeedback(result?.error || '导出步骤轨迹失败。', 'error');
    }
  }

  async function exportGcode() {
    if (!window.mkpAPI?.exportPostprocessGcode) {
      return;
    }

    const result = await window.mkpAPI.exportPostprocessGcode();
    if (result?.success) {
      setFeedback(`G-code 已导出到：${result.filePath}`, 'success');
      return;
    }

    if (!result?.canceled) {
      setFeedback(result?.error || '导出 G-code 失败。', 'error');
    }
  }

  function bindEvents() {
    refs.viewToggleButton.addEventListener('click', async () => {
      await setExpanded(!expanded);
    });

    refs.closeButton.addEventListener('click', async () => {
      await closeWindow();
    });

    refs.humanViewButton.addEventListener('click', () => {
      viewMode = 'human';
      refs.humanViewButton.classList.add('is-active');
      refs.technicalViewButton.classList.remove('is-active');
      renderSteps(reportState);
    });

    refs.technicalViewButton.addEventListener('click', () => {
      viewMode = 'technical';
      refs.humanViewButton.classList.remove('is-active');
      refs.technicalViewButton.classList.add('is-active');
      renderSteps(reportState);
    });

    refs.exportTraceButton.addEventListener('click', exportTrace);
    refs.exportGcodeButton.addEventListener('click', exportGcode);
  }

  async function init() {
    bindEvents();
    renderVisualProgress();
    await refreshState();
    pollTimer = window.setInterval(refreshState, POLL_MS);
  }

  window.addEventListener('beforeunload', () => {
    if (pollTimer) {
      clearInterval(pollTimer);
    }
    stopCountdown();
    stopVisualProgressLoop();
  });

  document.addEventListener('DOMContentLoaded', init);
})();
