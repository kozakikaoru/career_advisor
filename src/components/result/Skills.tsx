import type { PlanSkills } from "@/lib/schema/result";

const TAG_COLORS = [
  "text-cyan bg-cyan/10 border-cyan/25",
  "text-violet bg-violet/10 border-violet/25",
  "text-pink bg-pink/10 border-pink/25",
  "text-lime bg-lime/10 border-lime/25",
  "text-mute bg-panel2 border-line",
];

/**
 * C. スキル(各案ごと・v2 再構成)
 * - mustLearn(0〜8 件・0 件時は「特になし」表示)
 * - emergingSkills(1〜4 件)
 * - recommendedCerts(0〜3 件)
 * - strengths(2〜5 件)
 * specs §3-5 / §6-6
 *
 * 2026-06-03 かおる FB:
 * - PlanContent 側で「プラン概要 + ロードマップ + 必要スキル」を 1 つの統合カードに
 *   まとめるため、`bare` mode を追加。true のとき外側の `<div class="glow-card">`
 *   ラッパを外し、内側コンテンツだけ返す。
 */
export function Skills({
  skills,
  bare = false,
}: {
  skills: PlanSkills;
  bare?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2.5 mb-6">
        <span className="text-lg">📡</span>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          必要なスキル・学習領域
        </h2>
      </div>

      {/* mustLearn */}
      <section className="mb-6">
        <p className="text-xs font-display tracking-wider uppercase text-mute mb-3">
          学んでおくべき分野
        </p>
        {skills.mustLearn.length === 0 ? (
          <p className="text-sm text-mute leading-relaxed">
            特になし — この進路では、学ぶより動くことを優先。現場で必要な技能を身につけていく道です。
          </p>
        ) : (
          <ul className="space-y-3">
            {skills.mustLearn.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-1 w-5 h-5 rounded-md border border-line shrink-0 flex items-center justify-center">
                  <span className="text-[0.6rem] text-mute font-display">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
                <div>
                  <p className="font-medium leading-snug">{item.title}</p>
                  <p className="text-xs text-mute leading-relaxed mt-1">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* emergingSkills */}
      <section className="mb-6">
        <p className="text-xs font-display tracking-wider uppercase text-mute mb-3">
          業界の最新トレンド
        </p>
        <div className="flex flex-wrap gap-2">
          {skills.emergingSkills.map((s, i) => (
            <span
              key={i}
              className="text-xs font-medium rounded-full border px-3 py-1.5 text-cyan bg-cyan/10 border-cyan/25"
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* recommendedCerts(0 件のとき非表示) */}
      {skills.recommendedCerts.length > 0 && (
        <section className="mb-6">
          <p className="text-xs font-display tracking-wider uppercase text-mute mb-3">
            おすすめの資格
          </p>
          <div className="flex flex-wrap gap-2">
            {skills.recommendedCerts.map((c, i) => (
              <span
                key={i}
                className="text-xs font-medium rounded-full border px-3 py-1.5 text-violet bg-violet/10 border-violet/25"
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* strengths */}
      <section>
        <p className="text-xs font-display tracking-wider uppercase text-mute mb-3">
          活かせる強み
        </p>
        <div className="flex flex-wrap gap-2">
          {skills.strengths.map((s, i) => (
            <span
              key={i}
              className={`text-xs font-medium rounded-full border px-3 py-1.5 ${
                TAG_COLORS[i % TAG_COLORS.length]
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </section>
    </>
  );

  if (bare) {
    return <div>{inner}</div>;
  }

  return <div className="glow-card rounded-2xl p-6 sm:p-7">{inner}</div>;
}
