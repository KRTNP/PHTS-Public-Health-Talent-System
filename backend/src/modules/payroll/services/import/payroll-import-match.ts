export type PayrollImportMatchCandidate = {
  citizen_id: string;
  user_id: number | null;
  first_name: string;
  last_name: string;
  position_name: string;
  department: string | null;
};

type NameParts = {
  firstName: string;
  lastName: string;
};

export const normalizeImportedName = (value: string): string =>
  value
    .replace(/\([^)]*\)/g, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\s+/g, "")
    .trim();

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
};

const buildScore = (source: NameParts, candidate: NameParts): {
  score: number;
  firstDistance: number;
  lastDistance: number;
  fullDistance: number;
} => {
  const firstDistance = levenshtein(source.firstName, candidate.firstName);
  const lastDistance = levenshtein(source.lastName, candidate.lastName);
  const fullDistance = levenshtein(
    source.firstName + source.lastName,
    candidate.firstName + candidate.lastName,
  );

  let score = 0;
  if (firstDistance === 0) score += 4;
  else if (firstDistance === 1) score += 2;

  if (lastDistance === 0) score += 5;
  else if (lastDistance === 1) score += 3;
  else if (lastDistance === 2) score += 1;

  if (fullDistance <= 1) score += 3;
  else if (fullDistance <= 2) score += 2;
  else if (fullDistance <= 3) score += 1;

  if (source.lastName && candidate.lastName && (
    source.lastName.includes(candidate.lastName) || candidate.lastName.includes(source.lastName)
  )) {
    score += 2;
  }

  return {
    score,
    firstDistance,
    lastDistance,
    fullDistance,
  };
};

export const resolveClosestImportedCandidate = (
  row: NameParts,
  candidates: PayrollImportMatchCandidate[],
): PayrollImportMatchCandidate | null => {
  const source = {
    firstName: normalizeImportedName(row.firstName),
    lastName: normalizeImportedName(row.lastName),
  };

  const scored = candidates
    .map((candidate) => {
      const metrics = buildScore(source, {
        firstName: normalizeImportedName(candidate.first_name),
        lastName: normalizeImportedName(candidate.last_name),
      });
      return {
        candidate,
        ...metrics,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const runnerUp = scored[1];
  if (!best || best.score < 7) return null;
  if (best.firstDistance > 1 || best.lastDistance > 2) return null;
  if (runnerUp && best.score - runnerUp.score < 2) return null;
  return best.candidate;
};
