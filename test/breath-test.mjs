// Smoke test for the Breath module: the Gloom tide must be gone at Reflux
// (noon) and peak during the Respiration (midnight), and the tideline must
// rise monotonically with the gloom level. Run: node test/breath-test.mjs
import {
    breathLevel,
    gloomLineY,
    smoothstep,
    gloomExposure,
    gloomDamagePerSecond,
    GLOOM_BITE_MIN,
    GLOOM_MAX_DPS,
} from '../src/world/breath.js';
import { SEA } from '../src/world/constants.js';

const MIN_Y = SEA - 8,
    MAX_Y = SEA + 20;

// a high tide whose line is at y=50 (gloom past the bite threshold)
const LINE = 50;
const HIGH = 0.9;

function approx(a, b, eps = 1e-6) {
    return Math.abs(a - b) <= eps;
}

const noon = breathLevel(0.25);
const midnight = breathLevel(0.75);
const sunrise = breathLevel(0.0);

const checks = [
    ['smoothstep clamps low', smoothstep(-5, 0, 1), 0],
    ['smoothstep clamps high', smoothstep(5, 0, 1), 1],
    ['smoothstep midpoint = 0.5', smoothstep(0.5, 0, 1), 0.5],
    ['gloom ~0 at Reflux (noon)', noon, 0],
    ['gloom ~1 at Respiration (midnight)', midnight, 1],
    ['gloom rises from noon to midnight', midnight > sunrise && sunrise >= noon, true],
    ['tideline below seabed at Reflux', gloomLineY(0, MIN_Y, MAX_Y), MIN_Y],
    ['tideline above sea at full Respiration', gloomLineY(1, MIN_Y, MAX_Y), MAX_Y],
    [
        'tideline rises with gloom',
        gloomLineY(0.5, MIN_Y, MAX_Y) > gloomLineY(0.2, MIN_Y, MAX_Y),
        true,
    ],

    // --- the Gloom's bite ---
    ['no exposure above the tideline', gloomExposure(LINE + 1, HIGH, LINE), 0],
    ['no exposure at low tide', gloomExposure(LINE - 20, GLOOM_BITE_MIN, LINE), 0],
    ['full exposure deep + high tide', gloomExposure(LINE - 12, 1, LINE), 1],
    [
        'exposure deepens as you sink',
        gloomExposure(LINE - 8, HIGH, LINE) > gloomExposure(LINE - 2, HIGH, LINE),
        true,
    ],
    ['light wards the Gloom off (no damage)', gloomDamagePerSecond(1, true), 0],
    ['unlit full exposure drains max dps', gloomDamagePerSecond(1, false), GLOOM_MAX_DPS],
    ['no damage with no exposure', gloomDamagePerSecond(0, false), 0],
];

let fail = 0;
for (const [name, got, want] of checks) {
    const ok = typeof want === 'number' ? approx(got, want, 1e-3) : got === want;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got ${got}, want ${want})`);
}
process.exit(fail ? 1 : 0);
