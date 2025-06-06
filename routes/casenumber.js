// routes/casenumber.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { URLSearchParams } = require('url');

const router = express.Router();

// Helper function to format cookies
const getCookiesForHeader = (cookiesInput) => {
    if (Array.isArray(cookiesInput)) {
        const formattedCookies = cookiesInput.map(cookieString => cookieString.split(';')[0].trim()).join('; ');
        console.log('Formatted Cookie Header:', formattedCookies); // Log the formatted cookie string
        return formattedCookies;
    }
    const result = typeof cookiesInput === 'string' ? cookiesInput : '';
    console.log('Using raw cookie string for header:', result); // Log raw string if it's a string
    return result;
};

// Consistent headers based on your working curl commands
const getCommonHeaders = (cookies, referer) => {
    const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.7',
        'Connection': 'keep-alive',
        'Cookie': getCookiesForHeader(cookies),
        'Referer': referer,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Sec-GPC': '1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    };
    console.log('Common Headers Generated:', JSON.stringify(headers, null, 2));
    return headers;
};

// Headers for AJAX requests
const getAjaxHeaders = (cookies, origin) => {
    const headers = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.7',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': getCookiesForHeader(cookies),
        'Origin': origin,
        'Referer': `${origin}/case-status-search-by-case-number/`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-GPC': '1',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'X-Requested-With': 'XMLHttpRequest',
    };
    console.log('Ajax Headers Generated:', JSON.stringify(headers, null, 2));
    return headers;
};


router.post('/court-details', async (req, res) => {
    console.log('--- /api/casenumber/court-details Request Received ---');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const { districtLink, cookies } = req.body;
    if (!districtLink) {
        console.error('Validation Error: District link is required.');
        return res.status(400).json({ error: 'District link is required' });
    }

    const baseDistrictUrl = districtLink.endsWith('/') ? districtLink : `${districtLink}/`;
    const caseStatusUrl = `${baseDistrictUrl}case-status-search-by-case-number/`;

    console.log('Attempting GET request to:', caseStatusUrl);
    try {
        const response = await axios.get(caseStatusUrl, {
            headers: getCommonHeaders(cookies, baseDistrictUrl)
        });
        console.log('External API Response Status:', response.status);
        console.log('External API Response Headers (Set-Cookie):', response.headers['set-cookie'] || 'None');
        console.log('External API Response Data (Snippet):', response.data.substring(0, 500) + '...'); // Log first 500 chars

        const $ = cheerio.load(response.data);

        const scid = $('input[name="scid"]').val();
        const appTokenName = $('input[name^="tok_"]').attr('name');
        const appTokenValue = $('input[name^="tok_"]').val();

        const courtComplexes = [];
        $('select#est_code option').each((i, element) => {
            const value = $(element).val();
            const name = $(element).text().trim();
            if (value && name && name.toLowerCase() !== 'select court complex' && value !== "0") {
                courtComplexes.push({ name, value });
            }
        });
        console.log('Parsed SCID:', scid);
        console.log('Parsed App Token Name:', appTokenName);
        console.log('Parsed App Token Value:', appTokenValue);
        console.log('Parsed Court Complexes:', courtComplexes);

        const setCookies = response.headers['set-cookie'] || [];
        console.log('Cookies extracted from response:', setCookies);

        res.json({
            scid: scid || null,
            appTokenName: appTokenName || null,
            appTokenValue: appTokenValue || null,
            courtComplexes,
            setCookies
        });
        console.log('Response sent for /court-details.');
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Axios Error fetching court details:');
            console.error('Error Message:', error.message);
            if (error.response) {
                console.error('Response Status:', error.response.status);
                console.error('Response Data:', error.response.data?.substring(0, 500) + '...'); // Log response data if available
                console.error('Response Headers:', error.response.headers);
            } else if (error.request) {
                console.error('No response received from external server.');
            }
        } else {
            console.error('General Error fetching court details:', error.message);
        }
        res.status(500).json({ error: 'Failed to fetch court details', details: error.message });
    }
});
/**
 * @route   POST /api/casenumber/case-types
 * @desc    Step 2: Get case types based on selected court complex.
 */
router.post('/case-types', async (req, res) => {
    console.log('--- /api/casenumber/case-types Request Received ---');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const { districtBaseUrl, cookies, estCode, scid, appTokenName, appTokenValue } = req.body;

    if (!districtBaseUrl || !cookies || !estCode || !scid || !appTokenName || !appTokenValue) {
        console.error('Validation Error: Missing required parameters for fetching case types.');
        return res.status(400).json({ error: 'Missing required parameters for fetching case types' });
    }

    const properDistrictBaseUrl = districtBaseUrl.endsWith('/') ? districtBaseUrl : `${districtBaseUrl}/`;
    const ajaxUrl = `${properDistrictBaseUrl}wp-admin/admin-ajax.php`;
    const origin = properDistrictBaseUrl.slice(0, -1);

    const formData = new URLSearchParams();
    formData.append('action', 'get_case_types');
    formData.append('service_type', 'courtComplex');
    formData.append('est_code', estCode);
    formData.append('scid', scid);
    formData.append(appTokenName, appTokenValue);
    formData.append('es_ajax_request', '1');

    console.log('Outbound API URL (Case Types):', ajaxUrl);
    console.log('Outbound Request FormData (Case Types):', formData.toString());

    try {
        const response = await axios.post(ajaxUrl, formData.toString(), {
            headers: getAjaxHeaders(cookies, origin),
        });

        console.log('External API Response Status (Case Types):', response.status);
        console.log('External API Response Headers (Set-Cookie):', response.headers['set-cookie'] || 'None');
        console.log('Raw External API Response Data (Case Types):', JSON.stringify(response.data, null, 2));

        const externalApiResponse = response.data;
        const setCookies = response.headers['set-cookie'] || [];

        if (externalApiResponse.success && typeof externalApiResponse.data === 'string') {
            const $ = cheerio.load(externalApiResponse.data);
            const caseTypes = [];
            $('option').each((i, element) => {
                const value = $(element).val();
                const name = $(element).text().trim();
                if (value && name && name.toLowerCase() !== 'select case type' && value !== "0") {
                    caseTypes.push({ name, value });
                }
            });
            console.log('Parsed Case Types:', caseTypes);
            res.json({ success: true, caseTypes, setCookies });
            console.log('Response sent for /case-types.');
        } else {
            console.error('External API response (case types) indicates failure or unexpected format. Response:', JSON.stringify(externalApiResponse, null, 2));
            res.status(400).json({ error: 'Failed to get case types from external API.', details: externalApiResponse });
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Axios Error fetching case types:');
            console.error('Error Message:', error.message);
            if (error.response) {
                console.error('Response Status:', error.response.status);
                console.error('Response Data:', error.response.data?.substring(0, 500) + '...');
                console.error('Response Headers:', error.response.headers);
            } else if (error.request) {
                console.error('No response received from external server.');
            }
        } else {
            console.error('General Error fetching case types:', error.message);
        }
        res.status(500).json({ error: 'Failed to fetch case types', details: error.message });
    }
});
/**
 * @route   POST /api/casenumber/captcha
 * @desc    Step 3: Fetch a new captcha image.
 */
router.post('/captcha', async (req, res) => {
    console.log('--- /api/casenumber/captcha Request Received ---');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const { districtBaseUrl, scid, cookies } = req.body;

    if (!districtBaseUrl || !scid || !cookies) {
        console.error('Validation Error: Base URL, SCID, and cookies are required for captcha.');
        return res.status(400).json({ error: 'Base URL, SCID, and cookies are required' });
    }
    const properDistrictBaseUrl = districtBaseUrl.endsWith('/') ? districtBaseUrl : `${districtBaseUrl}/`;
    const captchaUrl = `${properDistrictBaseUrl}?_siwp_captcha&id=${scid}`;

    console.log('Attempting GET request to Captcha URL:', captchaUrl);
    try {
        const response = await axios.get(captchaUrl, {
            responseType: 'arraybuffer',
            headers: {
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.7',
                'Connection': 'keep-alive',
                'Cookie': getCookiesForHeader(cookies), // Ensure cookies are included
                'Referer': `${properDistrictBaseUrl}case-status-search-by-case-number/`,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            }
        });

        console.log('External API Response Status (Captcha):', response.status);
        console.log('External API Response Headers (Set-Cookie):', response.headers['set-cookie'] || 'None');

        const imageBase64 = Buffer.from(response.data, 'binary').toString('base64');
        console.log('Captcha Image Base64 length:', imageBase64.length); // Check if image data is present
        const setCookies = response.headers['set-cookie'] || [];
        console.log('Cookies extracted from captcha response:', setCookies);

        res.json({
            captchaImage: `data:image/png;base64,${imageBase64}`,
            setCookies
        });
        console.log('Response sent for /captcha.');
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Axios Error fetching captcha:');
            console.error('Error Message:', error.message);
            if (error.response) {
                console.error('Response Status:', error.response.status);
                // Captcha response data might be binary, so log only headers
                console.error('Response Headers:', error.response.headers);
            } else if (error.request) {
                console.error('No response received from external server.');
            }
        } else {
            console.error('General Error fetching captcha:', error.message);
        }
        res.status(500).json({ error: 'Failed to fetch captcha', details: error.message });
    }
});
/**
 * @route   POST /api/casenumber/case-data
 * @desc    Step 4: Submit the form and get the case data.
 */
router.post('/case-data', async (req, res) => {
    console.log('--- /api/casenumber/case-data Request Received ---');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const {
        districtBaseUrl, cookies, estCode, caseType,
        regNo, regYear, scid, appTokenName, appTokenValue, captchaValue
    } = req.body;

    if (!districtBaseUrl || !cookies || !estCode || !caseType || !regNo || !regYear || !scid || !appTokenName || !appTokenValue || !captchaValue) {
        console.error('Validation Error: Missing required parameters for case data search.');
        return res.status(400).json({ error: 'Missing required parameters for case data search' });
    }

    const properDistrictBaseUrl = districtBaseUrl.endsWith('/') ? districtBaseUrl : `${districtBaseUrl}/`;
    const ajaxUrl = `${properDistrictBaseUrl}wp-admin/admin-ajax.php`;
    const origin = properDistrictBaseUrl.slice(0, -1);

    const formData = new URLSearchParams();
    formData.append('service_type', 'courtComplex');
    formData.append('est_code', estCode);
    formData.append('case_type', caseType);
    formData.append('reg_no', regNo);
    formData.append('reg_year', regYear);
    formData.append('scid', scid);
    formData.append(appTokenName, appTokenValue);
    formData.append('siwp_captcha_value', captchaValue);
    formData.append('es_ajax_request', '1');
    formData.append('submit', 'Search');
    formData.append('action', 'get_cases');

    console.log('Outbound API URL (Case Data):', ajaxUrl);
    console.log('Outbound Request Headers (Ajax):', getAjaxHeaders(cookies, origin));
    console.log('Outbound Request FormData (Case Data):', formData.toString());

    try {
        const response = await axios.post(ajaxUrl, formData.toString(), {
            headers: getAjaxHeaders(cookies, origin)
        });
        console.log('External API Response Status (Case Data):', response.status);
        console.log('External API Response Headers (Set-Cookie):', response.headers['set-cookie'] || 'None');

        const externalApiResponse = response.data;
        console.log('Raw External API Response Data (Case Data):', JSON.stringify(externalApiResponse, null, 2));
        const setCookies = response.headers['set-cookie'] || [];

        if (externalApiResponse.success && typeof externalApiResponse.data === 'string') {
            console.log('External API response indicates success. Attempting to parse HTML...');
            const $ = cheerio.load(externalApiResponse.data);
            const cases = [];

            const tableRows = $('table.data-table-1 tbody tr');
            console.log(`Found ${tableRows.length} table rows for case data.`);

            if (tableRows.length === 0) {
                console.log('No case data rows found in the parsed HTML.');
            }

            tableRows.each((index, element) => {
                const viewButton = $(element).find('td:nth-child(5) a.viewCnrDetails');
                const caseData = {
                    serialNumber: $(element).find('td:nth-child(1)').text().trim(),
                    caseTypeNumberYear: $(element).find('td:nth-child(2)').text().trim(),
                    filingNumber: $(element).find('td:nth-child(3)').text().trim(),
                    petitionerRespondent: $(element).find('td:nth-child(4)').html()?.replace(/<br\s*\/?>/gi, ' | ').trim(),
                    viewDetails: {
                        url: viewButton.attr('href'),
                        caseNumberOnly: viewButton.attr('data-cno')
                    }
                };
                cases.push(caseData);
            });

            console.log(`Successfully parsed ${cases.length} cases.`);
            res.json({
                success: true,
                parsedCases: cases,
                setCookies
            });
            console.log('Response sent for /case-data.');
        } else if (externalApiResponse.success === false) {
             console.error('External API response (case data) indicates failure, "success: false". Data:', externalApiResponse.data);
             res.status(400).json({
                 error: externalApiResponse.data,
                 setCookies
             });
        } else {
            console.error('External API response (case data) was not successful or data format was unexpected. Full response:', JSON.stringify(externalApiResponse, null, 2));
            res.status(500).json({
                error: 'External API response was not successful or data format was unexpected.',
                externalResponse: externalApiResponse,
                setCookies
            });
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Axios Error in /case-data:');
            console.error('Error Message:', error.message);
            if (error.response) {
                console.error('Response Status:', error.response.status);
                console.error('Response Data:', error.response.data?.substring(0, 500) + '...');
                console.error('Response Headers:', error.response.headers);
            } else if (error.request) {
                console.error('No response received (request made but no response)');
            } else {
                console.error('Error setting up request:', error.config);
            }
        } else {
            console.error('General Error in /case-data:', error.message);
        }
        res.status(500).json({ error: 'Failed to fetch or parse case data', details: error.message });
    }
});

// ... (The /refresh-captcha and /case-details-by-cino routes can remain as they were, just ensure they use the new header functions if you decide to keep them) ...


module.exports = router;