(function () {
  const POLL_MS = 160;
  const DEFAULT_MIN_VISUAL_PROGRESS_MS = 1000;
  const MIN_BOOT_STAGE_MS = 520;
  const RESULT_SWAP_OUT_MS = 120;

  let reportState = null;
  let reportFingerprint = '';
  let expanded = false;
  let viewMode = 'human';
  let pollTimer = null;
  let countdownTimer = null;
  let countdownRemaining = 0;
  let visualProgress = 0;
  let visualProgressFrame = 0;
  let bootStartedAt = 0;
  let hasEnteredRuntimeStage = false;
  let bootRevealTimer = null;
  let lastRenderedStatus = null;
  let runtimeSwapPromise = Promise.resolve();

  const refs = {
    prototypeShell: document.getElementById('prototypeShell'),
    bootCaption: document.getElementById('bootCaption'),
    bootTitle: document.getElementById('bootTitle'),
    bootCopy: document.getElementById('bootCopy'),
    bootPhase: document.getElementById('bootPhase'),
    bootPercent: document.getElementById('bootPercent'),
    runtimeContent: document.getElementById('runtimeContent'),
    progressPanel: document.getElementById('progressPanel'),
    statusBadge: document.getElementById('statusBadge'),
    reportWindowTitle: document.getElementById('reportWindowTitle'),
    progressLabel: document.getElementById('progressLabel'),
    summaryTitle: document.getElementById('summaryTitle'),
    summaryText: document.getElementById('summaryText'),
    countdownText: document.getElementById('countdownText'),
    progressFill: document.getElementById('progressFill'),
    progressPercent: document.getElementById('progressPercent'),
    progressStepText: document.getElementById('progressStepText'),
    metricOutput: document.getElementById('metricOutput'),
    metricDuration: document.getElementById('metricDuration'),
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

    return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 1 : 2)}s`;
  }

  function formatPathForCard(filePath) {
    if (!filePath) {
      return '待生成';
    }

    const normalized = String(filePath).replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || normalized;
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

  function buildReportFingerprint(state) {
    return JSON.stringify({
      status: state?.status || 'unknown',
      finishedAt: state?.finishedAt || null,
      durationMs: state?.durationMs || 0,
      progressPercent: state?.progress?.percent ?? null,
      progressLabel: state?.progress?.label || '',
      progressDetail: state?.progress?.detail || '',
      progressCurrentStepTitle: state?.progress?.currentStepTitle || '',
      progressUpdatedAt: state?.progress?.updatedAt || '',
      outputPath: state?.outputPath || '',
      steps: state?.steps?.length || 0
    });
  }

  function getLatestStep(state) {
    const steps = Array.isArray(state?.steps) ? state.steps : [];
    return steps.length > 0 ? steps[steps.length - 1] : null;
  }

  function getVisualMinimumDurationMs(state) {
    const rawValue = Number(state?.ui?.minimumProgressDurationMs || DEFAULT_MIN_VISUAL_PROGRESS_MS);
    return Number.isFinite(rawValue) && rawValue > 0
      ? rawValue
      : DEFAULT_MIN_VISUAL_PROGRESS_MS;
  }

  function getStatusText(status) {
    if (status === 'completed') {
      return '已完成';
    }

    if (status === 'failed') {
      return '失败';
    }

    return '运行中';
  }

  function getWindowTitle(status) {
    if (status === 'completed') {
      return 'MKP 后处理已完成';
    }

    if (status === 'failed') {
      return 'MKP 后处理失败';
    }

    return 'MKP 后处理中';
  }

  function getHeadline(state) {
    if (state?.status === 'completed') {
      return '后处理已完成';
    }

    if (state?.status === 'failed') {
      return '后处理失败';
    }

    return state?.progress?.label || '正在处理 G-code';
  }

  function getSummaryText(state) {
    if (state?.status === 'completed') {
      return `已生成 ${formatPathForCard(state?.outputPath)}。结果仍在同一个窗口里呈现，详细步骤可按需展开查看。`;
    }

    if (state?.status === 'failed') {
      return '同一窗口会保留失败结果，请展开详细区查看错误原因与技术细节。';
    }

    return state?.progress?.detail || '窗口会先显示加载动画，再持续同步后处理实时进度。';
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

  function stopBootRevealTimer() {
    if (bootRevealTimer) {
      clearTimeout(bootRevealTimer);
      bootRevealTimer = null;
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

  function updateBootScreen(state) {
    const progressPercent = clampPercent(state?.progress?.percent, 0);
    refs.bootCaption.textContent = 'Classic V2 Preview';
    refs.bootTitle.textContent = state?.progress?.label || '正在准备后处理窗口';
    refs.bootCopy.textContent = state?.progress?.detail || '先稳定显示同一个窗口，再接入实时进度。';
    refs.bootPhase.textContent = state?.progress?.currentStepTitle || '正在连接实时进度';
    refs.bootPercent.textContent = progressPercent > 0 ? `${Math.round(progressPercent)}%` : '启动中';
  }

  function revealRuntimeStage() {
    if (hasEnteredRuntimeStage) {
      return;
    }

    hasEnteredRuntimeStage = true;
    refs.prototypeShell.classList.add('is-runtime-visible');
    stopBootRevealTimer();
  }

  function scheduleRuntimeStageReveal() {
    if (hasEnteredRuntimeStage) {
      return;
    }

    const elapsed = performance.now() - bootStartedAt;
    const waitMs = Math.max(0, MIN_BOOT_STAGE_MS - elapsed);
    stopBootRevealTimer();
    bootRevealTimer = window.setTimeout(() => {
      revealRuntimeStage();
    }, waitMs);
  }

  async function animateRuntimeResultSwap(updateFn) {
    const target = refs.runtimeContent;
    if (!target) {
      updateFn();
      return;
    }

    target.classList.add('is-swap-out');
    await new Promise((resolve) => window.setTimeout(resolve, RESULT_SWAP_OUT_MS));
    updateFn();
    target.classList.remove('is-swap-out');
    target.classList.add('is-swap-in');
    await new Promise((resolve) => window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        target.classList.remove('is-swap-in');
        resolve();
      });
    }));
  }

  function renderSteps(state) {
    const steps = Array.isArray(state?.steps) ? state.steps : [];
    if (steps.length === 0) {
      refs.stepsContainer.innerHTML = '<div class="step-card"><div class="step-body">暂时还没有可展示的步骤。</div></div>';
      return;
    }

    refs.stepsContainer.innerHTML = steps.map((step) => {
      const body = viewMode === 'human'
        ? `<div class="step-body">${escapeHtml(step.human || '暂无普通说明。')}</div>`
        : `<div class="step-technical"><pre>${escapeHtml(step.technical || '暂无技术细节。')}</pre></div>`;
      const dataBlock = viewMode === 'technical' && step.data
        ? `<div class="step-data"><pre>${escapeHtml(JSON.stringify(step.data, null, 2))}</pre></div>`
        : '';

      return `
        <article class="step-card">
          <div class="step-card-header">
            <h2 class="step-title">${escapeHtml(step.title || '未命名步骤')}</h2>
            <div class="step-kind">${escapeHtml(step.kind || 'info')}</div>
          </div>
          ${body}
          ${dataBlock}
        </article>
      `;
    }).join('');
  }

  function syncActionLabels() {
    refs.viewToggleButton.textContent = expanded ? '收起详细' : '查看详细';
    refs.closeButton.textContent = '关闭';
  }

  async function setExpanded(nextExpanded) {
    expanded = nextExpanded;
    refs.detailPanel.classList.toggle('is-visible', expanded);
    syncActionLabels();

    if (window.mkpAPI?.setPostprocessReportExpanded) {
      await window.mkpAPI.setPostprocessReportExpanded(expanded);
    }

    if (expanded) {
      stopCountdown();
      setFeedback('详细区已展开，窗口不会自动关闭。');
    } else if (reportState?.status === 'completed') {
      setFeedback('已回到结果摘要，窗口会按规则自动关闭。');
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

  function applyStateToDom(state) {
    const status = state?.status || 'running';
    const latestStep = getLatestStep(state);
    const currentStepTitle = state?.progress?.currentStepTitle || latestStep?.title || '等待后处理开始';

    refs.statusBadge.textContent = getStatusText(status);
    refs.statusBadge.className = `status-badge ${status === 'completed' ? 'status-completed' : status === 'failed' ? 'status-failed' : 'status-running'}`;
    refs.reportWindowTitle.textContent = getWindowTitle(status);
    refs.progressLabel.textContent = status === 'running' ? 'CLI 后处理执行中' : 'CLI 后处理结果';
    refs.summaryTitle.textContent = getHeadline(state);
    refs.summaryText.textContent = getSummaryText(state);
    refs.progressPanel.className = `prototype-progress ${status === 'completed' ? 'is-completed' : status === 'failed' ? 'is-failed' : 'is-running'}`;
    refs.progressStepText.textContent = `当前步骤：${currentStepTitle}`;
    refs.metricOutput.textContent = formatPathForCard(state?.outputPath);
    refs.metricDuration.textContent = status === 'running' ? '--' : formatSeconds(state?.durationMs || 0);
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
      setFeedback('同一窗口已切换到失败结果，请展开详细区查看原因。', 'error');
    } else if (expanded) {
      stopCountdown();
      setFeedback('详细区已展开，窗口不会自动关闭。');
    }
  }

  async function renderState(state) {
    const nextStatus = state?.status || 'running';
    const shouldAnimateResultSwap = (
      hasEnteredRuntimeStage
      && lastRenderedStatus === 'running'
      && (nextStatus === 'completed' || nextStatus === 'failed')
    );

    reportState = state;
    updateBootScreen(state);

    if (shouldAnimateResultSwap) {
      runtimeSwapPromise = runtimeSwapPromise.then(() => animateRuntimeResultSwap(() => {
        applyStateToDom(state);
      }));
      await runtimeSwapPromise;
    } else {
      applyStateToDom(state);
    }

    scheduleRuntimeStageReveal();
    lastRenderedStatus = nextStatus;
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
      await renderState(state);
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

    const result = await window.mkpAPI.exportPostprocessTrace(viewMode === 'technical' ? 'technical' : 'human');
    if (result?.success) {
      setFeedback(`步骤已导出到：${result.filePath}`, 'success');
      return;
    }

    if (!result?.canceled) {
      setFeedback(result?.error || '导出步骤失败。', 'error');
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
    bootStartedAt = performance.now();
    syncActionLabels();
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
    stopBootRevealTimer();
  });

  document.addEventListener('DOMContentLoaded', init);
})();
