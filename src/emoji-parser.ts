import { EmojiParserAttributesCallback, EmojiImageResolver, EmojiParserOptions } from './types';

import EMOJI_REGEX from './regex.generated';

/**
 * Decorate the emojis found in HTML elements and strings with image versions (while remaining accessible).
 *
 * @examples
 * ```
 *  EmojiParser.parse("I \u2764\uFE0F emoji!");
 *  // I <img class="emoji" draggable="false" alt="❤️" src="/assets/2764.gif"/> emoji!
 *
 *  EmojiParser.parse("I \u2764\uFE0F emoji!", function(iconId, options) {
 *    return '/assets/' + iconId + '.gif';
 *  });
 *  // I <img class="emoji" draggable="false" alt="❤️" src="/assets/2764.gif"/> emoji!
 *
 * EmojiParser.parse("I \u2764\uFE0F emoji!", {
 *   size: 72,
 *   callback: function(iconId, options) {
 *     return '/assets/' + options.size + '/' + iconId + options.ext;
 *   }
 * });
 *  // I <img class="emoji" draggable="false" alt="❤️" src="/assets/72x72/2764.png"/> emoji!
 * ```
 */
export class EmojiDecorator {
    constructor(options: Partial<EmojiParserOptions> = {}) {
        this.resolveImage = options.resolveImage ?? this.defaultImageSrcGenerator;
        this.decorateAttributes = options.decorateAttributes ?? (() => null);
        this.baseUrl = options.baseUrl ?? this.baseUrl;
        this.imageType = options.imageType ?? this.imageType;
        this.size = options.size ?? this.size;
        this.className = options.className ?? this.className;
        this.onLoadError = options.onLoadError ?? this.onLoadError;
    }

    /**
     * Function used to resolve the URL to use for a given emoji image.
     * By default, this constructs the URL from baseUrl, size, and imageType options along 
     * with the passed icon ID.
     * 
     * @param icon 
     * @param decorator 
     * @returns 
     */
    resolveImage: EmojiImageResolver = (icon, decorator) => 
        `${decorator.baseUrl}${decorator.size}/${icon}${decorator.imageType}`;

    /**
     * Allows you to specify a function which generates additional attributes for the <img> tags created 
     * during decoration.
     */
    decorateAttributes?: EmojiParserAttributesCallback;

    /**
     * The base URL where image assets are.
     */
    baseUrl = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/$VERSION/';

    /**
     * The image type (default is ".png").
     */
    imageType = '.png';

    /**
     * The image size to use (default is "72x72")
     */
    size = '72x72';

    /**
     * A class to add to <img> elements created while decorating.
     */
    className = 'emoji';

    /**
     * User first: used to remove missing images
     * preserving the original text intent when
     * a fallback for network problems is desired.
     * Automatically added to Image nodes via DOM
     * It could be recycled for string operations via:
     *  $('img.emoji').on('error', EmojiParser.onerror)
     */
    onLoadError = function (error: ErrorEvent) {
        if (this.parentNode) {
            this.parentNode.replaceChild(this.createText(this.alt, false), this);
        }
    };

    /**
     * Decorates the emojis of an HTML string, replacing emojis with <img/> tags.
     */
    parseString(str: string): string {
        return EmojiDecorator.replace(str, (emoji) => {
            let iconId = this.grabTheRightIcon(emoji);
            let src = this.resolveImage(iconId, this);
            if (!iconId || !src)
                return emoji;

            return `<img ${
                Object.entries({
                    draggable: 'false',
                    class: this.className,
                    alt: emoji,
                    src,
                    ...this.decorateAttributes(emoji, iconId)
                })
                .filter(([k, v]) => !k.startsWith('on')) // No scripting
                .map(([k, v]) => `${k}="${this.escapeHTML(v)}"`)
            } />`;
        });
    }

    /**
     * Decorate all emoji found in text nodes, placing images node instead.
     * @param   Element   generic DOM node with some text in some child node
     * @param   Object    options  containing info about how to parse
     *
     *            .callback   Function  the callback to invoke per each found emoji.
     *            .base       string    the base url, by default EmojiParser.base
     *            .ext        string    the image extension, by default EmojiParser.ext
     *            .size       string    the assets size, by default EmojiParser.size
     *
     * @return  Element same generic node with emoji in place, if any.
     */
    parseElement(node: Element): Element {
        this.replaceTextNodes(node, subnode => {
            let modified = false;
            let fragment = document.createDocumentFragment();
            let text = subnode.nodeValue;
            let match: RegExpMatchArray;
            let textOffset = 0;
            while ((match = EMOJI_REGEX.exec(text))) {
                let rawText = match[0];
                let index = match.index;

                // Create a raw text node if there was content between the last emoji (or start) and this one
                if (index !== textOffset)
                    fragment.appendChild(this.createText(text.slice(textOffset, index), true));
                textOffset = index + rawText.length;

                // Get emoji details, bail if we couldn't resolve
                let iconId = this.grabTheRightIcon(rawText);
                let src = this.resolveImage(iconId, this);
                if (!iconId || !src) {
                    fragment.appendChild(this.createText(rawText, false));
                    continue;
                }

                // Create and append image element (and mark fragment as modified)
                let img = new HTMLImageElement();
                img.onerror = this.onLoadError;
                Object.entries({
                        className: this.className,
                        draggable: 'false',
                        alt: rawText,
                        src: src,
                        ...(this.decorateAttributes(rawText, iconId) ?? {})
                    })
                    .filter(([k,v]) => !k.startsWith('on'))
                    .forEach(([k, v]) => img.setAttribute(k, v))
                ;
                fragment.appendChild(img);
                modified = true;
            }

            if (textOffset < text.length)
                fragment.appendChild(this.createText(text.slice(textOffset), true));

            if (modified)
                return fragment;
        });

        return node;
    }

    /**
     * Given an HEX codepoint, returns UTF16 surrogate pairs.
     *
     * @param   string  generic codepoint, i.e. '1F4A9'
     * @return  string  codepoint transformed into utf16 surrogates pair,
     *          i.e. \uD83D\uDCA9
     *
     * @example
     *  EmojiParser.fromCodePoint('1f1e8');
     *  // "\ud83c\udde8"
     *
     *  '1f1e8-1f1f3'.split('-').map(EmojiParser.fromCodePoint).join('')
     *  // "\ud83c\udde8\ud83c\uddf3"
     */
    static fromCodePoint(codepoint: string | number): string {
        let code = typeof codepoint === 'string' ? parseInt(codepoint, 16) : codepoint;
        if (code < 0x10000) {
            return String.fromCharCode(code);
        }
        code -= 0x10000;
        return String.fromCharCode(
            0xD800 + (code >> 10),
            0xDC00 + (code & 0x3FF)
        );
    }

    /**
     * Given UTF16 surrogate pairs, returns the equivalent HEX codepoint.
     *
     * @param   string  generic utf16 surrogates pair, i.e. \uD83D\uDCA9
     * @param   string  optional separator for double code points, default='-'
     * @return  string  utf16 transformed into codepoint, i.e. '1F4A9'
     *
     * @example
     *  EmojiParser.toCodePoint('\ud83c\udde8\ud83c\uddf3');
     *  // "1f1e8-1f1f3"
     *
     *  EmojiParser.toCodePoint('\ud83c\udde8\ud83c\uddf3', '~');
     *  // "1f1e8~1f1f3"
     */
    static toCodePoint(unicodeSurrogates, sep = '-'): string {
        let result: string[] = [];
        let char = 0;
        let previousChar = 0;
        let i = 0;

        while (i < unicodeSurrogates.length) {
            char = unicodeSurrogates.charCodeAt(i++);
            if (previousChar) {
                result.push((0x10000 + ((previousChar - 0xD800) << 10) + (char - 0xDC00)).toString(16));
                previousChar = 0;
            } else if (0xD800 <= char && char <= 0xDBFF) {
                previousChar = char;
            } else {
                result.push(char.toString(16));
            }
        }
        return result.join(sep);
    }

    /**
     * Shortcut for invoking new EmojiParser(options).parseString(what) 
     * or new EmojiParser(options).parseElement(what). See those methods for further invocation details.
     * 
     * @param what A string or HTMLElement.
     * @param options 
     * @returns 
     */
    static parse(what: string | HTMLElement, options?: EmojiParserOptions) {
        if (typeof what === 'string')
            return new EmojiDecorator(options).parseString(what);
        else
            return new EmojiDecorator(options).parseElement(what);
    }

    /**
     * Given a string, invokes the given function for each emoji found. The emoji is replaced with the 
     * result of the function.
     */
    static replace(text: string, callback: (emoji: string) => string) {
        return text.replace(EMOJI_REGEX, callback);
    }

    /**
     * Check if the string has at least one emoji in it
     */
    static test(text: string) {
        // IE6 needs a reset before too
        EMOJI_REGEX.lastIndex = 0;
        let result = EMOJI_REGEX.test(text);
        EMOJI_REGEX.lastIndex = 0;
        return result;
    }

    private createText(text: string, clean: boolean): Node {
        return document.createTextNode(clean ? text.replace(P_VS16, '') : text);
    }

    private escapeHTML(string: string): string {
        return string.replace(P_HTML_CHARS, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[char]));
    }

    private defaultImageSrcGenerator(icon: string, decorator: EmojiDecorator): string {
        return `${decorator.baseUrl}${decorator.size}/${icon}${decorator.imageType}`;
    }

    private replaceTextNodes(node: Element, replacer: (node: Text) => (Node|void)) {
        for (let subnode of Array.from(node.childNodes)) {
            if (subnode.nodeType === Node.ELEMENT_NODE) {
                if ('ownerSVGElement' in subnode)
                    continue;
                if (P_HTML_SKIPPED.test(subnode.nodeName.toLowerCase()))
                    continue;

                this.replaceTextNodes(subnode as Element, replacer);
            } else if (subnode.nodeType === Node.TEXT_NODE) {
                let newNode = replacer(subnode as Text);
                if (newNode && newNode !== subnode)
                    subnode.parentNode.replaceChild(newNode, subnode);
            }
        }
    }

    /**
     * Used to both remove the possible variant
     *  and to convert utf16 into code points.
     *  If there is a zero-width-joiner (U+200D), leave the variants in.
     * @param   string    the raw text of the emoji match
     * @return  string    the code point
     */
    private grabTheRightIcon(rawText: string): string {
        // if variant is present as \uFE0F
        return EmojiDecorator.toCodePoint(rawText.indexOf(ZWJ) < 0 ?
            rawText.replace(P_VS16, '') :
            rawText
        );
    }
};

const P_VS16 = /\uFE0F/g;
const ZWJ = String.fromCharCode(0x200D);
const P_HTML_CHARS = /[&<>'"]/g;
const P_HTML_SKIPPED = /^(?:iframe|noframes|noscript|script|select|style|textarea)$/;
