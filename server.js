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

        const externalApiResponse = response.data; // This is the original JSON from the external API

        // Check if the external API response has 'success: true' and 'data' field
        if (externalApiResponse.success && typeof externalApiResponse.data === 'string') {
            const htmlContent = externalApiResponse.data;

            // Load the HTML content into cheerio
            const $ = cheerio.load(htmlContent);

            const cases = [];
            $('table.data-table-1 tbody tr').each((index, element) => {
                const serialNumber = $(element).find('td:nth-child(1)').text().trim();
                const caseTypeNumberYear = $(element).find('td:nth-child(2)').text().trim();
                const petitionerRespondentText = $(element).find('td:nth-child(3)').html(); // Use .html() to preserve <br>
                
                // Clean up petitioner/respondent text
                const petitionerRespondent = petitionerRespondentText
                    ? petitionerRespondentText.replace(/<br\s*\/?>/gi, ' | ').replace(/\s{2,}/g, ' ').trim()
                    : '';

                const viewButton = $(element).find('td:nth-child(4) a.viewCnrDetails');
                const viewUrl = viewButton.attr('href'); // This might be 'javascript:void(0);'
                const dataCno = viewButton.attr('data-cno'); // This holds the actual case number if present

                cases.push({
                    serialNumber: serialNumber,
                    caseTypeNumberYear: caseTypeNumberYear,
                    petitionerRespondent: petitionerRespondent,
                    viewDetails: {
                        url: viewUrl,
                        caseNumberOnly: dataCno // The data-cno attribute holds the specific case number
                    }
                });
            });

            // Return the parsed JSON data
            res.json({
                success: true,
                parsedCases: cases,
                totalCases: parseInt($('#UPLK16').attr('data-total-cases')), // Extracting total cases from data attribute
                nextPage: parseInt($('#UPLK16').attr('data-next-page')) // Extracting next page from data attribute
            });

        } else {
            // If the external API didn't return expected structure or success: false
            res.status(500).json({
                error: 'External API response was not successful or data format was unexpected.',
                externalResponse: externalApiResponse // Include the raw response for debugging
            });
        }

    } catch (error) {
        console.error('Error fetching or parsing case data:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch or parse case data', details: error.message });
    }
});

// ... (rest of your app.js)


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

        const htmlData = response.data.data; // Access the HTML string from the 'data' field
        const $ = cheerio.load(htmlData); // Load the HTML into cheerio

        const caseDetails = {};

        // Parse Case Details Table
        const caseDetailsTable = $('.distTableContent table.data-table-1').first();
        if (caseDetailsTable.length) {
            const headers = [];
            caseDetailsTable.find('thead th').each((i, el) => {
                headers.push($(el).text().trim().replace('<strong>', '').replace('</strong>', ''));
            });
            const values = [];
            caseDetailsTable.find('tbody td').each((i, el) => {
                values.push($(el).text().trim());
            });

            headers.forEach((header, index) => {
                const key = header.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
                caseDetails[key] = values[index];
            });
        }

        // Parse Case Status Table
        const caseStatusTable = $('.distTableContent table.data-table-1').eq(1); // Second table
        if (caseStatusTable.length) {
            const headers = [];
            caseStatusTable.find('thead th').each((i, el) => {
                headers.push($(el).text().trim().replace(/[\t\r\n]+/g, ' ').trim()); // Clean up extra spaces/tabs/newlines
            });
            const values = [];
            caseStatusTable.find('tbody td').each((i, el) => {
                values.push($(el).text().trim());
            });

            headers.forEach((header, index) => {
                const key = header.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
                if (values[index]) {
                    caseDetails[key] = values[index];
                }
            });
        }

        // Parse Petitioner and Advocate
        const petitioners = [];
        $('.Petitioner ul li').each((i, el) => {
            const text = $(el).text().trim();
            const match = text.match(/(\d+\)\s*)(.*?)\s*Advocate\s*-\s*(.*)/i);
            if (match) {
                petitioners.push({
                    name: match[2].trim(),
                    advocate: match[3].trim()
                });
            } else {
                petitioners.push({ name: text, advocate: null });
            }
        });
        caseDetails.petitioners = petitioners;

        // Parse Respondent and Advocate
        const respondents = [];
        $('.respondent ul li').each((i, el) => {
            const text = $(el).text().trim();
            const match = text.match(/(\d+\)\s*)(.*?)\s*(?:Advocate\s*-\s*(.*))?/i); // Make advocate optional
            if (match) {
                respondents.push({
                    name: match[2].trim(),
                    advocate: match[3] ? match[3].trim() : null
                });
            } else {
                respondents.push({ name: text, advocate: null });
            }
        });
        caseDetails.respondents = respondents;

        // Parse Acts Section
        const actsTable = $('div.border.box.bg-white').nextAll('div').first().find('table'); // Assumed structure based on screenshot
        if (actsTable.length) {
            const actHeaders = [];
            actsTable.find('thead th').each((i, el) => {
                actHeaders.push($(el).text().trim());
            });
            const actValues = [];
            actsTable.find('tbody td').each((i, el) => {
                actValues.push($(el).text().trim());
            });

            caseDetails.acts = {};
            if (actHeaders.length === actValues.length) {
                actHeaders.forEach((header, index) => {
                    const key = header.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
                    caseDetails.acts[key] = actValues[index];
                });
            }
        }

        // Parse FIR Details Section
        const firDetailsTable = $('div.border.box.bg-white').nextAll('div').eq(1).find('table'); // Assumed structure based on screenshot
        if (firDetailsTable.length) {
            const firHeaders = [];
            firDetailsTable.find('thead th').each((i, el) => {
                firHeaders.push($(el).text().trim());
            });
            const firValues = [];
            firDetailsTable.find('tbody td').each((i, el) => {
                firValues.push($(el).text().trim());
            });

            caseDetails.fir_details = {};
            if (firHeaders.length === firValues.length) {
                firHeaders.forEach((header, index) => {
                    const key = header.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
                    caseDetails.fir_details[key] = firValues[index];
                });
            }
        }

        // Parse Case History Section
        const caseHistoryTable = $('div.border.box.bg-white').nextAll('div').eq(2).find('table'); // Assumed structure based on screenshot
        if (caseHistoryTable.length) {
            const historyHeaders = [];
            caseHistoryTable.find('thead th').each((i, el) => {
                historyHeaders.push($(el).text().trim());
            });

            const historyEntries = [];
            caseHistoryTable.find('tbody tr').each((i, row) => {
                const rowData = {};
                $(row).find('td').each((j, cell) => {
                    const key = historyHeaders[j].toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
                    rowData[key] = $(cell).text().trim();
                });
                historyEntries.push(rowData);
            });
            caseDetails.case_history = historyEntries;
        }


        // Send the structured JSON response
        res.json({
            success: true,
            caseDetails: caseDetails
        });

    } catch (error) {
        console.error('Error fetching or parsing case details by CINO:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch or parse case details by CINO', details: error.message });
    }
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});