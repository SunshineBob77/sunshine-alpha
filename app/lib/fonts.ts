import { Caveat, Fraunces } from "next/font/google";

export const caveat = Caveat({ weight: ["600", "700"], subsets: ["latin"] });

// Headline font for the Lifeline feed screen's dark restyle only (Drop
// titles) - every other screen keeps Geist Sans as its only font.
export const fraunces = Fraunces({ weight: ["500", "600"], subsets: ["latin"] });
