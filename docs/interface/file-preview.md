---
type: Reference
title: File, image and media preview
description: How the preview panel shows non-Markdown files, including image files, audio and video clips, and the text toggle for text-based images.
tags: [interface, preview, images, files, media]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – renderPreviewEntry, renderImagePreview, renderMediaPreview, renderAudioPreview, renderVideoPreview, renderVttPreview, localMediaBytes, pvVolumeHtml, pvSetVolume, pvApplyVolume, pvWireVolume
  - id: vtt
    resource: https://www.w3.org/TR/webvtt1/
    title: WebVTT – the Web Video Text Tracks Format
---

# Preview content by kind

Clicking a node opens the preview panel. What it shows depends on the node kind:[^source]

- A **concept** or **index** node renders its Markdown; see [Markdown preview](../algorithms/markdown-preview.md).
- A **file** node (non-Markdown text) shows its source text. When the file is an image — in practice an SVG — the preview shows the image instead, with a **Show source** toggle (and **Show image** to switch back). When it is a **WebVTT** subtitle track it is shown as a **transcript** instead: see [Captions](#captions).
- A **binary file** node shows its file details. A binary image is displayed inline, a PDF shows its metadata, and an audio or video file plays in a media player.

The panel is one reused element: opening an entry replaces its content and scrolls it back to the top, so a new entry never opens where the previous one was left.[^source]

# Images

An image is shown only after the same URL checks as other images: the bytes are read within the bundle budget and displayed from a blob URL, never from a network or `data:` URL in the content. It is stretched to fill the preview area — scaled up or down as needed — while keeping its aspect ratio and showing the whole image, so it neither crops nor scrolls. A text-based image (such as an SVG) can switch between the rendered image and the source text, because its bytes are text. A binary image has no text representation and so has no toggle.[^source]

# Audio and video

A media file plays on demand, and how it is loaded depends on where it lives. A **local** clip — a file in a folder you opened — is read whole and decoded when it is within the decode bound below; a **larger** local clip is not read at all, and plays from an object URL that the browser reads **on demand**, so a clip well past the bound still plays without being held whole in memory. A **served** clip is fetched once when it is opened, bounded by its own byte limit: one within the decode bound is decoded, and a larger one plays from a blob URL of its own bytes — read once and held whole, but never decoded into samples — so, like every media clip here, nothing is streamed from the network while it plays.[^source]

A **video** plays in a `<video>` element with the browser's own controls. An **audio** clip plays through the Web Audio graph — the same analysis graph the assistant's speech bubbles use — so the audio preview draws the **same rolling mel spectrogram** the assistant shows while it speaks. A decoded audio clip — a served or local clip within the decode bound — has its bytes in memory, which also lets its seek bar scrub by grains; a larger clip (a served one played from its blob, or a local one streamed from its object URL) plays through a media element into the same analyser, and its seek bar seeks.

The audio player lays its volume button, play/pause button, scrubber and position read-out inline over the foot of the spectrogram. The scrubber is a **fill** — the filled part of the track is the position, with no handle. Closing the preview stops the player rather than leaving it running behind the hidden panel.

## Volume

Both players carry one **volume control**: a speaker button beside the transport control — immediately left of the audio player's play/pause button, and over a video's lower corner just above its own controls — that opens a **vertical slider** above it. The slider pops up on click and closes on a click outside it, so it takes no room from the transport bar. The two players share a single volume, so lowering it while listening carries over to the next audio or video you open, and the value is remembered in `localStorage` (`okfy.volume`) across reloads. A video keeps its own native volume control; the slider and the remembered value stay in step with it, so either control works and the last setting is what carries over. The assistant's speech bubbles have their own output and are deliberately not affected by this control.[^source]

## Captions

When the folder holds a sibling **WebVTT** file — `{name}.vtt` next to an audio or video file `{name}.{format}` — it is read on demand and its cues are shown as the clip plays: over the spectrogram for an audio clip, and over the video for a video clip.[^vtt] The track is untrusted input like any other bundle file: it is read bounded, its cues are parsed for timings and text only, and each caption is shown as plain words, so its markup is never rendered and cue settings and region placement are ignored. Because the track is read only up to its own limit, a larger track contributes the captions within that limit and nothing beyond it — or, for a served track the bundle cannot read under the limit, no captions at all. A local folder finds the sibling among its own files; a served sibling the graph does not hold is tried once at its own URL, and a missing one simply leaves the player without captions.

**The track as its own page.** A `.vtt` file is also a node, and opening it shows the track as a **transcript** rather than as raw WebVTT: each cue becomes one line of `time` and the words that were spoken, and that Markdown goes through the **same document renderer the Markdown preview uses**, so the transcript is presented like any other page and the reader's own page tools — highlight, scroll, selection — work on it exactly as they do on a concept. The words are **literal**: the characters Markdown gives meaning to are escaped, so a track cannot introduce emphasis, a list or a link that it never had, and a transcript reads as it was spoken. A word-level track, which repeats its line as the highlight moves through it, is shown once per distinct line. The transcript is bounded, so a very long track shows its head (see [Limits and budgets](../security/limits-and-budgets.md)); a file with no cues at all is shown as it is rather than as an empty page. The assistant reads the same transcript, word for word, through its `read_file` tool.

**What the media page says about its track.** The file details under a media page name the track beside it — its path, its size when the folder or bundle holds it, and its cue count once it has been read — so a reader can tell that a clip has captions, and which file they come from, without opening anything else. A served sibling the bundle never listed appears there once the captions have loaded.

## Seek and scrub

Dragging the seek bar **scrubs** — the scrubber is the playhead, and the clip plays from wherever it is dragged. When the clip was decoded the audio is rendered as short, overlapping **grains** read from the head, each windowed to silence at its edges so the drag never clicks. The drag's speed sets both how far each grain reads ahead and how densely the grains are placed: a slow drag reads on slowly, which the grains render as a pitch-preserving stretch (each grain still plays at its own rate, so the pitch holds), and a fast drag is filled with **denser** grains — the read advance per grain is capped below a grain's length — so it stays a **continuous fast-forward** rather than falling into sparse, disjoint snippets; past the point where the grains can keep up, the audio saturates and the pointer simply outruns it. **Held at rest the grains keep firing at the fixed head, so the clip is heard infinitely slowed — a granular freeze — rather than going silent.** A larger, streamed clip — a local one read on demand, or a served one played from its blob — cannot be decoded for grains, so its element plays with its rate following the drag — re-seeking only once it has drifted from the pointer, since seeking a playing element on every pointer move stalls and silences it — slowing to the slowest step when the head rests. Releasing the scrubber resumes normal playback from where the drag left it, and a click or a keyboard move on the seek bar is a plain seek.[^source]

# Failure and limits

If an image cannot be loaded, the preview shows a short notice instead. An audio or video clip that is missing, unreadable or undecodable shows a notice in place of its player, and a **served** clip larger than the read limit is refused the same way — with a notice that names the clip's size, the limit it is read under and the way out: open the folder locally, where the clip streams and its size does not matter. The assistant is told the same thing (its `read_file` reports `readable: false` for such a clip), so it does not promise a player that is not there. A local clip is never fetched from the network, and a clip within the decode bound is read whole and decoded while a larger one — served or local — plays streamed from a blob, so its size does not matter past the served read bound. The image and media limits apply, as for content embedded in Markdown. See [Limits and budgets](../security/limits-and-budgets.md).

# Connections

- [Graph model](../model/graph-model.md)
- [Local folders](local-folders.md)
- [Markdown preview](../algorithms/markdown-preview.md)
- [URL and network bounds](../security/url-and-network-bounds.md)
- [Limits and budgets](../security/limits-and-budgets.md)

[^source]: `renderPreviewEntry`, `renderImagePreview`, `renderMediaPreview`, `renderAudioPreview`, `renderVideoPreview`, `renderVttPreview`, `mediaLocalUrl`, `mediaUrlFor`, `localMediaBytes`, `pvAudioStream`, `asScrubPlan`, `pvVolumeHtml`, `pvSetVolume`, `pvApplyVolume`, `pvWireVolume`, `associatedTrack`, `captionInfo`, `pvLoadVtt` and `pvVideoCues` in the tool source.
[^vtt]: WebVTT, the Web Video Text Tracks Format.
