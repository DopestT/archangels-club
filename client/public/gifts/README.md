# Gift Assets

Premium gift animations for the Archangels Club live gift engine.

## Architecture

```
Vite (app shell)
 └─ GiftAnimationManager (overlay renderer, fixed z-index 51–56)
     ├─ Rive  (.riv)   → premium interactive, state-machine driven  ← preferred
     ├─ WebM  (alpha)  → huge cinematic fullscreen gifts            ← optional
     └─ Emoji          → always-available fallback                 ← never breaks
```

Agora handles live video/audio only. Gift visuals never touch the video element —
they render in a decoupled fixed overlay above it.

## Folders

| Folder    | Holds                          | Referenced by manifest field |
| --------- | ------------------------------ | ---------------------------- |
| `icons/`  | Small SVG/PNG gift-tile icons  | `iconAsset`                  |
| `rive/`   | `.riv` interactive animations  | `animationAsset`             |
| `sounds/` | `.mp3` audio synced to the gift| `soundAsset`                 |
| `webm/`   | Alpha-channel `.webm` cinematics| `animationAsset` (webm tier)|

## Naming

Asset filenames mirror the gift `id` from `src/components/live/giftManifest.ts`.
Example for the gift `golden-wings`:

```
icons/golden-wings.svg
rive/golden-wings.riv
sounds/golden-wings.mp3
```

## Safe-by-default

Real `.riv` / `.webm` / sound files are **not required** for the build to pass.
If an asset is missing or fails to load, `RiveGiftRenderer` falls back to the
gift's `fallbackEmoji`. Drop assets in here as they are produced — no code change
needed, the manifest already points at the paths.

## Rive authoring contract

For a `.riv` file to be driven correctly it should expose:

- A **state machine** named to match the gift's `riveStateMachine`
  (default convention: `GiftStateMachine`).
- Optional number input `intensity` (0–100) — set from combo count.
- Optional boolean input `loop`.
- Optional **Rive Event** named `PlaySound` — fired at the frame where the
  `soundAsset` should play, for tight audio sync.
