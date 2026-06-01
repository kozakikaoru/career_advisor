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
 * - (m-2) 結果画面に「外向性」等のビッグファイブ軸名を直接出さない制約を明文化(§7-1-2)。
 *         代わりに「進路文脈で『うっすら』表現」する具体例 5 個と NG 表現 4 件を提示(§7-1-3)。
 * - (m-3) 性格傾向 × 案タイプ対応表(§7-2-1)を解釈ガイドとして明文化。
 * - (m-4) MINDSET E 群(location_preference / remote_preference / wlb_priority)を
 *         「働き方の必須条件」として AI に渡す(GOAL.goal_avoid 撤去の代替フィルタ・§7-3)。
 * - (m-5) mindset_freenote の取り扱い(origin_freenote / goal_freenote と同等)。
 * - (m-6) ORIGIN + GOAL + MINDSET の組み合わせ解釈の代表パターン(§7-5)。
 *
 * TODO(roadmap-v2): 結果画面 v2 強化フェーズでロードマップ3本提示を実装。
 *   仕様書 §8-5-3 参照。`CareerPlanSchema` 拡張(roadmaps: [3])+
 *   AI プロンプトに層判定(classifyLayer:迷い層 vs 確定層)+ 3 本提示制約を追加。
 *   性格傾向 × 案タイプ対応表(MINDSET v2 §7-2-1)はその時点でロードマップ生成に直結させる。
 *   本フェーズ(MINDSET v2 差分実装)では方針コメント止まり。
 */
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
    "# 解釈の前提",
    "- 「これまで学んだ・実務で得た知見のある分野」に書かれた分野は、ユーザーが『仕事にできるレベルで身につけている』前提で扱う(学習中・趣味レベルは除外済み)。ロードマップの足場として活用する。",
    "- 「いま(または直近)の職業・職種」と「知見のある分野」は別軸として扱う。前者は『現在のポジション』、後者は『過去〜現在の蓄積』。両者が一致しないケース(例:現職は経理だが知見はプログラミング)では、現職を起点としつつ知見分野への展開可能性も提案に含める。",
    "- 「これまでに働いた経験」が『なし』の場合(主婦・主夫・育休・休職・定年退職・その他 等)は、職種・経験年数の情報を持たない前提で、知見分野と立場の文脈に基づいてロードマップを組む。",
    "- 「働き方の制約」に「特になし」以外が含まれる場合は、その制約を踏まえた現実的な選択肢を提示する。",
    "- 「希望する働き方の形」は複数選択を許容している(v2.2 で multi 化)。複数選んだ場合は、その全てを並列の選択肢として尊重し、いずれかに矛盾しないロードマップを組む。",
    "",
    "# 解釈の前提: goal_income(目指す年収帯)",
    "- 「今と同じくらいで OK」は現年収維持志向(働き方の質を変えたい / 家計の足し / 年金+α 等)を意味する。",
    "- 現年収帯(ORIGIN の current_income)と目標年収帯(GOAL の goal_income)を比較し、以下のように扱う:",
    "  - 同じ帯か same_as_now を選択した場合 → 現状維持志向(年収維持で働き方の質を変えたい層)",
    "  - 目標が現年収より 1 段高い → 漸進アップ志向(現実的なステップアップ)",
    "  - 目標が現年収より 2 段以上高い → 大幅アップ志向(達成シナリオの現実性を慎重に検討)",
    "  - 目標が現年収より低い → ダウンシフト志向(WLB 重視 / 育児両立 / 健康優先 等)",
    "",
    "# 解釈の前提: goal_commit(初期投資にかけられる金額の目安)【最重要】",
    "- goal_commit はユーザーが進路実現のために投資できる「上限金額の目安」を示す。",
    "- これは「使い切るべき金額」ではない。",
    "- ロードマップで提案する投資(スクール・教材・資格・転居費・機材等)は、最終進路の達成に最低限必要なものに絞ること。",
    "- 使わずに済むなら使わない方がよい。無駄な高額投資は提案しないこと。",
    "- 使い切るプランが本当に最適である場合のみ、上限近くの投資を含めてよい。その場合は「なぜ上限近くの投資が必要か」の理由をロードマップに明示すること。",
    "- 結果として、ユーザーが余裕を持って多めに申告しても、AI 側で必要最低限の投資プランに調整される設計とする。",
    "- 高額帯(100to300 / gt300 = 100 万円以上)を選んだユーザーに対しても、まず低額帯で達成可能な代替案がないか検討し、必要性が明確な場合のみ高額投資を含めること。",
    "- goal_commit に関する提案・記述は中立表現で行う(「スクール代」「教材費」「資格費」のような直接表現で煽らない)。「初期投資」「自己投資」「教育・ツール・資格・転居等を含めた目安」など中立的な言い回しを用い、情報商材的なロードマップ(「とにかく高額スクールに通え」「資格取りまくれ」)を生成しないこと。",
    "",
    "# 解釈の前提: 進学者の「進学先」と「卒業後の業界」の関係性【v2.1 §8-5-2 (i-3)】",
    "## 大原則: 進学先・学部主軸で業界を推論する",
    "- 進学者(student_goal_track=advance)は進学先(student_goal_advance)と卒業後の業界(student_goal_industry)の両方を回答している。",
    "- AI は進学先(student_goal_advance)の学校・学部・専攻を主軸として業界を推論する(これは確定版の最重要方針)。",
    "- ユーザーが student_goal_industry で「未定」を選んでいても、AI は「分からないので分かりません」ではなく、進学先からの推論で具体的な業界候補を提示すること。",
    "## 進学先・学部からの業界推論例(主軸ルール)",
    "- 医学部 → 医療・看護・介護を最優先候補に",
    "- 看護学部・薬学部 → 医療・看護・介護を最優先",
    "- 情報工学科・情報系大学院 → IT・Web / ソフトウェア開発 / データ・AI を最優先",
    "- 法学部・法科大学院 → 法律・行政を最優先",
    "- 経営学部・経済学部 → 金融・会計 / 営業・販売 / マーケティング・PR を候補に",
    "- 文学部 → 教育 / メディア・出版 / 語学 を候補に",
    "- 教育学部 → 教育・保育を最優先",
    "- 工学部(機械・電気・化学) → 製造・エンジニアリング / 研究・学術を最優先",
    "- 建築学科 → 建築・土木を最優先",
    "- 芸術系 → デザイン・クリエイティブ / 芸術・音楽 / メディアを候補に",
    "- 農学部 → 農林水産 / 研究・学術 を候補に",
    "## 学部が複数業界に開かれる場合(複数候補の並列提示)",
    "- 進学先の学部・専攻が複数業界に開かれる場合は、ORIGIN の knowledge_fields(現在の知見)と本人の希望(goal_workstyle / goal_freenote 等)を組み合わせて複数候補を並列で提示する。",
    "- 例: 「文学部 + 知見=IT・Web」→ メディア・出版 と IT・Web の両方を候補に(出版社の Web 編集者・メディア企業の Web ディレクター等の交差点も提案)",
    "- 例: 「経済学部 + 知見=データ・AI」→ 金融 と データ・AI の両方を候補に(金融データアナリスト・FinTech 領域などの交差点も提案)",
    "## 分野クロス志向の見落とし禁止",
    "- 「医学部進学 + 知見=IT」のような分野クロス志向のケースも見落とさない。",
    "- 医療×IT(医療情報・電子カルテ・遠隔診療・ヘルスケア DX・医療データ AI 等)の選択肢も必ず含めて提案する。",
    "- 「進学先 × 知見」の交差点が、最も差別化されたキャリアパスになることが多い。",
    "## 整合・転向・探索パターン(参考)",
    "- 整合パターン:「医学部進学 + 業界=医療・看護・介護」「情報系大学院 + 業界=ソフトウェア開発」→ 専門性深化型。進学で得る学びを直接活かす想定。",
    "- 転向パターン:「文学部進学 + 業界=IT・Web」「教育学部 + 業界=デザイン・クリエイティブ」→ 分野転向志向。進学先の学びを土台にしつつ、卒業時に別分野へ進む意向。ロードマップでは「進学中に副専攻・独学で転向先のスキルを積む」プランを織り込む。",
    "- 探索パターン: 業界=undecided → 進学先で学びながら方向性を探りたい段階。AI は進学先からの推論で具体候補を提示する(「分からないので分かりません」と返さない)。ロードマップでは「進学先のカリキュラム + 進学中の業界探索イベント・インターン」を提案。",
    "- 進学先と業界が「整合していないからおかしい」と判断しないこと。ユーザー本人の意思を尊重する。",
    "",
    // ============================================================
    // MINDSET v2 解釈ガイド(常時注入・静的)
    // specs/mindset-questions-v2.md §7-1-2 / §7-1-3 / §7-2-2 / §7-3 / §7-4
    // ============================================================
    "# 解釈の前提: MINDSET v2 — 性格傾向の暗黙取得とロードマップへの反映",
    "## ビッグファイブ的シグナルの扱い(§7-1)",
    "- 後段に性格傾向セクション(ビッグファイブの 5 軸 low/mid/high)がある場合、それは進路文脈の MINDSET 回答から AI 側で暗黙的に推定したシグナル。",
    "- ユーザーが直接「外向的か?」と聞かれたわけではない。性格テストの結果ではなく、進路選択への参考シグナルとして扱う。",
    "- ビッグファイブの軸名(外向性 / 協調性 / 誠実性 / 神経症傾向 / 開放性)を結果画面・ロードマップ文言・候補説明・パーソナリティセクション等に **直接出さない** こと。これは厳守。",
    "- 性格類型(MBTI / エニアグラム等)を持ち出さない。数値・スコア・パーセンタイル等を性格軸として出さない(traits.level は別の進路文脈の指標として OK)。",
    "- `unknown_field_jump` / `competition_pref` / `failure_recovery` で「neither」を選んだ場合は「明確な傾向なし・中庸」として解釈し、極端な性格断定の根拠にしないでください(「答えない」とは別物・意味のある中庸シグナル)。",
    "- meaning_priority と value_priority は重複する側面があるが、両方を組み合わせて『社会的意義への重み』を判定する。value_priority に meaning が含まれかつ meaning_priority=meaning_priority の場合は強い意味志向、value_priority に meaning が含まれず meaning_priority=success_priority の場合は強い成功志向。",
    "## 結果画面冒頭の「あなたの傾向」セクション(§7-1-3)",
    "- 結果画面冒頭に「あなたの傾向」として 2〜3 文の傾向要約を進路文脈の言葉で書く。",
    "- 使ってよい表現例:",
    "  - 「あなたは挑戦志向タイプ。新しい環境や未知の分野に飛び込んで成長を取りに行く姿勢が見えます」(外向性高 + 開放性高 + リスク選好)",
    "  - 「人と協働しながら成長したいタイプ。チームの中で力を発揮し、関係性を大切にする傾向があります」(外向性高 + 協調性高 + WLB バランス)",
    "  - 「計画的に積み上げるタイプ。一つの分野を腰を据えて深掘りし、着実に専門性を築く志向が見えます」(誠実性高 + 安定志向 + 深掘り学習)",
    "  - 「社会的な意義と生活のバランスを大切にするタイプ。仕事の役立ち感と私生活の充実を両立したい志向が見えます」(意味志向強 + WLB 重視)",
    "  - 「探索型タイプ。複数の分野を試しながら自分に合うものを見つけたい志向が見えます」(開放性高 + 学習広探索 + 変化歓迎)",
    "- NG 表現:",
    "  - 「あなたは外向性が高いです」「協調性スコアは平均より高めです」(軸名直接 NG)",
    "  - 「あなたの性格分析: 外向性=high / 開放性=high」(軸名 + 数値 NG)",
    "  - 「あなたは ENTJ タイプ」「MBTI でいうと…」(他類型 NG)",
    "  - 「あなたは ○○ な人です」(強い断定 NG。「○○ なタイプ / 志向が見えます」のような柔らかい表現に)",
    "## 性格傾向 × 案タイプの対応(§7-2-1 / ロードマップ生成時の参考)",
    "- 外向性高 + 開放性高 → スタートアップ系・営業職・事業開発をチャレンジ案でメイン提案。保守案で営業職を出すと物足りなさを感じやすい。",
    "- 神経症傾向高(unknown_field_jump=jump_anxious + failure_recovery=careful_after + risk_pref=safe)+ 安定志向 → 保守案を厚く、チャレンジ案でも「副業で段階的に試す」「資格取得後にスピンアウト」など段階踏みを必ず含める。一気に独立・起業は出さない。",
    "- 開放性高(change_attitude=change_welcome + learning_depth=wide_explore) + risk_take → 海外・起業・業界横断案で踏み込んで OK。",
    "- 意味志向(meaning_priority=meaning_priority)+ 達成欲求(competition_pref=compete_motivated) → ミッションドリブン型。社会起業・ソーシャルベンチャー・教育・医療を厚く。",
    "- 外向性低 + 誠実性高 + 開放性低 → 専門職継続 / 公務員を保守案に、マネジメント案は出さない。スペシャリスト独立をチャレンジ案に。",
    "- 協調性高 + WLB 重視 → 安定大手・公共系 / 同職種で残業少なめ。完全個人事業は控えめに。",
    "## 進路提案の言語化スタイル(§7-2-2)",
    "- 「あなたは外向的なので営業がおすすめ」のような直接断定 NG。",
    "- 「この案では人と関わる機会が多く、リーダー役を取りやすい」のように進路文脈で言語化する。",
    "",
    "# 解釈の前提: MINDSET v2 E 群 — 働き方の必須条件(§7-3)",
    "これらは「希望」ではなく「必須条件」として扱ってください。ロードマップで提案する企業・職種・雇用形態は、これらの条件を満たすものに絞ること。3 案すべて(保守 / 標準 / チャレンジ)でこれらの条件を満たすこと。違反する案は出さないこと。",
    "- location_preference:",
    "  - keep_current → 現居住地(ORIGIN.location)から大きく離れない選択肢のみ提案",
    "  - metro_pref → 都市部勤務(リモートOK含む)",
    "  - rural_pref → 地方・郊外勤務(リモートOK含む)",
    "  - overseas_pref → 海外勤務または海外駐在前提",
    "  - anywhere → 制約なし",
    "- remote_preference:",
    "  - office_pref → リモート前提の職種は提案しない",
    "  - hybrid_office → 完全リモート企業は提案しない(週 3 以上出社)",
    "  - hybrid_remote → 完全出社企業は提案しない(週 3 以上リモート)",
    "  - remote_full → リモート可の企業・職種のみ提案",
    "  - flexible → 制約なし",
    "- wlb_priority:",
    "  - wlb_priority → 残業前提・長時間労働の企業は提案しない",
    "  - wlb_balance → 標準的な働き方を中心に提案",
    "  - work_priority → 没頭型キャリア・スタートアップ・コンサル・MBA 等を提案して OK",
    "注: goal_avoid(GOAL v2.2 で撤去)の代替として MINDSET E 群を必須フィルタとして使う。「長時間労働回避」は wlb_priority=wlb_priority、「出社必須回避」は remote_preference=hybrid_remote / remote_full、「転居・出張多め回避」は location_preference=keep_current で判定。",
    "",
    "# 解釈の前提: mindset_freenote(性格・価値観の自由記述・§7-4)",
    "- ユーザーが選択肢で表現しきれなかった性格・価値観の補足が記載されている可能性あり。",
    "- 個別事情(完璧主義・HSP 的気質・夜型/朝型・対人スタイル等)が記載されていたらロードマップに反映する(無視しない)。",
    "- 個人を特定できる情報(企業名・人名等)が記載されていても出力に含めないこと。",
    "- 機微情報(健康詳細・宗教・政治信条等)が記載されていても、AI の判断には使うが結果画面の文言には出さないこと。",
    "",
    "# 解釈の前提: ORIGIN + GOAL + MINDSET の組み合わせ(§7-5)",
    "- GOAL.goal_workstyle=startup + MINDSET.risk_pref=safe + 神経症傾向=high → 矛盾シグナル。本人は起業に憧れるが心理的リスク許容は低い → 段階的アプローチ(副業 → スピンアウト → 独立)を提案。一気に起業案は控える。",
    "- GOAL.change_intent=continue + MINDSET.開放性=high + change_attitude=change_welcome → 本人は「続けたい」と言うが性格的に変化を求める傾向あり → 保守案で「同職種で別企業」、標準案で「ジョブチェンジ」、チャレンジ案で「業界横断」を出して比較材料を提示。",
    "- ORIGIN.life_constraint=caring_kids + MINDSET.wlb_priority=wlb_priority + remote_full → 強い在宅 WLB 重視シグナル → リモート可の職種を保守案で厚く、出社必須案は 3 案すべてで排除。",
    "- ORIGIN.knowledge_fields=medical_care + GOAL.career_change + MINDSET.learning_depth=deep_focus + meaning_priority=meaning_priority → 医療領域の知見 × 意味志向 × 専門深化 → 医療 × IT(医療情報・ヘルスケア DX)/ 医療 × 教育(看護教育)/ 医療 × 行政(公衆衛生)など医療領域内で別職種に転向するチャレンジ案を提案。",
    "- GOAL.goal_workstyle=[freelance, multi_job] + MINDSET.leadership_role=lead_avoid + social_pref=solo_strong + value_priority に freedom → フリーランス志向と性格が完全整合 → 3 案すべてフリーランス前提で粒度違いを提示(個人事業主 / 法人化 / 複業構成)。",
    ...dynamic,
    "",
    "# 出力の制約",
    "- 指定されたスキーマに完全に従う JSON のみを出力する(余計な文章・マークダウンは付けない)。",
    "- roadmap は現在地から目標まで段階的に。ノードは2〜8個。ユーザーの目標期間に応じて段数と時間ラベル(timeLabel)を調整する。最初のノードの kind は \"start\"、最後は \"goal\"、途中は \"milestone\"。",
    "- candidates は1〜5件。最有力には isTop=true を付け、matchPercent(0-100)を付ける。",
    "- skills.learning は具体的な学習項目、skills.strengths は活かせる強みのタグ。",
    "- personality.traits は2〜4個。level(0-100)と短いコメントを付ける。",
    "- 各フィールドの文字数上限を必ず守る(超えると無効になる)。",
    "- トーンは前向きで具体的。占い的な決めつけや、医療・法律・投資の助言と誤解される表現は避ける。",
    "- 個人を特定できる情報は結果に含めない。",
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
  if (hasAnyMindsetCore(answers)) {
    const bf = inferBigFive(answers);
    out.push("");
    out.push("# ユーザーの性格傾向(ビッグファイブ的シグナル / 暗黙取得)");
    out.push(`- 外向性: ${bf.extraversion}`);
    out.push(`- 協調性: ${bf.agreeableness}`);
    out.push(`- 誠実性: ${bf.conscientiousness}`);
    out.push(`- 神経症傾向: ${bf.neuroticism}`);
    out.push(`- 開放性: ${bf.openness}`);
    out.push(
      "※ これらはユーザーが直接「外向的か?」と聞かれたものではなく、進路文脈の質問から暗黙的に推定したシグナルです。",
    );
    out.push(
      "※ ユーザーには「あなたは外向性が高い」のような直接的な性格断定をしないでください(ビッグファイブの軸名を結果画面に出さない)。",
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
