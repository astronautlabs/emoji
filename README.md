# @/emoji

A simple library that provides standard Unicode [emoji](http://en.wikipedia.org/wiki/Emoji) support across all platforms.
Forked from [twemoji](https://github.com/twitter/twemoji).

Adheres to the [Unicode 17.0 spec](https://unicode.org/versions/Unicode17.0.0/) and supports the 
[Emoji 17.0 spec](https://www.unicode.org/reports/tr51/tr51-29.html).

Offers support for all Unicode-defined emoji which are recommended for general interchange (RGI).

## License

Code
> Copyright 2025 Astronaut Labs, LLC.  
> Copyright 2019 Twitter, Inc and other contributors.  
> Licensed under the MIT License: <http://opensource.org/licenses/MIT>

Graphics
> Copyright 2019 Twitter, Inc and other contributors.  
> Licensed under CC-BY 4.0: <https://creativecommons.org/licenses/by/4.0/>

### Attribution Requirements

The graphics are provided under the Creative Commons Attribution 4.0 license as stated above.

Twitter, Inc. provided the following guidance on how to adhere to the license's attribution requirements when publishing the original `twemoji` library:

> As an open source project, attribution is critical from a legal, practical and motivational perspective in our 
> opinion. The graphics are licensed under the CC-BY 4.0 which has a pretty good guide on 
> [best practices for attribution](https://wiki.creativecommons.org/Best_practices_for_attribution).
>
> However, we consider the guide a bit onerous and as a project, will accept a mention in a project README or an 
> 'About' section or footer on a website. In mobile applications, a common place would be in the Settings/About 
> section (for example, see the mobile Twitter application Settings->About->Legal section). We would consider a 
> mention in the HTML/JS source sufficient also.

## Usage

```
npm install @astronautlabs/emoji
```

### How to use the Graphics

The graphics are bundled in the NPM package in the `assets` directory. So within your project, you should be able to 
access them from:

> `./node_modules/@astronautlabs/emoji/assets`

This folder corresponds to the `baseUrl` option used within the library, so if `/emoji` was mapped to this folder, you would set `baseUrl` to `/emoji`.

You are free to copy them to where you need them or configure your web server to serve them within your product. Just 
make sure to adhere to the **Attribution requirements** mentioned above.

### Replace all emojis in an HTMLElement

```ts
import { EmojiParser } from '@astronautlabs/emoji';

let div = document.createElement('div');
div.textContent = 'I \u2764\uFE0F emoji!';
document.body.appendChild(div);

EmojiParser.parse(document.body, { baseUrl: '/path/to/images' });

// Result:
// I <img src="/path/to/images/72x72/2764.png" alt="\u2764\uFE0F" className="emoji" draggable="false" /> emoji!
```

### Accessing Emoji Data

This library bundles information about what emojis are available. This can be used to build your own emoji picker,
for example.

```ts
import { EMOJI } from '@astronautlabs/emoji';

for (const category of EMOJI.categories) {
    console.log(`Category: ${category.title}`);
    for (const emoji of category.items) {
        console.log(`- ${emoji.string}: ${emoji.description}, ${emoji.keywords.join(',')}`);
    }
});
```

### Using the Raw Data

The raw emoji data used by this library is also bundled in the NPM package in JSON format, should you wish to use it outside of the library. You can find it at:

> `./node_modules/@astronautlabs/emoji/emoji.json`

Note that you do not need this for normal usage of the library (the data is generated into the Typescript source files).

## Thank you to the Twemoji contributors

The following contributors worked hard to build Twemoji:

* Justine De Caires (ex-Twitter)
* Jason Sofonia (ex-Twitter)
* Bryan Haggerty (ex-Twitter)
* Nathan Downs (ex-Twitter)
* Tom Wuttke (ex-Twitter)
* Andrea Giammarchi (ex-Twitter)
* Joen Asmussen (WordPress)
* Marcus Kazmierczak (WordPress)
* Kevin VQ Dam (ex-Discord)
* Gica Tam (Discord)
* Ben Olson (Discord)

> _The goal of [the Twemoji project] is to simply provide emoji for everyone. We definitely welcome improvements and fixes, but we may not merge every pull request suggested by the community due to the simple nature of the project._
> 
> _Thank you to all of our [contributors](https://github.com/jdecked/twemoji/graphs/contributors)._

# References

- [UNICODE CLDR JSON Character Annotations](https://github.com/unicode-org/cldr-json/tree/main/cldr-json/cldr-annotations-full)
