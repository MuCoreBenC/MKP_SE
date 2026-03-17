const VERSION_PATTERN = /[a-z]+|\d+/gi;

function tokenize(version: string): string[] {
  return version.match(VERSION_PATTERN) ?? ['0'];
}

function normalize(version: string | number | null | undefined): string {
  if (version === null || version === undefined) {
    return '0';
  }

  const normalized = String(version).trim().replace(/^v/i, '').toLowerCase();
  return normalized || '0';
}

function isNumericToken(token: string): boolean {
  return /^\d+$/.test(token);
}

export function compareVersions(leftInput: string | number, rightInput: string | number): number {
  const left = tokenize(normalize(leftInput));
  const right = tokenize(normalize(rightInput));
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftToken = left[index] ?? '0';
    const rightToken = right[index] ?? '0';

    if (leftToken === rightToken) {
      continue;
    }

    const leftIsNumber = isNumericToken(leftToken);
    const rightIsNumber = isNumericToken(rightToken);

    if (leftIsNumber && rightIsNumber) {
      const delta = Number(leftToken) - Number(rightToken);
      if (delta !== 0) {
        return delta > 0 ? 1 : -1;
      }
      continue;
    }

    if (leftIsNumber !== rightIsNumber) {
      return leftIsNumber ? 1 : -1;
    }

    const textCompare = leftToken.localeCompare(rightToken, 'en', {
      numeric: true,
      sensitivity: 'base'
    });

    if (textCompare !== 0) {
      return textCompare > 0 ? 1 : -1;
    }
  }

  return 0;
}
