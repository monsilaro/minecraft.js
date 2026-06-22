// The Breath — Hollow's signature tide of Gloom (the Ténèbres).
//
// The world "breathes": a tide of darkness rises and falls on the same cycle
// that drives the sky (sky.timeOfDay). At high tide (the Respiration, ~midnight)
// the Gloom floods the valleys; at low tide (the Reflux, ~noon) it recedes,
// uncovering the deep. This module is pure (no THREE / no DOM) so it can be
// unit-tested and shared by both the sky and the chunk shader.
//
// `breathLevel` is, by construction, the inverse of the chunk skylight factor in
// sky.js (dayFactor = smoothstep(sinH, -0.12, 0.25)): when it's bright the Gloom
// is gone, when it's dark the Gloom is at its peak.

// GLSL-style smoothstep with clamp. Mirrors THREE.MathUtils.smoothstep, and
// works with edge0 > edge1 (the interpolation simply runs the other way).
export function smoothstep(x, edge0, edge1) {
    if (edge0 === edge1) return x < edge0 ? 0 : 1;
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

// Gloom level for a given time of day, 0 (full Reflux) .. 1 (peak Respiration).
// timeOfDay: 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight.
export function breathLevel(timeOfDay) {
    const sinH = Math.sin(timeOfDay * Math.PI * 2);
    // inverse of dayFactor: high when sinH is low (night), zero around noon
    return smoothstep(sinH, 0.25, -0.3);
}

// World-Y of the Gloom tideline for a given gloom level. At full Reflux the line
// sits below the seabed (nothing flooded); at peak Respiration it drowns the
// valleys well above sea level. Callers pass minY = SEA - 8, maxY = SEA + 20.
export function gloomLineY(gloom, minY, maxY) {
    return minY + (maxY - minY) * gloom;
}

// ---- The Gloom's bite (survival tuning) ----
// Below the tideline at high tide, the Gloom drains your life — unless lantern
// light wards it off. Two escapes mirror the fiction: climb above the line, or
// stand in light. These constants are the dials; the functions are pure so the
// damage model can be unit-tested without a world.
export const GLOOM_BITE_MIN = 0.45; // tide must rise past this before it harms
export const GLOOM_DEPTH_FULL = 12; // blocks below the line for full intensity
export const GLOOM_MAX_DPS = 3; // hp/s drained when fully exposed and unlit
export const GLOOM_SAFE_RADIUS = 7; // search radius (blocks) for protective light
export const GLOOM_SAFE_LIGHT = 6; // effective light level that holds the Gloom off
export const BRAZIER_SAFE_RADIUS = 9; // a Brazier wards a larger guaranteed sphere

// How exposed the player is to the Gloom, 0 (safe) .. 1 (drowning at peak tide).
// Zero above the tideline or before the tide rises past the bite threshold;
// scales with both how deep below the line and how high the tide stands.
export function gloomExposure(playerY, gloom, gloomLineY) {
    if (gloom <= GLOOM_BITE_MIN) return 0;
    const depth = gloomLineY - playerY;
    if (depth <= 0) return 0;
    const submerged = Math.min(1, depth / GLOOM_DEPTH_FULL);
    const tide = (gloom - GLOOM_BITE_MIN) / (1 - GLOOM_BITE_MIN);
    return Math.max(0, Math.min(1, submerged * tide));
}

// Life drained per second for a given exposure. Lantern light (lit) stops it dead.
export function gloomDamagePerSecond(exposure, lit) {
    if (lit || exposure <= 0) return 0;
    return exposure * GLOOM_MAX_DPS;
}

// A carried (attuned) lantern cancels `bearer` of the raw exposure. At bearer 1.0
// it's full immunity while held; lower attunements only cover shallow gloom, so
// deeper/higher-tide regions still bite until you attune further.
export function mitigatedExposure(exposure, bearer) {
    return Math.max(0, exposure - bearer);
}
