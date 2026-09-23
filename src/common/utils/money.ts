/** Rounds to the cent, avoiding float-dust (e.g. 0.1 + 0.2) in money math. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
