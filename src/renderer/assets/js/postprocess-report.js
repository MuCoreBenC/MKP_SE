(function () {
  const POLL_MS = 800;
  let reportState = null;
  let reportFingerprint = '';
  let expanded = false;
  let viewMode = 'human';
  let pollTimer = null;
  let countdownTimer = null;
  let countdownRemaining = 0;

  const refs = {
    statusBadge: document.getElementById('statusBadge'),
    reportWindowTitle: document.getElementById('reportWindowTitle'),
    summaryTitle: document.getElementById('summaryTitle'),
    summaryText: document.getElementById('summaryText'),
    countdownText: document.getElementById('countdownText'),
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

  function formatSeconds(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
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

  function buildReportFingerprint(state) {
    return JSON.stringify({
      status: state?.status || 'unknown',
      finishedAt: state?.finishedAt || null,
      steps: state?.steps?.length || 0,
      durationMs: state?.durationMs || 0,
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
    setFeedback(`未展开详情，窗口将在 ${countdownRemaining} 秒后自动关闭。`);

    countdownTimer = window.setInterval(async () => {
      countdownRemaining -= 1;
      if (countdownRemaining <= 0) {
        stopCountdown();
        await closeWindow();
        return;
      }
      setFeedback(`未展开详情，窗口将在 ${countdownRemaining} 秒后自动关闭。`);
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
      return '处理中';
    }

    if (state?.status === 'failed') {
      return '失败';
    }

    return [
      `${summary.supportInterfaceCandidates || 0} 支撑段`,
      `${summary.supportSurfaceIroningCandidates || 0} 熨烫段`,
      `${summary.ignoredTopSurfaceIroningSegments || 0} 顶面忽略`
    ].join(' / ');
  }

  function getSummaryTitle(state) {
    if (state?.status === 'completed') {
      return '后处理完成，可以查看完整判断过程';
    }
    if (state?.status === 'failed') {
      return '后处理失败，请查看技术步骤';
    }
    return '正在扫描支撑面与熨烫路径';
  }

  function getSummaryText(state) {
    if (state?.status === 'completed') {
      return '窗口默认保持简洁摘要；如果不点击查看，10 秒后会自动关闭。点击后可切换普通步骤和代码步骤，并导出轨迹或 G-code。';
    }
    if (state?.status === 'failed') {
      return '错误状态下不会自动关闭，方便直接查看失败位置和技术细节。';
    }
    return '正在查找支撑面、识别熨烫路径、判断是否有效，以及决定是否注入涂胶或执行 Skip Ironing 恢复动作。';
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
      setFeedback('摘要模式。若不重新展开，窗口会继续按规则自动关闭。');
    }
  }

  function renderState(state) {
    reportState = state;
    const status = state?.status || 'running';

    refs.statusBadge.textContent = getStatusText(status);
    refs.statusBadge.className = `status-badge ${status === 'completed' ? 'status-completed' : status === 'failed' ? 'status-failed' : 'status-running'}`;
    refs.reportWindowTitle.textContent = status === 'completed' ? 'MKP 后处理完成' : status === 'failed' ? 'MKP 后处理失败' : 'MKP 后处理中';
    refs.summaryTitle.textContent = getSummaryTitle(state);
    refs.summaryText.textContent = getSummaryText(state);

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

    if (status === 'running' && !expanded) {
      stopCountdown();
      setFeedback('处理中...');
    } else if (status === 'failed') {
      stopCountdown();
      setFeedback('失败状态不会自动关闭，请先查看技术细节。', 'error');
    } else if (status === 'completed' && expanded) {
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
      setFeedback(`步骤代码已导出到：${result.filePath}`, 'success');
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
      refs.technicalViewButton.classList.add('is-active');
      refs.humanViewButton.classList.remove('is-active');
      renderSteps(reportState);
    });

    refs.exportTraceButton.addEventListener('click', exportTrace);
    refs.exportGcodeButton.addEventListener('click', exportGcode);
  }

  async function init() {
    bindEvents();
    await refreshState();
    pollTimer = window.setInterval(refreshState, POLL_MS);
  }

  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
    stopCountdown();
  });

  document.addEventListener('DOMContentLoaded', init);
})();
