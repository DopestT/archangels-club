/**
 * RiveGiftRenderer
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a premium gift animation from a Rive (.riv) file with a state machine.
 *
 * Safe-by-default: if the .riv file is missing, 404s, or fails to load for any
 * reason, this component reports the failure through `onError` and renders the
 * `fallback` node (the gift's emoji) instead — so the build and the live room
 * never break before real assets exist.
 *
 * Audio sync: the gift's sound plays either when the animation loads, or — for
 * tight sync — when the Rive file fires a Rive Event named "PlaySound". Any Rive
 * Event is also surfaced through `onRiveEvent` for custom hooks.
 */

import { useEffect, useRef, useState } from 'react';
import {
  useRive,
  useStateMachineInput,
  Layout,
  Fit,
  Alignment,
  EventType,
  RiveEventType,
} from '@rive-app/react-canvas';

export interface RiveGiftRendererProps {
  /** Path to the .riv asset, e.g. "/gifts/rive/golden-wings.riv". */
  riveAsset: string;
  /** State machine to drive. Convention: "GiftStateMachine". */
  riveStateMachine?: string;
  /** Optional named inputs to set on the state machine (numbers or booleans). */
  riveInputs?: Record<string, number | boolean>;
  /** Audio synced to the animation. */
  soundAsset?: string;
  width?: number;
  height?: number;
  /** Called once if the Rive asset cannot be loaded — parent should show emoji. */
  onError?: () => void;
  /** Called when the Rive animation finishes (state machine settles / stops). */
  onComplete?: () => void;
  /** Called for every Rive Event fired by the file (name + data). */
  onRiveEvent?: (name: string, data: Record<string, unknown>) => void;
  /** Rendered while loading and after a load failure. */
  fallback?: React.ReactNode;
}

const DEFAULT_STATE_MACHINE = 'GiftStateMachine';

export default function RiveGiftRenderer({
  riveAsset,
  riveStateMachine = DEFAULT_STATE_MACHINE,
  riveInputs,
  soundAsset,
  width = 64,
  height = 64,
  onError,
  onComplete,
  onRiveEvent,
  fallback = null,
}: RiveGiftRendererProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const soundPlayed  = useRef(false);
  const erroredOnce  = useRef(false);

  const reportError = () => {
    if (erroredOnce.current) return;
    erroredOnce.current = true;
    setFailed(true);
    onError?.();
  };

  const playSound = () => {
    if (!soundAsset || soundPlayed.current) return;
    soundPlayed.current = true;
    try {
      const audio = new Audio(soundAsset);
      audio.volume = 0.7;
      audioRef.current = audio;
      // Autoplay is allowed here because a gift send is a user gesture.
      void audio.play().catch(() => { /* autoplay blocked — ignore, visual still plays */ });
    } catch {
      /* sound is best-effort; never block the visual */
    }
  };

  const { rive, RiveComponent } = useRive({
    src: riveAsset,
    stateMachines: riveStateMachine,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoad: () => {
      setLoaded(true);
      // If the file has no "PlaySound" event, sync audio to load time.
      playSound();
    },
    onLoadError: reportError,
  });

  // Apply declared inputs once the state machine is live.
  const inputEntries = riveInputs ? Object.entries(riveInputs) : [];
  // Hooks must be unconditional — bind the first input if present (most gifts
  // expose a single "intensity" input). Additional inputs are applied via the
  // rive instance in the effect below.
  const firstInputName = inputEntries[0]?.[0];
  const firstInput = useStateMachineInput(
    rive,
    riveStateMachine,
    firstInputName,
  );

  useEffect(() => {
    if (!rive || !loaded || !riveInputs) return;
    try {
      const inputs = rive.stateMachineInputs(riveStateMachine) ?? [];
      for (const [name, value] of Object.entries(riveInputs)) {
        const input = inputs.find(i => i.name === name);
        if (!input) continue;
        if (typeof value === 'boolean') input.value = value;
        else input.value = value;
      }
    } catch {
      /* inputs are optional — ignore mismatches */
    }
  }, [rive, loaded, riveInputs, riveStateMachine]);

  // Keep the single bound input in sync as a convenience.
  useEffect(() => {
    if (!firstInput || firstInputName === undefined || !riveInputs) return;
    const v = riveInputs[firstInputName];
    if (v !== undefined) firstInput.value = v as never;
  }, [firstInput, firstInputName, riveInputs]);

  // Wire Rive events → audio sync + parent callback + completion.
  useEffect(() => {
    if (!rive) return;

    const onEvent = (event: { data?: { name?: string; properties?: Record<string, unknown> } }) => {
      const name = event?.data?.name ?? '';
      onRiveEvent?.(name, event?.data?.properties ?? {});
      if (name === 'PlaySound') playSound();
      if (name === 'Complete') onComplete?.();
    };

    const onStop = () => onComplete?.();

    try {
      rive.on(EventType.RiveEvent, onEvent as never);
      rive.on(EventType.Stop, onStop as never);
    } catch {
      /* event API unavailable — non-fatal */
    }

    return () => {
      try {
        rive.off(EventType.RiveEvent, onEvent as never);
        rive.off(EventType.Stop, onStop as never);
      } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rive]);

  // Stop any audio on unmount.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) { try { a.pause(); } catch { /* ignore */ } }
    };
  }, []);

  if (failed) return <>{fallback}</>;

  return (
    <div style={{ width, height, position: 'relative' }}>
      {/* Emoji fallback shows underneath until Rive paints its first frame. */}
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {fallback}
        </div>
      )}
      <RiveComponent style={{ width, height }} />
    </div>
  );
}

// Re-export the manifest event types so callers can fire system gifts without
// reaching into the Rive runtime directly.
export { RiveEventType };
