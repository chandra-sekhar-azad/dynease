import React, { useCallback } from 'react';
import { Joyride, ACTIONS, EVENTS, STATUS } from 'react-joyride';
import TourTooltip from './TourTooltip';
import { TOUR_STEPS } from './tourSteps';

/**
 * Reusable GuidedTour component powered by React Joyride v3.
 * Provides continuous step-by-step navigation, accessible spotlight,
 * branded tooltip styling, and resilient error recovery.
 */
export default function GuidedTour({
  run = false,
  steps = TOUR_STEPS,
  stepIndex = 0,
  onStepChange,
  onFinish,
  debug = false,
}) {
  const handleJoyrideCallback = useCallback((data, controls) => {
    const { action, index, status, type } = data;

    if (debug) {
      console.log('[Dynease Tour]', { type, action, status, index, data });
    }

    // Gracefully handle missing target element without leaving the tour stuck
    if (type === EVENTS.TARGET_NOT_FOUND) {
      console.warn(`[Dynease Tour] Target not found for step ${index}: ${data.step?.target}`);
      if (index < steps.length - 1) {
        onStepChange?.(index + 1);
      } else {
        onFinish?.();
      }
      return;
    }

    // Finished or skipped
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      onFinish?.();
      return;
    }

    // Closed by user via close icon or action
    if (action === ACTIONS.CLOSE || action === ACTIONS.SKIP || action === ACTIONS.RESET) {
      onFinish?.();
      return;
    }

    // Advancing or stepping back
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        const nextIndex = index + 1;
        if (nextIndex < steps.length) {
          onStepChange?.(nextIndex);
        } else {
          onFinish?.();
        }
      } else if (action === ACTIONS.PREV) {
        const prevIndex = Math.max(0, index - 1);
        onStepChange?.(prevIndex);
      }
    }
  }, [debug, steps.length, onStepChange, onFinish]);

  if (!run || !steps || steps.length === 0) {
    return null;
  }

  return (
    <Joyride
      run={run}
      steps={steps}
      stepIndex={stepIndex}
      continuous={true}
      scrollToFirstStep={true}
      onEvent={handleJoyrideCallback}
      tooltipComponent={TourTooltip}
      options={{
        arrowColor: '#ffffff',
        backgroundColor: '#ffffff',
        overlayColor: 'rgba(15, 23, 42, 0.65)',
        primaryColor: '#108a4a',
        textColor: '#0f3b25',
        zIndex: 1000,
        spotlightPadding: 10,
        spotlightClicks: false,
        disableOverlayClose: false,
      }}
    />
  );
}
