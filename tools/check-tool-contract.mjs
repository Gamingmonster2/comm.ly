/** Verify that generated engine pages contain every DOM node required by the interactive tools. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let failures = 0;

function check(label, ok, detail = '') {
  if (ok) console.log(`✔ ${label}`);
  else {
    failures += 1;
    console.log(`✖ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const contracts = {
  n3: {
    script: 'qr-tool.js',
    ids: ['qrTool', 'qrInput', 'qrShortenFirst', 'qrSize', 'qrLevel', 'qrFg', 'qrBg', 'qrGenerate', 'qrError', 'qrPreview', 'qrActions', 'qrResultUrl', 'qrDownloadPng', 'qrDownloadSvg', 'qrCopy']
  },
  n4: {
    script: 'utm-tool.js',
    ids: ['utmTool', 'utmUrl', 'utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent', 'utmShorten', 'utmGenerate', 'utmError', 'utmResult', 'utmFullUrl', 'utmShortUrl', 'utmCopyFull', 'utmCopyShort', 'utmOpen', 'utmCode', 'utmMeta']
  },
  n6: {
    script: 'bulk-tool.js',
    ids: ['bulkTool', 'bulkInput', 'bulkExpiry', 'bulkShorten', 'bulkError', 'bulkProgress', 'bulkResults', 'bulkTotal', 'bulkDone', 'bulkFailed', 'bulkRows', 'bulkCopyAll', 'bulkDownloadCsv', 'bulkReset']
  },
  n7: {
    script: 'api-playground.js',
    ids: ['apiTool', 'apiEndpoint', 'apiMethod', 'apiQuery', 'apiBody', 'apiLang', 'apiRun', 'apiError', 'apiStatus', 'apiTime', 'apiResponse', 'apiSnippet', 'apiCopySnippet', 'apiCopyResponse']
  },
  n8: {
    script: 'lookup-tool.js',
    ids: ['lookupTool', 'lookupInput', 'lookupButton', 'lookupError', 'lookupResult', 'lookupDestination', 'lookupHost', 'lookupCode', 'lookupStatus', 'lookupExpiry', 'lookupSource', 'signalHttps', 'signalNetwork', 'signalActive', 'signalKnownShortener', 'lookupOpen', 'lookupCopy', 'lookupShorten']
  },
  n9: {
    script: 'bio-tool.js',
    ids: ['bioTool', 'bioName', 'bioHandle', 'bioBio', 'bioTheme', 'bioAvatar', 'bioLinks', 'bioAddLink', 'bioPublish', 'bioPreview', 'bioError', 'bioResult', 'bioShortUrl', 'bioCopyUrl', 'bioOpenUrl', 'bioSlug']
  }
};

for (const [site, contract] of Object.entries(contracts)) {
  const html = await readFile(path.join(root, 'dist', site, 'index.html'), 'utf8');
  check(`${site}: tool script included`, html.includes(`/assets/${contract.script}`));
  for (const id of contract.ids) {
    const occurrences = (html.match(new RegExp(`id="${id}"`, 'g')) || []).length;
    check(`${site}: #${id} present exactly once`, occurrences === 1, `found ${occurrences}`);
  }
}

console.log(failures === 0 ? '\nALL TOOL CONTRACTS PASSED' : `\n${failures} CONTRACT CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
