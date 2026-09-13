/**
 * Re-export of the shared seeded PRNG. Crossword historically imported from
 * this path; keep it so the crossword generator does not need to change.
 */
export { createRng, type Rng } from "../random"
