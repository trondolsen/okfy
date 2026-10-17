---
type: Algorithm
title: Spectrogram
description: A rolling mel spectrogram of the live audio graph, shared by the assistant's speech, the microphone and an audio clip's preview.
tags: [algorithm, audio, spectrogram, canvas]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – asBuildMel, asLogMel and asSpecFrame
---

# Problem

The tool has to show what is being heard — the assistant's own speech, the microphone or a clip's audio — while it plays, without a library and without reading the audio bytes again for the picture. See the [spectrogram explainer](attachments/spectrogram.svg) for the filterbank, one column, the colour ramp and the rolling history.

# Three sources, one renderer

An **AnalyserNode** taps the audio graph and the same function draws all three sources, so the clip's view and the spoken one are the same picture:

| Source | `fftSize` | smoothing | Drawn on |
| --- | --- | --- | --- |
| The assistant's speech | 2048 | 0.5 | the commentary bubble |
| An audio clip's preview | 2048 | 0.5 | the player's framed canvas |
| The microphone | 1024 | 0.4 | the listening bubble |

The **FFT is the browser's**: the analyser reports one decibel value per frequency bin. What the tool adds is the mel pooling, the decibel scale, the colour ramp and the rolling history.[^source]

# The frame

One animation frame does the same four things, roughly sixty times a second:[^source]

1. Read the analyser's spectrum — `getFloatFrequencyData`, one decibel value per bin.
2. Pool it into **48 mel bands**, each in decibels (`asLogMel`).
3. Turn each band into a colour and write a one-pixel-wide column at the right edge of an offscreen history canvas.
4. Shift the history one pixel left and blit it to the visible canvas, sized in device pixels.

# The filterbank

`asBuildMel` spreads `nMels + 2` points **evenly on the mel scale** between 0 Hz and the top of the range, then maps each point back to hertz with `700 · (10^(m / 2595) − 1)`. Band *m* is a triangle that rises from point *m*, peaks at *m + 1* and falls to *m + 2*, so neighbouring bands overlap.

The mel scale is nearly linear at the bottom and compresses at the top, so the triangles get **wider as the frequency rises** and the low frequencies — where vowels and formants live — get proportionally more bands. The set is built for the analyser's own `fftSize` and sample rate, and capped at the Nyquist frequency.

# One column

A band's energy is the sum of its bins as **weighted power**, then written in decibels. That value is mapped onto a 70 dB window, from `AS_SPEECH_DB_FLOOR` (−95) to `AS_SPEECH_DB_CEIL` (−25), raised to the power 0.7 so quiet detail still shows, and mixed from the panel's own dark blue to the accent colour, so the view stays on theme. **Band 0, the lowest frequency, is drawn at the bottom**, so pitch reads up the column and time runs left to right.

# The rolling history

The history is an offscreen canvas. Each frame bakes the newest column onto its right edge, shifts the whole history one pixel left, and blits the result to the visible canvas. The shift uses `copy` compositing, which also clears the freed rightmost column, so the newest column always lands on empty pixels; a fresh clip or utterance clears the history, so its spectrogram rolls in from an empty field instead of splicing onto the last one.

Because the history is offscreen, a **snapshot** can copy it into a canvas of its own. That is what keeps a spectrogram in a bubble after playback has ended: it is frozen into the message when the speech finishes, and redrawn (scaled to fill) whenever the bubble is re-rendered.

# Scope and bounds

Only **audio** draws this view. A video plays in a plain media element with the browser's own controls, and a non-media file has no player at all. The spectrogram itself is computed live from the analyser — one pooled spectrum per frame, never per sample — so it costs the same for a long clip as for a short one. The clip's *bytes* are bounded separately: a clip up to `MAX_MEDIA_BYTES` (256 MiB) is read whole, one small enough to decode within `MAX_MEDIA_DECODE_BYTES` (32 MiB) is decoded for grain-accurate scrubbing, and a larger local clip streams from its object URL into the same analyser.

# Connections

- [Audio and video previews](../interface/file-preview.md)
- [The assistant](../interface/assistant.md)
- [Media file kinds](../design/interface-design.md)
- [Limits and budgets](../security/limits-and-budgets.md)

[^source]: `asBuildMel`, `asLogMel`, `asSpecFrame` and the analyser setup in the tool source.
