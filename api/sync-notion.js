import { NotionToMarkdown } from "notion-to-md";
import { Client } from "@notionhq/client";
import fs from "fs";
import path from "path";
import { richTextToPlainText } from "../../src/utils/richTextToPlainText.js";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });
const databaseId = process.env.NOTION_DATABASE_ID;
const outputDir = path.join(process.cwd(), "src/content/posts/notion");

export default async function handler(req, res) {
  const pages = await notion.databases.query({ database_id: databaseId });
  const localFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.md'));
  const notionFiles = [];
  for (const page of pages.results) {
    const draft = !(page.properties.Public?.checkbox === true);
    if (draft) continue;
    const notionId = page.id.replace(/-/g, '');
    notionFiles.push(`${notionId}.md`);
    const mdblocks = await n2m.pageToMarkdown(page.id);
    const mdString = n2m.toMarkdownString(mdblocks);
    const title = page.properties.Name.title[0]?.plain_text || "''";
    const published = page.properties.Published?.date?.start || new Date().toISOString().slice(0, 10);
    const description = richTextToPlainText(page.properties.Description?.rich_text) || "''";
    const tags = (page.properties.Tags?.multi_select?.map(tag => tag.name) || []).filter(Boolean);
    const category = page.properties.Category?.select?.name || "''";
    // 新增：获取封面图 URL
    let cover = '';
    if (page.cover) {
      if (page.cover.type === 'external') {
        cover = page.cover.external.url;
      } else if (page.cover.type === 'file') {
        cover = page.cover.file.url;
      }
    }
    const yamlEscape = str => str === "''" ? "''" : /[:\[\]\{\},\n\"]/.test(str) ? `"${str.replace(/"/g, '\"')}"` : str;
    // frontmatter 增加 image 字段
    const frontmatter = `---\ntitle: ${yamlEscape(title)}\npublished: ${published}\ndescription: ${yamlEscape(description)}\ntags: [${tags.map(yamlEscape).join(', ')}]\ncategory: ${yamlEscape(category)}\nimage: ${yamlEscape(cover)}\ndraft: ${draft}\n---\n`;
    fs.writeFileSync(
      path.join(outputDir, `${notionId}.md`),
      frontmatter + '\n' + mdString.parent
    );
  }
  for (const file of localFiles) {
    if (!notionFiles.includes(file)) {
      fs.unlinkSync(path.join(outputDir, file));
    }
  }
  res.status(200).json({ ok: true, message: "Notion 同步完成" });
}