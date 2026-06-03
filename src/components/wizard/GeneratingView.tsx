"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 結果生成中のローディング画面(「星々が占う」幻想版)。
 *
 * Gemini 2.5 Pro での生成は実測 127〜137 秒。
 * ユーザーが「動いてる?」と不安にならず、待ち時間自体が楽しめる体験を目指す。
 *
 * 構成要素:
 * 1. 疑似プログレスバー(時間ベース: 0% → 95% を 150 秒で / 完了時 100% へスムーズ着地)
 * 2. ステップメッセージ切替(占星術・星見・地図メタファ / aria-live 対応)
 * 3. アニメーション全部盛り
 *    - SVG ロードマップを徐々に描画(stroke-dashoffset)
 *    - ノード(目印)が順に点灯
 *    - ドットグリッド背景の脈動
 *    - 中央の AI コア(ネオン同心円パルス)
 *    - 周回する衛星(SVG <animateTransform>)
 *    - プログレスバー上の流れるシマー
 *    - ふわふわ漂うパーティクル
 * 4. 100% 達成演出(success フェーズ): 全ノードのパルス + 道筋の発光 + 中央フラッシュ
 *
 * Props:
 * - status: "loading" | "success" | "error"
 *   "success" — 結果取得完了時。1.5〜2s の達成演出を見せてから親が router.push する。
 *   "error"   — バーが赤系で停止し、メッセージも切り替わる。
 *   ?dev=submit で実機確認可能。
 */

type Status = "loading" | "success" | "error";

type Step = {
  /** この step に切り替わる秒数(progress fraction 0-1 ベース) */
  fromFraction: number;
  /** 進路の地図化メタファに沿った状況メッセージ */
  message: string;
  /** 控えめなサブテキスト(空でも可) */
  hint?: string;
};

/**
 * フェーズ別メッセージ。プログレス(0-1)に対する閾値で切り替わる。
 * 実測 127〜137 秒の体感を「9 段階で変化」させて単調さを消す。
 * 占星術・星見・地図メタファで世界観を統一(「星々が占う」)。
 */
const STEPS: Step[] = [
  {
    fromFraction: 0,
    message: "星々があなたの声を聞いています…",
    hint: "夜空に回答が届きました",
  },
  {
    fromFraction: 0.1,
    message: "現在地の座標を読み解いています…",
    hint: "あなたという星を地図にプロット",
  },
  {
    fromFraction: 0.22,
    message: "業界の星図と照らし合わせています…",
    hint: "実在する航路だけを残しています",
  },
  {
    fromFraction: 0.35,
    message: "あなたの強みの輝きを見つけています…",
    hint: "回答の星々を結んでいます",
  },
  {
    fromFraction: 0.48,
    message: "3 つの航路を描き始めました…",
    hint: "本命・別解・冒険ルートを並行構築",
  },
  {
    fromFraction: 0.6,
    message: "それぞれの航路の現実味を吟味しています…",
    hint: "占いの結果を磨き上げています",
  },
  {
    fromFraction: 0.72,
    message: "最初の一歩を星空に刻んでいます…",
    hint: "明日からできるアクションを編集中",
  },
  {
    fromFraction: 0.85,
    message: "失敗の予感も読み込んでいます…",
    hint: "注意すべき星の動きを記録",
  },
  {
    fromFraction: 0.95,
    message: "地図の最終調整中…",
    hint: "もうすぐ地図が完成します",
  },
];

/**
 * 0 → 0.95 まで到達するのに要する秒数。
 * 実測(Gemini 2.5 Pro)は成功時 127s / 失敗時 137s 程度なので、それを内包する
 * 150 秒(2.5 分)に拡張。これより遅い時は 0.95 → 0.99 にゆっくり漸近して粘る。
 */
const PROGRESS_TO_95_SEC = 150;

/**
 * 疑似プログレスを返すフック。
 *
 * - mounted から PROGRESS_TO_95_SEC 秒で 0 → 95% に到達(easeOutQuad っぽい逓減カーブ)
 * - それ以降は 95% でゆっくり前進(99% に漸近)し、決して 100% に行かない
 * - status="error" になった瞬間に止まる(値はそのまま保持)
 * - status="success" で 100% にスムーズ着地(easeOutCubic / 500ms)
 *
 * 戻り値: 0..1 の fraction
 */
function useFakeProgress(status: Status): number {
  // 初期値: success フェーズで突然マウントされた場合(?dev=success で直接開いた等)、
  // fraction=0 から finale 演出が始まるのは違和感あるので 0.95 から始める。
  // 通常運用では loading フェーズから順に進むので fraction は既に高い値になっている。
  const [fraction, setFraction] = useState(status === "success" ? 0.95 : 0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(status === "success" ? 0.95 : 0);

  useEffect(() => {
    if (status === "error") {
      // エラー時はバーを止める(値保持)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    if (status === "success") {
      // 完了通知が来たら 100% へスムーズ着地。
      // 500ms かけて easeOutCubic で 現在値 → 1.0 に。
      // - 通常運用: loading フェーズの末期(0.9〜0.99 付近)から呼ばれる
      // - dev 検証: ?dev=success で直接マウントされた場合は 0.95 スタート
      //
      // setInterval ベース(16ms tick)で動かす。requestAnimationFrame だと
      // タブ非アクティブ時やバックグラウンドブラウザで動作が止まる/極端に遅くなるが、
      // setInterval は止まらないので「結果取得完了 → 短時間で 100% 着地」が確実に走る。
      const from = lastRef.current;
      const start = performance.now();
      const duration = 500;
      const intervalId = window.setInterval(() => {
        const now = performance.now();
        const t = Math.min(1, (now - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        const v = from + (1 - from) * eased;
        lastRef.current = v;
        setFraction(v);
        if (t >= 1) {
          window.clearInterval(intervalId);
        }
      }, 16);
      return () => {
        window.clearInterval(intervalId);
      };
    }

    // 通常進行: PROGRESS_TO_95_SEC 秒で 0 → 0.95, それ以降は 0.99 に漸近
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000; // sec
      let v: number;
      if (elapsed <= PROGRESS_TO_95_SEC) {
        // easeOutQuad: 序盤少し早く・後半ゆっくり、で「待ってる感」を緩和
        const t = elapsed / PROGRESS_TO_95_SEC;
        v = (1 - Math.pow(1 - t, 2)) * 0.95;
      } else {
        // 上限を超えたら 0.95 → 0.99 へゆっくり漸近(60 秒で 0.99 弱に)
        const extra = elapsed - PROGRESS_TO_95_SEC;
        v = 0.95 + (1 - Math.exp(-extra / 60)) * 0.04;
      }
      // 単調増加を保証(タブ非アクティブ→復帰時の巻き戻し防止)
      v = Math.max(lastRef.current, v);
      lastRef.current = v;
      setFraction(v);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [status]);

  return fraction;
}

/**
 * ロードマップ SVG。
 *
 * - 曲線パス(d 属性)を stroke-dashoffset で徐々に描画
 * - パス上に 5 ノード配置 → progress が閾値を超えたノードから順に点灯
 * - viewBox を 0..400 x 0..160 に固定し、CSS で幅 100% に
 *
 * progress は 0..1。
 */
function RoadmapSvg({
  progress,
  error,
  finale,
}: {
  progress: number;
  error: boolean;
  /** 100% 達成演出中: 全ノードが大きくパルス + 道筋が眩しく光る */
  finale?: boolean;
}) {
  // path 長さ(おおよそ。SVG getTotalLength でも取れるが、固定パスなので定数で十分)
  // 実際の path で計算しなおすこともできるが、500 でほぼ収まる長さに設計してある。
  const PATH_LENGTH = 520;
  // 2026-06-03 かおる FB: ラインの伸びが「現状少し早い」体感だったので、
  // progress に対する描画長を easeIn(1.25 乗)気味に補正して 25-30% ゆっくり見せる。
  // 終端 progress=1 では PATH_LENGTH と一致するので、フィナーレ演出のタイミングはずれない。
  // 全体 150s の進行カーブ自体(useFakeProgress)は変えない。
  const drawn = PATH_LENGTH * Math.pow(progress, 1.25);

  // 5 つの目印ノード(パス上のだいたい等間隔の座標 + 名前)
  // 順に点灯することで「ロードマップを 5 段階で組み立てている」見え方になる。
  const nodes: { x: number; y: number; label: string; from: number }[] = [
    { x: 40, y: 120, label: "現在地", from: 0.05 },
    { x: 130, y: 60, label: "学び", from: 0.25 },
    { x: 210, y: 110, label: "実践", from: 0.5 },
    { x: 300, y: 50, label: "転機", from: 0.75 },
    { x: 370, y: 90, label: "目標", from: 0.95 },
  ];

  const stroke = error
    ? "url(#road-grad-error)"
    : "url(#road-grad)";

  return (
    <div className="relative w-full">
    <svg
      viewBox="0 0 400 160"
      className="w-full h-auto"
      role="img"
      aria-label="あなたの進路ロードマップを描いている図"
    >
      <defs>
        {/* メインのネオングラデ: cyan → violet → pink */}
        <linearGradient id="road-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        {/* エラー時の赤系グラデ */}
        <linearGradient
          id="road-grad-error"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        {/* 発光フィルタ(SVG filter は重いがロードマップ 1 本だけなので OK) */}
        <filter id="road-glow" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 背景のうっすら破線パス(完成図のヒント) */}
      <path
        d="M 40 120 Q 90 30 130 60 T 210 110 Q 260 0 300 50 T 370 90"
        fill="none"
        stroke="rgba(138, 147, 184, 0.18)"
        strokeWidth="2"
        strokeDasharray="3 6"
        strokeLinecap="round"
      />

      {/* 描画中の本線(stroke-dashoffset で前進) */}
      <path
        d="M 40 120 Q 90 30 130 60 T 210 110 Q 260 0 300 50 T 370 90"
        fill="none"
        stroke={stroke}
        strokeWidth={finale ? 4.5 : 3.5}
        strokeLinecap="round"
        strokeDasharray={PATH_LENGTH}
        strokeDashoffset={PATH_LENGTH - drawn}
        filter="url(#road-glow)"
        style={{
          transition:
            "stroke-dashoffset 0.25s linear, stroke-width 0.6s ease-out",
        }}
      />
      {/* finale 演出: 道筋に沿って眩しいオーバーレイ線を 1 本被せる */}
      {finale && (
        <path
          d="M 40 120 Q 90 30 130 60 T 210 110 Q 260 0 300 50 T 370 90"
          fill="none"
          stroke="rgba(255, 255, 255, 0.9)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#road-glow)"
          style={{ animation: "finale-path 1.4s ease-out forwards" }}
        />
      )}

      {/* ノード(目印) */}
      {nodes.map((n, i) => {
        const active = progress >= n.from;
        return (
          <g key={i} style={{ transition: "opacity 0.4s ease" }}>
            {/* 外側の発光ハロー(active 時のみ・finale 時は大きく派手に) */}
            {active && !error && (
              <circle
                cx={n.x}
                cy={n.y}
                r={finale ? 16 : 12}
                fill={
                  finale
                    ? "rgba(244, 114, 182, 0.32)"
                    : "rgba(168, 85, 247, 0.18)"
                }
                style={{
                  animation: finale
                    ? "finale-node 1.4s ease-out forwards"
                    : "node-halo 2.4s ease-in-out infinite",
                  transformOrigin: `${n.x}px ${n.y}px`,
                  animationDelay: finale ? `${i * 0.08}s` : undefined,
                }}
              />
            )}
            {/* 中央のドット */}
            <circle
              cx={n.x}
              cy={n.y}
              r="4.5"
              fill={
                active
                  ? error
                    ? "#ef4444"
                    : i === nodes.length - 1
                      ? "#f472b6"
                      : i === 0
                        ? "#22d3ee"
                        : "#a855f7"
                  : "#222a45"
              }
              stroke={active ? "rgba(255,255,255,0.9)" : "rgba(138,147,184,0.4)"}
              strokeWidth="1.2"
              style={{
                transition: "fill 0.4s ease, stroke 0.4s ease",
                filter: active && !error ? "url(#road-glow)" : "none",
              }}
            />
          </g>
        );
      })}

      {/* 描画ヘッド(現在描いている先端の光点)。error 時は出さない */}
      {!error && progress < 0.99 && (
        <DrawHead progress={progress} />
      )}
    </svg>
      {/*
        2026-06-02 かおる要望 #4:
        SVG <text> はビューボックスに比例縮小されるため、375px の端末では字が小さくなる(実測 ~7px)。
        ラベルを HTML 側にオーバーレイ表示することで CSS font-size を素直に使えるようにし、
        モバイルでも判読できる十分なサイズを確保。

        2026-06-03 追加調整(かおる要望 #4 リフィン):
        - モバイル text-xs(12px) → text-sm(14px)、デスクトップ text-sm(14px) → text-base(16px)
        - SVG の viewBox はそのまま(絵の位置は固定)・HTML 側だけ太らせる
       */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {nodes.map((n, i) => {
          const active = progress >= n.from;
          // ノード y + 22 の位置にラベルを置く設計を踏襲
          const leftPercent = (n.x / 400) * 100;
          const topPercent = ((n.y + 22) / 160) * 100;
          return (
            <span
              key={i}
              className="absolute -translate-x-1/2 font-display tracking-wider text-sm sm:text-base font-medium whitespace-nowrap"
              style={{
                left: `${leftPercent}%`,
                top: `${topPercent}%`,
                color: active ? "#e7ecff" : "#8a93b8",
                opacity: active ? 1 : 0.6,
                transition: "color 0.4s ease, opacity 0.4s ease",
                textShadow:
                  "0 0 6px rgba(7,9,18,0.95), 0 0 2px rgba(7,9,18,0.95), 0 1px 2px rgba(7,9,18,0.9)",
              }}
            >
              {n.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * パス上を進む光点(描画ヘッド)。
 * progress に応じて pathLength 上を移動。SVG の単純な計算で位置を出す。
 *
 * パス全体を 5 本のセグメント(直線近似)として等分して位置を割り出す。
 * 正確さより「先頭に何かが進んでる感」が目的なので近似で十分。
 */
function DrawHead({ progress }: { progress: number }) {
  // パスの主要点(RoadmapSvg と一致)
  const pts: [number, number][] = [
    [40, 120],
    [130, 60],
    [210, 110],
    [300, 50],
    [370, 90],
  ];
  // セグメント長で重み付け
  const segs: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    segs.push(Math.hypot(x2 - x1, y2 - y1));
  }
  const total = segs.reduce((a, b) => a + b, 0);
  // 2026-06-03 RoadmapSvg と同じ easeIn(1.25 乗)カーブで進む先端位置を求める
  // → 描画線と光点(先端)がズレない
  const target = Math.pow(progress, 1.25) * total;

  let acc = 0;
  let x = pts[0][0];
  let y = pts[0][1];
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const t = (target - acc) / segs[i];
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      x = x1 + (x2 - x1) * t;
      y = y1 + (y2 - y1) * t;
      break;
    }
    acc += segs[i];
  }
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r="6"
        fill="rgba(244, 114, 182, 0.25)"
        style={{ animation: "head-pulse 1.2s ease-in-out infinite" }}
      />
      <circle cx={x} cy={y} r="2.5" fill="#f9fafb" />
    </g>
  );
}

/**
 * 中央の AI コア(同心円パルス)。
 * Gemini が考え中であることを抽象表現する。CSS animation のみ。
 */
function CorePulse({ error }: { error: boolean }) {
  return (
    <div className="relative w-24 h-24 mx-auto" aria-hidden="true">
      {/* 外側のリング(回転) */}
      <div
        className={`absolute inset-0 rounded-full border-2 ${
          error
            ? "border-orange-500/40"
            : "border-transparent border-t-cyan border-r-violet"
        }`}
        style={{ animation: "spin 2.4s linear infinite" }}
      />
      {/* 中間リング(反回転) */}
      <div
        className={`absolute inset-2 rounded-full border ${
          error
            ? "border-orange-500/20"
            : "border-transparent border-b-pink border-l-violet"
        }`}
        style={{ animation: "spin 3.6s linear infinite reverse" }}
      />
      {/* 内側のコア(脈動) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`w-10 h-10 rounded-full ${
            error
              ? "bg-orange-500/30"
              : "bg-gradient-to-br from-cyan/40 via-violet/40 to-pink/40"
          }`}
          style={{ animation: "core-pulse 2s ease-in-out infinite" }}
        />
        {/* 中心の小さな点 */}
        <div className="absolute w-2.5 h-2.5 rounded-full bg-ice/90 shadow-[0_0_18px_rgba(255,255,255,0.9)]" />
      </div>
    </div>
  );
}

/**
 * 周囲を漂うパーティクル(雑な星)。
 * CSS @keyframes で位置を緩く動かす。座標は固定 5 個。
 */
function Particles() {
  // 同じ位置でも違うアニメーションタイミングで「ふわふわ」感を出す
  const particles = [
    { left: "10%", top: "20%", delay: "0s", scale: 0.9 },
    { left: "85%", top: "15%", delay: "1.2s", scale: 1.1 },
    { left: "78%", top: "78%", delay: "0.6s", scale: 0.8 },
    { left: "15%", top: "70%", delay: "1.8s", scale: 1 },
    { left: "50%", top: "8%", delay: "0.3s", scale: 0.7 },
    { left: "92%", top: "50%", delay: "2.1s", scale: 0.95 },
    { left: "5%", top: "45%", delay: "1.5s", scale: 0.85 },
  ];
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute w-1 h-1 rounded-full bg-ice/70"
          style={{
            left: p.left,
            top: p.top,
            transform: `scale(${p.scale})`,
            animation: `particle-float 6s ease-in-out infinite`,
            animationDelay: p.delay,
            boxShadow: "0 0 6px rgba(231, 236, 255, 0.7)",
          }}
        />
      ))}
    </div>
  );
}

export function GeneratingView({ status = "loading" }: { status?: Status }) {
  const fraction = useFakeProgress(status);
  const error = status === "error";
  const success = status === "success";
  const percent = Math.min(100, Math.round(fraction * 100));

  // 現在のステップ(progress fraction ベース)。エラー時は固定文言。
  // 100% 到達時は専用メッセージ。
  const currentStep =
    success && fraction >= 0.999
      ? {
          fromFraction: 1,
          message: "地図が完成しました ✦",
          hint: "結果画面へご案内します…",
        }
      : ([...STEPS].reverse().find((s) => fraction >= s.fromFraction) ??
        STEPS[0]);

  // 100% 達成演出フラグ: success かつ fraction が十分に上がってから発火
  const finale = success && fraction >= 0.995;

  return (
    <div className="relative rise">
      {/* 100% 到達時の全画面フラッシュ(success 時に一瞬眩しく光る) */}
      {finale && (
        <div
          className="fixed inset-0 z-50 pointer-events-none gen-flash"
          aria-hidden="true"
        />
      )}
      {/* 画面コンテナ: グリッド背景 + パーティクル */}
      <div
        className={`relative glow-card rounded-3xl px-6 py-10 sm:px-10 sm:py-14 overflow-hidden ${
          finale ? "gen-finale" : ""
        }`}
      >
        {/* 背景: 脈動するドットグリッド(globals.css の grid-bg を上書きせず別レイヤで) */}
        <div
          className="absolute inset-0 opacity-60"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.12), transparent 60%), radial-gradient(circle at 20% 80%, rgba(34, 211, 238, 0.1), transparent 55%), radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "auto, auto, 24px 24px",
            animation: "grid-pulse 5s ease-in-out infinite",
          }}
        />

        <Particles />

        {/* 中身 */}
        <div className="relative">
          {/* 中央コア + 周回衛星 */}
          <div className="relative mx-auto mb-8 w-44 h-44">
            <CorePulse error={error} />
            {/* 周回衛星(SVG で軌道 + animateTransform) */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 200 200"
              aria-hidden="true"
            >
              {/* 軌道(うっすら) */}
              <circle
                cx="100"
                cy="100"
                r="78"
                fill="none"
                stroke="rgba(138, 147, 184, 0.2)"
                strokeDasharray="2 4"
              />
              {/* 衛星 1 */}
              <g>
                <circle
                  cx="178"
                  cy="100"
                  r="3"
                  fill={error ? "#ef4444" : "#22d3ee"}
                  style={{
                    filter: error
                      ? "drop-shadow(0 0 6px rgba(239,68,68,0.9))"
                      : "drop-shadow(0 0 6px rgba(34,211,238,0.9))",
                  }}
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 100 100"
                    to="360 100 100"
                    dur={error ? "20s" : "8s"}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
              {/* 衛星 2(逆回り・別軌道) */}
              <g>
                <circle
                  cx="100"
                  cy="38"
                  r="2"
                  fill={error ? "#f97316" : "#f472b6"}
                  style={{
                    filter: error
                      ? "drop-shadow(0 0 5px rgba(249,115,22,0.8))"
                      : "drop-shadow(0 0 5px rgba(244,114,182,0.9))",
                  }}
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="360 100 100"
                    to="0 100 100"
                    dur={error ? "30s" : "12s"}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            </svg>
          </div>

          {/* ロードマップ SVG */}
          <div className={`mb-7 px-2 ${finale ? "gen-roadmap-finale" : ""}`}>
            <RoadmapSvg progress={fraction} error={error} finale={finale} />
          </div>

          {/* メッセージ(aria-live でステップ切替を読み上げ) */}
          <div
            className="text-center mb-7"
            aria-live="polite"
            aria-atomic="true"
          >
            <h2
              className={`font-display text-xl sm:text-2xl font-semibold neon-text mb-2 ${
                finale ? "gen-finale-title" : ""
              }`}
            >
              {error ? "通信エラーが発生しました" : currentStep.message}
            </h2>
            {!error && currentStep.hint && (
              <p className="text-mute text-sm leading-relaxed">
                {currentStep.hint}
              </p>
            )}
            {error && (
              <p className="text-mute text-sm leading-relaxed">
                少し待ってから再試行してください
              </p>
            )}
          </div>

          {/* プログレスバー */}
          <div className="relative">
            <div className="flex items-center justify-between mb-2 text-xs text-mute">
              <span className="tracking-wider uppercase font-display">
                {error ? "halted" : "drafting"}
              </span>
              <span
                className={`font-display tabular-nums ${
                  error ? "text-orange-400" : "text-ice/80"
                }`}
                aria-label={`進捗 ${percent}%`}
              >
                {percent}%
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-panel2 overflow-hidden border border-line/50">
              {/* 進行中の本体バー */}
              <div
                className={`absolute inset-y-0 left-0 ${
                  error
                    ? "bg-gradient-to-r from-orange-500 to-red-500"
                    : "bg-gradient-to-r from-cyan via-violet to-pink"
                }`}
                style={{
                  width: `${percent}%`,
                  transition: "width 0.3s linear",
                  boxShadow: error
                    ? "0 0 18px rgba(239, 68, 68, 0.5)"
                    : "0 0 22px rgba(168, 85, 247, 0.55)",
                }}
              />
              {/* 流れるシマー(error 時は出さない) */}
              {!error && (
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${percent}%`,
                    overflow: "hidden",
                  }}
                >
                  <div
                    className="absolute inset-y-0 w-1/3"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                      animation: "bar-shimmer 1.8s linear infinite",
                    }}
                  />
                </div>
              )}
            </div>

            {/* 注意書き */}
            <p className="mt-5 text-center text-[0.7rem] text-mute/70 leading-relaxed">
              {error
                ? "回答は保持しています。下のボタンから再試行できます。"
                : success
                  ? "もうすぐ結果画面に切り替わります…"
                  : "2 〜 3 分ほどかかります。タブを閉じずにお待ちください。"}
            </p>
          </div>
        </div>
      </div>

      {/* ローカル keyframes(globals.css を汚さない・このコンポーネントだけ
          で使うので scoped に持つ。Next/React は <style jsx> 非導入なので
          単純な <style> を吐き出す。SSR でも問題なし)。 */}
      <style>{`
        @keyframes core-pulse {
          0%, 100% {
            transform: scale(0.85);
            opacity: 0.85;
            filter: blur(0px);
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
            filter: blur(1px);
          }
        }
        @keyframes node-halo {
          0%, 100% {
            transform: scale(0.9);
            opacity: 0.45;
          }
          50% {
            transform: scale(1.4);
            opacity: 0.15;
          }
        }
        @keyframes head-pulse {
          0%, 100% { opacity: 0.5; r: 5; }
          50% { opacity: 1; r: 8; }
        }
        @keyframes bar-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes grid-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.8; }
        }
        @keyframes particle-float {
          0%, 100% {
            transform: translate(0, 0) scale(var(--s, 1));
            opacity: 0.4;
          }
          50% {
            transform: translate(6px, -10px) scale(calc(var(--s, 1) * 1.2));
            opacity: 1;
          }
        }
        /* 100% 達成演出: 全ノード一斉パルス */
        @keyframes finale-node {
          0%   { transform: scale(0.85); opacity: 0.4; }
          50%  { transform: scale(1.7);  opacity: 0.95; }
          100% { transform: scale(1.0);  opacity: 0.55; }
        }
        /* 100% 達成演出: 道筋オーバーレイ線を白く光らせて消える */
        @keyframes finale-path {
          0%   { opacity: 0; stroke-width: 1; filter: blur(0px); }
          30%  { opacity: 1; stroke-width: 3; filter: blur(0.5px); }
          100% { opacity: 0; stroke-width: 1; filter: blur(2px); }
        }
        /* 100% 達成演出: コンテナ枠が呼吸 */
        .gen-finale {
          animation: finale-card 1.6s ease-out;
        }
        @keyframes finale-card {
          0%   { box-shadow: 0 20px 60px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04); }
          40%  {
            box-shadow:
              0 0 80px -10px rgba(244, 114, 182, 0.55),
              0 0 120px -10px rgba(168, 85, 247, 0.45),
              inset 0 1px 0 rgba(255,255,255,0.12);
          }
          100% { box-shadow: 0 20px 60px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04); }
        }
        /* 100% 達成演出: タイトル一瞬きらめき */
        .gen-finale-title {
          animation: finale-title 1.4s ease-out;
        }
        @keyframes finale-title {
          0%   { letter-spacing: normal; filter: brightness(1) drop-shadow(0 0 0 transparent); }
          40%  { letter-spacing: 0.04em; filter: brightness(1.4) drop-shadow(0 0 18px rgba(244, 114, 182, 0.5)); }
          100% { letter-spacing: normal; filter: brightness(1) drop-shadow(0 0 0 transparent); }
        }
        /* 100% 達成演出: 画面全体フラッシュ */
        .gen-flash {
          background: radial-gradient(60% 50% at 50% 50%, rgba(255,255,255,0.55), rgba(244, 114, 182, 0.2) 40%, transparent 70%);
          animation: gen-flash-anim 1.6s ease-out forwards;
        }
        @keyframes gen-flash-anim {
          0%   { opacity: 0; }
          20%  { opacity: 0.75; }
          100% { opacity: 0; }
        }
        /* reduced-motion を尊重 — 振幅を抑える(完全停止ではなく、過度な動きを抑える) */
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden="true"] *,
          [aria-hidden="true"] {
            animation-duration: 6s !important;
            animation-iteration-count: 1 !important;
          }
          .gen-finale,
          .gen-finale-title,
          .gen-flash {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
