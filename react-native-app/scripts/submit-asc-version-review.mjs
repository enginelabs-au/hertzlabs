#!/usr/bin/env node
/**
 * Link a processed ASC build to an app store version and submit for review.
 *
 * Usage:
 *   node scripts/submit-asc-version-review.mjs --platform IOS --version 2.3 --build 23
 *   node scripts/submit-asc-version-review.mjs --platform MAC_OS --version 2.3 --build 23
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {parseEnv} from './lib/parse-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const APP_ID = '6777604364';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--platform') out.platform = argv[++i];
    else if (arg === '--version') out.versionString = argv[++i];
    else if (arg === '--build') out.buildNumber = argv[++i];
  }
  return out;
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function makeJwt({issuer, keyId, pem}) {
  const header = {alg: 'ES256', kid: keyId, typ: 'JWT'};
  const now = Math.floor(Date.now() / 1000);
  const payload = {iss: issuer, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1'};
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sign = crypto.createSign('SHA256');
  sign.update(unsigned);
  sign.end();
  const signature = sign.sign({key: crypto.createPrivateKey(pem), dsaEncoding: 'ieee-p1363'});
  return `${unsigned}.${b64url(signature)}`;
}

async function asc(token, method, route, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = {raw: text};
  }
  return {status: res.status, json, text};
}

async function ascGetAll(token, route) {
  const rows = [];
  let next = route.includes('?') ? route : `${route}?limit=200`;
  while (next) {
    const {status, json} = await asc(token, 'GET', next);
    if (status >= 300) {
      throw new Error(`ASC GET ${next} failed (${status}): ${JSON.stringify(json)}`);
    }
    rows.push(...(json.data ?? []));
    next = json.links?.next
      ? json.links.next.replace('https://api.appstoreconnect.apple.com', '')
      : null;
  }
  return rows;
}

function platformForBuild(attrs) {
  const iconUrl = attrs?.iconAssetToken?.templateUrl ?? '';
  if (iconUrl.includes('.icns')) {
    return 'MAC_OS';
  }
  return 'IOS';
}

async function waitForValidBuild(token, buildNumber, platform, maxAttempts = 60) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const builds = await ascGetAll(
      token,
      `/v1/builds?filter[app]=${APP_ID}&filter[version]=${encodeURIComponent(buildNumber)}&sort=-uploadedDate`,
    );
    const match = builds.find(
      b =>
        String(b.attributes?.version) === String(buildNumber) &&
        platformForBuild(b.attributes) === platform,
    );
    if (match) {
      const state = match.attributes?.processingState;
      console.log(`Build ${buildNumber} (${platform}): processingState=${state} id=${match.id}`);
      if (state === 'VALID') return match;
      if (state === 'FAILED' || state === 'INVALID') {
        throw new Error(`Build ${buildNumber} ${platform} is ${state}`);
      }
    } else {
      console.log(`Attempt ${attempt}/${maxAttempts}: build ${buildNumber} (${platform}) not found yet`);
    }
    await new Promise(r => setTimeout(r, 30_000));
  }
  throw new Error(`Timed out waiting for VALID build ${buildNumber} (${platform})`);
}

async function findOrCreateVersion(token, versionString, platform) {
  const versions = await ascGetAll(token, `/v1/apps/${APP_ID}/appStoreVersions`);
  const existing = versions.find(
    v => v.attributes?.versionString === versionString && v.attributes?.platform === platform,
  );
  if (existing) {
    console.log(`Using existing version ${versionString} (${platform}): ${existing.id} state=${existing.attributes?.appStoreState}`);
    return existing;
  }
  const {status, json} = await asc(token, 'POST', '/v1/appStoreVersions', {
    data: {
      type: 'appStoreVersions',
      attributes: {platform, versionString},
      relationships: {app: {data: {type: 'apps', id: APP_ID}}},
    },
  });
  if (status >= 300) {
    throw new Error(`Create version failed (${status}): ${JSON.stringify(json)}`);
  }
  console.log(`Created version ${versionString} (${platform}): ${json.data.id}`);
  return json.data;
}

async function linkBuildToVersion(token, versionId, buildId) {
  const current = await asc(token, 'GET', `/v1/appStoreVersions/${versionId}/relationships/build`);
  const currentId = current.json?.data?.id;
  if (current.status < 300 && currentId === buildId) {
    console.log(`Build ${buildId} already linked to version ${versionId}`);
    return;
  }
  const {status, json} = await asc(token, 'PATCH', `/v1/appStoreVersions/${versionId}/relationships/build`, {
    data: {type: 'builds', id: buildId},
  });
  if (status >= 300) {
    // ASC sometimes 500s on a no-op re-link; confirm whether the desired build is attached.
    const again = await asc(token, 'GET', `/v1/appStoreVersions/${versionId}/relationships/build`);
    if (again.status < 300 && again.json?.data?.id === buildId) {
      console.warn(`Link build returned ${status} but build ${buildId} is attached; continuing`);
      return;
    }
    throw new Error(`Link build failed (${status}): ${JSON.stringify(json)}`);
  }
  console.log(`Linked build ${buildId} to version ${versionId}`);
}

/** List ageRatingDeclaration candidates tied to this app / version. */
async function listAgeRatingCandidates(token, versionId) {
  const candidates = [];
  const versionAge = await asc(token, 'GET', `/v1/appStoreVersions/${versionId}/ageRatingDeclaration`);
  if (versionAge.status < 300 && versionAge.json?.data?.id) {
    candidates.push({
      id: versionAge.json.data.id,
      socialMedia: versionAge.json.data.attributes?.socialMedia ?? null,
      source: 'version',
      state: 'version',
    });
  }

  const appInfos = await ascGetAll(token, `/v1/apps/${APP_ID}/appInfos`);
  for (const info of appInfos) {
    const state = String(
      info.attributes?.appStoreState ?? info.attributes?.state ?? info.attributes?.appStoreAgeRating ?? '—',
    );
    const age = await asc(token, 'GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
    console.log(
      `ageRating via appInfo ${info.id} state=${state} -> ${age.status}` +
        (age.status < 300
          ? ` id=${age.json?.data?.id} socialMedia=${JSON.stringify(age.json?.data?.attributes?.socialMedia)}`
          : ''),
    );
    if (age.status < 300 && age.json?.data?.id) {
      candidates.push({
        id: age.json.data.id,
        socialMedia: age.json.data.attributes?.socialMedia ?? null,
        source: 'appInfo',
        appInfoId: info.id,
        state,
      });
    }
  }
  return candidates;
}

async function ensureSocialMediaFalse(token, versionId) {
  const candidates = await listAgeRatingCandidates(token, versionId);
  if (candidates.length === 0) {
    throw new Error(`No ageRatingDeclaration found for version ${versionId}`);
  }

  const already = candidates.find(c => c.socialMedia === false || c.socialMedia === true);
  // Still patch when null; if already boolean, we're done for that declaration —
  // but review may be checking a different declaration, so try patching nulls first.
  const ordered = [
    ...candidates.filter(c => c.socialMedia == null && /PREPARE|READY_FOR_REVIEW|DEVELOPER|REJECTED|METADATA/i.test(c.state)),
    ...candidates.filter(c => c.socialMedia == null),
    ...candidates.filter(c => c.socialMedia != null && /PREPARE|READY_FOR_REVIEW|DEVELOPER|REJECTED|METADATA/i.test(c.state)),
    ...candidates,
  ].filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);

  const errors = [];
  for (const candidate of ordered) {
    if (candidate.socialMedia === false) {
      console.log(`ageRatingDeclaration ${candidate.id} already socialMedia=false (${candidate.source}/${candidate.state})`);
      return candidate;
    }
    const patch = await asc(token, 'PATCH', `/v1/ageRatingDeclarations/${candidate.id}`, {
      data: {
        type: 'ageRatingDeclarations',
        id: candidate.id,
        attributes: {socialMedia: false},
      },
    });
    if (patch.status < 300) {
      console.log(
        `Set ageRatingDeclaration.socialMedia=false for ${candidate.id} (${candidate.source}/${candidate.state})`,
      );
      return candidate;
    }
    const detail = JSON.stringify(patch.json);
    console.warn(`ageRating patch ${candidate.id} failed (${patch.status}): ${detail}`);
    errors.push(`${candidate.id}:${patch.status}`);
  }

  if (already && already.socialMedia != null) {
    console.log(
      `Leaving existing socialMedia=${already.socialMedia} on ${already.id}; patches failed: ${errors.join(',')}`,
    );
    return already;
  }
  throw new Error(`Set ageRating socialMedia failed for all candidates: ${errors.join('; ')}`);
}

/** Fill fields ASC now requires before a new version can enter review. */
async function prepareVersionForReview(token, versionId, platform) {
  await ensureSocialMediaFalse(token, versionId);
  await ensureVersionLocalizations(token, versionId);

  if (platform !== 'IOS') {
    return;
  }

  await ensureAppClipDefaultExperience(token, versionId);
}

async function experienceIsComplete(token, experienceId) {
  const detail = await asc(
    token,
    'GET',
    `/v1/appClipDefaultExperiences/${experienceId}?include=appClipDefaultExperienceLocalizations`,
  );
  if (detail.status >= 300) return false;
  if (detail.json?.data?.attributes?.action == null) return false;
  const locs = await ascGetAll(
    token,
    `/v1/appClipDefaultExperiences/${experienceId}/appClipDefaultExperienceLocalizations`,
  );
  if (locs.length === 0) return false;
  for (const loc of locs) {
    const header = await asc(
      token,
      'GET',
      `/v1/appClipDefaultExperienceLocalizations/${loc.id}/appClipHeaderImage`,
    );
    const state = header.json?.data?.attributes?.assetDeliveryState?.state;
    if (header.status >= 300 || state !== 'COMPLETE') {
      return false;
    }
  }
  return true;
}

async function ensureAppClipDefaultExperience(token, versionId) {
  const clips = await ascGetAll(token, `/v1/apps/${APP_ID}/appClips`);
  console.log(`App Clips found: ${clips.length} ${clips.map(c => c.id).join(',')}`);
  if (clips.length === 0) {
    throw new Error(
      'ASC requires appClipDefaultExperience but this app has no App Clips; clear the App Clip requirement in App Store Connect or add a default experience',
    );
  }

  const existing = await asc(
    token,
    'GET',
    `/v1/appStoreVersions/${versionId}/relationships/appClipDefaultExperience`,
  );
  console.log(
    `Current appClipDefaultExperience: status=${existing.status} data=${JSON.stringify(existing.json?.data ?? null)}`,
  );

  for (const clip of clips) {
    const experiences = await ascGetAll(
      token,
      `/v1/appClips/${clip.id}/appClipDefaultExperiences?limit=50`,
    );
    console.log(
      `Clip ${clip.id} default experiences: ${experiences.length} ` +
        experiences
          .map(e => `${e.id}(action=${e.attributes?.action ?? 'null'})`)
          .join(', '),
    );

    // Prefer a previously completed experience (has action + header images).
    let complete = null;
    for (const exp of experiences) {
      if (await experienceIsComplete(token, exp.id)) {
        complete = exp;
        console.log(`Found complete App Clip experience ${exp.id}`);
        break;
      }
    }
    if (complete == null) {
      throw new Error(`No complete App Clip default experience found for clip ${clip.id}`);
    }

    const currentId = existing.status < 300 ? existing.json?.data?.id : null;
    if (currentId) {
      console.log(`Completing linked App Clip experience ${currentId}`);
      // Ensure action is set on the linked experience.
      const cur = await asc(token, 'GET', `/v1/appClipDefaultExperiences/${currentId}`);
      if (cur.json?.data?.attributes?.action == null) {
        await asc(token, 'PATCH', `/v1/appClipDefaultExperiences/${currentId}`, {
          data: {
            type: 'appClipDefaultExperiences',
            id: currentId,
            attributes: {action: complete.attributes?.action ?? 'PLAY'},
          },
        });
      }
      await cloneAppClipExperienceContent(token, complete.id, currentId);
      return;
    }

    // Create a new experience for this version, then clone header images from a complete template.
    const create = await asc(token, 'POST', '/v1/appClipDefaultExperiences', {
      data: {
        type: 'appClipDefaultExperiences',
        attributes: {action: complete.attributes?.action ?? 'PLAY'},
        relationships: {
          appClip: {data: {type: 'appClips', id: clip.id}},
          releaseWithAppStoreVersion: {data: {type: 'appStoreVersions', id: versionId}},
        },
      },
    });
    if (create.status >= 300) {
      throw new Error(
        `Create App Clip experience failed (${create.status}): ${JSON.stringify(create.json)}`,
      );
    }
    const newId = create.json.data.id;
    console.log(`Created App Clip experience ${newId} for version ${versionId}`);
    await cloneAppClipExperienceContent(token, complete.id, newId);
    console.log(`App Clip experience ${newId} ready`);
    return;
  }
}

async function downloadAppClipHeaderBytes(token, localizationId) {
  const header = await asc(
    token,
    'GET',
    `/v1/appClipDefaultExperienceLocalizations/${localizationId}/appClipHeaderImage`,
  );
  const asset = header.json?.data?.attributes?.imageAsset;
  if (!asset?.templateUrl || !asset?.width || !asset?.height) {
    throw new Error(`App Clip header image missing for localization ${localizationId}`);
  }
  const url = asset.templateUrl
    .replace('{w}', String(asset.width))
    .replace('{h}', String(asset.height))
    .replace('{f}', 'png');
  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    throw new Error(`Download App Clip header failed (${imgRes.status})`);
  }
  return Buffer.from(await imgRes.arrayBuffer());
}

async function uploadAppClipHeader(token, localizationId, locale, bytes) {
  const existing = await asc(
    token,
    'GET',
    `/v1/appClipDefaultExperienceLocalizations/${localizationId}/appClipHeaderImage`,
  );
  const state = existing.json?.data?.attributes?.assetDeliveryState?.state;
  if (existing.status < 300 && state === 'COMPLETE') {
    console.log(`App Clip header already present for ${locale}`);
    return;
  }
  if (existing.status < 300 && state === 'UPLOAD_COMPLETE') {
    console.log(`App Clip header upload complete for ${locale}; waiting for processing`);
    for (let attempt = 1; attempt <= 24; attempt++) {
      await new Promise(r => setTimeout(r, 5_000));
      const check = await asc(
        token,
        'GET',
        `/v1/appClipDefaultExperienceLocalizations/${localizationId}/appClipHeaderImage`,
      );
      const next = check.json?.data?.attributes?.assetDeliveryState?.state;
      console.log(`App Clip header ${locale} state=${next} (wait ${attempt})`);
      if (next === 'COMPLETE') return;
      if (next === 'FAILED') {
        throw new Error(`App Clip header ${locale} processing failed`);
      }
    }
  }

  const reserve = await asc(token, 'POST', '/v1/appClipHeaderImages', {
    data: {
      type: 'appClipHeaderImages',
      attributes: {fileName: `appclip-${locale}.png`, fileSize: bytes.length},
      relationships: {
        appClipDefaultExperienceLocalization: {
          data: {type: 'appClipDefaultExperienceLocalizations', id: localizationId},
        },
      },
    },
  });
  if (reserve.status >= 300) {
    throw new Error(
      `Reserve App Clip header ${locale} failed (${reserve.status}): ${JSON.stringify(reserve.json)}`,
    );
  }
  const imageId = reserve.json.data.id;
  const op = reserve.json.data.attributes?.uploadOperations?.[0];
  if (!op?.url) {
    throw new Error(`No upload URL for App Clip header ${locale}`);
  }
  const uploadRes = await fetch(op.url, {
    method: op.method ?? 'PUT',
    headers: Object.fromEntries((op.requestHeaders ?? []).map(h => [h.name, h.value])),
    body: bytes,
  });
  if (!uploadRes.ok) {
    throw new Error(`Upload App Clip header ${locale} failed (${uploadRes.status})`);
  }
  const commit = await asc(token, 'PATCH', `/v1/appClipHeaderImages/${imageId}`, {
    data: {
      type: 'appClipHeaderImages',
      id: imageId,
      attributes: {uploaded: true},
    },
  });
  if (commit.status >= 300) {
    throw new Error(
      `Commit App Clip header ${locale} failed (${commit.status}): ${JSON.stringify(commit.json)}`,
    );
  }
  for (let attempt = 1; attempt <= 12; attempt++) {
    const check = await asc(
      token,
      'GET',
      `/v1/appClipDefaultExperienceLocalizations/${localizationId}/appClipHeaderImage`,
    );
    const state = check.json?.data?.attributes?.assetDeliveryState?.state;
    console.log(`App Clip header ${locale} state=${state} (attempt ${attempt})`);
    if (state === 'COMPLETE') return;
    if (state === 'FAILED') {
      throw new Error(`App Clip header ${locale} processing failed`);
    }
    await new Promise(r => setTimeout(r, 5_000));
  }
  throw new Error(`App Clip header ${locale} did not become COMPLETE in time`);
}

async function cloneAppClipExperienceContent(token, fromExperienceId, toExperienceId) {
  const sourceLocs = await ascGetAll(
    token,
    `/v1/appClipDefaultExperiences/${fromExperienceId}/appClipDefaultExperienceLocalizations`,
  );
  if (sourceLocs.length === 0) {
    throw new Error(`Template App Clip experience ${fromExperienceId} has no localizations`);
  }
  const templateLoc = sourceLocs.find(l => l.attributes?.locale === 'en-AU') ?? sourceLocs[0];
  const templateBytes = await downloadAppClipHeaderBytes(token, templateLoc.id);
  const subtitle = templateLoc.attributes?.subtitle ?? 'Open Hertz Labs';

  const locales = new Set([
    ...sourceLocs.map(l => l.attributes?.locale).filter(Boolean),
    'en-AU',
    'en-US',
  ]);

  const destLocs = await ascGetAll(
    token,
    `/v1/appClipDefaultExperiences/${toExperienceId}/appClipDefaultExperienceLocalizations`,
  );
  const destByLocale = Object.fromEntries(destLocs.map(l => [l.attributes?.locale, l]));

  for (const locale of locales) {
    let destLoc = destByLocale[locale];
    if (!destLoc) {
      const created = await asc(token, 'POST', '/v1/appClipDefaultExperienceLocalizations', {
        data: {
          type: 'appClipDefaultExperienceLocalizations',
          attributes: {locale, subtitle},
          relationships: {
            appClipDefaultExperience: {
              data: {type: 'appClipDefaultExperiences', id: toExperienceId},
            },
          },
        },
      });
      if (created.status >= 300) {
        throw new Error(
          `Create App Clip localization ${locale} failed (${created.status}): ${JSON.stringify(created.json)}`,
        );
      }
      destLoc = created.json.data;
      console.log(`Created App Clip localization ${locale} on ${toExperienceId}`);
    }

    const sourceForLocale = sourceLocs.find(l => l.attributes?.locale === locale) ?? templateLoc;
    const bytes =
      sourceForLocale.id === templateLoc.id
        ? templateBytes
        : await downloadAppClipHeaderBytes(token, sourceForLocale.id);
    await uploadAppClipHeader(token, destLoc.id, locale, bytes);
  }
}

async function ensureVersionLocalizations(token, versionId) {
  const locs = await ascGetAll(
    token,
    `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
  );
  const byLocale = Object.fromEntries(locs.map(l => [l.attributes?.locale, l]));
  console.log(`Version localizations: ${Object.keys(byLocale).join(', ') || '(none)'}`);

  const template = byLocale['en-AU'] ?? byLocale['en-US'] ?? locs[0];
  if (!template) {
    throw new Error(`No appStoreVersionLocalizations on version ${versionId}`);
  }

  for (const locale of ['en-US', 'en-AU']) {
    if (byLocale[locale]) continue;
    const attrs = {
      locale,
      description: template.attributes?.description ?? '',
      keywords: template.attributes?.keywords ?? '',
      marketingUrl: template.attributes?.marketingUrl ?? undefined,
      promotionalText: template.attributes?.promotionalText ?? undefined,
      supportUrl: template.attributes?.supportUrl ?? undefined,
      whatsNew: template.attributes?.whatsNew ?? undefined,
    };
    // Drop undefined keys.
    for (const key of Object.keys(attrs)) {
      if (attrs[key] == null) delete attrs[key];
    }
    const create = await asc(token, 'POST', '/v1/appStoreVersionLocalizations', {
      data: {
        type: 'appStoreVersionLocalizations',
        attributes: attrs,
        relationships: {
          appStoreVersion: {data: {type: 'appStoreVersions', id: versionId}},
        },
      },
    });
    if (create.status >= 300) {
      const detail = JSON.stringify(create.json);
      if (/submitted for review/i.test(detail)) {
        console.warn(`Skip localization ${locale}: version already submitted`);
        continue;
      }
      throw new Error(`Create version localization ${locale} failed (${create.status}): ${detail}`);
    }
    console.log(`Created appStoreVersionLocalization ${locale}`);
  }
}

async function listReviewSubmissions(token, platform) {
  // Platform filter is best-effort; some tenants ignore it and return all.
  try {
    return await ascGetAll(
      token,
      `/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[platform]=${platform}`,
    );
  } catch {
    return await ascGetAll(token, `/v1/reviewSubmissions?filter[app]=${APP_ID}`);
  }
}

async function cancelStaleReviewSubmissions(token, platform, keepIds = new Set()) {
  const all = await listReviewSubmissions(token, platform);
  for (const sub of all) {
    if (keepIds.has(sub.id)) continue;
    const state = sub.attributes?.state;
    const subPlatform = sub.attributes?.platform;
    if (subPlatform && subPlatform !== platform && subPlatform !== 'ANY') continue;
    // Cancel empty / unsubmitted drafts that block the concurrency quota.
    if (!['READY_FOR_REVIEW', 'UNRESOLVED'].includes(state)) continue;
    const cancel = await asc(token, 'PATCH', `/v1/reviewSubmissions/${sub.id}`, {
      data: {
        type: 'reviewSubmissions',
        id: sub.id,
        attributes: {canceled: true},
      },
    });
    if (cancel.status >= 300) {
      console.warn(
        `Could not cancel review submission ${sub.id} (${state}): ${cancel.status} ${JSON.stringify(cancel.json)}`,
      );
    } else {
      console.log(`Canceled stale review submission ${sub.id} (was ${state})`);
    }
  }
}

async function addVersionToSubmission(token, submissionId, versionId) {
  const items = await ascGetAll(token, `/v1/reviewSubmissions/${submissionId}/items`);
  const already = items.some(
    item => item.relationships?.appStoreVersion?.data?.id === versionId,
  );
  if (already) {
    console.log(`Version ${versionId} already on submission ${submissionId}`);
    return;
  }
  const item = await asc(token, 'POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: {data: {type: 'reviewSubmissions', id: submissionId}},
        appStoreVersion: {data: {type: 'appStoreVersions', id: versionId}},
      },
    },
  });
  if (item.status >= 300) {
    throw new Error(`Add review item failed (${item.status}): ${JSON.stringify(item.json)}`);
  }
  console.log(`Added version ${versionId} to submission ${submissionId}`);
}

async function finalizeSubmission(token, submissionId, platform) {
  const submit = await asc(token, 'PATCH', `/v1/reviewSubmissions/${submissionId}`, {
    data: {
      type: 'reviewSubmissions',
      id: submissionId,
      attributes: {submitted: true},
    },
  });
  if (submit.status >= 300) {
    throw new Error(`submitForReview failed (${submit.status}): ${JSON.stringify(submit.json)}`);
  }
  console.log(
    `Submitted ${platform} version for review: submission=${submissionId} state=${submit.json?.data?.attributes?.state ?? '—'}`,
  );
  return submit.json?.data;
}

async function submitVersionForReview(token, versionId, platform) {
  const open = await listReviewSubmissions(token, platform);
  for (const sub of open) {
    console.log(
      `Existing submission ${sub.id} platform=${sub.attributes?.platform} state=${sub.attributes?.state}`,
    );
  }

  for (const sub of open) {
    const state = sub.attributes?.state;
    const subPlatform = sub.attributes?.platform;
    if (subPlatform && subPlatform !== platform && subPlatform !== 'ANY') continue;
    if (state === 'WAITING_FOR_REVIEW' || state === 'IN_REVIEW') {
      console.log(`Review submission already active for ${platform}: ${sub.id} state=${state}`);
      return sub;
    }
  }

  // Prefer reusing a READY_FOR_REVIEW draft (orphans count against the 5-slot quota).
  const draft = open.find(sub => {
    const state = sub.attributes?.state;
    const subPlatform = sub.attributes?.platform;
    if (state !== 'READY_FOR_REVIEW' && state !== 'UNRESOLVED_ISSUES') return false;
    if (subPlatform && subPlatform !== platform && subPlatform !== 'ANY') return false;
    return true;
  });
  if (draft) {
    console.log(`Reusing draft review submission ${draft.id} state=${draft.attributes?.state}`);
    await addVersionToSubmission(token, draft.id, versionId);
    return finalizeSubmission(token, draft.id, platform);
  }

  await cancelStaleReviewSubmissions(token, platform);

  const create = await asc(token, 'POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: {platform},
      relationships: {app: {data: {type: 'apps', id: APP_ID}}},
    },
  });
  if (create.status >= 300) {
    throw new Error(`Create review submission failed (${create.status}): ${JSON.stringify(create.json)}`);
  }
  const submissionId = create.json.data.id;
  console.log(`Created review submission ${submissionId}`);
  await addVersionToSubmission(token, submissionId, versionId);
  return finalizeSubmission(token, submissionId, platform);
}

async function main() {
  const {platform, versionString, buildNumber} = parseArgs(process.argv);
  if (!platform || !versionString || !buildNumber) {
    console.error('Usage: node scripts/submit-asc-version-review.mjs --platform IOS|MAC_OS --version 2.3 --build 23');
    process.exit(1);
  }

  const env = parseEnv(envPath);
  const keyId = (env.APPLE_CONNECT_KEY_ID || 'S6FZD2L3R5').trim();
  const issuer = (env.APPLE_CONNECT_ISSUER_ID || '').trim();
  const keyPath = path.join(__dirname, '..', '.secrets', `AuthKey_${keyId}.p8`);
  if (!issuer || !fs.existsSync(keyPath)) {
    console.error('Missing APPLE_CONNECT_ISSUER_ID or .secrets/AuthKey_*.p8');
    process.exit(1);
  }
  const pem = fs.readFileSync(keyPath, 'utf8');
  const token = makeJwt({
    issuer,
    keyId,
    pem,
  });

  console.log(`=== Submit ASC review: ${platform} v${versionString} build ${buildNumber} ===`);
  const build = await waitForValidBuild(token, buildNumber, platform);
  const version = await findOrCreateVersion(token, versionString, platform);
  await linkBuildToVersion(token, version.id, build.id);
  await asc(token, 'PATCH', `/v1/builds/${build.id}`, {
    data: {type: 'builds', id: build.id, attributes: {usesNonExemptEncryption: false}},
  });
  await prepareVersionForReview(token, version.id, platform);
  await submitVersionForReview(token, version.id, platform);
  console.log('OK');
}

main().catch(err => {
  console.error(err.message ?? err);
  process.exit(1);
});
