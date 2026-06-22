// Tiny WebAudio synth: every sound generated, no assets.
//
// Design goal: NATURAL, not electronic. Two rules keep it from sounding harsh:
//  1. soft attack — fade in over a few ms so onsets are a "thud", never a click.
//  2. lowpass-dominant, low frequencies, sine/triangle tones — warm, not buzzy.
// Avoid square/sawtooth: they read as cheap video-game beeps.

let ctx = null;
let master = null;
let volume = clampVol(parseFloat(localStorage.getItem('mc-ish-vol') ?? '0.8'));

function clampVol(v) {
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
}

function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
}

// master volume bus: all voices route through here
function out() {
    const a = ac();
    if (!master) {
        master = a.createGain();
        master.gain.value = volume;
        master.connect(a.destination);
    }
    return master;
}

export function setVolume(v) {
    volume = clampVol(v);
    localStorage.setItem('mc-ish-vol', String(volume));
    if (master) master.gain.value = volume;
}

export function getVolume() {
    return volume;
}

// Soft tonal voice. Sine/triangle only. Gentle attack ramp removes the click.
function tone(f0, f1, dur, type = 'sine', vol = 0.1, delay = 0, attack = 0.008) {
    try {
        const a = ac();
        const t0 = a.currentTime + delay;
        const osc = a.createOscillator();
        const g = a.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + Math.min(attack, dur * 0.4));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g).connect(out());
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    } catch {
        /* audio not available */
    }
}

// Lowpass-filtered noise impact. The gain envelope (soft attack + smooth decay)
// shapes it into a natural thud/crunch rather than a hissy burst.
function burst(dur, vol = 0.12, freq = 400, delay = 0, attack = 0.005) {
    try {
        const a = ac();
        const t0 = a.currentTime + delay;
        const len = Math.max(1, Math.floor(a.sampleRate * dur));
        const buf = a.createBuffer(1, len, a.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = a.createBufferSource();
        src.buffer = buf;
        const filter = a.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = freq;
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + Math.min(attack, dur * 0.4));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filter).connect(g).connect(out());
        src.start(t0);
        src.stop(t0 + dur + 0.02);
    } catch {
        /* audio not available */
    }
}

export const S = {
    unlock() {
        try {
            ac().resume();
        } catch {
            /* no-op */
        }
    },

    // dull, soft "tup" — low thud with a faint body
    place() {
        burst(0.07, 0.08, 300);
        tone(150, 110, 0.07, 'sine', 0.05);
    },
    // muffled crumble thud
    breakBlock() {
        burst(0.13, 0.11, 360);
    },
    // quiet scrape tick while mining
    dig() {
        burst(0.045, 0.05, 320);
    },
    // gentle rising blip
    pickup() {
        tone(480, 720, 0.1, 'sine', 0.09, 0, 0.01);
    },
    // soft body thump + low grunt, no buzz
    hurt() {
        burst(0.1, 0.1, 240);
        tone(170, 120, 0.16, 'sine', 0.07, 0, 0.01);
    },
    // soft punch
    mobHit() {
        burst(0.09, 0.12, 380);
    },
    // sharper, brighter double-tick for critical hits
    crit() {
        burst(0.06, 0.13, 560);
        burst(0.05, 0.1, 760, 0.05);
    },
    // three soft chews
    eat() {
        burst(0.05, 0.07, 420, 0);
        burst(0.05, 0.07, 360, 0.16);
        burst(0.05, 0.07, 400, 0.32);
    },
    // gentle wood double-tap
    craft() {
        burst(0.05, 0.07, 520);
        burst(0.05, 0.06, 440, 0.07);
    },
    // soft nasal grunt
    oink() {
        tone(280 + Math.random() * 50, 190, 0.14, 'triangle', 0.05, 0, 0.012);
    },
    // low soft moan
    groan() {
        tone(115, 90, 0.6, 'sine', 0.05, 0, 0.04);
    },
    // soft descending tone
    death() {
        tone(200, 60, 0.8, 'sine', 0.13, 0, 0.02);
    },
    // soft string pluck + warm twang
    bow() {
        burst(0.025, 0.04, 1200);
        tone(500, 260, 0.09, 'sine', 0.06, 0, 0.004);
    },
    // three soft bone clicks
    rattle() {
        burst(0.03, 0.04, 1400, 0);
        burst(0.03, 0.04, 1200, 0.09);
        burst(0.03, 0.04, 1300, 0.17);
    },
    // airy fuse hiss
    hiss() {
        burst(0.8, 0.08, 2500, 0, 0.1);
    },
    // low boom + sub rumble
    explosion() {
        burst(0.7, 0.38, 220, 0, 0.008);
        tone(80, 30, 0.6, 'sine', 0.2, 0, 0.01);
    },
    // soft click
    equip() {
        tone(440, 560, 0.07, 'sine', 0.07, 0, 0.005);
    },
    // wooden door creak
    door() {
        burst(0.12, 0.08, 260);
        tone(230, 150, 0.13, 'triangle', 0.06, 0, 0.012);
    },
};
