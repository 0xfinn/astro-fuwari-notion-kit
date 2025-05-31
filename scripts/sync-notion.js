import { NotionToMarkdown } from "notion-to-md";
import { Client } from "@notionhq/client";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import "dotenv/config";
import { richTextToPlainText } from '../src/utils/richTextToPlainText.js';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });
const databaseId = process.env.NOTION_DATABASE_ID;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, '../src/content/posts/notion');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

export async function syncNotion() {
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
    let cover = '';
    if (page.cover) {
      if (page.cover.type === 'external') {
        cover = page.cover.external.url;
      } else if (page.cover.type === 'file') {
        cover = page.cover.file.url;
      }
    }
    const yamlEscape = str => str === "''" ? "''" : /[:\[\]\{\},\n\"]/.test(str) ? `"${str.replace(/"/g, '\"')}"` : str;
    const frontmatter = `---\ntitle: ${yamlEscape(title)}\npublished: ${published}\ndescription: ${yamlEscape(description)}\ntags: [${tags.map(yamlEscape).join(', ')}]\ncategory: ${yamlEscape(category)}\nimage: ${yamlEscape(cover)}\ndraft: ${draft}\n---\n`;
    fs.writeFileSync(
      path.join(outputDir, `${notionId}.md`),
      frontmatter + '\n' + mdString.parent
    );
    console.log(`Saved ${title}`);
  }
  for (const file of localFiles) {
    if (!notionFiles.includes(file)) {
      fs.unlinkSync(path.join(outputDir, file));
    }
  }
}

if (import.meta.url === process.argv[1] || import.meta.url === `file://${process.argv[1]}`) {
  syncNotion();
}
