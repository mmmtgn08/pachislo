# 毎日の定期タスクに登録するプロンプト

Claude Code の定期タスク（毎日 17:47 JST 想定）に、以下の文面をそのまま登録します。
内容を変えたいときはこのファイルを編集し、Claude に「定期タスクのプロンプトを更新して」と頼んでください。

---

パチスロ系YouTubeショートの「今日の1本」を作って投稿ワークフローを起動してください。チャットでの確認は不要です。

1. GitHub リポジトリ mmmtgn08/pachislo の main ブランチから次のファイルを読む（GitHub MCP の get_file_contents を使う。手元にクローンがあればそれでもよい）:
   - content/GUIDE.md（編集方針とルール。必ず従う）
   - content/history.jsonl（過去の投稿。ネタ被りとテーマの偏りを避ける）
   - content/examples/sample.json（台本JSONの形式）
2. ガイドに沿って、今日（日本時間）の日付を `date` に入れた台本JSONを1本作る。
   - ガイドの「伸びる構成」（フック→期待→本編→オチ→コメント誘導）に必ず沿う
   - シリーズ・フックの型・テーマは直近の履歴を見てローテーションする
   - 2人の掛け合いにし、emphasis / se / reaction の演出を入れる
   - 文字数制限（text 70字・telop 40字・合計380字・7〜10行）を守る
   - 手元にリポジトリがあれば `python3 -m shorts.schema <ファイル>` で検証する
3. GitHub MCP の actions_run_trigger で、mmmtgn08/pachislo のワークフロー `daily-short.yml` を ref `main` で起動する。inputs は `{"script_json": "<台本JSONを1行の文字列にしたもの>"}`。
4. 5〜8分後にワークフローの実行結果を確認する。台本の検証エラーで失敗していたら、直して1回だけ再実行する。それ以外の失敗（認証エラー等）は再実行せず、原因を短くまとめて終了する。
5. git の push やファイル編集は行わない（履歴の記録はワークフローが行う）。
