import { describe, expect, it } from 'vitest';
import {
  adjoint,
  hermitianEigenvalues,
  identity,
  kron,
  matmul,
  matrix,
  maxAbsDiff,
  outer,
  scale,
  shannonEntropy,
  trace,
  traceProduct,
  vonNeumannEntropy,
} from './linalg';

describe('linalg', () => {
  it('multiplies, conjugates and traces complex matrices', () => {
    const a = matrix([[1, [0, 1]], [[2, -1], 3]]);
    expect(maxAbsDiff(matmul(a, identity(2)), a)).toBe(0);
    expect(maxAbsDiff(adjoint(adjoint(a)), a)).toBe(0);
    expect(trace(a)).toEqual({ re: 4, im: 0 });
    // Tr(A A†) is the squared Frobenius norm: 1 + 1 + 5 + 9.
    expect(traceProduct(a, adjoint(a))).toBeCloseTo(16, 12);
  });

  it('builds Kronecker products in row-major block order', () => {
    const x = matrix([[0, 1], [1, 0]]);
    const k = kron(x, identity(2));
    expect(k.n).toBe(4);
    expect(k.re[0 * 4 + 2]).toBe(1); // ⟨00|X⊗I|10⟩
    expect(k.re[0 * 4 + 1]).toBe(0);
  });

  it('finds eigenvalues of complex Hermitian matrices', () => {
    // [[2, i], [−i, 2]] has eigenvalues 1 and 3.
    expect(hermitianEigenvalues(matrix([[2, [0, 1]], [[0, -1], 2]]))).toEqual([
      expect.closeTo(1, 10),
      expect.closeTo(3, 10),
    ]);
    // Pauli Y ⊗ Pauli Y has eigenvalues −1, −1, 1, 1.
    const y = matrix([[0, [0, -1]], [[0, 1], 0]]);
    const ev = hermitianEigenvalues(kron(y, y));
    ev.forEach((v, i) => expect(v).toBeCloseTo(i < 2 ? -1 : 1, 10));
  });

  it('computes Shannon and von Neumann entropies in bits', () => {
    expect(shannonEntropy([0.5, 0.5])).toBeCloseTo(1, 12);
    expect(shannonEntropy([1, 0, 0])).toBe(0);
    expect(vonNeumannEntropy(scale(identity(4), 0.25))).toBeCloseTo(2, 10);
    // A pure state with complex amplitudes has zero entropy.
    const pure = outer([[Math.SQRT1_2, 0], [0, Math.SQRT1_2]]);
    expect(vonNeumannEntropy(pure)).toBeCloseTo(0, 10);
  });
});
