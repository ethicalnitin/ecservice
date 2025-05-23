const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3001; // Choose a port

// Middleware
app.use(cors()); // Allow requests from your frontend
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

// Function to extract cookies from a frontend request
const getCookiesFromRequest = (req) => {
    // If using cookie-parser, it might be req.cookies
    // Or, you might need to get it from the 'cookie' header directly
    // The user specified passing cookies in the payload, which is unusual.
    // Let's assume the frontend sends cookies in the request body for simplicity
    // based on the prompt, or preferably via the 'Cookie' header.
    // We will assume the frontend sends a 'cookies' field in the body.
    return req.body.cookies || req.headers.cookie || '';
};

app.post('/api/states', async (req, res) => {
    try {
        const cookies = getCookiesFromRequest(req); // Get cookies from frontend payload/header

        const response = await axios.get('https://ecourts.gov.in/ecourts_home/index.php', {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'max-age=0',
                'Cookie': cookies, // Pass the cookies here
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

        // Parse HTML to extract state links
        const $ = cheerio.load(response.data);
        const states = [];
        $('a[href*="p=dist_court/"]').each((i, element) => {
            const link = $(element).attr('href');
            const name = $(element).text().trim();
            if (link && name && !name.includes('More')) { // Basic filtering
                states.push({ name, link: `https://ecourts.gov.in/ecourts_home/${link}` });
            }
        });

        // IMPORTANT: Capture 'Set-Cookie' headers if any and send back to frontend
        const setCookies = response.headers['set-cookie'];

        res.json({ states, setCookies });

    } catch (error) {
        console.error('Error fetching states:', error.message);
        res.status(500).json({ error: 'Failed to fetch states', details: error.message });
    }
});

app.post('/api/districts', async (req, res) => {
    const { stateLink, cookies } = req.body; // Expect state link and cookies

    if (!stateLink || !cookies) {
        return res.status(400).json({ error: 'State link and cookies are required' });
    }

    try {
        const response = await axios.get(stateLink, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cookie': cookies, // Use provided cookies
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
        // NOTE: The selector 'a[href*=".dcourts.gov.in"]' is an example.
        // You MUST inspect the actual HTML response to find the correct selector for district links.
        $('a').each((i, element) => {
             const link = $(element).attr('href');
             const name = $(element).text().trim();
             // Add robust filtering logic based on actual HTML structure
             if (link && link.includes('.dcourts.gov.in') && name.length > 2) {
                districts.push({ name, link });
             }
        });


        const setCookies = response.headers['set-cookie'];
        res.json({ districts, setCookies });

    } catch (error) {
        console.error('Error fetching districts:', error.message);
        res.status(500).json({ error: 'Failed to fetch districts', details: error.message });
    }
});

app.post('/api/court-details', async (req, res) => {
    const { districtLink, cookies } = req.body;

    if (!districtLink || !cookies) {
        return res.status(400).json({ error: 'District link and cookies are required' });
    }

    // Construct the specific page URL (e.g., case status search)
    // You might need to adjust this based on the actual district link structure.
    const targetUrl = new URL(districtLink);
    const caseStatusUrl = `${targetUrl.origin}/case-status-search-by-petitioner-respondent/`;


    try {
        const response = await axios.get(caseStatusUrl, {
             headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.7',
                'Cache-Control': 'max-age=0',
                'Connection': 'keep-alive',
                'Cookie': cookies, // Use provided cookies
                'Referer': targetUrl.origin + '/',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Sec-Gpc': '1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        });

        const $ = cheerio.load(response.data);

        // --- Extraction Logic ---
        // This is the most crucial part and requires inspecting the HTML.
        // Look for hidden input fields or JavaScript variables.
        const scid = $('input[name="scid"]').val(); // Example: Find input with name 'scid'
        const appToken = $('input[name*="tok_"]').attr('name'); // Example: Find input name starting with 'tok_'
        const courtComplexes = [];
        $('select[name="est_code"] option').each((i, element) => { // Example: Find dropdown
            courtComplexes.push({
                name: $(element).text(),
                value: $(element).val()
            });
        });

        const setCookies = response.headers['set-cookie'];

        res.json({
            scid: scid || 'Not Found - Check Selector',
            appToken: appToken || 'Not Found - Check Selector',
            courtComplexes,
            setCookies
         });

    } catch (error) {
        console.error('Error fetching court details:', error.message);
        res.status(500).json({ error: 'Failed to fetch court details', details: error.message });
    }
});

app.post('/api/captcha', async (req, res) => {
    const { districtBaseUrl, scid, cookies } = req.body;

    if (!districtBaseUrl || !scid || !cookies) {
        return res.status(400).json({ error: 'Base URL, SCID, and cookies are required' });
    }

    const captchaUrl = `${districtBaseUrl}?_siwp_captcha&id=${scid}`;

    try {
        const response = await axios.get(captchaUrl, {
            responseType: 'arraybuffer', // Get image as buffer
            headers: {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.7',
                'Connection': 'keep-alive',
                'Cookie': cookies,
                'Referer': `${districtBaseUrl}/case-status-search-by-petitioner-respondent/`,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Gpc': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        });

        // Convert image buffer to Base64 to send in JSON
        const imageBase64 = Buffer.from(response.data, 'binary').toString('base64');
        const setCookies = response.headers['set-cookie'];

        res.json({
            captchaImage: `data:image/png;base64,${imageBase64}`, // Or jpeg, adjust as needed
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
        appTokenName, // e.g., 'tok_c100...'
        appTokenValue, // e.g., '00cbe...'
        captchaValue // The value entered by the user
    } = req.body;

    // Basic validation
    if (!districtBaseUrl || !cookies || !estCode || !litigantName || !regYear || !scid || !appTokenName || !appTokenValue || !captchaValue) {
       return res.status(400).json({ error: 'Missing required parameters' });
    }

    const ajaxUrl = `${districtBaseUrl}/wp-admin/admin-ajax.php`;

    // Construct the form data
    const formData = new URLSearchParams();
    formData.append('service_type', 'courtComplex');
    formData.append('est_code', estCode);
    formData.append('litigant_name', litigantName);
    formData.append('reg_year', regYear);
    formData.append('case_status', caseStatus);
    formData.append('scid', scid);
    formData.append(appTokenName, appTokenValue); // Dynamic token name
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
                'Cookie': cookies,
                'Origin': districtBaseUrl,
                'Referer': `${districtBaseUrl}/case-status-search-by-petitioner-respondent/`,
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

        // The response should be JSON
        res.json(response.data);

    } catch (error) {
        console.error('Error fetching case data:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch case data', details: error.message });
    }
});

app.post('/api/case-details-by-cino', async (req, res) => {
    const { districtBaseUrl, cookies, cino } = req.body;

    if (!districtBaseUrl || !cookies || !cino) {
        return res.status(400).json({ error: 'District base URL, cookies, and CINO are required' });
    }

    const ajaxUrl = `${districtBaseUrl}/wp-admin/admin-ajax.php`;

    // Construct the form data
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
                'Cookie': cookies, // Pass the cookies from the previous step
                'Origin': districtBaseUrl,
                'Referer': `${districtBaseUrl}/case-status-search-by-petitioner-respondent/`, // Referer remains the search page
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

        // The response should be JSON containing case details
        res.json(response.data);

    } catch (error) {
        console.error('Error fetching case details by CINO:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch case details by CINO', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});