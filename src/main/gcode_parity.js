const DEFAULT_GCODE_PARITY_MARKERS = [
  '; post_process =',
  '; MACHINE_START_GCODE_END',
  '; Z_HEIGHT:',
  '; Current Layer Thickness:',
  '; FEATURE: Support interface',
  ';Pre-glue preparation',
  ';Rising Nozzle a little',
  '; ===== MKP Support Electron Glueing Start =====',
  '; ===== MKP Support Electron Glueing End =====',
  ';Mounting Toolhead',
  ';Toolhead Mounted',
  ';Glueing Started',
  ';Inposition',
  ';Glueing Finished',
  ';Toolhead Unmounted',
  ';Prepare for next tower',
  ';Tower_Layer_Gcode',
  ';START_HERE',
  ';MKP thick bridge',
  ';Walls Ahead!',
  ';Walls Released'
];

function normalizeGcodeLines(gcodeContent = '') {
  return String(gcodeContent || '').split(/\r?\n/).map((line) => line.trimEnd());
}

function countMarker(lines = [], marker = '') {
  let count = 0;
  const indexes = [];

  lines.forEach((line, index) => {
    if (line.includes(marker)) {
      count += 1;
      indexes.push(index);
    }
  });

  return {
    marker,
    count,
    firstIndex: indexes.length > 0 ? indexes[0] : -1,
    lastIndex: indexes.length > 0 ? indexes[indexes.length - 1] : -1
  };
}

function collectGcodeParitySummary(gcodeContent = '', markers = DEFAULT_GCODE_PARITY_MARKERS) {
  const lines = normalizeGcodeLines(gcodeContent);
  const markerStats = markers.map((marker) => countMarker(lines, marker));

  return {
    lineCount: lines.length,
    markerStats
  };
}

function compareGcodeParity(referenceContent = '', candidateContent = '', markers = DEFAULT_GCODE_PARITY_MARKERS) {
  const reference = collectGcodeParitySummary(referenceContent, markers);
  const candidate = collectGcodeParitySummary(candidateContent, markers);
  const markerDiffs = markers.map((marker, index) => {
    const referenceStat = reference.markerStats[index];
    const candidateStat = candidate.markerStats[index];

    return {
      marker,
      referenceCount: referenceStat.count,
      candidateCount: candidateStat.count,
      countDelta: candidateStat.count - referenceStat.count,
      referenceFirstIndex: referenceStat.firstIndex,
      candidateFirstIndex: candidateStat.firstIndex,
      firstIndexDelta: candidateStat.firstIndex - referenceStat.firstIndex
    };
  });

  return {
    referenceLineCount: reference.lineCount,
    candidateLineCount: candidate.lineCount,
    lineCountDelta: candidate.lineCount - reference.lineCount,
    markerDiffs,
    mismatches: markerDiffs.filter((item) => item.countDelta !== 0 || item.firstIndexDelta !== 0)
  };
}

module.exports = {
  DEFAULT_GCODE_PARITY_MARKERS,
  collectGcodeParitySummary,
  compareGcodeParity
};
