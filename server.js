const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { URLSearchParams } = require('url'); // Needed for /api/case-data and /api/case-details-by-cino

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ // More specific CORS configuration if needed by your frontend
    origin: ['https://verdant-cucurucho-13134b.netlify.app', 'https://jr-portal.vercel.app', 'http://localhost:3000', 'http://localhost:3002'], // Added your common frontends
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept', 'Cookie']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Function to extract cookies from a frontend request (from your original code)
const getCookiesFromRequest = (req) => {
    return req.body.cookies || req.headers.cookie || '';
};

// Helper function to format cookies for the 'Cookie' header (from definitive approach)
// This handles both array of cookie strings and a single cookie string.
const getCookiesForHeader = (cookiesInput) => {
    if (Array.isArray(cookiesInput)) {
        return cookiesInput.map(cookieString => {
            const parts = cookieString.split(';');
            return parts[0].trim(); // Get only the name=value part
        }).join('; ');
    }
    if (typeof cookiesInput === 'string') {
        // If it's already a string, assume it's correctly formatted or a single cookie part
        return cookiesInput;
    }
    return ''; // Fallback for null/undefined or other types
};

// ===============================================
// New function: Replicate siwp_genid() for client-side SCID generation (from definitive approach)
// ===============================================
function generateSecurimageCaptchaId() {
    let cid = '';
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let c = 0; c < 40; ++c) {
        cid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return cid;
}

app.post('/api/states', async (req, res) => {
    try {
        const cookiesFromClient = getCookiesFromRequest(req); // Get cookies from frontend payload/header

        const response = await axios.get('https://ecourts.gov.in/ecourts_home/index.php', {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'max-age=0',
                'Cookie': getCookiesForHeader(cookiesFromClient), // Use helper for consistent formatting
                'Priority': 'u=0, i',
                'Sec-Ch-Ua': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Sec-Gpc': '1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const states = [];
        $('a[href*="p=dist_court/"]').each((i, element) => {
            const link = $(element).attr('href');
            const name = $(element).text().trim();
            if (link && name && !name.includes('More')) {
                states.push({ name, link: `https://ecourts.gov.in/ecourts_home/${link}` });
            }
        });

        const setCookies = response.headers['set-cookie'];
        res.json({ states, setCookies });

    } catch (error) {
        console.error('Error fetching states:', error.message);
        res.status(500).json({ error: 'Failed to fetch states', details: error.message });
    }
});

app.post('/api/districts', async (req, res) => {
    const { stateLink, cookies } = req.body;

    if (!stateLink) { // Removed !cookies check, as initial call might not have specific cookies yet
        return res.status(400).json({ error: 'State link is required' });
    }

    try {
        const response = await axios.get(stateLink, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cookie': getCookiesForHeader(cookies), // Use helper
                'Priority': 'u=0, i',
                'Referer': 'https://ecourts.gov.in/',
                'Sec-Ch-Ua': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Sec-Gpc': '1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const districts = [];
        $('a').each((i, element) => {
            const link = $(element).attr('href');
            const name = $(element).text().trim();
            if (link && link.includes('.dcourts.gov.in') && name.length > 2) {
                // Ensure districtLink ends with a slash for consistency if needed by later logic
                const districtFullLink = link.startsWith('http') ? link : `https://${link}`; // Assume https
                districts.push({ name, link: districtFullLink.endsWith('/') ? districtFullLink : `${districtFullLink}/` });
            }
        });

        const setCookies = response.headers['set-cookie'];
        res.json({ districts, setCookies });

    } catch (error) {
        console.error('Error fetching districts:', error.message);
        res.status(500).json({ error: 'Failed to fetch districts', details: error.message });
    }
});

// ===============================================
// Updated /api/court-details endpoint
// ===============================================
app.post('/api/court-details', async (req, res) => {
    const { districtLink, cookies } = req.body; // cookies expected as an array of strings or a string

    if (!districtLink) {
        return res.status(400).json({ error: 'District link is required' });
    }

    // Ensure districtLink ends with a slash for consistency
    const baseDistrictUrl = districtLink.endsWith('/') ? districtLink : `${districtLink}/`;
    const caseStatusUrl = `${baseDistrictUrl}case-status-search-by-petitioner-respondent/`;

    console.log(`[Initial Load] Attempting to fetch: ${caseStatusUrl}`);
    console.log(`[Initial Load] Sending cookies: ${getCookiesForHeader(cookies)}`);

    try {
        // Headers from "definitive approach" for this specific interaction
        const headers = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.7',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache', // For older HTTP/1.0 proxies
            'Expires': '0', // Ensures no caching
            'Connection': 'keep-alive',
            'Cookie': getCookiesForHeader(cookies),
            'Referer': baseDistrictUrl,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Sec-Gpc': '1',
            'Upgrade-Insecure-Requests': '1',
            // User-Agent from definitive example for Securimage interaction consistency
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        };

        const response = await axios.get(caseStatusUrl, { headers });
        const $ = cheerio.load(response.data);

        // Use more specific selectors for scid and token
        const scid = $('input#input_siwp_captcha_id_0[name="scid"]').val();
        let appTokenName = null;
        let appTokenValue = null;
        $('input[name^="tok_"]').each((i, el) => {
            appTokenName = $(el).attr('name');
            appTokenValue = $(el).val();
            return false; // Found the first one, break loop
        });

      const courtComplexes = [];
const courtEstablishments = [];

// Extract Court Complexes
$('select#est_code option').each((i, element) => {
    const value = $(element).val();
    const name = $(element).text().trim();
    if (value && name && name.toLowerCase() !== 'select court complex' && name.toLowerCase() !== 'all' && value !== "0") {
        courtComplexes.push({ name, value });
    }
});

// Extract Court Establishments
$('select#court_establishment option').each((i, element) => {
    const value = $(element).val();
    const name = $(element).text().trim();
    if (value && name && name.toLowerCase() !== 'select court establishment' && name.toLowerCase() !== 'all' && value !== "0") {
        courtEstablishments.push({ name, value });
    }
});

        const setCookies = response.headers['set-cookie'] || [];

        console.log('[Initial Load] Extracted SCID:', scid);
        console.log('[Initial Load] Extracted App Token Name:', appTokenName);
        console.log('[Initial Load] Extracted App Token Value:', appTokenValue ? 'Present' : 'MISSING');
        console.log('[Initial Load] Court Complexes count:', courtComplexes.length);
        console.log('[Initial Load] New cookies received:', setCookies.length ? setCookies : 'None');

        res.json({
            scid: scid || null, // Send null if not found
            appTokenName: appTokenName || null,
            appTokenValue: appTokenValue || null,
            courtComplexes,
            courtEstablishments,
            setCookies
        });

    } catch (error) {
        console.error('[Initial Load] Error fetching court details:', error.message);
        if (error.response) {
            console.error('[Initial Load] Error response status:', error.response.status);
            console.error('[Initial Load] Error response data (partial):', error.response.data ? String(error.response.data).substring(0, 500) : 'No data');
        }
        res.status(500).json({ error: 'Failed to fetch court details', details: error.message });
    }
});

// ===============================================
// New /api/refresh-captcha endpoint
// ===============================================
app.post('/api/refresh-captcha', async (req, res) => {
    const { districtBaseUrl, cookies } = req.body; // cookies expected as an array of strings or a string

    if (!districtBaseUrl || !cookies) { // Cookies are essential here
        return res.status(400).json({ error: 'District base URL and cookies are required' });
    }

    const baseDistrictUrlProper = districtBaseUrl.endsWith('/') ? districtBaseUrl : `${districtBaseUrl}/`;
    const caseStatusSearchUrl = `${baseDistrictUrlProper}case-status-search-by-petitioner-respondent/`;

    console.log(`[Refresh] Attempting to refresh captcha for: ${baseDistrictUrlProper}`);
    console.log(`[Refresh] Sending initial cookies: ${getCookiesForHeader(cookies)}`);

    let currentSessionCookiesArray = [];
    if (Array.isArray(cookies)) {
        currentSessionCookiesArray = [...cookies];
    } else if (typeof cookies === 'string') {
        currentSessionCookiesArray = cookies.split(';').map(c => c.trim()).filter(c => c);
    }

    try {
        // --- STEP 1: Generate a new SCID ---
        const newScid = generateSecurimageCaptchaId();
        console.log('[Refresh] Generated new SCID client-side:', newScid);

        // --- STEP 2: Fetch the new captcha image ---
        const captchaImageUrl = `${baseDistrictUrlProper}?_siwp_captcha&id=${newScid}`;
        console.log('[Refresh] Fetching captcha image from:', captchaImageUrl);

        const captchaImageResponse = await axios.get(captchaImageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.7',
                'Connection': 'keep-alive',
                'Cookie': getCookiesForHeader(currentSessionCookiesArray),
                'Referer': caseStatusSearchUrl,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Gpc': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        });

        const newCookiesFromImage = captchaImageResponse.headers['set-cookie'] || [];
        if (newCookiesFromImage.length > 0) {
            console.log('[Refresh] Cookies from captcha image fetch:', newCookiesFromImage);
            currentSessionCookiesArray.push(...newCookiesFromImage);
            // Deduplicate cookies, prioritizing later ones
            const cookieMap = new Map();
            currentSessionCookiesArray.forEach(cookieStr => {
                const name = cookieStr.split('=')[0].trim();
                cookieMap.set(name, cookieStr);
            });
            currentSessionCookiesArray = Array.from(cookieMap.values());
        }
        const imageBase64 = Buffer.from(captchaImageResponse.data, 'binary').toString('base64');

        // --- STEP 3: Re-fetch the main page to get the latest app token ---
        console.log(`[Refresh] Re-fetching page for token: ${caseStatusSearchUrl}`);
        console.log(`[Refresh] Sending cookies for page re-fetch: ${getCookiesForHeader(currentSessionCookiesArray)}`);
        
        const pageResponse = await axios.get(caseStatusSearchUrl, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.7',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Connection': 'keep-alive',
                'Cookie': getCookiesForHeader(currentSessionCookiesArray),
                'Referer': baseDistrictUrlProper,
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Sec-Gpc': '1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        });

        const newCookiesFromPage = pageResponse.headers['set-cookie'] || [];
        if (newCookiesFromPage.length > 0) {
            console.log('[Refresh] Cookies from page re-fetch:', newCookiesFromPage);
            currentSessionCookiesArray.push(...newCookiesFromPage);
            const cookieMap = new Map();
            currentSessionCookiesArray.forEach(cookieStr => {
                const name = cookieStr.split('=')[0].trim();
                cookieMap.set(name, cookieStr);
            });
            currentSessionCookiesArray = Array.from(cookieMap.values());
        }

        const $ = cheerio.load(pageResponse.data);
        let newAppTokenName = null;
        let newAppTokenValue = null;
        $('input[name^="tok_"]').each((i, el) => {
            newAppTokenName = $(el).attr('name');
            newAppTokenValue = $(el).val();
            return false;
        });

        console.log('[Refresh] Extracted new App Token Name:', newAppTokenName);
        console.log('[Refresh] Extracted new App Token Value:', newAppTokenValue ? 'Present' : 'MISSING');
        console.log('[Refresh] Final cookies to send to client:', currentSessionCookiesArray.length);

        res.json({
            newScid: newScid,
            newAppTokenName: newAppTokenName,
            newAppTokenValue: newAppTokenValue,
            captchaImage: `data:image/png;base64,${imageBase64}`,
            setCookies: currentSessionCookiesArray
        });

    } catch (error) {
        console.error('[Refresh] Error refreshing captcha:', error.message);
        if (error.response) {
            console.error('[Refresh] Error response status:', error.response.status);
            console.error('[Refresh] Error response data (partial):', error.response.data ? String(error.response.data).substring(0, 500) : 'No data');
        }
        res.status(500).json({ error: 'Failed to refresh captcha', details: error.message });
    }
});

// This endpoint is for fetching a captcha image if you ALREADY have an SCID.
// The new /api/refresh-captcha generates a new SCID and fetches the image.
app.post('/api/captcha', async (req, res) => {
    const { districtBaseUrl, scid, cookies } = req.body;

    if (!districtBaseUrl || !scid || !cookies) {
        return res.status(400).json({ error: 'Base URL, SCID, and cookies are required' });
    }
    const properDistrictBaseUrl = districtBaseUrl.endsWith('/') ? districtBaseUrl : `${districtBaseUrl}/`;
    const captchaUrl = `${properDistrictBaseUrl}?_siwp_captcha&id=${scid}`;

    try {
        const response = await axios.get(captchaUrl, {
            responseType: 'arraybuffer',
            headers: {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.7',
                'Connection': 'keep-alive',
                'Cookie': getCookiesForHeader(cookies), // Use helper
                'Referer': `${properDistrictBaseUrl}case-status-search-by-petitioner-respondent/`,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Gpc': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36', // Your original UA
                'sec-ch-ua': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        });

        const imageBase64 = Buffer.from(response.data, 'binary').toString('base64');
        const setCookies = response.headers['set-cookie'];

        res.json({
            captchaImage: `data:image/png;base64,${imageBase64}`,
            setCookies
        });

    } catch (error) {
        console.error('Error fetching captcha:', error.message);
        res.status(500).json({ error: 'Failed to fetch captcha', details: error.message });
    }
});


app.post('/api/case-data', async (req, res) => {
    const {
        districtBaseUrl,
        cookies,
        estCode,
        litigantName,
        regYear,
        caseStatus,
        scid,
        appTokenName,
        appTokenValue,
        captchaValue
    } = req.body;

    if (!districtBaseUrl || !cookies || !estCode || !litigantName || !regYear || !scid || !appTokenName || !appTokenValue || !captchaValue) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    const properDistrictBaseUrl = districtBaseUrl.endsWith('/') ? districtBaseUrl : `${districtBaseUrl}/`;
    const ajaxUrl = `${properDistrictBaseUrl}wp-admin/admin-ajax.php`;

    const formData = new URLSearchParams();
    formData.append('service_type', 'courtComplex');
    formData.append('est_code', estCode);
    formData.append('litigant_name', litigantName);
    formData.append('reg_year', regYear);
    formData.append('case_status', caseStatus);
    formData.append('scid', scid);
    formData.append(appTokenName, appTokenValue);
    formData.append('siwp_captcha_value', captchaValue);
    formData.append('es_ajax_request', '1');
    formData.append('submit', 'Search');
    formData.append('action', 'get_parties');

    try {
        const response = await axios.post(ajaxUrl, formData.toString(), {
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.7',
                'Connection': 'keep-alive',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Cookie': getCookiesForHeader(cookies), // Use helper
                'Origin': properDistrictBaseUrl.slice(0, -1), // Remove trailing slash for Origin
                'Referer': `${properDistrictBaseUrl}case-status-search-by-petitioner-respondent/`,
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-GPC': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'sec-ch-ua': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        });

        const externalApiResponse = response.data;
        const setCookies = response.headers['set-cookie'] || []; // Capture any cookies from this response

        if (externalApiResponse.success && typeof externalApiResponse.data === 'string') {
            const htmlContent = externalApiResponse.data;
            const $ = cheerio.load(htmlContent);
            const cases = [];
            $('table.data-table-1 tbody tr').each((index, element) => {
                const serialNumber = $(element).find('td:nth-child(1)').text().trim();
                const caseTypeNumberYear = $(element).find('td:nth-child(2)').text().trim();
                const petitionerRespondentText = $(element).find('td:nth-child(3)').html();
                const petitionerRespondent = petitionerRespondentText
                    ? petitionerRespondentText.replace(/<br\s*\/?>/gi, ' | ').replace(/\s{2,}/g, ' ').trim()
                    : '';
                const viewButton = $(element).find('td:nth-child(4) a.viewCnrDetails');
                const viewUrl = viewButton.attr('href');
                const dataCno = viewButton.attr('data-cno');
                cases.push({
                    serialNumber: serialNumber,
                    caseTypeNumberYear: caseTypeNumberYear,
                    petitionerRespondent: petitionerRespondent,
                    viewDetails: { url: viewUrl, caseNumberOnly: dataCno }
                });
            });

            // Extract pagination details carefully
            const paginationElement = $('#UPLK16'); // This ID is likely specific, make it more general or configurable if needed
            let totalCases = null;
            let nextPage = null;
            if (paginationElement.length > 0) {
                 totalCases = parseInt(paginationElement.attr('data-total-cases'), 10);
                 nextPage = parseInt(paginationElement.attr('data-next-page'), 10);
                 if (isNaN(totalCases)) totalCases = null; // Handle NaN
                 if (isNaN(nextPage)) nextPage = null;   // Handle NaN
            }


            res.json({
                success: true,
                parsedCases: cases,
                totalCases: totalCases,
                nextPage: nextPage,
                setCookies // Pass along any new cookies
            });
        } else if (externalApiResponse.success === false && typeof externalApiResponse.data === 'string') {
             // Handle cases like "Invalid Captcha" or "No records found"
             console.log('[Case Data] Non-success message from external API:', externalApiResponse.data);
             res.status(400).json({ // Use a 4xx status for client-side type errors from external API
                error: externalApiResponse.data, // Send the message from the external API
                externalResponse: externalApiResponse,
                setCookies
            });
        }
         else {
            console.log('[Case Data] External API response format unexpected:', externalApiResponse);
            res.status(500).json({
                error: 'External API response was not successful or data format was unexpected.',
                externalResponse: externalApiResponse,
                setCookies
            });
        }
    } catch (error) {
        console.error('Error fetching or parsing case data:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch or parse case data', details: error.message });
    }
});

app.post('/api/case-details-by-cino', async (req, res) => {
    const { districtBaseUrl, cookies, cino } = req.body;

    if (!districtBaseUrl || !cookies || !cino) {
        return res.status(400).json({ error: 'District base URL, cookies, and CINO are required' });
    }

    const properDistrictBaseUrl = districtBaseUrl.endsWith('/') ? districtBaseUrl : `${districtBaseUrl}/`;
    const ajaxUrl = `${properDistrictBaseUrl}wp-admin/admin-ajax.php`;

    const formData = new URLSearchParams();
    formData.append('cino', cino);
    formData.append('action', 'get_cnr_details');
    formData.append('es_ajax_request', '1');

    try {
        const response = await axios.post(ajaxUrl, formData.toString(), {
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.7',
                'Connection': 'keep-alive',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Cookie': getCookiesForHeader(cookies), // Use helper
                'Origin': properDistrictBaseUrl.slice(0, -1), // Remove trailing slash for Origin
                'Referer': `${properDistrictBaseUrl}case-status-search-by-petitioner-respondent/`,
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-GPC': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'sec-ch-ua': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        });
        
        const setCookies = response.headers['set-cookie'] || []; // Capture cookies

        if (response.data && response.data.success && typeof response.data.data === 'string') {
            const htmlData = response.data.data;
            const $ = cheerio.load(htmlData);
            const caseDetails = {};

            // Helper to parse tables with headers and values into an object
            const parseTableToObject = (tableElement) => {
                const obj = {};
                if (tableElement.length) {
                    const headers = [];
                    tableElement.find('thead th').each((i, el) => {
                        headers.push($(el).text().trim().toLowerCase().replace(/[^a-zA-Z0-9_]+/g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, ''));
                    });
                    const values = [];
                    tableElement.find('tbody td').each((i, el) => {
                        values.push($(el).text().trim());
                    });
                    headers.forEach((header, index) => {
                        if (header && values[index] !== undefined) { // Ensure header is not empty
                           obj[header] = values[index];
                        }
                    });
                }
                return obj;
            };
            
             // Helper to parse tables with multiple rows into an array of objects
            const parseRowsToArray = (tableElement) => {
                const entries = [];
                if (tableElement.length) {
                    const headers = [];
                    tableElement.find('thead th').each((i, el) => {
                        headers.push($(el).text().trim().toLowerCase().replace(/[^a-zA-Z0-9_]+/g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, ''));
                    });
                    tableElement.find('tbody tr').each((i, row) => {
                        const rowData = {};
                        $(row).find('td').each((j, cell) => {
                            if (headers[j]) { // Ensure header exists
                                rowData[headers[j]] = $(cell).text().trim();
                            }
                        });
                        if (Object.keys(rowData).length > 0) entries.push(rowData);
                    });
                }
                return entries;
            };


            // Parse Case Details and Case Status Tables
            Object.assign(caseDetails, parseTableToObject($('.distTableContent table.data-table-1').first()));
            Object.assign(caseDetails, parseTableToObject($('.distTableContent table.data-table-1').eq(1))); // Second table for status

            const petitioners = [];
            $('.Petitioner ul li').each((i, el) => {
                const text = $(el).text().trim();
                const match = text.match(/(\d+\)\s*)(.*?)\s*(?:Advocate\s*-\s*(.*))?/i);
                if (match) {
                    petitioners.push({ name: match[2].trim(), advocate: match[3] ? match[3].trim() : null });
                } else if (text) {
                    petitioners.push({ name: text.replace(/^\d+\)\s*/, '').trim(), advocate: null });
                }
            });
            caseDetails.petitioners_and_advocates = petitioners;

            const respondents = [];
            $('.respondent ul li').each((i, el) => {
                const nameText = $(el).find('p').first().text().trim();
                let advocate = null;
                const nameMatch = nameText.match(/(\d+\)\s*)(.*)/);
                let name = nameMatch ? nameMatch[2].trim() : nameText;
                $(el).contents().each((j, contentNode) => {
                    if (contentNode.type === 'text') {
                        const textContent = $(contentNode).text().trim();
                        const advocateMatch = textContent.match(/Advocate\s*-\s*(.*)/i);
                        if (advocateMatch) { advocate = advocateMatch[1].trim(); return false; }
                    }
                });
                if (name) respondents.push({ name: name, advocate: advocate });
            });
            caseDetails.respondents_and_advocates = respondents;

            // More robust parsing for sections by looking for headings
            // These selectors might need adjustment based on the exact HTML structure.
            const sectionsRoot = $('div.distTableContent').parent(); // Common parent or document body
            
            caseDetails.acts_and_sections = parseRowsToArray(sectionsRoot.find('h6:contains("Act and Sections")').first().nextUntil('h6', 'div.table-responsive').find('table.data-table-1'));
            caseDetails.fir_details = parseRowsToArray(sectionsRoot.find('h6:contains("FIR Details")').first().nextUntil('h6', 'div.table-responsive').find('table.data-table-1'));
            caseDetails.history_of_case_hearing = parseRowsToArray(sectionsRoot.find('h6:contains("History of Case Hearing")').first().nextUntil('h6', 'div.table-responsive').find('table.data-table-1'));


            res.json({
                success: true,
                caseDetails: caseDetails,
                setCookies // Pass along any new cookies
            });
        } else {
            console.error('[CINO Details] External API response format unexpected or success false:', response.data);
            res.status(500).json({ 
                error: 'Failed to parse CINO details, unexpected API response format.', 
                details: response.data, // Send raw data for debugging
                setCookies 
            });
        }

    } catch (error) {
        console.error('Error fetching or parsing case details by CINO:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch or parse case details by CINO', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});