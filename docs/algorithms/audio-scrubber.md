---
type: Algorithm
title: Audio scrubber
description: The fill-only seek bar and the granular scrub behind a drag — a pitch-preserving stretch when slow, a continuous fast-forward when fast, and a freeze at rest.
tags: [algorithm, audio, grains, playback]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the scrub helpers and pvAudioScrubStart, pvAudioScrubTick, pvAudioGrain
---

# Problem

Dragging an audio player's seek bar normally jumps the playhead in silence, so the reader cannot hear *where* they are. The tool has to make a drag audible — as tape scrubbing is — without a library, and without resampling the clip. See the [audio scrubber explainer](attachments/audio-scrubber.svg) for the control, the grain, the plan and the freeze.

# The control

The scrubber is one `<input type="range">` with 1000 steps, drawn as a **fill**: the filled part of the track is the position and the circular thumb is removed. It sits over the foot of the spectrogram beside the play button and the time read-out. A pointer drag **scrubs** — the playhead follows the pointer and the audio plays through the drag — while the keyboard drives the same `input` event, which is treated as a plain seek.

# Two paths

A clip that could be decoded for grains **scrubs with grains**; one too large to decode streams through a media element and **scrubs with its playback rate**.

# The grain

A grain is a 60 ms window of the clip, played from its own `AudioBufferSource` at its own rate — the buffer is never resampled, so a dragged stretch keeps its pitch. Its envelope is a **raised cosine** of 48 points (`setValueCurveAtTime`), so each grain is silent at both edges and two overlapping grains cross-fade instead of clicking.

# The plan

Each tick measures the drag's velocity on the audio clock, smooths it, and asks for two numbers:[^source]

```
hop     = clamp(0.045 / max(1, |vel|), 0.008, 0.02)   // how often a grain starts
advance = clamp(vel * hop, -0.045, 0.045)             // how far the head moves per grain
```

- Up to **2.25×**, `hop` stays at 20 ms — fifty grains a second — and only `advance` grows: a pitch-preserving time-stretch.
- From there the grains get **denser** — up to 125 a second — while `advance` is pinned at 45 ms, **three quarters of a grain**, so consecutive windows always overlap in the source.
- Past about **5.6×** the audio saturates at the densest hop and the pointer simply outruns it.

The point of the cap is that a fast drag stays a **continuous fast-forward** rather than falling into sparse, disjoint snippets. Grains are launched on the audio clock rather than on the tick's 10 ms timer, so their spacing stays even; a jump or a reversal of more than one grain snaps the read head to the pointer.

# Held still

At rest the velocity is zero, so `advance` is zero and the head stops — but the grains keep firing at it, reading the same 60 ms window about fifty times a second. Heard, that is the clip infinitely slowed, a **granular freeze**, rather than a silence.

A streamed clip cannot be decoded for grains, so its rate carries the motion instead: `playbackRate = clamp(drag rate, 0.3, 4)` with the pitch kept. It is re-seeked only once it has drifted 0.35 s from the pointer, because seeking a playing element on every pointer move stalls it and silences it; at rest its rate drops to 0.3, which is still audible.

# Release

On release the slider's live value is read, so the head lands exactly where the pointer left it even if the last tick ran a moment before. The offset is set there and normal playback resumes from that spot, the grains fading out as the clip takes over. The assistant's media tool moves the same way: `pvScrubTo` starts a scrub at the current position and walks the bar in twenty steps, so a move sounds like a drag rather than a silent jump.

# Connections

- [Audio and video previews](../interface/file-preview.md)
- [Spectrogram](spectrogram.md)
- [Interface design](../design/interface-design.md)

[^source]: `asScrubPlan`, `asScrubWindow`, `asScrubCurve` and `pvAudioScrubTick` in the tool source.
