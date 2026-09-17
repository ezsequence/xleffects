# xleffects

Pure fseq **frame-processing building blocks** — transforms that operate on a
model *plan* plus a channel *buffer*, with no layout dependency.

An fseq frame is a flat channel-byte buffer with no semantics, so a naive
whole-buffer edit (e.g. multiplying every byte to dim a show) corrupts every
non-intensity channel: it swings moving-head motors, shifts colour-wheel slots,
and moves control/threshold values. These primitives take a small per-model
plan describing which channels are safe to touch, and transform only those.

## Dimming

```ts
import { applyDimming, ModelDimPlan } from 'xleffects';

// One plan per model. Produced however you like; in the parent project
// xlLayoutCalcs' getControllersAndModelChannels returns models that already
// carry startChannel / channelCount / gamma / noDimChannels, so its records
// satisfy ModelDimPlan directly:
//
//   const { models } = getControllersAndModelChannels(rgb, net);
//   applyDimming(models, frame, factor);
//
// Or hand-build plans:
const plans: ModelDimPlan[] = [
  { startChannel: 1, channelCount: 15, noDimChannels: [] },
];

applyDimming(plans, frame, 0.5);                         // straight ×0.5
applyDimming(plans, frame, 0.5, { gammaCorrect: true }); // ×0.5^gamma per plan
```

Whether to *skip* a model (e.g. leave moving heads out of a whole-show
brightness pass) is a **planning** decision, not the layout's and not this
package's: filter the plans (`models.filter(m => !m.isMovingHead)`) or set
`excludeFromDimming` on the ones you want left whole before calling.

`applyDimming` mutates the frame in place: excluded plans are skipped, each
plan's `noDimChannels` pass through unchanged, and the rest are scaled and
clamped to a rounded 0-255 byte.

## Design

This package is a **leaf**: it imports nothing and knows nothing about layouts,
controllers, or file formats. Building a plan (layout knowledge) and reading or
writing an fseq (file I/O) live in their own layers; this package is only the
in-memory channel-data transform in the middle.

## License

AGPL-3.0-only.
