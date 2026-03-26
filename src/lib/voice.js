'use client';

// Initialise voice list early so it's ready when needed
export function ensureVoicesLoaded() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices(); // triggers async load
}

function getAmericanFemaleVoice() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    // Priority list — first match wins
    const matchers = [
        (v) => v.name === 'Google US English' && v.lang === 'en-US',
        (v) => v.name.includes('Samantha') && v.lang === 'en-US',
        (v) => v.name.includes('Microsoft Jenny') && v.lang.startsWith('en-US'),
        (v) => v.name.includes('Microsoft Aria') && v.lang.startsWith('en-US'),
        (v) => v.name.includes('Zira') && v.lang.startsWith('en'),
        (v) => v.lang === 'en-US' && !v.name.toLowerCase().includes('male'),
        (v) => v.lang === 'en-US',
        (v) => v.lang.startsWith('en-'),
    ];

    for (const match of matchers) {
        const found = voices.find(match);
        if (found) return found;
    }
    return voices[0] || null;
}

export function speak(text, { rate = 0.93, pitch = 1.08, volume = 1.0 } = {}) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const trimmed = text?.trim();
    if (!trimmed) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(trimmed);
    const voice = getAmericanFemaleVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    window.speechSynthesis.speak(utterance);
}

export function stopSpeech() {
    if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel();
    }
}

/**
 * Converts a navigation step object into a natural spoken instruction.
 */
export function formatNavInstruction(step) {
    if (!step) return '';
    const type = (step.maneuver?.type || '').toLowerCase();
    const mod  = (step.maneuver?.modifier || '').toLowerCase();
    // step.name is already English-resolved from api.js (never Arabic)
    // Use instruction as fallback display text; name for "onto X"
    const name = step.name?.trim() || '';
    const dist = step.distance?.trim() || '';

    if (type === 'arrive') {
        return name ? `You have arrived at ${name}.` : 'You have arrived at your destination.';
    }
    if (type === 'depart') {
        return name ? `Start on ${name}.` : 'Start navigation.';
    }

    let verb = 'Continue';
    if (type === 'turn' || type === 'new name') {
        if (mod.includes('sharp left'))       verb = 'Take a sharp left';
        else if (mod.includes('sharp right')) verb = 'Take a sharp right';
        else if (mod.includes('slight left')) verb = 'Bear left';
        else if (mod.includes('slight right'))verb = 'Bear right';
        else if (mod.includes('left'))        verb = 'Turn left';
        else if (mod.includes('right'))       verb = 'Turn right';
        else if (mod.includes('uturn'))       verb = 'Make a U-turn';
    } else if (type === 'roundabout' || type === 'rotary') {
        verb = 'Enter the roundabout';
    } else if (type === 'merge') {
        verb = mod.includes('left') ? 'Merge left' : mod.includes('right') ? 'Merge right' : 'Merge';
    } else if (type === 'fork') {
        verb = mod.includes('left') ? 'Keep left' : 'Keep right';
    } else if (type === 'off ramp') {
        verb = mod.includes('left') ? 'Take the exit on the left' : 'Take the exit on the right';
    }

    const prelude = dist ? `In ${dist}, ` : '';
    const onto    = name ? ` onto ${name}` : '';
    return `${prelude}${verb}${onto}.`;
}
