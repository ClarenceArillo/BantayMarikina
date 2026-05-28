const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-marikina';
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const BASE = `http://${HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const DOC_PREFIX = `projects/${PROJECT_ID}/databases/(default)/documents`;

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function token(uid, role = 'resident') {
  const now = Math.floor(Date.now() / 1000);
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
    aud: PROJECT_ID,
    auth_time: now,
    exp: now + 3600,
    firebase: { sign_in_provider: 'password' },
    iat: now,
    role,
    sub: uid,
    user_id: uid,
  })}.`;
}

function fields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => {
    if (typeof value === 'number') {
      return [key, Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }];
    }
    if (value === null) return [key, { nullValue: null }];
    if (Array.isArray(value)) return [key, { arrayValue: { values: value.map((item) => fields({ item }).item) } }];
    if (typeof value === 'object') return [key, { mapValue: { fields: fields(value) } }];
    return [key, { stringValue: String(value) }];
  }));
}

async function request(method, path, uid, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token(uid)}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

async function commit(uid, writes) {
  return request('POST', ':commit', uid, { writes });
}

function setWrite(path, data, serverTimestampFields = []) {
  return {
    update: {
      name: `${DOC_PREFIX}${path}`,
      fields: fields(data),
    },
    updateTransforms: serverTimestampFields.map((fieldPath) => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME',
    })),
  };
}

async function expect(label, promise, shouldPass = true) {
  const result = await promise;
  const passed = shouldPass ? result.ok : !result.ok;
  if (!passed) {
    throw new Error(`${label} expected ${shouldPass ? 'success' : 'failure'} but got ${result.status}: ${result.text}`);
  }
  console.log(`${shouldPass ? 'PASS' : 'PASS denied'} ${label}`);
}

async function main() {
  const reportId = `perm_${Date.now()}`;
  const mismatchReportId = `${reportId}_mismatch`;
  const reportPath = `/Reports/${reportId}`;
  const mismatchReportPath = `/Reports/${mismatchReportId}`;
  const owner = 'owner-user';
  const staleOwner = 'stale-owner';
  const other = 'other-user';

  await expect('stale session identity is denied by report rules', commit(owner, [
    setWrite(mismatchReportPath, {
      title: 'High Flood',
      hazardType: 'Flood',
      hazard_type: 'Flood',
      description: 'This write intentionally uses a mismatched caller identity.',
      latitude: 14.63,
      longitude: 121.1,
      accuracyMeters: 8,
      severity: 'High',
      barangay: 'Concepcion Uno',
      userId: staleOwner,
      sender_id: staleOwner,
      reporterName: 'Stale User',
      reporterPhotoUrl: '',
      reporter_photo_url: '',
      imageUrl: null,
      image_url: null,
      media: [],
      capturedAtLabel: '',
      source: 'community',
      moderationStatus: 'visible',
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      userReportCount: 0,
      status: 'active',
    }, ['timestamp', 'createdAt', 'updatedAt']),
    setWrite(`/ReportSubmissionGuards/${staleOwner}`, {
      lastReportId: mismatchReportId,
      userId: staleOwner,
    }, ['lastSubmittedAt', 'updatedAt']),
  ]), false);

  await expect('owner can create report with guard', commit(owner, [
    setWrite(reportPath, {
      title: 'High Flood',
      hazardType: 'Flood',
      hazard_type: 'Flood',
      description: 'Flood water is rising near the street.',
      latitude: 14.63,
      longitude: 121.1,
      accuracyMeters: 8,
      severity: 'High',
      barangay: 'Concepcion Uno',
      userId: owner,
      sender_id: owner,
      reporterName: 'Owner User',
      reporterPhotoUrl: '',
      reporter_photo_url: '',
      imageUrl: null,
      image_url: null,
      media: [],
      capturedAtLabel: '',
      source: 'community',
      moderationStatus: 'visible',
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      userReportCount: 0,
      status: 'active',
    }, ['timestamp', 'createdAt', 'updatedAt']),
    setWrite(`/ReportSubmissionGuards/${owner}`, {
      lastReportId: reportId,
      userId: owner,
    }, ['lastSubmittedAt', 'updatedAt']),
  ]));

  await expect('non-owner cannot delete report', request('DELETE', reportPath, other), false);
  await expect('other user can like report', commit(other, [
    setWrite(`${reportPath}/likes/${other}`, { userId: other }, ['createdAt']),
  ]));
  await expect('other user can view report', commit(other, [
    setWrite(`${reportPath}/userViews/${other}`, { userId: other }, ['createdAt']),
  ]));
  await expect('other user can comment with guard', commit(other, [
    setWrite(`${reportPath}/comments/comment1`, {
      userId: other,
      userName: 'Other User',
      userPhotoUrl: '',
      body: 'Thanks for the update.',
    }, ['createdAt']),
    setWrite(`/CommentSubmissionGuards/${other}`, {
      lastCommentId: 'comment1',
      reportId,
      userId: other,
    }, ['lastSubmittedAt', 'updatedAt']),
  ]));
  await expect('owner cannot flag own report', commit(owner, [
    setWrite(`${reportPath}/userReports/${owner}`, {
      userId: owner,
      category: 'spam',
      note: '',
    }, ['createdAt']),
  ]), false);

  for (let index = 1; index <= 5; index += 1) {
    const uid = `flagger-${index}`;
    await expect(`flag user ${index} can create one flag`, commit(uid, [
      setWrite(`${reportPath}/userReports/${uid}`, {
        userId: uid,
        category: index % 2 === 0 ? 'false_report' : 'misleading_information',
        note: '',
      }, ['createdAt']),
    ]));
  }

  await expect('owner can delete own report', request('DELETE', reportPath, owner));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
