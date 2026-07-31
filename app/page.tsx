"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ColorOption = {
  name: string;
  value: string;
  ink: string;
};

const COLORS: ColorOption[] = [
  { name: "Coral", value: "#ff6b6b", ink: "#311111" },
  { name: "Sunny", value: "#ffd166", ink: "#302200" },
  { name: "Mint", value: "#52d6a5", ink: "#062b20" },
  { name: "Sky", value: "#59b8ff", ink: "#082238" },
  { name: "Violet", value: "#a78bfa", ink: "#1f1640" },
  { name: "Pink", value: "#f783c5", ink: "#3a102a" },
];

const START_TIME = 3.5;
const MIN_TIME = 1.15;

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export default function Home() {
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [options, setOptions] = useState(() => shuffle(COLORS).slice(0, 4));
  const [target, setTarget] = useState(options[0]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(START_TIME);
  const [roundTime, setRoundTime] = useState(START_TIME);
  const [feedback, setFeedback] = useState<"idle" | "right" | "wrong">("idle");
  const deadlineRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem("color-dash-best") ?? 0);
    setBest(Number.isFinite(saved) ? saved : 0);
  }, []);

  const endGame = useCallback(() => {
    setStatus("over");
    setFeedback("idle");
    setBest((current) => {
      const nextBest = Math.max(current, scoreRef.current);
      window.localStorage.setItem("color-dash-best", String(nextBest));
      return nextBest;
    });
  }, []);

  const createRound = useCallback((currentScore: number) => {
    const nextOptions = shuffle(COLORS).slice(0, 4);
    const nextTarget = nextOptions[Math.floor(Math.random() * nextOptions.length)];
    const duration = Math.max(MIN_TIME, START_TIME - currentScore * 0.055);
    setOptions(nextOptions);
    setTarget(nextTarget);
    setRoundTime(duration);
    setTimeLeft(duration);
    deadlineRef.current = performance.now() + duration * 1000;
  }, []);

  const loseLife = useCallback(() => {
    const nextLives = livesRef.current - 1;
    livesRef.current = nextLives;
    setLives(nextLives);
    setStreak(0);
    setFeedback("wrong");
    if (nextLives <= 0) {
      window.setTimeout(endGame, 380);
      return;
    }
    createRound(scoreRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback("idle"), 260);
  }, [createRound, endGame]);

  useEffect(() => {
    if (status !== "playing") return;
    let frame = 0;
    const tick = () => {
      const remaining = Math.max(0, (deadlineRef.current - performance.now()) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        loseLife();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, target, loseLife]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  const startGame = () => {
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setStreak(0);
    setLives(3);
    setFeedback("idle");
    setStatus("playing");
    createRound(0);
  };

  const chooseColor = (color: ColorOption) => {
    if (status !== "playing" || feedback === "right") return;
    if (color.name !== target.name) {
      loseLife();
      return;
    }

    const speedBonus = Math.ceil((timeLeft / roundTime) * 4);
    const nextScore = scoreRef.current + 1 + speedBonus;
    scoreRef.current = nextScore;
    setScore(nextScore);
    setStreak((current) => current + 1);
    setFeedback("right");
    if (navigator.vibrate) navigator.vibrate(25);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback("idle");
      createRound(nextScore);
    }, 155);
  };

  const progress = Math.max(0, Math.min(100, (timeLeft / roundTime) * 100));

  return (
    <main className={`game-shell ${feedback}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="game-card" aria-label="Color Dash game">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>COLOR DASH</span>
          </div>
          <div className="best-score">
            <span>BEST</span>
            <strong>{best}</strong>
          </div>
        </header>

        {status === "playing" ? (
          <>
            <div className="hud">
              <div>
                <span className="hud-label">SCORE</span>
                <strong>{score}</strong>
              </div>
              <div className="streak" aria-live="polite">
                {streak >= 2 ? `×${streak} streak` : "stay sharp"}
              </div>
              <div className="lives" aria-label={`${lives} lives remaining`}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <span className={index < lives ? "live" : ""} key={index}>
                    ●
                  </span>
                ))}
              </div>
            </div>

            <div className="timer" aria-label={`${timeLeft.toFixed(1)} seconds left`}>
              <span style={{ width: `${progress}%` }} />
            </div>

            <div className="prompt">
              <span>FIND THIS COLOR</span>
              <div
                className="target-orb"
                style={{ background: target.value }}
                aria-label={target.name}
              >
                <span>{target.name}</span>
              </div>
            </div>

            <div className="color-grid">
              {options.map((color) => (
                <button
                  className="color-button"
                  key={color.name}
                  style={{ background: color.value, color: color.ink }}
                  onClick={() => chooseColor(color)}
                  aria-label={`Choose ${color.name}`}
                >
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="start-screen">
            <div className="hero-orbits" aria-hidden="true">
              <span />
              <span />
              <span />
              <strong>GO!</strong>
            </div>
            <p className="eyebrow">{status === "over" ? "TIME’S UP" : "QUICK COLOR GAME"}</p>
            <h1>
              {status === "over" ? (
                <>
                  Nice <em>dash.</em>
                </>
              ) : (
                <>
                  Think fast.
                  <br />
                  Tap the <em>match.</em>
                </>
              )}
            </h1>
            <p className="intro">
              {status === "over"
                ? `You scored ${score}. Your next run starts slow, then speeds up fast.`
                : "Match the glowing color before the bar runs out. Three misses and the run is over."}
            </p>
            {status === "over" && (
              <div className="results">
                <div>
                  <span>SCORE</span>
                  <strong>{score}</strong>
                </div>
                <div>
                  <span>BEST</span>
                  <strong>{best}</strong>
                </div>
              </div>
            )}
            <button className="play-button" onClick={startGame}>
              <span>{status === "over" ? "PLAY AGAIN" : "START DASHING"}</span>
              <b aria-hidden="true">→</b>
            </button>
            <p className="hint">Tap with one thumb · No sign-in needed</p>
          </div>
        )}
      </section>
    </main>
  );
}
