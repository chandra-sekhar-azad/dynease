'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

const ClickSpark = ({
  sparkColor = '#108a4a',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1.0,
  desktopOnly = true,
  isGlobal = false,
  children
}) => {
  const canvasRef = useRef(null);
  const sparksRef = useRef([]);
  const startTimeRef = useRef(null);
  const [isDesktop, setIsDesktop] = useState(true);

  // Check for desktop mode (fine pointer and >= 768px screen width)
  useEffect(() => {
    if (!desktopOnly) {
      setIsDesktop(true);
      return;
    }

    const checkDesktop = () => {
      const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
      const isWideScreen = window.innerWidth >= 768;
      setIsDesktop(hasFinePointer || isWideScreen);
    };

    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, [desktopOnly]);

  // Handle canvas sizing
  useEffect(() => {
    if (!isDesktop) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let resizeTimeout;

    const resizeCanvas = () => {
      if (isGlobal) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      } else {
        const parent = canvas.parentElement;
        if (!parent) return;
        const { width, height } = parent.getBoundingClientRect();
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
      }
    };

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 100);
    };

    if (isGlobal) {
      window.addEventListener('resize', handleResize);
    } else {
      const parent = canvas.parentElement;
      if (parent) {
        const ro = new ResizeObserver(handleResize);
        ro.observe(parent);
        resizeCanvas();
        return () => {
          ro.disconnect();
          clearTimeout(resizeTimeout);
        };
      }
    }

    resizeCanvas();

    return () => {
      if (isGlobal) {
        window.removeEventListener('resize', handleResize);
      }
      clearTimeout(resizeTimeout);
    };
  }, [isDesktop, isGlobal]);

  const easeFunc = useCallback(
    t => {
      switch (easing) {
        case 'linear':
          return t;
        case 'ease-in':
          return t * t;
        case 'ease-in-out':
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing]
  );

  // Render loop
  useEffect(() => {
    if (!isDesktop) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationId;

    const draw = timestamp => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sparksRef.current = sparksRef.current.filter(spark => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) {
          return false;
        }

        const progress = elapsed / duration;
        const eased = easeFunc(progress);

        const distance = eased * sparkRadius * extraScale;
        const lineLength = sparkSize * (1 - eased);

        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        ctx.strokeStyle = sparkColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        return true;
      });

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isDesktop, sparkColor, sparkSize, sparkRadius, sparkCount, duration, easeFunc, extraScale]);

  const triggerSparks = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const now = performance.now();
    const newSparks = Array.from({ length: sparkCount }, (_, i) => ({
      x,
      y,
      angle: (2 * Math.PI * i) / sparkCount,
      startTime: now
    }));

    sparksRef.current.push(...newSparks);
  }, [sparkCount]);

  // Global window click listener in capture phase when isGlobal=true
  useEffect(() => {
    if (!isDesktop || !isGlobal) return;

    const handleGlobalClick = e => {
      triggerSparks(e.clientX, e.clientY);
    };

    window.addEventListener('click', handleGlobalClick, { capture: true });
    return () => window.removeEventListener('click', handleGlobalClick, { capture: true });
  }, [isDesktop, isGlobal, triggerSparks]);

  const handleClick = e => {
    if (isGlobal) return; // Handled by global capture listener
    triggerSparks(e.clientX, e.clientY);
  };

  if (!isDesktop) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100%'
      }}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        style={
          isGlobal
            ? {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                display: 'block',
                userSelect: 'none',
                pointerEvents: 'none',
                zIndex: 99999
              }
            : {
                width: '100%',
                height: '100%',
                display: 'block',
                userSelect: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none'
              }
        }
      />
      {children}
    </div>
  );
};

export default ClickSpark;
