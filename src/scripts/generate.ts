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
    await generateEmojiList();
    generateEmojis();
}

async function generateEmojiList() {
    let response = await fetch('https://raw.githubusercontent.com/unicode-org/cldr-json/refs/heads/main/cldr-json/cldr-annotations-full/annotations/en/annotations.json');
    if (!response.ok)
        throw new Error(`Failed to fetch emoji data from Unicode.org: ${response.status}`);

    let annotations = (await response.json()).annotations.annotations;

    let lines = text.split('\n').map(x => x.replace(/#.*/, '')).filter(x => x);

    for (let line of lines) {
        let fields = line.split(/ *; */);
    }
}

function generateEmojis() {
    const categories = <RawCategory[]>JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'emoji.json')).toString('utf-8'));
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
                    items: cat.items.map<Emoji>(item => ({
                        type: item.type ?? 'normal',
                        string: String.fromCodePoint(...item.unicode.split('-').map(x => Number.parseInt(x, 16))),
                        description: item.description,
                        excludeFromPicker: item.exclude_from_picker ?? false,
                        keywords: item.keywords ? item.keywords.split(',') : [], 
                        unicode: item.unicode.split('-').map(x => Number.parseInt(x, 16)),
                        multiDiversityBaseSame: item.multi_diversity_base_same,
                        multiDiversityBaseDifferent: item.multi_diversity_base_different,
                        multiDiversityBaseDifferentIsSorted: item.multi_diversity_base_different_is_sorted ?? false,
                    })),
                }))
            })};
            `
        )
    )
}

const PROJECT_ROOT = path.join(__dirname, '..', '..');

interface RawCategory {
    id: string;
    title: string;
    items: RawEmoji[];
}

interface RawEmoji {
    unicode: string;
    description: string;
    keywords: string;
    exclude_from_picker?: boolean;
    type: EmojiType;
    multi_diversity_base_same?: string;
    multi_diversity_base_different?: string;
    multi_diversity_base_different_is_sorted: boolean;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

main(process.argv.slice(1));