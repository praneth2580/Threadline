import * as cheerio from 'cheerio';

/**
 * Generates a stable structural hash for an element based on its DOM path and text content.
 * Disregards transient properties like random classes or IDs.
 */
function generateStableElementHash(el, $) {
    // 1. Build structural path
    let path = '';
    let current = el;
    
    while (current && current.type === 'tag') {
        const index = $(current).prevAll(current.name).length + 1;
        path = `${current.name}[${index}]>${path}`;
        current = current.parent;
    }
    
    // 2. Get stable snippet of text
    const textSnippet = $(el).text().replace(/\s+/g, ' ').substring(0, 50).trim();
    const strToHash = path + '|' + textSnippet;
    
    // 3. FNV-1a Hash Implementation for fast, zero-dependency hashing
    let hash = 2166136261;
    for (let i = 0; i < strToHash.length; i++) {
        hash ^= strToHash.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
}

/**
 * Parses and cleans HTML, returning a structured object containing text and metadata
 * instead of raw HTML. This is optimal to feed into an AI context.
 * 
 * @param {string} html The raw HTML string
 * @param {string} [baseUrl] Optional base URL to resolve relative links
 * @param {string[]} [selectors] An optional array of CSS selectors to extract specific components
 */
export function parseHtmlForAi(html, baseUrl, selectors) {
    const $ = cheerio.load(html);
    
    // 1. Preserve critical aria/alt labels before removing visual elements
    $('[aria-label], [alt], [title]').each((_, el) => {
        const $el = $(el);
        const labelText = $el.attr('aria-label') || $el.attr('alt') || $el.attr('title');
        
        // If element has no meaningful text content, inject the label 
        // We use a regex to see if it contains any non-whitespace characters
        const currentText = $el.text().trim();
        if (labelText && currentText === '') {
            $el.text(`[${labelText}]`);
        }
    });

    // 2. Remove noise that carries no useful content for the AI
    // We remove 'link' tags (stylesheets/etc) but NOT 'a' tags.
    $('script, style, noscript, svg, path, link, meta, iframe, canvas, video, audio').remove();
    
    // 3. Remove comments
    $('*').contents().filter(function() {
        return this.type === 'comment';
    }).remove();

    // 4. Inject structural spacing (newlines) for block elements
    $('p, br, div, h1, h2, h3, h4, h5, h6, li, article, section, blockquote, header, footer').append('\n');

    const title = $('title').text().replace(/\s+/g, ' ').trim() || '';
    
    // 5. Get raw cleaned text content, preserving newlines safely
    const rawText = $('body').text() || $.text();
    // Collapse horizontal whitespace to a single space, and multiple newlines into max 2
    const textContent = rawText
        .replace(/[ \t\r]+/g, ' ')       // Replace horizontal spaces mapped with tabs/carriage returns to 1 space
        .replace(/ \n /g, '\n')          // Clean up spaces around newlines
        .replace(/ \n/g, '\n')
        .replace(/\n /g, '\n')
        .replace(/\n{3,}/g, '\n\n')      // Max 2 vertical newlines
        .trim();

    // Extract links
    const links = [];
    $('a[href]').each((_, element) => {
        const text = $(element).text().replace(/\s+/g, ' ').trim();
        let href = $(element).attr('href');
        
        if (!href) return;

        if (baseUrl && !href.startsWith('http')) {
            try {
                href = new URL(href, baseUrl).href;
            } catch (e) {
                // Keep relative url if parsing fails
            }
        }
        
        if (text && href) {
            links.push({
                text, 
                href,
                elementHash: generateStableElementHash(element, $)
            });
        }
    });

    // Extract specific selected components if requested
    const extractedComponents = {};
    if (selectors && selectors.length > 0) {
        for (const selector of selectors) {
            extractedComponents[selector] = [];
            $(selector).each((_, element) => {
                const text = $(element).text().replace(/\s+/g, ' ').trim();
                if (text) {
                    extractedComponents[selector].push({
                        text,
                        elementHash: generateStableElementHash(element, $)
                    });
                }
            });
        }
    }

    return {
        title,
        textContent,
        links,
        ...(selectors && selectors.length > 0 ? { extractedComponents } : {})
    };
}
