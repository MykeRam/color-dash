"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

type ColorOption = {
  name: string;
  value: string;
  ink: string;
};

type LeaderboardEntry = {
  id: string;
  player_name: string;
  score: number;
};

type ScoreSubmissionResult = {
  saved: boolean;
  best_score: number;
};

const COLORS: ColorOption[] = [
  { name: "Flame", value: "#ff7657", ink: "#35120b" },
  { name: "Lemon", value: "#ffe45c", ink: "#302600" },
  { name: "Emerald", value: "#4ee6a8", ink: "#052d20" },
  { name: "Cyan", value: "#45d8ff", ink: "#052a35" },
  { name: "Indigo", value: "#7f8cff", ink: "#11163d" },
  { name: "Magenta", value: "#ff70c7", ink: "#3c0c2a" },
];

const START_TIME = 3.5;
const MIN_TIME = 1.15;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const LEADERBOARD_READY = Boolean(SUPABASE_URL && SUPABASE_KEY);
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!LEADERBOARD_READY || !SUPABASE_URL || !SUPABASE_KEY) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseClient;
}

function leaderboardHeaders() {
  return {
    apikey: SUPABASE_KEY ?? "",
    Authorization: `Bearer ${SUPABASE_KEY ?? ""}`,
    "Content-Type": "application/json",
  };
}

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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState<
    "loading" | "ready" | "error" | "unavailable"
  >("loading");
  const [playerBest, setPlayerBest] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "saving" | "saved" | "not-improved" | "error"
  >("idle");
  const deadlineRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = Number(window.localStorage.getItem("color-dash-best") ?? 0);
      setBest(Number.isFinite(saved) ? saved : 0);
      setPlayerName(window.localStorage.getItem("color-dash-player") ?? "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const loadLeaderboard = useCallback(async () => {
    if (!LEADERBOARD_READY) {
      setLeaderboardStatus("unavailable");
      return;
    }

    setLeaderboardStatus("loading");
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/color_dash_scores?select=id,player_name,score&order=score.desc,created_at.asc&limit=5`,
        {
          headers: leaderboardHeaders(),
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Leaderboard request failed");
      const entries = (await response.json()) as LeaderboardEntry[];
      setLeaderboard(entries);
      setLeaderboardStatus("ready");
    } catch {
      setLeaderboardStatus("error");
    }
  }, []);

  const loadPlayerBest = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const {
        data: { session },
        error: sessionError,
      } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        setPlayerBest(null);
        return;
      }

      const { data, error } = await client
        .from("color_dash_scores")
        .select("score")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      setPlayerBest(data?.score ?? null);
    } catch {
      setPlayerBest(null);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadLeaderboard();
      void loadPlayerBest();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadLeaderboard, loadPlayerBest]);

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
    setSubmitStatus("idle");
    setStatus("playing");
    createRound(0);
  };

  const saveScore = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!LEADERBOARD_READY || score < 1 || submitStatus === "saving") return;

    const cleanName = playerName.trim().replace(/\s+/g, " ").slice(0, 18);
    if (!cleanName) {
      setSubmitStatus("error");
      return;
    }

    if (playerBest !== null && score <= playerBest) {
      setSubmitStatus("not-improved");
      return;
    }

    setSubmitStatus("saving");
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error("Leaderboard unavailable");

      const {
        data: { session: existingSession },
        error: sessionError,
      } = await client.auth.getSession();
      if (sessionError) throw sessionError;

      let session = existingSession;
      if (!session) {
        const { data, error } = await client.auth.signInAnonymously();
        if (error || !data.session) {
          throw error ?? new Error("Could not create a player session");
        }
        session = data.session;
      }

      const { data, error } = await client
        .rpc("submit_color_dash_score", {
          p_player_name: cleanName,
          p_score: score,
        })
        .single<ScoreSubmissionResult>();
      if (error || !data) throw error ?? new Error("Score submission failed");

      window.localStorage.setItem("color-dash-player", cleanName);
      setPlayerName(cleanName);
      setPlayerBest(data.best_score);
      setSubmitStatus(data.saved ? "saved" : "not-improved");
      if (data.saved) await loadLeaderboard();
    } catch {
      setSubmitStatus("error");
    }
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
  const pointsNeeded =
    playerBest === null ? 0 : Math.max(0, playerBest - score + 1);
  const canImprovePlayerBest = playerBest === null || score > playerBest;
  const heroIcon = (
    <>
      <span />
      <span />
      <span />
      <strong>GO!</strong>
    </>
  );

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
          <div
            className={`start-screen ${
              status === "over" ? "results-screen" : "ready-screen"
            }`}
          >
            <div className="hero-control">
              <button
                className="hero-orbits hero-action"
                onClick={
                  status === "over" ? () => setStatus("ready") : startGame
                }
                aria-label={
                  status === "over"
                    ? "Return to the main screen"
                    : "Start Color Dash"
                }
              >
                {heroIcon}
              </button>
              {status === "ready" && (
                <div className="start-cue" aria-hidden="true">
                  <b>←</b>
                  <span>START HERE</span>
                </div>
              )}
            </div>
            {status === "over" && <p className="eyebrow">TIME’S UP</p>}
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
            {status === "ready" && (
              <section className="leaderboard" aria-labelledby="leaderboard-title">
                <div className="leaderboard-heading">
                  <span id="leaderboard-title">GLOBAL TOP 5</span>
                </div>
                {leaderboardStatus === "loading" && (
                  <p className="leaderboard-message">Loading best scores…</p>
                )}
                {leaderboardStatus === "error" && (
                  <button
                    className="leaderboard-message leaderboard-retry"
                    onClick={() => void loadLeaderboard()}
                  >
                    Couldn’t load scores · Tap to retry
                  </button>
                )}
                {leaderboardStatus === "unavailable" && (
                  <p className="leaderboard-message">Leaderboard coming soon</p>
                )}
                {leaderboardStatus === "ready" && leaderboard.length === 0 && (
                  <p className="leaderboard-message">Be the first on the board.</p>
                )}
                {leaderboardStatus === "ready" && leaderboard.length > 0 && (
                  <ol>
                    {leaderboard.map((entry, index) => (
                      <li key={entry.id}>
                        <span className="leaderboard-rank">{index + 1}</span>
                        <span className="leaderboard-name">{entry.player_name}</span>
                        <strong>{entry.score}</strong>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
            {status === "over" && (
              <>
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
                <form className="score-form" onSubmit={saveScore}>
                  <label htmlFor="player-name">
                    {playerBest === null
                      ? "SAVE TO GLOBAL BOARD"
                      : `LEADERBOARD BEST · ${playerBest}`}
                  </label>
                  <div>
                    <input
                      id="player-name"
                      value={playerName}
                      onChange={(event) => {
                        setPlayerName(event.target.value);
                        if (
                          submitStatus === "error" ||
                          submitStatus === "not-improved"
                        ) {
                          setSubmitStatus("idle");
                        }
                      }}
                      maxLength={18}
                      placeholder="Your name"
                      autoComplete="nickname"
                      disabled={submitStatus === "saved"}
                    />
                    <button
                      type="submit"
                      disabled={
                        submitStatus === "saving" ||
                        submitStatus === "saved" ||
                        score < 1 ||
                        !LEADERBOARD_READY ||
                        !canImprovePlayerBest
                      }
                    >
                      {submitStatus === "saving"
                        ? "SAVING…"
                        : submitStatus === "saved"
                          ? "UPDATED ✓"
                          : !canImprovePlayerBest && playerBest !== null
                            ? `BEAT ${playerBest}`
                          : "SAVE"}
                    </button>
                  </div>
                  <p
                    className={submitStatus === "error" ? "score-error" : ""}
                    role="status"
                  >
                    {submitStatus === "saved"
                      ? "New personal best — your leaderboard score is updated."
                      : submitStatus === "error"
                        ? "Couldn’t save your score. Please try again."
                        : score < 1
                          ? "Score a point to join the board."
                          : !canImprovePlayerBest
                            ? `You need ${pointsNeeded} more ${
                                pointsNeeded === 1 ? "point" : "points"
                              } to update your score.`
                            : playerBest === null
                              ? "Your first saved score starts your personal best."
                              : `Beat ${playerBest} to update your leaderboard score.`}
                  </p>
                </form>
              </>
            )}
            {status === "over" && (
              <button className="play-button" onClick={startGame}>
                <span>PLAY AGAIN</span>
                <b aria-hidden="true">→</b>
              </button>
            )}
            <p className="hint">
              {status === "ready"
                ? "Tap GO to start · One thumb · No sign-in needed"
                : "Tap GO for home · No sign-in needed"}
            </p>
          </div>
        )}
        <footer className="creator-credit">
          Developed by{" "}
          <a href="https://myke.nyc" target="_blank" rel="noreferrer">
            Myke
          </a>
        </footer>
      </section>
    </main>
  );
}
