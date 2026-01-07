import fs from 'fs';
import path from 'path';
import mustache from 'mustache';
import yaml from 'yaml';
import { Emoji, EmojiCategory, EmojiType } from '../types';

/**
 * Generates:
 * - src/regex.generated.ts
 * - src/emoji.generated.ts
 * 
 * @param args 
 */
function main(args: string[]) {
    generateEmojis();
    generateRegex();
}

function generateEmojis() {
    const categories = <RawCategory[]>yaml.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'emoji.yml')).toString('utf-8'));
    fs.writeFileSync(
        path.join(PROJECT_ROOT, 'src', 'emoji.generated.ts'), 
        unindent(
            `
            ${header()}
            
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

function generateRegex() {
    const { items } = readData();
    const [multiDiversityItems, nonMultiDiversityItems] = partition(items, x => x.type === 'multi-diversity');
    const [zwjItems, nonZwjItems] = partition(nonMultiDiversityItems, x => x.codepoints.cp.includes(CP_ZWJ));
    const [zwjDiversityItems, zwjNonDiversityItems] = partition(zwjItems, x => x.type === 'diversity');

    zwjItems.forEach(x => {
        if (!['diversity', 'normal'].includes(x.type)) {
            throw new Error(`Zwj diversity item 0x${x.unicode}: invalid type (${x.type}). Must be 'diversity'.`);
        }
    });

    const multiDiversityCodepointSequences = multiDiversityItems
        .flatMap(i => i.diversitySequences)
        .map(codepoints => codepoints.cp);

    const zwjDiversityBreakdown = zwjDiversityItems.flatMap<[ZwjDiversityType, number[]]>(item => {
        const prefix = item.codepoints.cp.slice(0, 2);
        const cp = item.codepoints.cp;

        if (arrayEquals(prefix, [CP_MAN, CP_ZWJ])) {
            verifyGenderComplementExists(zwjDiversityItems, new Codepoints([CP_WOMAN, ...cp.slice(1)]), item);
            verifyGenderComplementExists(zwjDiversityItems, new Codepoints([CP_PERSON, ...cp.slice(1)]), item);
            return [];
        } else if (arrayEquals(prefix, [CP_WOMAN, CP_ZWJ])) {
            verifyGenderComplementExists(zwjDiversityItems, new Codepoints([CP_MAN, ...cp.slice(1)]), item);
            verifyGenderComplementExists(zwjDiversityItems, new Codepoints([CP_PERSON, ...cp.slice(1)]), item);
            return [];
        } else if (arrayEquals(prefix, [CP_PERSON, CP_ZWJ])) {
            verifyGenderComplementExists(zwjDiversityItems, new Codepoints([CP_MAN, ...cp.slice(1)]), item);
            verifyGenderComplementExists(zwjDiversityItems, new Codepoints([CP_WOMAN, ...cp.slice(1)]), item);
            return [['leading-gender', cp.slice(2)]];
        } else if (arrayEquals(cp.slice(-4), [CP_VS16, CP_ZWJ, CP_MALE_SIGN, CP_VS16])) {
            verifyGenderComplementExists(zwjDiversityItems, new Codepoints(cp.slice(0, -2).concat([CP_FEMALE_SIGN, CP_VS16])), item);
            return [['trailing-gender-with-variant', cp.slice(0, -4)]];
        } else if (arrayEquals(cp.slice(-4), [CP_VS16, CP_ZWJ, CP_FEMALE_SIGN, CP_VS16])) {
            verifyGenderComplementExists(zwjDiversityItems, new Codepoints(cp.slice(0, -2).concat([CP_MALE_SIGN, CP_VS16])), item);
            return [];
        } else if (arrayEquals(cp.slice(-3), [CP_ZWJ, CP_MALE_SIGN, CP_VS16])) {
            verifyGenderComplementExists(zwjDiversityItems, new Codepoints(cp.slice(0, -2).concat([CP_FEMALE_SIGN, CP_VS16])), item);
            return [['trailing-gender-without-variant', cp.slice(0, -3)]];
        } else if (arrayEquals(cp.slice(-3), [CP_ZWJ, CP_FEMALE_SIGN, CP_VS16])) {
            verifyGenderComplementExists(zwjDiversityItems, new Codepoints(cp.slice(0, -2).concat([CP_MALE_SIGN, CP_VS16])), item);
            return [];
        } else {
            throw new Error(`Zwj diversity item ${item.codepoints.key} needs to be in a pair of leading or trailing genders`);
        }
    });

    const zwjLeadingGenderRegex = regexFromCodepointSequences(codePointSequencesByZwjDiversityType(zwjDiversityBreakdown, 'leading-gender'));
    const zwjTrailingGenderWithVariantRegex = regexFromCodepointSequences(codePointSequencesByZwjDiversityType(zwjDiversityBreakdown, 'trailing-gender-with-variant'));
    const zwjTrailingGenderWithoutVariantRegex = regexFromCodepointSequences(codePointSequencesByZwjDiversityType(zwjDiversityBreakdown, 'trailing-gender-without-variant'));
    const zwjRegex = regexFromCodepointSequences(zwjNonDiversityItems.map(x => x.codepoints.cp));
    const diversityRegex = regexFromCodepointSequences(codePointSequencesByType(nonZwjItems, 'diversity'));

    const keycapPrefixRegex = regexFromCodepointSequences(
        // KeycapCodePoint gets added back in the RegEx after the optional variant
        codePointSequencesByType(nonZwjItems, 'keycap').map(x => x.filter(x => x != CP_KEYCAP))
    );

    const multiDiversityRegex = regexFromCodepointSequences(multiDiversityCodepointSequences);
    const normalRegex = regexFromCodepointSequences(
        codePointSequencesByType(nonZwjItems, 'flag').concat(
            codePointSequencesByType(nonZwjItems, 'regional'),
            codePointSequencesByType(nonZwjItems, 'normal')
        )
    );
    const textDefaultRegex = regexFromCodepointSequences(
        codePointSequencesByType(nonZwjItems, 'text-default'));
    const variantDiversityRegex = regexFromCodepointSequences(codePointSequencesByType(nonZwjItems, 'variant,diversity'));
    const variantRegex = regexFromCodepointSequences(codePointSequencesByType(nonZwjItems, 'variant'));

    const debug = false;

    fs.writeFileSync(
        path.join(__dirname, '..', '..', 'src', `regex${debug?'-debug':''}.generated.ts`),
        mustache.render(
            fs.readFileSync(path.join(__dirname, '..', '..', 'build', 'templates', `regex${debug?'-debug':''}.js.mustache`))
                .toString('utf8'),
            {
                header: header(),
                diversityRegex,
                femaleOrMaleSignRegex: P_FEMALE_OR_MALE_SIGN,
                keycap: P_KEYCAP,
                keycapPrefixRegex,
                manWomanPersonRegex: P_MAN_WOMAN_PERSON,
                multiDiversityRegex,
                normalRegex,
                skinToneOrVs16Regex: P_SKIN_TONE_OR_VS16,
                skinToneRegex: P_SKIN_TONE,
                textDefaultRegex,
                variantDiversityRegex,
                variantRegex,
                vs15: P_VS15,
                vs16: P_VS16,
                zwj: P_ZWJ,
                zwjLeadingGenderRegex,
                zwjRegex,
                zwjTrailingGenderWithVariantRegex,
                zwjTrailingGenderWithoutVariantRegex,
            }
        )
    )
}

const PROJECT_ROOT = path.join(__dirname, '..', '..');

class Codepoints {
    constructor(readonly cp: number[], readonly includeInPicker = true) {
        this.key = cp.map(x => x.toString(16)).join('-');
    }

    key: string;
}

interface RawCategory {
    id: string;
    title: string;
    items: RawEmoji[];
}

interface RawEmoji {
    unicode: string;
    codepoints: Codepoints; // Generated
    hasZeroWidthJoiner: boolean; // Generated
    diversitySequences: Codepoints[];
    description: string;
    keywords: string;
    exclude_from_picker?: boolean;
    type: EmojiType;
    multi_diversity_base_same?: string;
    multi_diversity_base_different?: string;
    multi_diversity_base_different_is_sorted: boolean;
}

const CP_KEYCAP = 0x20e3;
const CP_ZWJ = 0x200d;
const CP_MAN = 0x1f468;
const CP_WOMAN = 0x1f469;
const CP_PERSON = 0x1f9d1;
const CP_VS15 = 0xfe0e;
const CP_VS16 = 0xfe0f;
const CP_FEMALE_SIGN = 0x2640;
const CP_MALE_SIGN = 0x2642;
const CP_LIGHTEST_SKIN_TONE = 0x1f3fb;
const CP_DARKEST_SKIN_TONE = 0x1f3ff;
const CP_SKIN_TONES = intRange(CP_LIGHTEST_SKIN_TONE, CP_DARKEST_SKIN_TONE).map(x => [x]);

const P_KEYCAP = unicodePattern(CP_KEYCAP);
const P_ZWJ = unicodePattern(CP_ZWJ);
const P_VS15 = unicodePattern(CP_VS15);
const P_VS16 = unicodePattern(CP_VS16);

const P_SKIN_TONE = regexFromCodepointSequences(CP_SKIN_TONES)
const P_SKIN_TONE_OR_VS16 = regexFromCodepointSequences(
    [[CP_VS16]].concat(CP_SKIN_TONES)
);
const P_FEMALE_OR_MALE_SIGN = regexFromCodepointSequences(
    [[CP_FEMALE_SIGN], [CP_MALE_SIGN]]
);
const P_MAN_WOMAN_PERSON = regexFromCodepointSequences(
    [[CP_MAN], [CP_WOMAN], [CP_PERSON]]
);

type ZwjDiversityType = undefined | 'leading-gender' | 'trailing-gender-without-variant' | 'trailing-gender-with-variant';

function header() {
    return unindent(
        `
        // Copyright Astronaut Labs LLC, Twitter Inc. Licensed under MIT
        // https://github.com/astronautlabs/emoji/blob/main/LICENSE.md
        `
    );
}

function unicodePattern(v: number): string {
    if (v < 0xff)
        return String.fromCodePoint(v);
    let char = String.fromCodePoint(v);
    return Array.from(char).map(char => `\\u${char.codePointAt(0)!.toString(16)}`).join('');
}

/**
 * Create a map of common prefixes -> lists of last items that share the prefix.
 * This is to compact the regex. For example, /abc|abd|abe/ can be /ab[cde]/
 * Input is like [[1,2,3], [1,2,5], [1,2,9], [8,9], [20]]
 * Output is like { ['1:2']: [3,5,9], ['8']: [9], ['']: [20] }
 */
function groupLastItemsByPrefix(sequences: number[][]): Map<string, number[]> {
    return sequences
        .map<[string, number]>(sequence => [
            sequence.slice(0, -1).map(x => x.toString(16)).join('-'),
            sequence.slice(-1)[0]
        ])
        .reduce(
            (map, [prefix, n]) => (map.set(prefix, [...(map.get(prefix) ?? []), n]), map),
            new Map<string, number[]>()
        )
        ;
}

// Converts a sequences of (start,end) tuples into a regex char group string.
// Input is like [[1,4], [6,7], [9,9]]
// Output is like "[1-4679]"
function spanString(seq: [number, number][]): string {
    if (seq.length === 0)
        return '';

    if (seq.length === 1 && seq[0][0] === seq[0][1])
        return unicodePattern(seq[0][0]);

    return `[${seq
        .map(([start, end]) => {
            if (start === end)
                return unicodePattern(start);

            if (start + 1 === end)
                return unicodePattern(start) + unicodePattern(end);

            return `${unicodePattern(start)}-${unicodePattern(end)}`;
        })
        .join('')
    }]`;
}

// Input is like [1,2,3,4,6,7,9]
// Output is like [[1,4], [6,7], [9,9]]
function findContiguousSpans(seq: number[]): [number, number][] {
    let ranges: [number, number][] = [];
    let start: number = 0;

    seq = seq.slice().sort((a, b) => a - b);

    for (let i = 1, max = seq.length; i < max; ++i) {
        if (seq[i - 1] + 1 < seq[i]) {
            ranges.push([seq[start], seq[i - 1]]);
            start = i;
        }
    }

    ranges.push([seq[start], seq[seq.length - 1]]);

    ranges.forEach(([start, end]) => {
        if (start > end)
            throw new Error(`Broken: Start after end`);
    })

    return ranges;

}

function regexFromCodepointSequences(codePointSequences: number[][]) {
    // Normalize the codepoint sequences (UCS2)
    codePointSequences = codePointSequences.map(sequence => {
        return sequence.flatMap(codePoint => {
            if (codePoint >= 0x10000 && codePoint < 0x110000) {
                return [
                    ((codePoint - 0x10000) >> 10) + 0xd800,
                    (codePoint & 0x3ff) + 0xdc00
                ];
            } else if (codePoint < 0x10000) {
                return [codePoint];
            } else {
                return [];
            }
        });
    });

    var groupedItems = groupLastItemsByPrefix(codePointSequences)
    let sortedGroupedItems = Array.from(groupedItems.entries()).map(([prefix, nums]) => ({
        prefix: prefix ? prefix.split('-').map(x => Number.parseInt(x, 16)) : [],
        prefixStr: String.fromCodePoint(...(prefix ? prefix.split('-').map(x => Number.parseInt(x, 16)) : [])),
        //prefixStr: (prefix ? prefix.split('-').map(x => zeroPad(Number.parseInt(x, 16), 8)) : []).join('-'),
        nums: nums.sort((a, b) => a - b)
    }));

    sortedGroupedItems.sort((a, b) => {
        if (a.prefix.length === b.prefix.length)
            return a.prefixStr.localeCompare(b.prefixStr);
        return b.prefix.length - a.prefix.length;
    });

    var regexParts = sortedGroupedItems.map(item => {
        let spans = findContiguousSpans(item.nums);
        let spanStr = spanString(spans);

        return [
            ...item.prefix.map(i => unicodePattern(i)),
            spanStr
        ].join('');
    });

    // Return something that is a single char or [] class,
    // or a non-capturing group of chars and [] classes "|"ed together.

    if (regexParts.length === 0)
        throw new Error('Regex cannot be empty');
    else if (regexParts.length === 1 && sortedGroupedItems[0].prefix.length === 0)
        return regexParts[0];
    else
        return `(?:${regexParts.join('|')})`;
}

function intRange(start: number, end: number) {
    return Array.from(Array(end - start + 1)).map((_, i) => start + i);
}

function partition<T>(list: T[], discriminant: (t: T) => boolean): [T[], T[]] {
    let match: T[] = [];
    let noMatch: T[] = [];

    list.forEach(x => discriminant(x) ? match.push(x) : noMatch.push(x));

    return [match, noMatch];
}

function readData() {
    const categories = <RawCategory[]>yaml.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'emoji.yml')).toString('utf-8'));
    categories.forEach(category => {
        category.items.forEach(item => {
            item.type ??= 'normal';
            item.multi_diversity_base_different_is_sorted ??= false;
            item.codepoints = new Codepoints(item.unicode.split('-').map(x => Number.parseInt(x, 16)), !item.exclude_from_picker);
            item.hasZeroWidthJoiner = item.codepoints.cp.includes(CP_ZWJ);

            if (['diversity', 'variant,diversity'].includes(item.type)) {
                item.diversitySequences = [
                    item.codepoints,
                    ...CP_SKIN_TONES.map(([suffix]) => {
                        if (item.hasZeroWidthJoiner) {
                            const firstZwjIndex = item.codepoints.cp.indexOf(CP_ZWJ);
                            const [before, after] = splitAt(item.codepoints.cp, firstZwjIndex);
                            return new Codepoints([...before.filter(x => x !== CP_VS16), suffix, ...after]);
                        } else {
                            return new Codepoints([...item.codepoints.cp, suffix]);
                        }
                    })
                ];
            } else if (item.type === 'multi-diversity') {
                item.diversitySequences = [
                    item.codepoints,
                    ...CP_SKIN_TONES.reverse().flatMap(([firstTone]) => {
                        return CP_SKIN_TONES.reverse().map(([secondTone]) => {
                            if (firstTone === secondTone && item.multi_diversity_base_same != item.multi_diversity_base_different) {
                                return new Codepoints(item.multi_diversity_base_same!.split('-').map(cp => cp === 'skintone' ? firstTone : Number.parseInt(cp, 16)));
                            } else {
                                let usedFirst = false;
                                let includeInPicker = firstTone >= secondTone || !item.multi_diversity_base_different_is_sorted;

                                return new Codepoints(item.multi_diversity_base_different!.split('-').map(cp => {
                                    if (cp === 'skintone') {
                                        if (usedFirst)
                                            return secondTone;

                                        usedFirst = true;
                                        return firstTone;
                                    } else {
                                        return Number.parseInt(cp, 16);
                                    }
                                }), includeInPicker);
                            }
                        });
                    })
                ];
            } else {
                item.diversitySequences = [item.codepoints];
            }
        });
    });

    return { categories, items: categories.flatMap(x => x.items) };
}

function verifyGenderComplementExists(
    zwjDiversityItems: RawEmoji[],
    genderComplementCodepoints: Codepoints,
    item: RawEmoji
) {
    if (!zwjDiversityItems.some(x => arrayEquals(x.codepoints.cp, genderComplementCodepoints.cp))) {
        throw new Error(
            `Zwj diversity item ${item.unicode} is missing its gender-complement sequence ${genderComplementCodepoints.key}`
        )
    }
}

function splitAt<T>(arr: T[], index: number): [T[], T[]] {
    return [arr.slice(0, index), arr.slice(index)];
}

function arrayEquals<T>(a: T[], b: T[]): boolean {
    return a.every((v, i) => v === b[i]);
}

function codePointSequencesByZwjDiversityType(zwjDiversityBreakdown: [ZwjDiversityType, number[]][], typeNeeded: ZwjDiversityType) {
    return zwjDiversityBreakdown.filter(([type, cp]) => type === typeNeeded).map(([_, cp]) => cp);
}

function codePointSequencesByType(items: RawEmoji[], type: EmojiType) {
    return items.filter(x => x.type === type).map(x => x.codepoints.cp);
} 

function unindent(str: string) {
    let lastNewline = str.lastIndexOf("\n");
    let indent = str.slice(lastNewline + 1).replace(/[^ ]/g, '');
    return str.split(/\n/g)
        .map(x => x.replace(indent, ''))
        .join("\n")
        .replace(/^\n/, '')
        .replace(/\n$/, '')
    ;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

main(process.argv.slice(1));