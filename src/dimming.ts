// Frame dimming — scale the intensity channels of one fseq frame in place
// while passing motor / shutter / colour-wheel / control channels through
// untouched.  An fseq frame is a flat channel byte buffer with no semantics,
// so a blanket multiply swings moving heads and shifts wheel slots; a dim plan
// says which channels are safe to scale.
//
// This module is a pure leaf: it depends on nothing and knows nothing about
// layouts.  A "dim plan" is the minimal per-model description it needs, and any
// producer can build one.  In this project xlLayoutCalcs'
// getControllersAndModelChannels returns models that already carry the fields a
// plan needs (startChannel, channelCount, gamma, noDimChannels), so its records
// satisfy ModelDimPlan structurally — no import crosses between the packages.

export interface ModelDimPlan {
    /** Resolved absolute 1-based first channel of the model within the frame. */
    startChannel: number;
    /** Number of channels the model occupies from startChannel. */
    channelCount: number;
    /**
     * Gamma used for factor^gamma scaling when gammaCorrect is set.  Optional;
     * treated as 1 (no gamma shaping) when absent, which is all that plain
     * dimming needs.
     */
    gamma?: number;
    /**
     * When true, leave every channel of this model untouched.  Optional and
     * defaults to false: a planning layer above may set it to skip a model
     * (e.g. moving heads a whole-show slider shouldn't touch), but a plain
     * layout fact record (xlLayoutCalcs' XlModelChannelInfo) omits it and is
     * still a valid plan — models pass through via noDimChannels instead.
     */
    excludeFromDimming?: boolean;
    /**
     * 0-based channel offsets within [startChannel, startChannel+channelCount)
     * that must pass through unscaled (motors, shutter, wheel slot, presets,
     * and any channel not positively known to be intensity).  A model with
     * every offset listed here is effectively excluded.
     */
    noDimChannels: number[];
}

export interface ApplyDimmingOptions {
    /**
     * Scale by factor^gamma (each plan's own gamma) instead of a plain factor,
     * so higher-gamma models dim harder — e.g. factor 0.5 on a gamma-2 model
     * multiplies its intensity channels by 0.25.  Default false (a straight
     * multiply), which is correct when the playback controller applies gamma
     * itself; enable it when the frame values are the final, gamma-encoded
     * output and you want a linear-light dim.
     */
    gammaCorrect?: boolean;
}

/**
 * Scale the dimmable channels of every plan in `frame` by `factor`, in place.
 *
 * Excluded plans are skipped entirely; each plan's noDimChannels pass through
 * unchanged; the rest are multiplied (optionally by factor^gamma) and clamped
 * to a rounded 0-255 byte.  `frame` is one fseq frame's channel bytes; call it
 * once per frame with the same plans.
 */
export function applyDimming(
    plans: ModelDimPlan[],
    frame: Uint8Array,
    factor: number,
    options?: ApplyDimmingOptions,
): void {
    const gammaCorrect = options?.gammaCorrect ?? false;

    for (const p of plans) {
        if (p.excludeFromDimming) continue;

        const eff = gammaCorrect ? Math.pow(factor, p.gamma ?? 1) : factor;
        // Common path (pixel models) has no no-dim channels, so no Set is built.
        const noDim = p.noDimChannels.length > 0 ? new Set(p.noDimChannels) : null;
        const base = p.startChannel - 1;   // startChannel is 1-based

        for (let o = 0; o < p.channelCount; o++) {
            if (noDim && noDim.has(o)) continue;
            const idx = base + o;
            if (idx < 0 || idx >= frame.length) continue;
            const v = frame[idx] * eff;
            frame[idx] = v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
        }
    }
}
