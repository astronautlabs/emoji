import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { Emoji, EmojiCategory, EmojiType } from '../types';
import { unindent } from './utils';

/**
 * Generates:
 * - src/emoji.generated.ts
 * 
 * @param args 
 */
async function main(args: string[]) {
    //await generateEmojiList();
    generateEmojis();
}

// async function generateEmojiList() {
//     let response = await fetch('https://raw.githubusercontent.com/unicode-org/cldr-json/refs/heads/main/cldr-json/cldr-annotations-full/annotations/en/annotations.json');
//     if (!response.ok)
//         throw new Error(`Failed to fetch emoji data from Unicode.org: ${response.status}`);

//     let annotations = (await response.json()).annotations.annotations;

//     let lines = text.split('\n').map(x => x.replace(/#.*/, '')).filter(x => x);

//     for (let line of lines) {
//         let fields = line.split(/ *; */);
//     }
// }

function generateEmojis() {
    const categories = <EmojiCategory[]>JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'emoji.json')).toString('utf-8'));
    fs.writeFileSync(
        path.join(PROJECT_ROOT, 'src', 'emoji.generated.ts'), 
        unindent(
            `
            // Copyright Astronaut Labs LLC, Twitter Inc. Licensed under MIT
            // https://github.com/astronautlabs/emoji/blob/main/LICENSE.md
            
            import { EmojiCategory } from './types';
            
            export const EMOJI: { categories: EmojiCategory[] } = ${JSON.stringify({
                categories: categories.map<EmojiCategory>(cat => ({
                    id: cat.id,
                    title: cat.title,
                    items: cat.items
                }))
            })};
            `
        )
    )
}

const PROJECT_ROOT = path.join(__dirname, '..', '..');

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

main(process.argv.slice(1));