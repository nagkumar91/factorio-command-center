// Maximize c.x subject to A.x <= b, x >= 0. Keep the original deterministic
// fast path, but accept a result only with a certificate in the ORIGINAL units.
// Degenerate recipe networks can amplify round-off in incremental pivots. A
// bounded retry uses Bland's rule and reconstructs the basis from A every 20
// pivots, rather than trusting the accumulated inverse or relaxing balances.
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const finite = values => values != null && typeof values.every === 'function' && values.every(Number.isFinite);
const tolerance = 1e-7;
const roundoff = (a, b) => 8 * Number.EPSILON * a.reduce((sum, value, i) => sum + Math.abs(value * b[i]), 0);

function primalViolation(A, b, x) {
  let violation = 0;
  for (const value of x) violation = Math.max(violation, -value);
  for (let i = 0; i < b.length; i++) violation = Math.max(violation, dot(A[i], x) - b[i]);
  return violation;
}

function certified(result, A, b, c) {
  if (result.status === 'optimal') {
    const {x, dual} = result;
    if (!finite(x) || !finite(dual)) return false;
    const objective = dot(c, x), upperBound = dot(b, dual);
    const maxViolation = primalViolation(A, b, x);
    let dualViolation = Math.max(0, ...dual.map(value => -value));
    for (let j = 0; j < c.length; j++) {
      const column = A.map(row => row[j]), activity = dot(column, dual);
      if (!Number.isFinite(activity)) return false;
      if (c[j] - activity > tolerance * Math.abs(c[j]) + roundoff(column, dual)) return false;
      dualViolation = Math.max(dualViolation, (c[j] - activity) / Math.max(1, Math.abs(c[j])));
    }
    const gap = Math.abs(upperBound - objective);
    result.validation = {maxViolation, dualViolation, dualityGap: gap};
    return finite([objective, upperBound, maxViolation, dualViolation, gap, result.objective])
      && maxViolation <= tolerance && dualViolation <= tolerance
      && gap <= tolerance * Math.max(1, Math.abs(objective), Math.abs(upperBound))
      && Math.abs(objective - result.objective) <= tolerance * Math.max(1, Math.abs(objective));
  }
  if (result.status === 'unbounded') {
    if (!finite(result.x) || !finite(result.ray)) return false;
    // A feasible point plus a nonnegative improving recession direction is
    // required. In particular, nonpositive costs can never be unbounded.
    const ray = result.ray.map(value => Math.max(0, value));
    const scale = Math.max(0, ...ray);
    if (!scale) return false;
    result.ray = ray.map(value => value / scale);
    return primalViolation(A, b, result.x) <= tolerance
      && A.every(row => Number.isFinite(dot(row, result.ray)) && dot(row, result.ray) <= roundoff(row, result.ray))
      && Number.isFinite(dot(c, result.ray)) && dot(c, result.ray) > roundoff(c, result.ray);
  }
  if (result.status === 'infeasible') {
    if (!finite(result.dual)) return false;
    const scale = Math.max(0, ...result.dual);
    if (!scale) return false;
    const y = result.dual.map(value => Math.max(0, value) / scale);
    // Farkas witness: y >= 0, A' y >= 0, b.y < 0.
    const valid = c.every((_, j) => {
      const column = A.map(row => row[j]);
      return Number.isFinite(dot(column, y)) && dot(column, y) >= -roundoff(column, y);
    }) && Number.isFinite(dot(b, y)) && dot(b, y) < -roundoff(b, y);
    if (valid) result.dual = y;
    return valid;
  }
  return false;
}

export function solveLinearProgram(A, b, c, {epsilon = 1e-9, maxPivots = 100000} = {}) {
  if (!finite(b) || !finite(c) || !Array.isArray(A) || A.length !== b.length
      || A.some(row => !finite(row) || row.length !== c.length)) throw new Error('LP requires finite, dimensionally consistent A, b and c');
  if (!Number.isFinite(epsilon) || epsilon <= 0 || !Number.isSafeInteger(maxPivots) || maxPivots < 1) throw new Error('LP requires a positive epsilon and pivot budget');
  let pivots = 0, rebuilds = 0, last, original;
  for (let attempt = 0; attempt < 3 && pivots < maxPivots; attempt++) {
    // Powers of two avoid introducing additional rounding in the retry. Row
    // scaling is undone for dual witnesses before checking original units.
    const scales = b.map((value, i) => attempt === 2
      ? 2 ** Math.max(-1022, Math.min(1023, Math.round(Math.log2(Math.max(...A[i].map(Math.abs), 0) || Math.abs(value) || 1)))) : 1);
    const rows = attempt === 2 ? A.map((row, i) => row.map(value => value / scales[i])) : A;
    const rhs = attempt === 2 ? b.map((value, i) => value / scales[i]) : b;
    const costScale = attempt === 2 ? 2 ** Math.max(-1022, Math.min(1023, Math.round(Math.log2(Math.max(...c.map(Math.abs), 0) || 1)))) : 1;
    const budget = Math.min(maxPivots - pivots, Math.max(1000, 10 * (b.length + c.length)));
    last = tableau(rows, rhs, c.map(value => value / costScale), {epsilon, maxPivots: budget, rebuildEvery: attempt ? 20 : 0});
    pivots += last.pivots; rebuilds += last.rebuilds;
    if (last.dual) last.dual = last.dual.map((value, i) => value * (last.status === 'optimal' ? costScale : 1) / scales[i]);
    if (last.status === 'optimal') last.objective *= costScale;
    if (certified(last, A, b, c)) {
      // A fresh dual witness can certify the original point even if its old
      // tableau had drifted. Preserve that exact point when it is still optimal.
      const preserved = original?.status === 'optimal' && last.status === 'optimal' ? {...original, dual: last.dual} : null;
      const result = preserved && certified(preserved, A, b, c) ? preserved : last;
      return {...result, pivots, rebuilds, attempts: attempt + 1};
    }
    if (!attempt) original = last;
  }
  // Neither failure of phase I nor absence of a pivot proves anything when
  // the computed witness fails. Never mislabel that as a missing recipe route.
  return {status: 'numerical-failure', pivots, rebuilds, reason: last?.reason || 'Uncertified simplex result'};
}

function tableau(A, b, c, {epsilon, maxPivots, rebuildEvery}) {
  const m = b.length, n = c.length;
  const B = Array.from({length: m}, (_, i) => n + i), N = Array.from({length: n + 1}, (_, i) => i === n ? -1 : i);
  const D = Array.from({length: m + 2}, () => new Float64Array(n + 2));
  for (let i = 0; i < m; i++) { D[i].set(A[i]); D[i][n] = -1; D[i][n + 1] = b[i]; }
  for (let j = 0; j < n; j++) D[m][j] = -c[j];
  D[m + 1][n] = 1;
  let pivots = 0, rebuilds = 0;
  const point = () => {
    const x = new Array(n).fill(0);
    for (let i = 0; i < m; i++) if (B[i] >= 0 && B[i] < n) x[B[i]] = Math.max(0, D[i][n + 1]);
    return x;
  };
  const dual = row => {
    const y = new Array(m).fill(0);
    for (let j = 0; j <= n; j++) if (N[j] >= n) y[N[j] - n] = D[row][j];
    return y;
  };

  function rebuild() {
    const coefficient = (i, j) => j === -1 ? -1 : j < n ? A[i][j] : Number(j === n + i);
    const rows = Array.from({length: m}, (_, i) => Float64Array.from([...B.map(j => coefficient(i, j)), ...N.map(j => coefficient(i, j)), b[i]]));
    // Gauss-Jordan elimination with partial pivoting solves B^-1 [N | b]
    // directly from original columns; no accumulated tableau values are used.
    for (let k = 0; k < m; k++) {
      let r = k;
      for (let i = k + 1; i < m; i++) if (Math.abs(rows[i][k]) > Math.abs(rows[r][k])) r = i;
      if (!Number.isFinite(1 / rows[r][k])) return false;
      [rows[k], rows[r]] = [rows[r], rows[k]];
      const divisor = rows[k][k];
      for (let j = k; j < rows[k].length; j++) rows[k][j] /= divisor;
      for (let i = 0; i < m; i++) if (i !== k) {
        const factor = rows[i][k];
        for (let j = k; j < rows[i].length; j++) rows[i][j] -= factor * rows[k][j];
      }
    }
    for (let i = 0; i < m; i++) for (let j = 0; j < n + 2; j++) D[i][j] = rows[i][m + j];
    for (let phase = 1; phase <= 2; phase++) {
      const row = phase === 1 ? m + 1 : m;
      const cost = j => phase === 1 ? -Number(j === -1) : j >= 0 && j < n ? c[j] : 0;
      for (let j = 0; j < n + 2; j++) {
        D[row][j] = j === n + 1 ? 0 : -cost(N[j]);
        for (let i = 0; i < m; i++) D[row][j] += cost(B[i]) * D[i][j];
      }
    }
    rebuilds++;
    return D.every(finite);
  }

  function pivot(r, s) {
    if (pivots >= maxPivots) return false;
    pivots++;
    const inverse = 1 / D[r][s];
    if (!Number.isFinite(inverse)) return false;
    for (let i = 0; i < m + 2; i++) if (i !== r) {
      const factor = D[i][s] * inverse;
      for (let j = 0; j < n + 2; j++) if (j !== s) D[i][j] -= D[r][j] * factor;
    }
    for (let j = 0; j < n + 2; j++) if (j !== s) D[r][j] *= inverse;
    for (let i = 0; i < m + 2; i++) if (i !== r) D[i][s] *= -inverse;
    D[r][s] = inverse; [B[r], N[s]] = [N[s], B[r]];
    return rebuildEvery && pivots % rebuildEvery === 0 ? rebuild() : D.every(finite);
  }

  function simplex(phase) {
    const row = phase === 1 ? m + 1 : m;
    while (true) {
      let s = -1;
      for (let j = 0; j <= n; j++) {
        if (phase === 2 && N[j] === -1) continue;
        if (rebuildEvery) {
          if (D[row][j] < -epsilon && (s < 0 || N[j] < N[s])) s = j;
        } else if (s < 0 || D[row][j] < D[row][s] - epsilon || (Math.abs(D[row][j] - D[row][s]) <= epsilon && N[j] < N[s])) s = j;
      }
      if (s < 0 || D[row][s] >= -epsilon) return {status: 'optimal'};
      let r = -1;
      for (let i = 0; i < m; i++) if (D[i][s] > epsilon) {
        const ratio = D[i][n + 1] / D[i][s], old = r < 0 ? Infinity : D[r][n + 1] / D[r][s];
        if (ratio < old - epsilon || (Math.abs(ratio - old) <= epsilon && (r < 0 || B[i] < B[r]))) r = i;
      }
      if (r < 0) return {status: 'unbounded', column: s};
      if (!pivot(r, s)) return {status: 'numerical-failure'};
    }
  }

  const failure = () => ({status: 'numerical-failure', pivots, rebuilds, reason: pivots >= maxPivots ? 'LP pivot budget exhausted' : 'Nonfinite or singular simplex basis'});
  let r = 0;
  for (let i = 1; i < m; i++) if (D[i][n + 1] < D[r][n + 1]) r = i;
  if (m && D[r][n + 1] < -epsilon) {
    if (!pivot(r, n)) return failure();
    const phase = simplex(1);
    if (phase.status === 'numerical-failure') return failure();
    if (phase.status !== 'optimal' || Math.abs(D[m + 1][n + 1]) > epsilon) return {status: 'infeasible', dual: dual(m + 1), pivots, rebuilds};
    const artificial = B.indexOf(-1);
    if (artificial !== -1) {
      let s = -1;
      for (let j = 0; j <= n; j++) if (Math.abs(D[artificial][j]) > epsilon && (s < 0 || N[j] < N[s])) s = j;
      if (s >= 0 && !pivot(artificial, s)) return failure();
    }
  }
  if (rebuildEvery && !rebuild()) return failure();
  const phase = simplex(2);
  if (phase.status === 'numerical-failure') return failure();
  if (phase.status === 'unbounded') {
    const ray = new Array(n).fill(0), s = phase.column;
    if (N[s] >= 0 && N[s] < n) ray[N[s]] = 1;
    for (let i = 0; i < m; i++) if (B[i] >= 0 && B[i] < n) ray[B[i]] = -D[i][s];
    return {status: 'unbounded', x: point(), ray, pivots, rebuilds};
  }
  return {status: 'optimal', x: point(), dual: dual(m), objective: D[m][n + 1], pivots, rebuilds};
}
