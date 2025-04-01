const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

class NewsScraper {
    constructor() {
        this.BASE_URL = 'https://akharinkhabar.ir';
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
            console.error(`❌ Error fetching ${url}:`, error.message);
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

        if (allNews.length === 0) return { developer: "Developed by @abj0o", error: 'No news found.' };

        // دریافت محتوای اخبار
        for (let i = 0; i < allNews.length; i++) {
            allNews[i].content = await this.getNewsContent(allNews[i].link);
        }

        return { developer: "Developed by @abj0o", news: allNews };
    }
}

// ایجاد سرور Express
const app = express();
const scraper = new NewsScraper();

app.get('/', (req, res) => {
    res.send('🚀 News Web Service is running. Use /news to get the latest news.');
});

// دریافت اخبار
app.get('/news', async (req, res) => {
    try {
        const news = await scraper.scrapeAkharinKhabar();
        res.json(news);
    } catch (error) {
        res.status(500).json({ developer: "Developed by @abj0o", error: 'Error fetching news' });
    }
});

// شروع سرور
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
