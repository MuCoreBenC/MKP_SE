const fs = require('fs');
const path = require('path');
const { compareGcodeParity } = require('../src/main/gcode_parity');

function readRequiredFile(filePath, label) {
  const resolved = path.resolve(filePath || '');
  if (!filePath || !fs.existsSync(resolved)) {
    throw new Error(`Missing ${label} file: ${filePath || '(empty)'}`);
  }
  return {
    path: resolved,
    content: fs.readFileSync(resolved, 'utf8')
  };
}

function main() {
  const [, , referencePath, candidatePath] = process.argv;
  const reference = readRequiredFile(referencePath, 'reference');
  const candidate = readRequiredFile(candidatePath, 'candidate');
  const comparison = compareGcodeParity(reference.content, candidate.content);

  const payload = {
    referencePath: reference.path,
    candidatePath: candidate.path,
    referenceLineCount: comparison.referenceLineCount,
    candidateLineCount: comparison.candidateLineCount,
    lineCountDelta: comparison.lineCountDelta,
    mismatches: comparison.mismatches
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main();
