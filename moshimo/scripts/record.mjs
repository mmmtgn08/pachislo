// 投稿後に履歴へ記録する: node scripts/record.mjs script.json out/video.meta.json [VIDEO_ID]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [scriptPath, metaPath, videoId] = process.argv.slice(2);
const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const long = meta.format === 'long';
const dir = path.join(ROOT, 'topics', long ? 'posted_long' : 'posted');
fs.mkdirSync(dir, {recursive: true});
fs.writeFileSync(path.join(dir, `${meta.date}.json`), JSON.stringify(script, null, 2) + '\n');
const entry = {date: meta.date, series: meta.series, episode: meta.episode, title: meta.title, seconds: meta.seconds, video_id: videoId || null};
if (long) entry.format = 'long';
fs.appendFileSync(path.join(ROOT, 'history.jsonl'), JSON.stringify(entry) + '\n');
console.log('記録しました', entry);
