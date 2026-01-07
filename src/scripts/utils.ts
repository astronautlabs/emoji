
export function unindent(str: string) {
    let lastNewline = str.lastIndexOf("\n");
    let indent = str.slice(lastNewline + 1).replace(/[^ ]/g, '');
    return str.split(/\n/g)
        .map(x => x.replace(indent, ''))
        .join("\n")
        .replace(/^\n/, '')
        .replace(/\n$/, '')
    ;
}
