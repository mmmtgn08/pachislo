# 毎日の定期タスクに登録するプロンプト

Claude Code の定期タスクに、以下の文面をそのまま登録します。
内容を変えたいときはこのファイルを編集し、Claude に「定期タスクのプロンプトを更新して」と頼んでください。

---

「もしも」3Dショートの今日の1本を作り、投稿ワークフローを起動してください。チャットでの確認は不要です。

1. GitHub リポジトリ mmmtgn08/pachislo の main ブランチから次のファイルを読む（GitHub MCP の get_file_contents を使う）:
   - moshimo/GUIDE.md（編集方針・事実のルール・使えるシーン。必ず従う）
   - moshimo/history.jsonl（過去の投稿。同じネタ・似たネタを避ける）
   - moshimo/requests.md（あれば。視聴者のリクエスト）
   - moshimo/STATS.md（あれば。動画ごとの再生数。ガイドの「再生数から学ぶ」に従う）
   - moshimo/topics/posted/ の直近3本（フック・タイトル・締めの質問の型を被らせないため）
   - moshimo/topics/oxygen.json と moshimo/topics/gravity.json（台本JSONの形式）
2. ガイドに沿って、今日（日本時間）の日付を `date` に入れた台本JSONを1本作る。
   - 事実のルールを最優先する。少しでも怪しい数字・主張は使わない
   - シーンの type と event の組み合わせを1本の中で繰り返さない。直近の動画とも構成を変える
   - ガイドの「量産型にしない」を守る（フック・タイトル・締めの質問の型を直近と変える。description に情報源の名前を書く）
3. GitHub MCP の actions_run_trigger で、mmmtgn08/pachislo のワークフロー `moshimo.yml` を ref `main` で起動する。inputs は `{"script_json": "<台本JSONを1行の文字列にしたもの>"}`。
4. 8〜10分後にワークフローの実行結果を確認する。台本の検証エラーで失敗していたら、直して1回だけ再実行する。それ以外の失敗は再実行せず、原因を短くまとめて終了する。
5. git の push やファイル編集は行わない（履歴の記録はワークフローが行う）。
