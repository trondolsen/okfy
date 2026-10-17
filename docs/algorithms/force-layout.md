---
type: Algorithm
title: Force layout
description: A d3-force-style simulation with Barnes-Hut repulsion, link and radial forces, and grid collision, run on a canvas, on a physics module shared with the mascot.
tags: [algorithm, layout, simulation, canvas]
okfx:
  mode: reference
  version: praxis/1
sources:
  - id: source
    resource: ../../okfy.html
    title: okfy.html – the physics, layout step and draw sections
---

# Context

The graph is drawn on an HTML canvas with no charting library. Node positions are found by a continuous **force simulation** in the style of `d3-force`, written from scratch. See the [force layout explainer](attachments/force-layout.svg) for the forces, the quadtree, one Verlet step and the cooling temperature.[^source]

# Forces

The simulation accumulates acceleration from several forces:[^source]

- **Many-body repulsion** between all nodes, approximated with a Barnes-Hut quadtree so the cost stays near `O(n log n)` instead of `O(n²)`. Each pair is softened by a small constant distance, so two nodes that nearly coincide push gently instead of with a singular force.
- **Link forces** that pull connected nodes together, with different strengths for tree, reference and tag links.
- A **tag affinity** while tag hubs are shown: two hubs applied to the same concept pull together with a layout-only spring — no link, no arrow, and no effect on degree or the link count — so tags that share concepts form clusters instead of spreading evenly around the ring. The pull grows with the number of concepts shared, up to a cap.
- A weak **radial** force that gives the tree a ring structure by depth.
- A **collision** force that prevents overlap, using a uniform grid, with a direction-normalised push so two nodes that sit on the same point separate instead of sticking together.
- A weak **centering** force.

# Integration

Velocities are updated with a velocity-Verlet step and clamped to a maximum speed and acceleration. The speed cap is a small fraction of the ring gap (a few percent) and the acceleration cap equals it, so the half-step term cannot carry a node further than about one and a half speed caps in one frame: a node never crosses the canvas between two frames, which keeps a busy directory calm enough to click while it settles. A cooling factor `alpha` decays each tick, the velocity damping hardens as it falls, and it never drops below a floor, so the layout keeps a slow, continuous motion instead of freezing. Interaction that changes the layout — entering a directory, resetting, or dragging a node — raises `alpha` and re-energizes it, while a plain single click leaves the graph undisturbed.[^source]

# Shared physics

The force primitives (softened repulsion, link springs, centering, the acceleration clamp) and the velocity-Verlet integrator are factored into one **shared physics module**. The graph supplies its own bodies, Barnes-Hut repulsion, ring targets and collision, while the mascot animation reuses the same primitives and step with its own bodies, link topology and parameters — so both run the same simulation at the same pace. The mascot idles its loop as soon as the released figure has converged and while its panel is hidden, so it costs nothing outside the brief settle.

# Trade-offs

A continuous simulation keeps the graph alive and self-organising, but it costs CPU on every frame and never becomes pixel-stable. The tool therefore keeps the view framed while a fresh layout settles, and can skip animation when the user prefers reduced motion. A reset, a fresh bundle load or entering a directory **eases** the framing into place over about 0.4 s rather than cutting to it, and any pan, zoom or drag cancels the move — with reduced motion the new framing is applied at once. While a bundle is still loading, the framing keeps easing out as nodes arrive, until the user takes the view.

# Connections

- [Graph construction](graph-construction.md)
- [Graph model](../model/graph-model.md)
- [Local processing](../principles/local-processing.md)

[^source]: The physics, layout step and draw sections of the tool source.
