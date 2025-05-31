import { syncNotion } from '../scripts/sync-notion.js';

export default async function handler(req, res) {
  try {
    await syncNotion();
    res.status(200).json({ ok: true, message: 'Notion 同步完成' });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
}