// Minimal dense complex linear algebra for the UQCF toy simulator.
// Matrices are square, row-major, with separate real and imaginary planes.
// Sizes here are tiny (at most 16×16), so clarity beats speed.

export interface CMatrix {
  n: number;
  re: Float64Array;
  im: Float64Array;
}

export interface Complex {
  re: number;
  im: number;
}

// --- CONSTRUCTION ---

export const zeros = (n: number): CMatrix => ({
  n,
  re: new Float64Array(n * n),
  im: new Float64Array(n * n),
});

export const identity = (n: number): CMatrix => {
  const m = zeros(n);
  for (let i = 0; i < n; i++) m.re[i * n + i] = 1;
  return m;
};

/** Build a matrix from rows of real numbers or [re, im] pairs. */
export const matrix = (rows: (number | [number, number])[][]): CMatrix => {
  const n = rows.length;
  const m = zeros(n);
  rows.forEach((row, i) => {
    if (row.length !== n) throw new Error('matrix(): rows must form a square matrix');
    row.forEach((v, j) => {
      const [re, im] = typeof v === 'number' ? [v, 0] : v;
      m.re[i * n + j] = re;
      m.im[i * n + j] = im;
    });
  });
  return m;
};

/** |v⟩⟨v| for a complex column vector given as [re, im] pairs. */
export const outer = (v: [number, number][]): CMatrix => {
  const n = v.length;
  const m = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // v_i · conj(v_j)
      m.re[i * n + j] = v[i][0] * v[j][0] + v[i][1] * v[j][1];
      m.im[i * n + j] = v[i][1] * v[j][0] - v[i][0] * v[j][1];
    }
  }
  return m;
};

// --- ARITHMETIC ---

export const add = (a: CMatrix, b: CMatrix): CMatrix => {
  const m = zeros(a.n);
  for (let k = 0; k < a.re.length; k++) {
    m.re[k] = a.re[k] + b.re[k];
    m.im[k] = a.im[k] + b.im[k];
  }
  return m;
};

/** Multiply every entry by the complex scalar s. */
export const scale = (a: CMatrix, s: Complex | number): CMatrix => {
  const { re: sr, im: si } = typeof s === 'number' ? { re: s, im: 0 } : s;
  const m = zeros(a.n);
  for (let k = 0; k < a.re.length; k++) {
    m.re[k] = a.re[k] * sr - a.im[k] * si;
    m.im[k] = a.re[k] * si + a.im[k] * sr;
  }
  return m;
};

export const matmul = (a: CMatrix, b: CMatrix): CMatrix => {
  const n = a.n;
  const m = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const ar = a.re[i * n + k];
      const ai = a.im[i * n + k];
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < n; j++) {
        const br = b.re[k * n + j];
        const bi = b.im[k * n + j];
        m.re[i * n + j] += ar * br - ai * bi;
        m.im[i * n + j] += ar * bi + ai * br;
      }
    }
  }
  return m;
};

/** Conjugate transpose A†. */
export const adjoint = (a: CMatrix): CMatrix => {
  const n = a.n;
  const m = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      m.re[j * n + i] = a.re[i * n + j];
      m.im[j * n + i] = -a.im[i * n + j];
    }
  }
  return m;
};

/** Kronecker (tensor) product A ⊗ B. */
export const kron = (a: CMatrix, b: CMatrix): CMatrix => {
  const n = a.n * b.n;
  const m = zeros(n);
  for (let i1 = 0; i1 < a.n; i1++) {
    for (let j1 = 0; j1 < a.n; j1++) {
      const ar = a.re[i1 * a.n + j1];
      const ai = a.im[i1 * a.n + j1];
      if (ar === 0 && ai === 0) continue;
      for (let i2 = 0; i2 < b.n; i2++) {
        for (let j2 = 0; j2 < b.n; j2++) {
          const br = b.re[i2 * b.n + j2];
          const bi = b.im[i2 * b.n + j2];
          const idx = (i1 * b.n + i2) * n + (j1 * b.n + j2);
          m.re[idx] = ar * br - ai * bi;
          m.im[idx] = ar * bi + ai * br;
        }
      }
    }
  }
  return m;
};

/** U ρ U† — unitary conjugation of a density operator. */
export const conjugate = (u: CMatrix, rho: CMatrix): CMatrix => matmul(matmul(u, rho), adjoint(u));

export const trace = (a: CMatrix): Complex => {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.n; i++) {
    re += a.re[i * a.n + i];
    im += a.im[i * a.n + i];
  }
  return { re, im };
};

/** Re Tr(AB), without forming the product. */
export const traceProduct = (a: CMatrix, b: CMatrix): number => {
  const n = a.n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      s += a.re[i * n + k] * b.re[k * n + i] - a.im[i * n + k] * b.im[k * n + i];
    }
  }
  return s;
};

/** Largest absolute entry difference; used for approximate equality. */
export const maxAbsDiff = (a: CMatrix, b: CMatrix): number => {
  let d = 0;
  for (let k = 0; k < a.re.length; k++) {
    d = Math.max(d, Math.abs(a.re[k] - b.re[k]), Math.abs(a.im[k] - b.im[k]));
  }
  return d;
};

// --- SPECTRAL ---

/**
 * Eigenvalues of a Hermitian matrix H = A + iB, ascending.
 *
 * The real symmetric embedding [[A, −B], [B, A]] has the same eigenvalues as H,
 * each with doubled multiplicity, so a cyclic Jacobi sweep on it suffices.
 */
export const hermitianEigenvalues = (h: CMatrix): number[] => {
  const n = h.n;
  const N = 2 * n;
  const a = new Float64Array(N * N);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const re = h.re[i * n + j];
      const im = h.im[i * n + j];
      a[i * N + j] = re;
      a[(i + n) * N + (j + n)] = re;
      a[i * N + (j + n)] = -im;
      a[(i + n) * N + j] = im;
    }
  }

  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < N; p++) for (let q = p + 1; q < N; q++) off += a[p * N + q] ** 2;
    if (off < 1e-26) break;

    for (let p = 0; p < N; p++) {
      for (let q = p + 1; q < N; q++) {
        const apq = a[p * N + q];
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (a[q * N + q] - a[p * N + p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < N; k++) {
          const akp = a[k * N + p];
          const akq = a[k * N + q];
          a[k * N + p] = c * akp - s * akq;
          a[k * N + q] = s * akp + c * akq;
        }
        for (let k = 0; k < N; k++) {
          const apk = a[p * N + k];
          const aqk = a[q * N + k];
          a[p * N + k] = c * apk - s * aqk;
          a[q * N + k] = s * apk + c * aqk;
        }
      }
    }
  }

  const doubled = Array.from({ length: N }, (_, i) => a[i * N + i]).sort((x, y) => x - y);
  // Each eigenvalue appears twice in the embedding; keep one of each pair.
  return doubled.filter((_, i) => i % 2 === 0);
};

/** Shannon entropy in bits of a probability vector (zeros contribute nothing). */
export const shannonEntropy = (p: number[]): number =>
  // Clamp: rounding can push a pure state's entropy to a tiny negative number.
  Math.max(0, p.reduce((s, x) => (x > 1e-15 ? s - x * Math.log2(x) : s), 0));

/** Von Neumann entropy S(ρ) = −Tr(ρ log₂ ρ), in bits. */
export const vonNeumannEntropy = (rho: CMatrix): number =>
  shannonEntropy(hermitianEigenvalues(rho).map((x) => Math.max(0, x)));
