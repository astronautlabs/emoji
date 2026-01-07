import fs from 'fs';
import path from 'path';
import { EmojiDecorator } from '../emoji-decorator';
import { EMOJI } from '../emoji.generated';
import { unindent } from './utils';

/**
 * Generates:
 * - src/regex.generated.ts
 * - src/emoji.generated.ts
 * 
 * @param args 
 */
async function main(args: string[]) {
    generatePreview();
}

function generatePreview() {
    fs.writeFileSync(
        path.join(PROJECT_ROOT, 'preview.html'), 
        EmojiDecorator.parse(unindent(
            `
            <!DOCTYPE html>
            <html>
            <head>
                <title>@/emoji</title>
            </head>
            <body>
                <h1>@/emoji preview (${EMOJI.categories.flatMap(c => c.items).length} emojis)</h1>

                ${EMOJI.categories.map(category => `
                    <h2>${category.title}</h2>
                    <div class="emoji-list">
                        ${category.items.map(item => `
                            <div>
                                <i>${item.string}</i>
                                <div>
                                    ${item.description}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}

                <style>
                    * {
                        font-family: sans-serif;
                    }

                    h1 {
                        margin-top: 2em;
                    }

                    div.emoji-list {
                        display: flex;
                        flex-wrap: wrap;
                        
                        > div {
                            aspect-ratio: 1/1;
                            width: 150px;
                            margin: 5px;
                            padding: 5px;
                            border: 1px solid blue;
                            border-radius: 5px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-direction: column;
                            font-style: normal;
                            opacity: 0.5;

                            i {
                                font-size: 72px;
                                img {
                                    width: 72px;
                                    height: 72px;
                                }
                            }
                            
                            &:has(img.emoji) {
                                opacity: 1;
                            }
                        }
                    }
                    
                </style>
            </body>
            </html>
            `
        ))
    );
}

const PROJECT_ROOT = path.join(__dirname, '..', '..');

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

main(process.argv.slice(1));