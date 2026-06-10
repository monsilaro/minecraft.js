// Tiny WebAudio synth: every sound generated, no assets.

let ctx = null;

function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
}

function tone(f0, f1, dur, type = 'square', vol = 0.12, delay = 0) {
    try {
        const a = ac();
        const t0 = a.currentTime + delay;
        const osc = a.createOscillator();
        const g = a.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(g).connect(a.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    } catch {
        /* audio not available */
    }
}

function burst(dur, vol = 0.15, freq = 800, delay = 0) {
    try {
        const a = ac();
        const t0 = a.currentTime + delay;
        const len = Math.max(1, Math.floor(a.sampleRate * dur));
        const buf = a.createBuffer(1, len, a.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = a.createBufferSource();
        src.buffer = buf;
        const filter = a.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = freq;
        const g = a.createGain();
        g.gain.value = vol;
        src.connect(filter).connect(g).connect(a.destination);
        src.start(t0);
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
    place() {
        tone(220, 150, 0.07, 'square', 0.1);
    },
    breakBlock() {
        burst(0.13, 0.22, 900);
    },
    dig() {
        burst(0.035, 0.06, 700);
    },
    pickup() {
        tone(520, 900, 0.09, 'sine', 0.12);
    },
    hurt() {
        tone(190, 100, 0.18, 'sawtooth', 0.18);
    },
    mobHit() {
        burst(0.08, 0.16, 500);
        tone(260, 160, 0.08, 'square', 0.08);
    },
    eat() {
        burst(0.06, 0.1, 600, 0);
        burst(0.06, 0.1, 500, 0.18);
        burst(0.06, 0.1, 550, 0.36);
    },
    craft() {
        tone(330, 440, 0.1, 'triangle', 0.12);
    },
    oink() {
        tone(300 + Math.random() * 80, 180, 0.13, 'square', 0.06);
    },
    groan() {
        tone(120, 65, 0.55, 'sawtooth', 0.05);
    },
    death() {
        tone(220, 40, 0.9, 'sawtooth', 0.2);
    },
    bow() {
        tone(600, 220, 0.12, 'triangle', 0.1);
    },
    rattle() {
        burst(0.04, 0.05, 2200, 0);
        burst(0.04, 0.05, 1800, 0.09);
        burst(0.04, 0.05, 2000, 0.17);
    },
    hiss() {
        burst(0.9, 0.12, 3500);
    },
    explosion() {
        burst(0.7, 0.45, 250);
        tone(90, 30, 0.6, 'sawtooth', 0.25);
    },
    equip() {
        tone(280, 380, 0.08, 'triangle', 0.1);
    },
};
