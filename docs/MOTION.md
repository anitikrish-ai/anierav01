# AniEra motion spec

Personality: **calm and fast, with one playful spring.** Content glides in with a
decelerate curve; glass controls are the only things that bounce.

Source of truth: `src/motion.css`. Tokens mirrored in `docs/motion-tokens.json`.

## Scale

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 100ms | press feedback |
| `--dur-fast` | 200ms | hover, micro-interactions, **all exits** |
| `--dur-base` | 300ms | entrances, page transition in |
| `--dur-slow` | 500ms | scroll reveals, spring settle |

Easings: `--ease-standard` (state), `--ease-out` (enter), `--ease-in` (exit),
`--ease-spring` (the one signature; glass press and tab pill only).
Distances: 8 / 16 / 24px. Never more.

## Rules

1. Animate `transform` and `opacity` only. No width/height/top/left/box-shadow/background-position/text-shadow.
2. Durations come from the scale. A `270ms` is drift.
3. Exits are faster than entrances (200ms vs 300ms).
4. Stagger 40ms per child, capped at 12 children (~480ms total).
5. One hero motion per view. Looping animation is allowed only for live indicators (`anim-glow`) and the next-episode hint.
6. Every animation has a reduced-motion fallback in `motion.css`: fade or nothing.
7. Never nest `backdrop-filter`. Glass is for navigation and controls; posters and panels are flat `surface`.

## Signature moves

| Name | Class | Trigger | Not for |
|---|---|---|---|
| card-lift | `.card-lift` | hover/focus on poster cards | text-only list rows |
| glass-press | `.glass-press` | hover/press on glass icon buttons | content cards |
| scroll-reveal | `<Reveal>` | enters viewport once | above-the-fold hero (use `.anim-rise`) |
| sheen | `.sheen` | hover on posters | more than one element per card |
| specular light | `.liquid-glass` + `lib/glass-pointer.ts` | pointer over nav/glass | touch devices (auto-disabled) |

## Adding motion

Use a class from `motion.css` or add one there with tokens. Do not write
`duration-[270ms]` or a new `cubic-bezier()` in a component. Tailwind
`duration-200/300/500` match fast/base/slow and are allowed.
