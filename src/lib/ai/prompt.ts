import type { AnswerMap } from "@/lib/schema/answers";
import { labelizeAnswers } from "./labels";

/**
 * 回答からプロンプト本文を組み立てる(ai-layer.md §4 / GOAL v2 §8-5 / MINDSET v2 §8-5)。
 * - 安定キーではなく人間可読ラベルで渡す(labelizeAnswers)。
 * - スキーマと二重に制約を明記する(段数・件数・トーン)。
 * - 占い的な決めつけ、医療・法律・投資助言と誤認される表現は避ける(security の免責方針)。
 *
 * v2 注記:
 * - `knowledge_fields` は「仕事にできるレベルの知識・経験」のみが回答されている前提を
 *   AI 側に伝え、ロードマップの足場として強気に扱えるよう示唆する。
 *
 * GOAL v2 注記(specs §8-5-2):
 * - (g) goal_commit は「使い切るべき金額」ではなく「上限の目安」。AI は最低限必要な投資のみ提案する。
 * - (h) 中立表現で受け渡し、情報商材的なロードマップを生成しない。
 * - (a) current_income と goal_income の対比から年収トレンドを判定して注釈する。
 *
 * GOAL v2.2 注記:
 * - goal_avoid を完全撤去(ほぼ全員が全選択肢にチェック → 差別化情報として機能しなかったため)。
 *   よって avoid 関連の「除外条件」「ネガティブフィルタ」解釈ガイドも削除済み。
 * - goal_workstyle が single → multi(MUST 1個以上)に変更。labelizeAnswers が multi として
 *   配列ラベルを連結する(複数の希望雇用形態を AI に並列で渡せる)。
 *
 * GOAL v2.1 注記(specs §8-5-2 (i-1)〜(i-5)):
 * - (i-1) student_job_status のフェーズ別提案軸切替(就活フェーズ別ガイド)。
 * - (i-2) student_advance_status のフェーズ別提案軸切替(進学フェーズ別ガイド) +
 *         student_goal_track=undecided(進路迷い)の整形。
 * - (i-3) 進学者の「進学先 × 業界」の関係性解釈(進学先・学部主軸の業界推論ガイド)。
 *         §9-v2.1-3 採択 C + 進学先・学部主軸明文化。
 * - (i-4) admitted × after_preparation の組み合わせ解釈(進学卒業後スタートの読み方)。
 * - (i-5) 非学生で after_preparation を選んだケースの解釈(準備イベントの相対時期)。
 *
 * MINDSET v2 注記(specs §7 / §8-5):
 * - (m-1) inferBigFive: 進路文脈の MINDSET 回答からビッグファイブ 5 軸を low/mid/high で暗黙取得し、
 *         AI プロンプトに 5 軸サマリを注入。`neither` 値は中庸入力として `mid` 寄り判定。
 *         AI への入力としてのみ使い、出力(結果画面)には軸名・スコアを出さない。
 * - (m-3) 性格傾向 × 案タイプ対応表(§7-2-1)を解釈ガイドとして明文化。
 *         各 Plan の選び方・ロードマップのトーンに反映させるための内部参考シグナル。
 * - (m-4) MINDSET E 群(location_preference / remote_preference / wlb_priority)を
 *         「働き方の必須条件」として AI に渡す(GOAL.goal_avoid 撤去の代替フィルタ・§7-3)。
 * - (m-5) mindset_freenote の取り扱い(origin_freenote / goal_freenote と同等)。
 * - (m-6) ORIGIN + GOAL + MINDSET の組み合わせ解釈の代表パターン(§7-5)。
 *
 * 2026-06-02 PersonalityType セクション撤去(Gemini 502 対応):
 * - 結果画面の `personality` セクションを撤去したため、prompt から以下を削除:
 *   - 「結果画面冒頭の『あなたの傾向』セクション」(§7-1-3)の出力指示
 *   - 出力制約の `personality.traits` 関連指示
 *   - 「ビッグファイブの軸名を結果画面に直接出さない」制約(出力先自体がなくなったため不要)
 * - MINDSET 回答自体は引き続き AI 入力としては利用(進路提案に暗黙反映)。
 * - 「うっすら表現」の指針は skills.strengths と各 Plan の説明文に活かす方針で残す。
 *
 * 結果 v2(2026-06-02 確定版・specs/result-v2.md):
 * - 3 案出力(plans: [Plan, Plan, Plan])に対応。3 案の差を §4-5 のパターンで担保。
 * - `hero.tagline` の指示・「○○から××へ」回避(§3-1 / §4-6)。
 * - roadmap[].description に数値・期限・手段を必ず含める(§4-1 / §4-7 Few-shot)。
 * - mustLearn は進路依存で 0〜8 件可変(§3-5 / §4-2)。
 * - feasibility(4 段階)+ warning のトーン規範(§4-4)。
 * - timeLabel は短い英数表記(NOW/3M/6M/1Y/2Y/3Y/5Y/10Y/GOAL)で統一(§4-3 / §5)。
 * - NOW ノードには nowActions(1〜3 件)を必ず出力(§3-6-2)。
 * - 楽観バイアス排除・未確定情報を理由に逃げない(§4-6)。
 */

/** プロンプトのバージョン(specs §4-8 / A-B 切替用)。 */
export const PROMPT_VERSION = "result-v2";

export function buildPrompt(answers: AnswerMap): string {
  const labeled = labelizeAnswers(answers);
  const qa = Object.entries(labeled)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join("\n");

  // 解釈ガイドの動的部分(年収トレンド / 除外条件 / undecided+both_unsure)
  const dynamic = buildInterpretationNotes(answers);

  return [
    "あなたは進路相談の専門家です。以下の回答をもとに、現実的で前向きな進路プランを日本語で作成してください。",
    "",
    "# ユーザーの回答",
    qa,
    "",
    // ============================================================
    // 解釈の前提(短縮版・2026-06-02)
    // ============================================================
    "# 解釈の前提",
    "- 「これまで学んだ・実務で得た知見のある分野」=ユーザーが『仕事にできるレベル』で身につけている分野(学習中・趣味レベルは除外済み)。ロードマップの足場として活用する。",
    "- 「いま(または直近)の職業・職種」と「知見のある分野」は別軸。前者=現在のポジション、後者=過去〜現在の蓄積。一致しない場合(例:現職は経理だが知見はプログラミング)は、現職を起点としつつ知見分野への展開可能性も提案に含める。",
    "- 「これまでに働いた経験」が『なし』(主婦・主夫・育休・休職・定年退職・その他 等)の場合は、職種・経験年数の情報を持たない前提で、知見分野と立場の文脈に基づいてロードマップを組む。",
    "- 「働き方の制約」に「特になし」以外が含まれる場合は、その制約を踏まえた現実的な選択肢を提示する。",
    "- 「希望する働き方の形」は複数選択許容(v2.2 で multi 化)。複数選んだ場合は全てを並列の選択肢として尊重し、いずれかに矛盾しないロードマップを組む。",
    "",
    "# 解釈の前提: goal_income(目指す年収帯)",
    "- 「今と同じくらいで OK」=現年収維持志向(働き方の質を変えたい / 家計の足し / 年金+α 等)。",
    "- 現年収帯と目標年収帯の差で扱いを分ける: 同じ or same_as_now=現状維持志向 / +1段=漸進アップ志向 / +2段以上=大幅アップ志向(達成シナリオの現実性を慎重に検討) / 目標が現年収より低い=ダウンシフト志向(WLB 重視 / 育児両立 / 健康優先 等)。",
    "",
    "# 解釈の前提: goal_commit(初期投資にかけられる金額の目安)【最重要】",
    "- goal_commit は「上限金額の目安」であり「使い切るべき金額」ではない。",
    "- ロードマップで提案する投資(スクール・教材・資格・転居費・機材等)は、最終進路の達成に最低限必要なものに絞ること。使わずに済むなら使わない方がよい。",
    "- 使い切るプランが本当に最適である場合のみ、上限近くの投資を含めてよい。その場合は「なぜ上限近くの投資が必要か」をロードマップに明示する。",
    "- 高額帯(100to300 / gt300 = 100 万円以上)を選んだユーザーに対しても、まず低額帯で達成可能な代替案がないか検討し、必要性が明確な場合のみ高額投資を含めること。",
    "- 中立表現で行う(「スクール代」「教材費」と煽らず「初期投資」「自己投資」「教育・ツール・資格・転居等を含めた目安」)。情報商材的なロードマップ(「とにかく高額スクールに通え」「資格取りまくれ」)は禁止。",
    "",
    // ============================================================
    // MINDSET v2 解釈ガイド(短縮版 / 2026-06-05 さらに圧縮)
    // specs/mindset-questions-v2.md §7-1 / §7-2 / §7-3 / §7-4
    // ============================================================
    "# 解釈の前提: MINDSET v2 — 性格傾向の進路提案への反映",
    "## ビッグファイブ的シグナルの扱い(§7-1)",
    "- 後段の性格傾向セクション(5 軸 low/mid/high)は MINDSET 回答からの暗黙推定値(性格テスト結果ではない)。AI 内部での 3 案組み立てにのみ使う。",
    "- 結果画面の Plan 説明・ロードマップでは進路文脈の言葉で柔らかく織り込み、ビッグファイブの軸名・MBTI 等の類型名・数値スコアは出力しないこと。",
    "- 性格を強く断定しない(『あなたは ○○ な人です』NG → 『○○志向が見えます』のように柔らかく)。`neither` 値は中庸シグナルとして扱い、両極判定の根拠にしない。",
    "## 性格傾向 × 案タイプの対応(§7-2-1 / 3 案組み立ての参考)",
    "- 外向性高 + 開放性高 → スタートアップ系・営業職・事業開発をチャレンジ案でメイン提案。",
    "- 神経症傾向高(jump_anxious + careful_after + safe)+ 安定志向 → 保守案を厚く、チャレンジ案でも段階踏み(副業 → スピンアウト等)必須。一気の独立・起業は出さない。",
    "- 開放性高(change_welcome + wide_explore) + risk_take → 海外・起業・業界横断案で踏み込んで OK。",
    "- 意味志向 + 達成欲求 → ミッションドリブン型。社会起業・教育・医療を厚く。",
    "- 外向性低 + 誠実性高 + 開放性低 → 専門職継続 / 公務員を保守案、スペシャリスト独立をチャレンジ案。マネジメント案は出さない。",
    "- 協調性高 + WLB 重視 → 安定大手・公共系。完全個人事業は控えめに。",
    "## 進路提案の言語化スタイル(§7-2-2)",
    "- 直接断定 NG(「あなたは外向的なので営業がおすすめ」)。進路文脈で言語化(「この案では人と関わる機会が多く、リーダー役を取りやすい」)する。",
    "",
    "# 解釈の前提: MINDSET v2 E 群 — 働き方の必須条件(§7-3)",
    "「希望」ではなく「必須条件」として扱う。3 案すべて(保守 / 標準 / チャレンジ)でこれらの条件を満たすこと。違反する案は出さない。",
    "- location_preference: keep_current=現居住地から離れない / metro_pref=都市部勤務 / rural_pref=地方・郊外 / overseas_pref=海外勤務・駐在 / anywhere=制約なし",
    "- remote_preference: office_pref=リモート前提の職種は提案しない / hybrid_office=完全リモート企業は提案しない(週3以上出社) / hybrid_remote=完全出社企業は提案しない(週3以上リモート) / remote_full=リモート可のみ提案 / flexible=制約なし",
    "- wlb_priority: wlb_priority=残業前提・長時間労働は提案しない / wlb_balance=標準的な働き方中心 / work_priority=没頭型キャリア・スタートアップ・コンサル・MBA 等を提案して OK",
    "注: goal_avoid(GOAL v2.2 で撤去)の代替として MINDSET E 群を必須フィルタとして使う。「長時間労働回避」=wlb_priority、「出社必須回避」=hybrid_remote / remote_full、「転居・出張多め回避」=keep_current で判定。",
    "",
    "# 解釈の前提: mindset_freenote(§7-4)",
    "- 選択肢で表現しきれなかった性格・価値観の補足(完璧主義・HSP・夜型/朝型・対人スタイル等)が記載されていればロードマップに反映する(無視しない)。",
    "- 個人特定情報(企業名・人名)・機微情報(健康詳細・宗教・政治信条)は出力に含めない(AI 判断には使ってよい)。",
    "",
    "# 解釈の前提: ORIGIN + GOAL + MINDSET の組み合わせ(§7-5)",
    "- GOAL.goal_workstyle=startup + risk_pref=safe + 神経症傾向=high → 矛盾シグナル。段階的アプローチ(副業 → スピンアウト → 独立)を提案。一気の起業案は控える。",
    "- change_intent=continue + 開放性=high + change_welcome → 本人は「続けたい」が変化志向あり → 保守案=同職種別企業 / 標準案=ジョブチェンジ / チャレンジ案=業界横断 を出して比較材料を提示。",
    "- life_constraint=caring_kids + wlb_priority + remote_full → リモート可職種を保守案で厚く、出社必須案は 3 案すべてで排除。",
    "- knowledge_fields=medical_care + career_change + deep_focus + meaning_priority → 医療×IT / 医療×教育 / 医療×行政 など医療領域内で別職種に転向するチャレンジ案を提案。",
    "- goal_workstyle=[freelance, multi_job] + lead_avoid + solo_strong + value=freedom → 3 案すべてフリーランス前提で粒度違いを提示(個人事業 / 法人化 / 複業構成)。",
    ...dynamic,
    "",
    // ============================================================
    // 結果 v2 専用ガイド(短縮版・specs/result-v2.md §4)
    // ============================================================
    "# 結果生成の前提: 業界事情を踏まえた具体提示(v2 §4-1)",
    "- 抽象論・ふわっとした提案は禁止。各 plan の candidate.detail / roadmap.description / skills は、対象分野の業界事情・職種の細分・採用市場の現実を踏まえた具体的な選択肢を提示する。",
    "- とくに roadmap[].description には**具体的な数値・期限・手段**を必ず含める(例:「開業資金 50 万円(月 5 万円×10 ヶ月)」「ポートフォリオを 5 件作る」「TOEIC 700 点取得」「未経験採用 3 社にエントリー」「副業で月 5 万円稼ぐ」)。",
    "- 業界事情の最低提示要件(各案で最低 2 つは触れる): 採用ルート(新卒 / 中途未経験 / 経験者 / 委託 / フリーランス)/ 職種の細分(例: エンジニア → FE/BE/アプリ/組込/インフラ/SRE/データ/ML)/ 雇用形態(正社員 / 契約 / 派遣 / 業務委託 / フリーランス / 副業 / 起業)/ 学習ルート(独学 / 専門学校 / 大学 / オンラインスクール / ブートキャンプ / 企業研修)。",
    "",
    "# 結果生成の前提: skills セクションの組み立て(v2 §4-2)",
    "- skills.mustLearn(0〜8 件)を**主軸**に学んでおくべき分野を細かく説明。件数は進路の性質に応じて: 現場で学ぶ進路(接客・現場仕事・運送)→ 0 件(空配列)/ 一般進路 → 3〜5 件 / 学習中心の進路(エンジニア・士業・起業・医療)→ 5〜8 件まで OK。",
    "- 各 mustLearn は title(40 字以内)+ description(200 字以内)。「なぜ学ぶか」を一言含む。",
    "- recommendedCerts は控えめに。本当に必須なもの(医師・弁護士・看護師・税理士など業務独占資格)だけ。0 件で OK。",
    "- emergingSkills には業界の最新トレンドを最低 1 件含める(例: 生成 AI 使いこなし / バイブコーディング / ノーコード / データドリブン思考)。",
    "- strengths は MINDSET 5 軸から進路文脈で「うっすら」表現で 2〜5 件抽出。心理学用語(「外向性」等)は出さない(§7-1-3 準拠)。",
    "",
    "# 結果生成の前提: roadmap の時間粒度(v2 §4-3 / §5)",
    "- ★ **roadmap は 3 案すべて 7〜8 段で必ず構成すること**(6 段以下は基本禁止)。粒度を細かくすることで進路の具体性が出る。",
    "- 推奨構成(goal_horizon に応じて 7〜8 段で):",
    "  - 3年プラン: NOW / 3M / 6M / 1Y / 18M / 2Y / 3Y / GOAL(8 段)",
    "  - 5年プラン: NOW / 6M / 1Y / 2Y / 3Y / 4Y / 5Y / GOAL(8 段)",
    "  - 10年プラン: NOW / 6M / 1Y / 3Y / 5Y / 7Y / 10Y / GOAL(8 段)",
    "  - 1年プラン: NOW / 2M / 4M / 6M / 8M / 10M / 1Y / GOAL(8 段)。1 年でも省略せず細かく刻む。",
    "- 段数を増やすことを優先・5 段以下は禁止(schema 下限 3 だが実質は 7〜8 段必須)。",
    "- timeLabel は短い英数表記(NOW / 3M / 6M / 9M / 1Y / 2Y / 3Y / 5Y / 10Y / GOAL)で統一。日本語は periodText のみ(`open` モードのみ短期/中期/長期も可)。",
    "- timeLabel=NOW のノード(kind=start)には必ず nowActions(1〜3 件)を含める。「今週中に〜」「今月中に〜」のような具体性。",
    "- 各 RoadmapNode.description には**具体的な数値・期限・手段**を含める(40 字以上 350 字以下)。最初のノード kind=\"start\"、最後 kind=\"goal\"、途中 kind=\"milestone\"。",
    "",
    "# 結果生成の前提: feasibility と warning(v2 §4-4)",
    "- 各 plan の candidate には feasibility 必須: realistic(業界の通常キャリアパスで届く範囲)/ challenging(努力と時間をかければ届く)/ very_challenging(複数の大きな壁・長期戦)/ extreme_effort(現実的な期間では到達困難・超努力が必要)。",
    "- 判定例: 高校生×知見なし×1年で年収2000万 → extreme_effort(warning 必須)/ 在職3年エンジニア×3年で年収1.5倍 → realistic か challenging / 主婦10年ブランク×看護師×3年 → challenging(看護学校3年が必要)/ 高校生×エンジニア×5年 → realistic。",
    "- feasibility != realistic のとき warning に 20〜160 字で「なぜ厳しいか」+「やるなら何が必要か / 代替案」を書く。warning の書き方:",
    "  - NG: 「あなたには無理です」「諦めなさい」「絶対に達成できません」「現実的でない」",
    "  - OK: 「未経験で 1 年で年収 2000 万は通常ルートでは届かない。それでも目指すなら、副業 + 高単価フリーランス化を 3 年計画でやり切る覚悟が必要」",
    "  - OK: 「学習量が多く、3 年は集中して学び続ける覚悟が必要。短期で稼ぐより、まず実力をつける期間」",
    "- extreme_effort は UI 上「超努力が必要」と表示される。突き放しではなく「やるなら覚悟がいる」前提で warning を書く。",
    "",
    "# 結果生成の前提: plans を 3 本提示する原則(v2 §4-5)",
    "- plans は固定長 3。3 案の差が十分大きくなる組み合わせを選ぶ。",
    "- 基本(現在の知見・職種がある場合): 案1=specialize(専門深化) / 案2=transition(キャリアチェンジ) / 案3=hybrid(現知見×別分野クロス)。",
    "- 学生・未経験: 案1=advance(進学・体系学習) / 案2=new_entry(未経験就職・研修) / 案3=side_job(独学+副業・インターン)。",
    "- 起業志向: 案1=employ_then_independent / 案2=independent(即独立) / 案3=small_start。",
    "- 「優劣」ではなく「方向の違い」として提示。matchPercent は各案の本人との適合度(MINDSET / GOAL 由来)、合計 100% にする必要なし(各案独立で 60〜95% 程度)。isTop=true は 1 案だけ(または全 false)。",
    "",
    "# 結果生成の前提: トーン規範(v2 §4-6)",
    "- 「努力次第で達成可能」「やればできる」のような楽観バイアスを排除し、難易度の高さは率直に伝える。一方で「あなたは絶対 X すべき」のような決めつけは避け、「X という選択肢がある / Y の方が現実的かも」と複数提示する。",
    "- 未確定情報を理由に逃げない(§8-5-2 (i-3) と同じ原則。「業界が未定なので分かりません」と返さず、進学先・知見・MINDSET から具体候補を推論する)。",
    "- 占い的な決めつけ、医療・法律・投資助言と誤認される表現は避ける(免責方針)。",
    "- hero.tagline は「○○から××へ」のような現在地・目標を直接示す表現は避ける。3 案を象徴する短い言葉(8〜40 字)。例: 「3 つの道、どれを選ぶ?」「未来は、ここから 3 つに広がる」「次の 3 年、3 通りの行き先」。",
    "",
    // ============================================================
    // Few-shot 例(短縮版・Good 4 + NG 2 + ロードマップ specific 3)
    // 元: Good 10 + NG 5 → 約半分に縮減(v2 §4-7)
    // ============================================================
    "# Few-shot 例: roadmap[].description の具体性(v2 §4-7)",
    "Good 例(数値・期限・手段のいずれかを必ず含む):",
    "1. 「開業資金 50 万円を貯める(月 5 万円 × 10 ヶ月)。給与天引きの自動積立を活用し、3 月末までに達成する」",
    "2. 「ポートフォリオを 5 件作る。Next.js + Tailwind で個人プロジェクト 3 件、副業案件 2 件を GitHub に公開する」",
    "3. 「TOEIC 700 点取得。月 30 時間の学習(平日 1 時間 + 週末 2 時間)を 6 ヶ月続け、年内に受験」",
    "4. 「未経験採用の Web 制作会社 3 社にエントリーする。Wantedly / Green / 直接応募の 3 ルートを並行で進める」",
    "",
    "ロードマップ specific 例(進路別):",
    "- 看護目標: 「看護学校の入学試験対策。生物・現代文・面接の 3 科目を週末に予備校で受講(月 4 万円)」",
    "- フリーランス目標: 「インボイス登録 + 屋号で青色申告開業 + 取引先 2 社と業務委託契約を年内に締結」",
    "- 資格目標: 「簿記 2 級。3 ヶ月で過去問 5 年分を解き切る。試験は 11 月実施回を受験」",
    "",
    "NG 例(抽象的すぎ・行動につながらない):",
    "- 「スキルを磨く」「経験を積む」「自分を高める」 → 何を・どれくらい・いつまでが無い。",
    "- 「努力する」「考える」 → 行動・数値・期限・手段が無い。",
    "",
    "# Few-shot 例: mustLearn / hero.tagline(v2 §4-7)",
    "- mustLearn 進路依存: 接客業・現場仕事 → mustLearn=[](「特になし(現場で学ぶ進路です)」と UI 表示)/ エンジニア・士業・起業 → 5〜8 件 OK / 一般進路(営業・販売・事務)→ 3〜5 件。",
    "- hero.tagline Good 例: 「3 つの道、どれを選ぶ?」「未来は、ここから 3 つに広がる」「あなたの進路、3 つの視点で」「次の 3 年、3 通りの行き先」。",
    "- hero.tagline NG 例: 「高校生からエンジニアへ」「会社員から起業家へ」(currentLabel / goalLabel と重複)。",
    "",
    "# 出力の制約(v2)",
    "- 指定スキーマに完全に従う JSON のみを出力する(余計な文章・マークダウン NG)。",
    "- トップレベルに hero / plans の 2 キーを必ず含める(2026-06-02: personality キーは廃止)。",
    "- plans は配列で**ちょうど 3 件**(固定長)。3 案の差は §4-5 のパターンで担保。",
    "- 各 plan は planType / candidate / roadmap / skills / adSlot を必ず含む。adSlot は MVP では { kind: \"ad_recruitment\" } のみで OK(headline/body は省略可)。",
    "- hero.tagline は 8〜40 字。hero.currentLabel と hero.goalLabel は任意(UI には表示されない)。",
    "- 各フィールドの文字数上限・下限を必ず守る(超過・不足は無効になる)。",
    "- トーンは前向きで具体的(免責方針は上記トーン規範を参照)。個人特定情報は結果に含めない。",
  ].join("\n");
}

/** 現在の回答から動的に追加する注釈行を返す(空配列なら追加なし)。 */
function buildInterpretationNotes(answers: AnswerMap): string[] {
  const out: string[] = [];

  // (a) 年収トレンド注釈
  const trend = computeIncomeTrend(answers);
  if (trend) {
    out.push("");
    out.push(`# 年収トレンド: ${trend}`);
  }

  // (m-1) MINDSET v2 ビッグファイブ的シグナルの暗黙取得(specs §7-1)
  // MINDSET の主要回答(コア性格 5 + 学習 + リスク)が 1 件でもあれば 5 軸サマリを注入。
  // どれも未回答の場合は注入しない(ORIGIN/GOAL のみのテストや /diagnosis?dev=mindset 前の状態に配慮)。
  // 2026-06-02 PersonalityType 撤去後も、これらは「進路提案組み立ての参考シグナル」として AI 入力に維持する。
  if (hasAnyMindsetCore(answers)) {
    const bf = inferBigFive(answers);
    out.push("");
    out.push("# ユーザーの性格傾向(ビッグファイブ的シグナル / 暗黙取得 / 進路提案の参考シグナル)");
    out.push(`- 外向性: ${bf.extraversion}`);
    out.push(`- 協調性: ${bf.agreeableness}`);
    out.push(`- 誠実性: ${bf.conscientiousness}`);
    out.push(`- 神経症傾向: ${bf.neuroticism}`);
    out.push(`- 開放性: ${bf.openness}`);
    out.push(
      "※ これらはユーザーが直接「外向的か?」と聞かれたものではなく、進路文脈の質問から暗黙的に推定したシグナルです。",
    );
    out.push(
      "※ AI 内部での 3 案の組み立て・各 Plan の説明トーン・ロードマップの粒度に反映させてください。結果画面に軸名・数値・MBTI 等の類型は出力しないこと(進路文脈の柔らかい言葉で『○○志向が見えます』のように織り込む)。",
    );
  }

  // (b) change_intent=undecided + change_direction=both_unsure
  if (
    answers.change_intent === "undecided" &&
    answers.change_direction === "both_unsure"
  ) {
    out.push("");
    out.push("# 迷い層への対応");
    out.push(
      "- ユーザーは「キャリアチェンジ / ステップアップ」の両方で迷っている。ロードマップでは、ステップアップ案とキャリアチェンジ案を両方提示すること(片方に絞らない)。",
    );
  }

  // (c) goal_start_timing + goal_horizon の合算解釈
  if (
    typeof answers.goal_start_timing === "string" &&
    typeof answers.goal_horizon === "string"
  ) {
    out.push("");
    out.push(
      `# 期間設計: 動き出し=${answers.goal_start_timing} / 実現期間=${answers.goal_horizon}`,
    );
    out.push(
      "- 「動き出すタイミング」は準備期間の設計に、「実現したい期間」はロードマップの全長に反映する。両者の組み合わせから、準備フェーズと実行フェーズの配分を判断する。",
    );
  }

  // (i-1) student_job_status のフェーズ別提案軸切替【v2.1 §8-5-2 (i-1)】
  if (typeof answers.student_job_status === "string") {
    const guide = JOB_STATUS_PROMPT[answers.student_job_status];
    if (guide) {
      out.push("");
      out.push(`# 就活フェーズ: ${guide}`);
    }
  }

  // (i-2) student_advance_status のフェーズ別提案軸切替【v2.1 §8-5-2 (i-2)】
  if (typeof answers.student_advance_status === "string") {
    const guide = ADV_STATUS_PROMPT[answers.student_advance_status];
    if (guide) {
      out.push("");
      out.push(`# 進学フェーズ: ${guide}`);
    }
  }

  // (i-3) 進学者の「進学先 × 卒業後業界」の関係性ガイド【v2.1 §8-5-2 (i-3)】
  // 2026-06-05 動的化: student_goal_track=advance または student_advance_status が
  // 定義されているときのみ注入(社会人・フリーランス・主婦等には送らない・プロンプト圧縮目的)。
  if (
    answers.student_goal_track === "advance" ||
    typeof answers.student_advance_status === "string"
  ) {
    out.push("");
    out.push(
      "# 解釈の前提: 進学者の「進学先」と「卒業後の業界」の関係性【v2.1 §8-5-2 (i-3)】",
    );
    out.push("## 大原則: 進学先・学部主軸で業界を推論する");
    out.push(
      "- 進学者(student_goal_track=advance)は、AI が進学先(student_goal_advance)の学校・学部・専攻を主軸として業界を推論する(最重要方針)。",
    );
    out.push(
      "- ユーザーが student_goal_industry で「未定」を選んでいても、「分からないので分かりません」ではなく、進学先からの推論で具体的な業界候補を提示すること。",
    );
    out.push("## 進学先・学部からの業界推論例(主軸ルール)");
    out.push("- 医学部・看護学部・薬学部 → 医療・看護・介護を最優先");
    out.push(
      "- 情報工学科・情報系大学院 → IT・Web / ソフトウェア開発 / データ・AI を最優先",
    );
    out.push("- 法学部・法科大学院 → 法律・行政を最優先");
    out.push("- 経営・経済学部 → 金融・会計 / 営業 / マーケティングを候補に");
    out.push("- 文学部 → 教育 / メディア・出版 / 語学 を候補に");
    out.push("- 教育学部 → 教育・保育を最優先");
    out.push("- 工学部 → 製造・エンジニアリング / 研究・学術を最優先");
    out.push("- 建築学科 → 建築・土木を最優先");
    out.push(
      "- 芸術系 → デザイン・クリエイティブ / 芸術・音楽 / メディアを候補に",
    );
    out.push("- 農学部 → 農林水産 / 研究・学術 を候補に");
    out.push("## 分野クロス志向の見落とし禁止(複数候補の並列提示)");
    out.push(
      "- 学部が複数業界に開かれる場合は、ORIGIN の knowledge_fields と本人の希望を組み合わせて複数候補を並列提示する。例:「文学部 + 知見=IT・Web」→ メディア・出版 と IT・Web の交差点も提案。",
    );
    out.push(
      "- 「医学部進学 + 知見=IT」のようなクロス志向も見落とさない。医療×IT(医療情報・ヘルスケア DX・医療データ AI 等)の選択肢も含める。「進学先 × 知見」の交差点が最も差別化されたキャリアパスになることが多い。",
    );
    out.push(
      "- 整合/転向/探索パターン: 整合=進学先の学びを直接活かす / 転向=「進学中に副専攻・独学で転向先のスキルを積む」を織り込む / 探索(業界=undecided)=進学先カリキュラム + 業界探索イベント・インターンを提案。進学先と業界が「整合していないからおかしい」と判断しないこと。",
    );
  }

  // (i-2 補足) student_goal_track=undecided(進路迷い層・進学迷い含む)
  // 確定版では reconsidering を撤去し、進学迷いも Q1 の undecided に統合(§9-v2.1-2 採択 A)。
  // ロードマップ3本提示は別フェーズだが、進路迷い時の AI 整形は v2.1 でも明示する。
  if (answers.student_goal_track === "undecided") {
    out.push("");
    out.push("# 進路探索フェーズ(student_goal_track=undecided)");
    out.push(
      "- ユーザーは卒業後の進路自体を決めかねている(進学/就職/起業 すべてが候補)。",
    );
    out.push(
      "- ロードマップでは「進学した場合 / 就職した場合 / 起業した場合」など方向性違いの案を並列で提示するとよい(将来の3本提示ルールと整合)。",
    );
    out.push(
      "- ORIGIN の knowledge_fields(現在の知見)と本人の志向(goal_workstyle / goal_freenote 等)から各案の妥当性を評価し、ユーザーが選びやすい比較軸を提示する。",
    );
  }

  // (i-4) admitted × after_preparation の組み合わせ解釈【v2.1 §8-5-2 (i-4)】
  if (
    answers.student_advance_status === "admitted" &&
    answers.goal_start_timing === "after_preparation"
  ) {
    out.push("");
    out.push(
      "# 解釈の前提: 進学合格組の「動き出しタイミング」(admitted × after_preparation)",
    );
    out.push(
      "- 合格・入学確定 × 準備期間後の組み合わせ → 「進学卒業後(2〜4年後・大学院なら 2〜6年後)からロードマップ開始」と解釈する。",
    );
    out.push(
      "- 進学期間中は「準備フェーズ」として、学業 + 並行できる軽い準備(資格・インターン・読書等)を提案。",
    );
    out.push(
      "- goal_horizon(実現期間)は、「進学卒業時点からのカウントダウン」として扱う。例: 進学先=「大学院(情報系・2年)」 + goal_horizon=5y → 「進学 2 年 + 5 年プラン = 入学から 7 年後の実現」と AI が解釈。",
    );
    out.push(
      "- 進学先の課程期間(2 年 / 4 年 / 6 年)は ORIGIN の student_major や student_goal_advance の text から AI が読み取って妥当に推測すること(固定値ではない)。",
    );
  }

  // (i-5) after_preparation を非進学者(student_advance_status≠admitted など)が選んだケース【v2.1 §8-5-2 (i-5)】
  if (
    answers.goal_start_timing === "after_preparation" &&
    answers.student_advance_status !== "admitted"
  ) {
    out.push("");
    out.push(
      "# 解釈の前提: after_preparation は学生限定ではない(非進学者ケース)",
    );
    out.push(
      "- after_preparation は「決まったライフイベント(進学卒業・育休明け・資格取得・家庭事情の落ち着き等)を待ってから動き出す」を表す共通選択肢。",
    );
    out.push(
      "- 学生以外で選んだケース(例: 育休中の親 / 介護中の社会人 / 試験勉強中の社会人)では、ORIGIN の life_constraint / stage / time_available などを参考に「何の準備が終わるのを待っているか」を AI が推測してロードマップ開始時期を設定する。",
    );
    out.push(
      "- 不明確な場合は、ロードマップに「準備期間が終わり次第ステップ 1 へ」と相対時期で書く(絶対年数は書かない)。",
    );
  }

  return out;
}

/** student_job_status の各値 → フェーズ別 AI 提案軸ガイド(v2.1 §8-5-2 (i-1))。 */
const JOB_STATUS_PROMPT: Record<string, string> = {
  exploring:
    "業界・職種を絞り込む段階。自己分析・志望軸の言語化・業界比較を提案の軸にする。",
  researching:
    "業界は絞れているが企業比較中。各社の選び方・OB訪問・インターン活用を中心に提案。",
  entry_started:
    "エントリー開始済み。ES・自己 PR ブラッシュアップと、選考前準備を中心に提案。",
  in_selection:
    "選考中。面接対策・志望動機の磨き込み・複数内定時の比較軸を中心に提案。",
  offer_received:
    "内定あり(継続選考の可能性も)。承諾判断軸と、入社後の初期スキル設計を提案。",
  offer_accepted:
    "内定承諾済み。就活アドバイスではなく、入社後 3〜5 年のキャリア設計・配属希望・初期スキル投資を提案。",
  not_started:
    "就活未着手・進路未定。無理に就活を勧めず、進路探索の最初のステップから提案する。",
};

/** student_advance_status の各値 → フェーズ別 AI 提案軸ガイド(v2.1 §8-5-2 (i-2))。
 *  確定版で reconsidering を撤去し 4 値化(§9-v2.1-2 採択 A)。 */
const ADV_STATUS_PROMPT: Record<string, string> = {
  searching:
    "進学先検討中。分野選び・大学比較・学べる内容と卒業後の進路接続を中心に提案。",
  target_decided:
    "志望校決定済み・受験準備中。受験勉強と並行して進学後の学習設計の方向性を示す。",
  in_exam:
    "受験本番中(出願済み・結果待ち含む)。受験戦略のアドバイスは最小限にして、進学後〜卒業後の長期キャリアを描く。",
  admitted:
    "合格・入学確定。進学後の学習設計と卒業後の業界選択を中心に提案。goal_start_timing=after_preparation との整合性を最優先で確認。",
};

// ============================================================
// MINDSET v2: ビッグファイブ的シグナル暗黙取得(specs §7-1-1)
// ============================================================

/** ビッグファイブ 5 軸の出力レベル(`low` / `mid` / `high`)。 */
export type BigFiveLevel = "low" | "mid" | "high";

/**
 * MINDSET v2 の進路文脈回答からビッグファイブ 5 軸を `low` / `mid` / `high` で
 * 暗黙的に推定する(specs §7-1-1)。
 *
 * 設計方針:
 * - 各軸は複数質問の **組み合わせ** で判定する(単一質問では断定しない)。
 * - 「明確な high」「明確な low」が成立しない場合はすべて `mid`(中庸)に倒す。
 * - `neither` 値(unknown_field_jump / competition_pref / failure_recovery)は
 *   中庸入力として扱い、両極の `high` / `low` 判定の根拠にしない。
 *
 * 制約:
 * - ユーザーには軸名(外向性等)を一切表示しない(§7-1-2 prompt 側で明文)。
 * - AI は本値を「進路提案の参考シグナル」として使う(性格断定ではなく)。
 */
export function inferBigFive(a: AnswerMap): {
  extraversion: BigFiveLevel;
  agreeableness: BigFiveLevel;
  conscientiousness: BigFiveLevel;
  neuroticism: BigFiveLevel;
  openness: BigFiveLevel;
} {
  // 外向性 = leadership_role + social_pref
  // 高: lead_want and team_strong / 低: lead_avoid and solo_strong / それ以外: mid
  const extraversion: BigFiveLevel =
    a.leadership_role === "lead_want" && a.social_pref === "team_strong"
      ? "high"
      : a.leadership_role === "lead_avoid" && a.social_pref === "solo_strong"
        ? "low"
        : "mid";

  // 協調性 = social_pref + competition_pref(逆向き)
  // 高: team_strong and compete_drain / 低: compete_motivated and solo_strong / それ以外: mid
  // competition_pref=neither は中庸入力(片方の極端判定の根拠にしない)
  const agreeableness: BigFiveLevel =
    a.social_pref === "team_strong" && a.competition_pref === "compete_drain"
      ? "high"
      : a.competition_pref === "compete_motivated" &&
          a.social_pref === "solo_strong"
        ? "low"
        : "mid";

  // 誠実性 = plan_style + learning_depth
  // 高: plan_first and deep_focus / 低: action_first and wide_explore / それ以外: mid
  const conscientiousness: BigFiveLevel =
    a.plan_style === "plan_first" && a.learning_depth === "deep_focus"
      ? "high"
      : a.plan_style === "action_first" && a.learning_depth === "wide_explore"
        ? "low"
        : "mid";

  // 神経症傾向 = unknown_field_jump + failure_recovery + risk_pref(逆向き)
  // 高: jump_anxious and careful_after and safe
  // 低: jump_ok and retry_fast and risk_take
  // どちらの極にも該当しない(neither を含む)→ mid
  const neuroticism: BigFiveLevel =
    a.unknown_field_jump === "jump_anxious" &&
    a.failure_recovery === "careful_after" &&
    a.risk_pref === "safe"
      ? "high"
      : a.unknown_field_jump === "jump_ok" &&
          a.failure_recovery === "retry_fast" &&
          a.risk_pref === "risk_take"
        ? "low"
        : "mid";

  // 開放性 = change_attitude + learning_depth
  // 高: change_welcome and (wide_explore or mix_learning)
  // 低: change_dislike and deep_focus
  const openness: BigFiveLevel =
    a.change_attitude === "change_welcome" &&
    (a.learning_depth === "wide_explore" ||
      a.learning_depth === "mix_learning")
      ? "high"
      : a.change_attitude === "change_dislike" &&
          a.learning_depth === "deep_focus"
        ? "low"
        : "mid";

  return {
    extraversion,
    agreeableness,
    conscientiousness,
    neuroticism,
    openness,
  };
}

/** MINDSET コア性格群の回答が 1 つでも入っているか(BF サマリ注入のトリガ)。 */
function hasAnyMindsetCore(a: AnswerMap): boolean {
  const coreIds = [
    "leadership_role",
    "social_pref",
    "plan_style",
    "unknown_field_jump",
    "change_attitude",
    "competition_pref",
    "risk_pref",
    "learning_depth",
    "failure_recovery",
  ];
  return coreIds.some((id) => typeof a[id] === "string" && a[id] !== "");
}

/** ORIGIN の current_income と GOAL の goal_income の対比から年収トレンドを判定する。 */
function computeIncomeTrend(answers: AnswerMap): string | null {
  const cur = typeof answers.current_income === "string" ? answers.current_income : "";
  const goal = typeof answers.goal_income === "string" ? answers.goal_income : "";
  if (!cur || !goal) return null;

  // goal_income の same_as_now → 現状維持志向
  if (goal === "same_as_now") return "現状維持志向";

  // ORIGIN の current_income(none / lt300 / 300to500 / 500to700 / 700to1000 / gt1000)を rank 化
  const currentRank: Record<string, number> = {
    none: 0,
    lt300: 1,
    "300to500": 2,
    "500to700": 3,
    "700to1000": 4,
    gt1000: 5,
  };
  // GOAL の goal_income(lt200 / 200to300 / 300to400 / 400to600 / 600to800 / 800to1200 / 1200to2000 / gt2000)を ORIGIN と比較可能な rank に揃える
  // ※ GOAL は ORIGIN より細かいが、ざっくり対応で十分。
  const goalRank: Record<string, number> = {
    lt200: 0, // ORIGIN none〜lt300 相当
    "200to300": 1, // ORIGIN lt300 相当
    "300to400": 2, // ORIGIN 300to500 の下端相当
    "400to600": 2.5, // ORIGIN 300to500〜500to700 の境界
    "600to800": 3, // ORIGIN 500to700 相当
    "800to1200": 4, // ORIGIN 700to1000 相当
    "1200to2000": 5, // ORIGIN gt1000 相当
    gt2000: 6, // ORIGIN gt1000 超
  };
  const c = currentRank[cur];
  const g = goalRank[goal];
  if (c === undefined || g === undefined) return null;

  const diff = g - c;
  if (diff <= -0.5) return "ダウンシフト志向";
  if (Math.abs(diff) < 0.5) return "現状維持志向";
  if (diff < 1.5) return "漸進アップ志向";
  return "大幅アップ志向";
}
