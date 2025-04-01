const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

class NewsCache {
    constructor(cacheFile = 'news_cache.json', expireHours = 2) {
        this.cacheFile = cacheFile;
        this.cacheExpiry = expireHours * 3600 * 1000;
    }

    get() {
        if (!fs.existsSync(this.cacheFile)) return null;
        const content = fs.readFileSync(this.cacheFile, 'utf-8');
        if (!content) return null;

        try {
            const cache = JSON.parse(content);
            if (!cache.timestamp || !cache.data) return null;
            if (Date.now() - cache.timestamp > this.cacheExpiry) return null;
            return cache.data;
        } catch {
            return null;
        }
    }

    set(data) {
        const cache = { timestamp: Date.now(), data };
        fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2), 'utf-8');
    }

    clear() {
        if (fs.existsSync(this.cacheFile)) fs.unlinkSync(this.cacheFile);
    }
}

class NewsScraper {
    constructor() {
        this.BASE_URL = 'https://akharinkhabar.ir';
        this.NEWS_LIMIT = 50;
        this.cache = new NewsCache();
    }

    async fetchHTML(url) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${url}:`, error.message);
            return null;
        }
    }

    getFullUrl(url) {
        if (!url) return null;
        url = url.trim();
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) return this.BASE_URL + url;
        return null;
    }

    async getNewsContent(url) {
        const fullUrl = this.getFullUrl(url);
        if (!fullUrl) return 'Error: Invalid news link';

        const html = await this.fetchHTML(fullUrl);
        if (!html) return 'Error: Could not fetch content';

        const $ = cheerio.load(html);
        const selectors = [
            '.single_content_text__4h66M',
            'div.news-text',
            'div.article-content',
            'div[itemprop="articleBody"]',
            '.content_content__sfzd5',
            '#body',
            '#news_content_body'
        ];

        for (let selector of selectors) {
            const content = $(selector).text().trim();
            if (content.length > 50) {
                return content.length > 500 ? content.substring(0, 500) + '...' : content;
            }
        }

        return 'Error: Content section not found';
    }

    async scrapeAkharinKhabar() {
        const cachedNews = this.cache.get();
        if (cachedNews) return { developer: "Developed by @IlIlIlIlIIlIlIlIlIl", news: cachedNews };

        const allNews = [];
        const pages = ['/?type=comment', '/', '/most-visited'];

        for (let page of pages) {
            const targetUrl = this.BASE_URL + page;
            const html = await this.fetchHTML(targetUrl);
            if (!html) continue;

            const $ = cheerio.load(html);
            $('article.rectangle_container__rBE5L').each((i, el) => {
                const title = $(el).find('h4.rectangle_news_title__VvUoG').text().trim();
                const link = $(el).find('a').attr('href');
                const imageUrl = $(el).find('img.rectangle_news_image__fcCG2').attr('data-src') || 
                                 $(el).find('img.rectangle_news_image__fcCG2').attr('src');

                if (title && link) {
                    allNews.push({
                        title,
                        link: this.getFullUrl(link),
                        image: this.getFullUrl(imageUrl),
                        content: '[Fetching...]'
                    });
                }
            });
        }

        if (allNews.length === 0) return { developer: "Developed by @IlIlIlIlIIlIlIlIlIl", error: 'No news found.' };

        const uniqueNews = allNews.slice(0, this.NEWS_LIMIT);

        for (let i = 0; i < uniqueNews.length; i++) {
            uniqueNews[i].content = await this.getNewsContent(uniqueNews[i].link);
        }

        this.cache.set(uniqueNews);
        return { developer: "Developed by @abj0o", news: uniqueNews };
    }
}

// Create Express server
const app = express();
const scraper = new NewsScraper();

app.get('/', (req, res) => {
    res.send('🚀 News Web Service is running. Use /news to get the latest news.');
});

// Endpoint to fetch news
app.get('/news', async (req, res) => {
    try {
        const news = await scraper.scrapeAkharinKhabar();
        res.json(news);
    } catch (error) {
        res.status(500).json({ developer: "Developed by @IlIlIlIlIIlIlIlIlIl", error: 'Error fetching news' });
    }
});

// Endpoint to clear cache
app.get('/clear-cache', (req, res) => {
    scraper.cache.clear();
    res.json({ developer: "Developed by @IlIlIlIlIIlIlIlIlIl", message: 'Cache cleared.' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
