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
