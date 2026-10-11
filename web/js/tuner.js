// Tuner ------------------------------------------------------------------------
// Listens to the microphone, finds the pitch by autocorrelation and shows how far
// it is from the nearest string of the chosen instrument (or nearest note).

const SETTINGS = {
    referenceFrequency: 440,
    rmsThreshold: 0.01, // quieter input is ignored
    autocorrelateThreshold: 0.002,
    fftSize: 2048,
    analyzeIntervalMs: 66, // ~15 measurements per second
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const INSTRUMENTS = {
    guitar: ["E2", "A2", "D3", "G3", "B3", "E4"],
    bass: ["E1", "A1", "D2", "G2"],
    ukulele: ["G4", "C4", "E4", "A4"],
    violin: ["G3", "D4", "A4", "E5"],
    cello: ["C2", "G2", "D3", "A3"],
    banjo: ["G4", "D3", "G3", "B3", "D4"],
    mandolin: ["G3", "D4", "A4", "E5"],
    chromatic: [],
};

function noteFrequency(note) {
    const match = /^([A-G]#?)(\d+)$/.exec(note);
    const semitonesFromA4 = NOTE_NAMES.indexOf(match[1]) - 9 + (Number(match[2]) - 4) * 12;
    return SETTINGS.referenceFrequency * Math.pow(2, semitonesFromA4 / 12);
}

const STRINGS = Object.fromEntries(Object.entries(INSTRUMENTS).map(([instrument, notes]) => [
    instrument,
    notes.map((name) => ({ name, frequency: noteFrequency(name) })),
]));

function closestNote(frequency) {
    const noteNumber = 12 * Math.log2(frequency / SETTINGS.referenceFrequency) + 49;
    const rounded = Math.round(noteNumber);
    return {
        name: NOTE_NAMES[(((rounded + 8) % 12) + 12) % 12] + Math.floor((rounded + 8) / 12),
        cents: Math.round((noteNumber - rounded) * 100),
    };
}

function closestString(frequency, strings) {
    let best = null;
    for (const string of strings) {
        const cents = Math.round(1200 * Math.log2(frequency / string.frequency));
        if (!best || Math.abs(cents) < Math.abs(best.cents)) {
            best = { name: string.name, cents };
        }
    }
    return best;
}

function autoCorrelate(buffer, sampleRate) {
    const size = buffer.length;
    let sum = 0;
    for (let i = 0; i < size; i += 1) sum += buffer[i] * buffer[i];
    if (Math.sqrt(sum / size) < SETTINGS.rmsThreshold) return -1;

    // Trim quiet edges
    const threshold = SETTINGS.autocorrelateThreshold;
    let r1 = 0;
    let r2 = size - 1;
    for (let i = 0; i < size / 2; i += 1) {
        if (Math.abs(buffer[i]) < threshold) { r1 = i; break; }
    }
    for (let i = 1; i < size / 2; i += 1) {
        if (Math.abs(buffer[size - i]) < threshold) { r2 = size - i; break; }
    }
    const trimmed = buffer.slice(r1, r2);
    const n = trimmed.length;
    if (n < 2) return -1;

    const correlation = new Float32Array(n);
    for (let lag = 0; lag < n; lag += 1) {
        let value = 0;
        for (let i = 0; i + lag < n; i += 1) value += trimmed[i] * trimmed[i + lag];
        correlation[lag] = value;
    }

    // Skip the initial slope, then take the highest peak
    let d = 0;
    while (d < n - 1 && correlation[d] > correlation[d + 1]) d += 1;
    let bestLag = -1;
    let bestValue = -Infinity;
    for (let i = d; i < n; i += 1) {
        if (correlation[i] > bestValue) { bestValue = correlation[i]; bestLag = i; }
    }
    if (bestLag <= 0) return -1;

    // Parabolic interpolation around the peak
    const x1 = correlation[bestLag - 1] || 0;
    const x2 = correlation[bestLag];
    const x3 = correlation[bestLag + 1] || 0;
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    return sampleRate / (bestLag + (a ? b / (2 * a) : 0));
}

class Tuner {
    constructor(onUpdate) {
        this.onUpdate = onUpdate;
        this.strings = STRINGS.guitar;
        this.audio = null;
        // Bumped by stop(), so a start() still waiting for the microphone can tell it was cancelled
        this.generation = 0;
        this.pending = null; // the generation a start() is waiting in
    }

    setInstrument(instrument) {
        this.strings = STRINGS[instrument] ?? [];
    }

    async start() {
        if (this.audio || this.pending === this.generation) return;
        const generation = this.generation;
        this.pending = generation;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (generation !== this.generation) {
                // Left the tuner before the reader answered the permission prompt
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            const context = new AudioContext();
            const analyser = context.createAnalyser();
            analyser.fftSize = SETTINGS.fftSize;
            context.createMediaStreamSource(stream).connect(analyser);
            this.audio = { stream, context, analyser, buffer: new Float32Array(analyser.fftSize) };
            this.timer = setInterval(() => this.analyze(), SETTINGS.analyzeIntervalMs);
            this.onUpdate({ listening: true });
        } catch (error) {
            console.error("Unable to start tuner:", error);
            this.pending = null;
            this.onUpdate({ listening: false });
        }
    }

    stop() {
        this.generation += 1;
        if (!this.audio) return;
        clearInterval(this.timer);
        this.audio.stream.getTracks().forEach((track) => track.stop());
        this.audio.context.close().catch(() => {});
        this.audio = null;
        this.onUpdate({ listening: false });
    }

    analyze() {
        const { analyser, buffer, context } = this.audio;
        analyser.getFloatTimeDomainData(buffer);
        const frequency = autoCorrelate(buffer, context.sampleRate);
        if (frequency <= 0) {
            this.onUpdate({ listening: true });
            return;
        }
        const target = this.strings.length ? closestString(frequency, this.strings) : closestNote(frequency);
        this.onUpdate({ listening: true, target: target.name, cents: target.cents });
    }
}

/** Wires the tuner page of the settings menu; the menu starts and stops it as the page is shown and left. */
export function setupTuner() {
    const instrument = document.getElementById("tuner-instrument");
    const targetNote = document.getElementById("tuner-target-note");
    const label = document.getElementById("tuner-label");
    const marker = document.getElementById("tuner-bar-marker");
    const fill = document.getElementById("tuner-bar-fill");
    const status = document.getElementById("tuner-status");

    const tuner = new Tuner(({ listening, target = null, cents = 0 }) => {
        status.classList.toggle("listening", listening);
        status.lastElementChild.textContent = listening ? "Poslouchám" : "Mikrofon je vypnutý";
        targetNote.textContent = target ?? "-";
        label.textContent = target ? `${cents >= 0 ? "+" : ""}${cents}¢` : "-";
        marker.style.left = `${Math.max(0, Math.min(100, 50 + cents))}%`;

        const closeness = 100 - Math.abs(cents);
        fill.dataset.closeness = !target ? "" : closeness > 90 ? "good" : closeness > 60 ? "ok" : "bad";
        targetNote.classList.toggle("tuned", Boolean(target) && closeness > 90);
    });

    tuner.setInstrument(instrument.value);
    instrument.addEventListener("change", () => tuner.setInstrument(instrument.value));
    status.lastElementChild.textContent = "Mikrofon je vypnutý";
    return { start: () => tuner.start(), stop: () => tuner.stop() };
}
