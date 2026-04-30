
/**
 * StudyHub — scanner.gs
 * Timeout-safe discovery + queue + download loop.
 */
const CONTINUOUS_SCAN_TRIGGER_FN = 'discoveryRefreshTick_';
const DISCOVERY_RUNNING_KEY = 'DISCOVERY_RUNNING';
const DISCOVERY_LAST_RUN_KEY = 'DISCOVERY_LAST_RUN';
const DISCOVERY_MODE_KEY = 'DISCOVERY_MODE'; // SAMPLE | LIVE
const DISCOVERY_CURSOR_KEY = 'DISCOVERY_CURSOR';
const DISCOVERY_BATCH_SIZE_KEY = 'DISCOVERY_BATCH_SIZE';
const DISCOVERY_YEAR_FILTER_KEY = 'DISCOVERY_YEAR_FILTER';
const DEFAULT_DISCOVERY_BATCH_SIZE = 150;

const DL_TRIGGER_FN = 'downloadQueueLoopTick_';
const DL_RUNNING_KEY = 'DL_RUNNING';
const DL_LAST_RUN_KEY = 'DL_LAST_RUN';
const DL_CURSOR_KEY = 'DL_CURSOR';
const DL_BATCH_SIZE_KEY = 'DL_BATCH_SIZE';
const DL_MAX_RUN_MS = 4.5 * 60 * 1000;
const DEFAULT_DL_BATCH_SIZE = 50;

function runFullBuildPipeline() {
  logRun_('PIPELINE_START', 'FULL_BUILD', '', 'Started full build pipeline');
  startDiscoveryRefresh_();
  discoveryRefreshTick_();
  logRun_('PIPELINE_END', 'FULL_BUILD', '', 'Discovery loop started');
}

function runDiscoveryRefresh() {
  startDiscoveryRefresh_();
  discoveryRefreshTick_();
}

function runCurrentYearUpdate() {
  const year = String(new Date().getFullYear());
  const props = PropertiesService.getScriptProperties();
  props.setProperty(DISCOVERY_YEAR_FILTER_KEY, year);
  startDiscoveryRefresh_();
  discoveryRefreshTick_();
  logRun_('CURRENT_YEAR_UPDATE_START', year, '', 'Started current-year update loop');
}

function ensureSingleTimeTrigger_(functionName, everyMinutes) {
  deleteTriggersForFunction_(functionName);
  ScriptApp.newTrigger(functionName).timeBased().everyMinutes(Math.max(1, Math.floor(Number(everyMinutes) || 1))).create();
}

function startDiscoveryRefresh_() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(DISCOVERY_RUNNING_KEY, 'true');
  if (!props.getProperty(DISCOVERY_CURSOR_KEY)) props.setProperty(DISCOVERY_CURSOR_KEY, '0');
  if (!props.getProperty(DISCOVERY_MODE_KEY)) props.setProperty(DISCOVERY_MODE_KEY, 'SAMPLE');
  if (!props.getProperty(DISCOVERY_BATCH_SIZE_KEY)) props.setProperty(DISCOVERY_BATCH_SIZE_KEY, String(DEFAULT_DISCOVERY_BATCH_SIZE));
  ensureSingleTimeTrigger_(CONTINUOUS_SCAN_TRIGGER_FN, 1);
  logRun_('DISCOVERY_LOOP_START', 'EVERY_1_MINUTE', '', 'Background discovery loop started/resumed');
}

function stopDiscoveryRefresh_() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(DISCOVERY_RUNNING_KEY, 'false');
  props.deleteProperty(DISCOVERY_CURSOR_KEY);
  props.deleteProperty(DISCOVERY_YEAR_FILTER_KEY);
  deleteTriggersForFunction_(CONTINUOUS_SCAN_TRIGGER_FN);
  logRun_('DISCOVERY_LOOP_STOP', '', '', 'Background discovery loop stopped');
}

function resetDiscoveryState_() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(DISCOVERY_RUNNING_KEY, 'false');
  props.setProperty(DISCOVERY_CURSOR_KEY, '0');
  props.deleteProperty(DISCOVERY_YEAR_FILTER_KEY);
  props.deleteProperty(DISCOVERY_LAST_RUN_KEY);
  props.setProperty(DISCOVERY_MODE_KEY, 'SAMPLE');
  props.setProperty(DISCOVERY_BATCH_SIZE_KEY, String(DEFAULT_DISCOVERY_BATCH_SIZE));
  deleteTriggersForFunction_(CONTINUOUS_SCAN_TRIGGER_FN);
  logRun_('DISCOVERY_RESET', '', '', 'Discovery state reset');
}

function discoveryRefreshStatus_() {
  const props = PropertiesService.getScriptProperties();
  return {
    running: props.getProperty(DISCOVERY_RUNNING_KEY) === 'true',
    mode: props.getProperty(DISCOVERY_MODE_KEY) || 'SAMPLE',
    last_run: props.getProperty(DISCOVERY_LAST_RUN_KEY) || '',
    cursor: Number(props.getProperty(DISCOVERY_CURSOR_KEY) || 0),
    batch_size: Number(props.getProperty(DISCOVERY_BATCH_SIZE_KEY) || DEFAULT_DISCOVERY_BATCH_SIZE),
    year_filter: props.getProperty(DISCOVERY_YEAR_FILTER_KEY) || '',
    trigger_function: CONTINUOUS_SCAN_TRIGGER_FN
  };
}

function debugDiscoveryProgress_() {
  const status = discoveryRefreshStatus_();
  const stats = queueStats_();
  const expected = expectedSampleCounts_();
  return {
    discovery_status: status,
    queue_total: stats.total_queue_records,
    by_grade: stats.by_grade,
    by_status: stats.by_status,
    expected_sample_counts: expected
  };
}

function setContinuousScanModeSample_() {
  PropertiesService.getScriptProperties().setProperty(DISCOVERY_MODE_KEY, 'SAMPLE');
  logRun_('DISCOVERY_MODE', 'SAMPLE', '', 'Discovery mode set to SAMPLE');
}

function setContinuousScanModeLive_() {
  PropertiesService.getScriptProperties().setProperty(DISCOVERY_MODE_KEY, 'LIVE');
  logRun_('DISCOVERY_MODE', 'LIVE', '', 'Discovery mode set to LIVE');
}

function setDiscoveryBatchSize_(size) {
  const n = Number(size);
  if (!n || n < 1) throw new Error('Batch size must be a positive number');
  PropertiesService.getScriptProperties().setProperty(DISCOVERY_BATCH_SIZE_KEY, String(Math.floor(n)));
  logRun_('DISCOVERY_BATCH_SIZE', String(Math.floor(n)), '', 'Discovery batch size updated');
}

function discoveryRefreshTick_() {
  const props = PropertiesService.getScriptProperties();
  const running = props.getProperty(DISCOVERY_RUNNING_KEY) === 'true';
  if (!running) {
    logRun_('DISCOVERY_TICK_SKIP', '', '', 'Tick skipped because discovery is not running');
    deleteTriggersForFunction_(CONTINUOUS_SCAN_TRIGGER_FN);
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    logRun_('DISCOVERY_TICK_LOCK_SKIP', '', '', 'Skipped because another tick is still running');
    return;
  }

  try {
    const mode = String(props.getProperty(DISCOVERY_MODE_KEY) || 'SAMPLE').toUpperCase();
    const yearFilter = String(props.getProperty(DISCOVERY_YEAR_FILTER_KEY) || '');
    const batchSize = Math.max(1, Math.floor(Number(props.getProperty(DISCOVERY_BATCH_SIZE_KEY) || DEFAULT_DISCOVERY_BATCH_SIZE)));
    const cursor = Math.max(0, Math.floor(Number(props.getProperty(DISCOVERY_CURSOR_KEY) || 0)));

    const allCandidates = getAllDiscoveryCandidates_({ mode: mode, yearFilter: yearFilter });
    const total = allCandidates.length;
    props.setProperty(DISCOVERY_LAST_RUN_KEY, nowIso_());

    if (!total) {
      props.setProperty(DISCOVERY_RUNNING_KEY, 'false');
      deleteTriggersForFunction_(CONTINUOUS_SCAN_TRIGGER_FN);
      logRun_('DISCOVERY_TICK_EMPTY', mode, '', 'No discovery candidates found');
      return;
    }

    if (cursor >= total) {
      props.setProperty(DISCOVERY_RUNNING_KEY, 'false');
      deleteTriggersForFunction_(CONTINUOUS_SCAN_TRIGGER_FN);
      logRun_('DISCOVERY_COMPLETE', String(total), '', 'Discovery finished; starting validation + downloads');
      validateQueue_();
      downloadQueuedRecords_();
      return;
    }

    const nextCursor = Math.min(total, cursor + batchSize);
    const batch = allCandidates.slice(cursor, nextCursor);
    const result = queueUpsertBatch_(batch);
    props.setProperty(DISCOVERY_CURSOR_KEY, String(nextCursor));

    logRun_('DISCOVERY_BATCH', JSON.stringify({ mode: mode, start: cursor, end: nextCursor, total: total }), JSON.stringify(result), 'Discovery batch queued');

    if (nextCursor >= total) {
      props.setProperty(DISCOVERY_RUNNING_KEY, 'false');
      deleteTriggersForFunction_(CONTINUOUS_SCAN_TRIGGER_FN);
      logRun_('DISCOVERY_COMPLETE', String(total), JSON.stringify(result), 'Discovery finished; starting validation + downloads');
      validateQueue_();
      downloadQueuedRecords_();
    }
  } catch (err) {
    logRun_('DISCOVERY_TICK_ERROR', '', '', String(err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function getAllDiscoveryCandidates_(options) {
  options = options || {};
  const mode = options.mode || 'SAMPLE';
  const yearFilter = options.yearFilter ? String(options.yearFilter) : '';

  let candidates = [];
  if (mode === 'SAMPLE') {
    candidates = buildSampleCandidates_();
  } else {
    candidates = [].concat(scanDbeSourcesLive_(), scanProvinceSourcesLive_(), scanApprovedWebSourcesLive_());
  }

  if (yearFilter) {
    candidates = candidates.filter(function (r) { return String(r.year) === yearFilter; });
  }
  return candidates;
}

function buildSampleCandidates_() {
  const candidates = [];
  const years = ['2022', '2023', '2024', '2025'];
  const provinces = ['National', 'Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'];
  const subjectMap = getSampleSubjectMap_();
  const subjectLanguageMap = {
    'Afrikaans FAL': 'Afrikaans',
    'English FAL': 'English',
    'English HL': 'English',
    'Mathematics': 'English',
    'Mathematical Literacy': 'English',
    'Natural Sciences': 'English',
    'Physical Sciences': 'English',
    'Life Sciences': 'English',
    'Accounting': 'English',
    'Geography': 'English',
    'History': 'English',
    'Business Studies': 'English',
    'Economics': 'English',
    'EMS': 'English',
    'Social Sciences': 'English',
    'Technology': 'English'
  };

  function papersForSubject(subject, grade) {
    const g = Number(grade);
    if (subject === 'Mathematics' || subject === 'Mathematical Literacy') return ['P1', 'P2'];
    if (subject === 'Physical Sciences') return ['P1', 'P2'];
    if (subject === 'Accounting') return ['P1'];
    if (subject === 'Business Studies') return ['P1', 'P2'];
    if (subject === 'Economics') return ['P1', 'P2'];
    if (subject === 'Geography') return ['P1', 'P2'];
    if (subject === 'History') return ['P1', 'P2'];
    if (subject === 'Life Sciences') return ['P1', 'P2'];
    if (subject === 'English FAL' || subject === 'English HL') return g >= 10 ? ['P1', 'P2', 'P3'] : ['P1', 'P2'];
    if (subject === 'Afrikaans FAL') return g >= 10 ? ['P1', 'P2', 'P3'] : ['P1', 'P2'];
    if (subject === 'Natural Sciences') return ['P1', 'P2'];
    if (subject === 'Social Sciences') return ['P1', 'P2'];
    if (subject === 'EMS') return ['P1'];
    if (subject === 'Technology') return ['P1'];
    return ['P1'];
  }

  Object.keys(subjectMap).forEach(function (grade) {
    const subjects = subjectMap[grade];
    years.forEach(function (year, yIdx) {
      subjects.forEach(function (subject, sIdx) {
        const language = subjectLanguageMap[subject] || 'English';
        const papers = papersForSubject(subject, grade);
        provinces.forEach(function (province, pIdx) {
          papers.forEach(function (paperType) {
            const provider = province === 'National' ? 'DBE' : 'Province';
            const fileType = ((sIdx + yIdx + pIdx) % 4 === 0) ? 'ZIP' : 'PDF';
            const baseSlug = slugify_(subject) + '-' + grade + '-' + year + '-' + paperType.toLowerCase() + '-' + slugify_(province);
            candidates.push({
              provider: provider,
              source_url: 'https://sample.studyhub.local/' + baseSlug,
              province: province,
              grade: String(grade),
              subject: subject,
              year: String(year),
              language: language,
              paper_type: paperType,
              paper_file_type: fileType,
              memo_file_type: fileType,
              has_memo: true,
              paper_url: 'https://sample.studyhub.local/files/' + baseSlug + '-paper.' + fileType.toLowerCase(),
              memo_url: 'https://sample.studyhub.local/files/' + baseSlug + '-memo.' + fileType.toLowerCase(),
              status: 'VALIDATED'
            });
          });
        });
      });
    });
  });
  return candidates;
}

function getSampleSubjectMap_() {
  return {
    '8': ['English FAL', 'Afrikaans FAL', 'Mathematics', 'Natural Sciences', 'Social Sciences', 'Technology', 'EMS'],
    '9': ['English FAL', 'Afrikaans FAL', 'Mathematics', 'Natural Sciences', 'Social Sciences', 'Technology', 'EMS'],
    '10': ['English FAL', 'Afrikaans FAL', 'Mathematics', 'Mathematical Literacy', 'Physical Sciences', 'Life Sciences', 'Geography', 'History', 'Accounting', 'Business Studies'],
    '11': ['English FAL', 'Afrikaans FAL', 'Mathematics', 'Mathematical Literacy', 'Physical Sciences', 'Life Sciences', 'Geography', 'History', 'Accounting', 'Business Studies', 'Economics'],
    '12': ['English FAL', 'Afrikaans FAL', 'Mathematics', 'Mathematical Literacy', 'Physical Sciences', 'Life Sciences', 'Geography', 'History', 'Accounting', 'Business Studies', 'Economics']
  };
}

function expectedSampleCounts_() {
  const baseByGrade = { '8': 48, '9': 48, '10': 84, '11': 92, '12': 92 };
  const locations = 10;
  const byGrade = {};
  Object.keys(baseByGrade).forEach(function (g) { byGrade[g] = baseByGrade[g] * locations; });
  const total = Object.keys(byGrade).reduce(function (sum, g) { return sum + byGrade[g]; }, 0);
  return {
    queue_records_by_grade: byGrade,
    total_queue_records: total,
    expected_papers: total,
    expected_memos: total,
    expected_total_raw_files: total * 2
  };
}

function showExpectedSampleCounts_() {
  SpreadsheetApp.getUi().alert(JSON.stringify(expectedSampleCounts_(), null, 2));
}

function scanDbeSourcesLive_() { return []; }
function scanProvinceSourcesLive_() { return []; }
function scanApprovedWebSourcesLive_() { return []; }

function queueUpsertBatch_(records) {
  const sh = requireSheet_('Queue');
  const rows = sh.getDataRange().getValues();
  const headers = rows[0] || [];
  if (!headers.length) throw new Error('Queue sheet has no headers. Run setupStudyHub_() first.');

  const existingKeys = {};
  for (let i = 1; i < rows.length; i++) {
    const rowObj = Object.fromEntries(headers.map(function (h, idx) { return [h, rows[i][idx]]; }));
    const key = buildQueueDedupeKey_(rowObj);
    existingKeys[key] = true;
  }

  const newRows = [];
  let attempted = 0, inserted = 0, skippedInvalid = 0, skippedDuplicate = 0;

  records.forEach(function (record) {
    attempted++;
    const normalized = normalizeQueueRecord_(record);
    if (!isQueueRecordValid_(normalized)) { skippedInvalid++; return; }
    const key = buildQueueDedupeKey_(normalized);
    if (existingKeys[key]) { skippedDuplicate++; return; }
    existingKeys[key] = true;

    const newRow = headers.map(function (h) {
      if (h === 'timestamp') return new Date();
      if (h === 'status') return 'VALIDATED';
      if (h === 'notes') return '';
      if (h === 'target_folder_url') return '';
      return normalized[h] !== undefined ? normalized[h] : '';
    });
    newRows.push(newRow);
    inserted++;
  });

  if (newRows.length > 0) {
    sh.getRange(sh.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }

  return { attempted: attempted, inserted: inserted, skipped_invalid: skippedInvalid, skipped_duplicate: skippedDuplicate };
}

function normalizeQueueRecord_(record) {
  return {
    provider: stringOrBlank_(record.provider).trim(),
    source_url: stringOrBlank_(record.source_url).trim(),
    province: stringOrBlank_(record.province).trim(),
    grade: stringOrBlank_(record.grade).trim(),
    subject: stringOrBlank_(record.subject).trim(),
    year: stringOrBlank_(record.year).trim(),
    language: stringOrBlank_(record.language).trim(),
    paper_type: stringOrBlank_(record.paper_type).trim(),
    paper_file_type: String(record.paper_file_type || '').toUpperCase(),
    memo_file_type: String(record.memo_file_type || '').toUpperCase(),
    has_memo: boolFromAny_(record.has_memo),
    paper_url: stringOrBlank_(record.paper_url).trim(),
    memo_url: stringOrBlank_(record.memo_url).trim(),
    status: stringOrBlank_(record.status).trim(),
    notes: stringOrBlank_(record.notes).trim(),
    target_folder_url: stringOrBlank_(record.target_folder_url).trim()
  };
}

function buildQueueDedupeKey_(record) {
  return [
    stringOrBlank_(record.provider),
    stringOrBlank_(record.source_url),
    stringOrBlank_(record.province),
    stringOrBlank_(record.grade),
    stringOrBlank_(record.subject),
    stringOrBlank_(record.year),
    stringOrBlank_(record.language),
    stringOrBlank_(record.paper_type)
  ].join('|');
}

function isQueueRecordValid_(record) {
  return !!(
    stringOrBlank_(record.subject) &&
    stringOrBlank_(record.year) &&
    stringOrBlank_(record.language) &&
    stringOrBlank_(record.paper_type) &&
    stringOrBlank_(record.paper_url) &&
    stringOrBlank_(record.memo_url) &&
    stringOrBlank_(record.paper_file_type) &&
    stringOrBlank_(record.memo_file_type) &&
    boolFromAny_(record.has_memo)
  );
}

function upsertQueueRecord_(record) {
  const result = queueUpsertBatch_([record]);
  return result.inserted > 0;
}

function validateQueue_() {
  const sh = requireSheet_('Queue');
  const rows = sh.getDataRange().getValues();
  const headers = rows[0] || [];
  const statusCol = headers.indexOf('status') + 1;
  const notesCol = headers.indexOf('notes') + 1;
  if (statusCol <= 0 || notesCol <= 0) throw new Error('Queue sheet is missing required columns: status / notes');

  let validated = 0, invalid = 0;
  for (let i = 1; i < rows.length; i++) {
    const rowObj = Object.fromEntries(headers.map(function (h, idx) { return [h, rows[i][idx]]; }));
    const valid = isQueueRecordValid_(normalizeQueueRecord_(rowObj));
    sh.getRange(i + 1, statusCol).setValue(valid ? 'VALIDATED' : 'INVALID');
    sh.getRange(i + 1, notesCol).setValue(valid ? '' : 'Invalid queue record');
    if (valid) validated++; else invalid++;
  }
  logRun_('VALIDATE', 'QUEUE', String(validated), 'Validation completed. VALIDATED=' + validated + ', INVALID=' + invalid);
}

function downloadQueuedRecords_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(DL_RUNNING_KEY) !== 'true') props.setProperty(DL_RUNNING_KEY, 'true');
  if (!props.getProperty(DL_CURSOR_KEY)) props.setProperty(DL_CURSOR_KEY, '2');
  if (!props.getProperty(DL_BATCH_SIZE_KEY)) props.setProperty(DL_BATCH_SIZE_KEY, String(DEFAULT_DL_BATCH_SIZE));
  ensureSingleTimeTrigger_(DL_TRIGGER_FN, 1);
  downloadQueueLoopTick_();
  try { SpreadsheetApp.getUi().alert('Download loop started. It will continue in the background until done.'); } catch (e) {}
}

function stopDownloadQueueLoop_() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(DL_RUNNING_KEY, 'false');
  props.deleteProperty(DL_LAST_RUN_KEY);
  deleteTriggersForFunction_(DL_TRIGGER_FN);
  logRun_('DL_LOOP_STOP', '', '', 'Background download loop stopped');
  try { SpreadsheetApp.getUi().alert('Download loop stopped.'); } catch (e) {}
}

function downloadLoopStatus_() {
  const props = PropertiesService.getScriptProperties();
  return {
    running: props.getProperty(DL_RUNNING_KEY) === 'true',
    cursor: Number(props.getProperty(DL_CURSOR_KEY) || 0),
    batch_size: Number(props.getProperty(DL_BATCH_SIZE_KEY) || DEFAULT_DL_BATCH_SIZE),
    last_run: props.getProperty(DL_LAST_RUN_KEY) || '',
    trigger_function: DL_TRIGGER_FN,
    ts: nowIso_()
  };
}

function setDownloadLoopBatchSize_(n) {
  const size = Math.max(1, Math.floor(Number(n) || DEFAULT_DL_BATCH_SIZE));
  PropertiesService.getScriptProperties().setProperty(DL_BATCH_SIZE_KEY, String(size));
  logRun_('DL_BATCH_SIZE', String(size), '', 'Download loop batch size updated');
}

function downloadQueueLoopTick_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(DL_RUNNING_KEY) !== 'true') {
    deleteTriggersForFunction_(DL_TRIGGER_FN);
    logRun_('DL_TICK_SKIP', 'NOT_RUNNING', '', 'Skipping tick; loop not running');
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    logRun_('DL_TICK_SKIP', 'LOCKED', '', 'Another DL tick still running');
    return;
  }

  try {
    props.setProperty(DL_LAST_RUN_KEY, nowIso_());
    const sh = requireSheet_('Queue');
    const rows = sh.getDataRange().getValues();
    if (rows.length <= 1) {
      finishDownloadLoop_('No queue rows found');
      return;
    }

    const headers = rows[0] || [];
    const statusCol = headers.indexOf('status') + 1;
    const notesCol = headers.indexOf('notes') + 1;
    const targetFolderCol = headers.indexOf('target_folder_url') + 1;
    if (statusCol <= 0 || notesCol <= 0 || targetFolderCol <= 0) {
      throw new Error('Queue sheet missing required columns: status / notes / target_folder_url');
    }

    let rowIndex = Math.max(2, Math.floor(Number(props.getProperty(DL_CURSOR_KEY) || 2)));
    const batchSize = Math.max(1, Math.floor(Number(props.getProperty(DL_BATCH_SIZE_KEY) || DEFAULT_DL_BATCH_SIZE)));
    const startedAt = new Date().getTime();
    let processed = 0, downloaded = 0, failed = 0, skipped = 0;

    while (rowIndex <= rows.length && processed < batchSize && ((new Date().getTime()) - startedAt) < DL_MAX_RUN_MS) {
      const rowValues = rows[rowIndex - 1];
      const rowObj = Object.fromEntries(headers.map(function (h, idx) { return [h, rowValues[idx]]; }));
      const status = String(rowObj.status || '').trim().toUpperCase();
      if (status !== 'VALIDATED') {
        rowIndex++;
        skipped++;
        continue;
      }

      processed++;
      try {
        const result = downloadSingleQueueRow_(rowObj);
        sh.getRange(rowIndex, statusCol).setValue('DOWNLOADED');
        sh.getRange(rowIndex, notesCol).setValue(result.simulated ? 'Downloaded (simulated SAMPLE content)' : 'Downloaded');
        sh.getRange(rowIndex, targetFolderCol).setValue(result.folderUrl || '');
        downloaded++;
      } catch (err) {
        sh.getRange(rowIndex, statusCol).setValue('DOWNLOAD_FAILED');
        sh.getRange(rowIndex, notesCol).setValue(String(err));
        failed++;
      }
      rowIndex++;
    }

    props.setProperty(DL_CURSOR_KEY, String(rowIndex));
    logRun_('DL_BATCH', JSON.stringify({ next_row: rowIndex, batch_size: batchSize }), JSON.stringify({ processed: processed, downloaded: downloaded, failed: failed, skipped: skipped }), 'Download batch completed');

    if (rowIndex > rows.length) {
      finishDownloadLoop_('Reached end of queue');
      buildBundles_();
      generateCatalog_();
      return;
    }
  } catch (err) {
    logRun_('DL_TICK_ERROR', '', '', String(err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function finishDownloadLoop_(reason) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(DL_RUNNING_KEY, 'false');
  deleteTriggersForFunction_(DL_TRIGGER_FN);
  logRun_('DL_LOOP_FINISH', reason || '', '', 'Background download loop finished');
}

function downloadSingleQueueRow_(rowObj) {
  const normalized = normalizeQueueRecord_(rowObj);
  const roots = ensureDriveRoots_();
  const folder = ensureSourceRecordFolder_(roots.sourceLibrary, normalized);

  const paperResult = fetchWithRetry_(normalized.paper_url, { expectedType: normalized.paper_file_type, minSizeBytes: 20, maxRetries: 3 });
  const memoResult = fetchWithRetry_(normalized.memo_url, { expectedType: normalized.memo_file_type, minSizeBytes: 20, maxRetries: 3 });

  const basePrefix = [normalized.province, normalized.subject, normalized.grade, normalized.year, normalized.language, normalized.paper_type].map(function (s) { return sanitizeFolderName_(s); }).join('_');
  const paperFileName = makeSafeFileName_(basePrefix + '_PAPER') + extensionForFileType_(normalized.paper_file_type);
  const memoFileName = makeSafeFileName_(basePrefix + '_MEMO') + extensionForFileType_(normalized.memo_file_type);

  const paperBlob = paperResult.blob; paperBlob.setName(paperFileName);
  const memoBlob = memoResult.blob; memoBlob.setName(memoFileName);

  const paperFile = upsertFileInFolder_(folder, paperFileName, paperBlob);
  const memoFile = upsertFileInFolder_(folder, memoFileName, memoBlob);

  return {
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    paperFileId: paperFile.getId(),
    paperFileName: paperFile.getName(),
    memoFileId: memoFile.getId(),
    memoFileName: memoFile.getName(),
    simulated: !!(paperResult.simulated || memoResult.simulated)
  };
}

function fetchWithRetry_(url, options) {
  options = options || {};
  const maxRetries = Number(options.maxRetries || 3);
  const minSizeBytes = Number(options.minSizeBytes || 200);
  const expectedType = String(options.expectedType || '').toUpperCase();

  const props = PropertiesService.getScriptProperties();
  const discoveryMode = String(props.getProperty(DISCOVERY_MODE_KEY) || 'SAMPLE').toUpperCase();
  const host = tryGetHost_(url);

  if (discoveryMode === 'SAMPLE' || host.endsWith('sample.studyhub.local')) {
    const fake = buildSyntheticBlob_(expectedType, url);
    return { blob: fake.blob, bytes: fake.bytes, size: fake.size, contentType: fake.contentType, simulated: true };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true,
        headers: { 'User-Agent': 'StudyHubDownloader/1.0' }
      });

      const code = Number(response.getResponseCode());
      const blob = response.getBlob();
      const bytes = blob.getBytes();
      const contentType = String(blob.getContentType() || '').toLowerCase();

      if (code < 200 || code >= 300) throw new Error('HTTP ' + code + ' from ' + url);
      if (looksLikeHtml_(contentType, bytes)) throw new Error('Unexpected HTML from ' + url);
      if (bytes.length < minSizeBytes) throw new Error('Downloaded file too small from ' + url + ' (' + bytes.length + ' bytes)');
      validateBlobByType_(expectedType, bytes, url);

      return { blob: blob, bytes: bytes, size: bytes.length, contentType: contentType, simulated: false };
    } catch (err) {
      lastError = err;
      Utilities.sleep(500 * attempt);
    }
  }
  throw new Error('Download failed after retries: ' + String(lastError));
}

function tryGetHost_(url) {
  try {
    const m = String(url || '').match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
    return (m && m[1]) ? m[1].toLowerCase() : '';
  } catch (e) {
    return '';
  }
}

function buildSyntheticBlob_(expectedType, sourceUrl) {
  const type = String(expectedType || '').toUpperCase();
  let bytes, contentType, name;

  if (type === 'ZIP') {
    bytes = [0x50,0x4B,0x05,0x06, 0x00,0x00, 0x00,0x00, 0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00];
    contentType = 'application/zip';
    name = 'synthetic.zip';
  } else {
    const pdfText = '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000119 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n180\n%%EOF';
    bytes = Utilities.newBlob(pdfText).getBytes();
    contentType = 'application/pdf';
    name = 'synthetic.pdf';
  }

  const blob = Utilities.newBlob(bytes, contentType, name);
  return { blob: blob, bytes: bytes, size: bytes.length, contentType: contentType, source: sourceUrl };
}

function looksLikeHtml_(contentType, bytes) {
  if (contentType.indexOf('text/html') >= 0) return true;
  if (contentType.indexOf('application/xhtml') >= 0) return true;
  const prefix = bytes.slice(0, 80).map(function (b) { return String.fromCharCode(b); }).join('').toLowerCase();
  return (prefix.indexOf('<!doctype html') >= 0 || prefix.indexOf('<html') >= 0 || prefix.indexOf('<head') >= 0 || prefix.indexOf('<body') >= 0);
}

function validateBlobByType_(expectedType, bytes, url) {
  const type = String(expectedType || '').toUpperCase();
  if (type === 'PDF' && !isPdfBytes_(bytes)) throw new Error('Invalid PDF signature from ' + url);
  if (type === 'ZIP' && !isZipBytes_(bytes)) throw new Error('Invalid ZIP signature from ' + url);
}

function isPdfBytes_(bytes) {
  return !!(bytes && bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D);
}

function isZipBytes_(bytes) {
  return !!(bytes && bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B);
}

function ensureSourceRecordFolder_(rootFolder, rowObj) {
  const gradeFolder = ensureSubFolder_(rootFolder, 'Grade_' + sanitizeFolderName_(rowObj.grade));
  const yearFolder = ensureSubFolder_(gradeFolder, sanitizeFolderName_(rowObj.year));
  const provinceFolder = ensureSubFolder_(yearFolder, sanitizeFolderName_(rowObj.province));
  const subjectFolder = ensureSubFolder_(provinceFolder, sanitizeFolderName_(rowObj.subject));
  const languageFolder = ensureSubFolder_(subjectFolder, sanitizeFolderName_(rowObj.language));
  return ensureSubFolder_(languageFolder, sanitizeFolderName_(rowObj.paper_type));
}

function upsertFileInFolder_(folder, fileName, blob) {
  const existing = folder.getFilesByName(fileName);
  while (existing.hasNext()) existing.next().setTrashed(true);
  return folder.createFile(blob);
}

function retryFailedDownloads_() {
  const sh = requireSheet_('Queue');
  const rows = sh.getDataRange().getValues();
  const headers = rows[0] || [];
  const statusCol = headers.indexOf('status') + 1;
  if (statusCol <= 0) throw new Error('Queue sheet missing status column');

  for (let i = 2; i <= sh.getLastRow(); i++) {
    const status = String(sh.getRange(i, statusCol).getValue() || '').trim().toUpperCase();
    if (status === 'DOWNLOAD_FAILED') sh.getRange(i, statusCol).setValue('VALIDATED');
  }
  logRun_('DOWNLOAD_RETRY_MARK', '', '', 'Failed downloads reset to VALIDATED');
  downloadQueuedRecords_();
}

function queueStats_() {
  const sh = requireSheet_('Queue');
  const rows = sh.getDataRange().getValues();

  if (rows.length <= 1) {
    return {
      ok: true,
      total_queue_records: 0,
      expected_papers: 0,
      expected_memos: 0,
      expected_total_raw_files: 0,
      by_grade: {}, by_year: {}, by_subject: {}, by_status: {}, by_provider: {}, by_language: {}
    };
  }

  const objects = rowsToObjects_(rows);
  const result = {
    ok: true,
    total_queue_records: 0,
    expected_papers: 0,
    expected_memos: 0,
    expected_total_raw_files: 0,
    by_grade: {}, by_year: {}, by_subject: {}, by_status: {}, by_provider: {}, by_language: {}
  };

  objects.forEach(function (r) {
    if (!r.subject || !r.year || !r.paper_url || !r.memo_url) return;
    result.total_queue_records++;
    const grade = stringOrBlank_(r.grade) || 'UNKNOWN';
    const year = stringOrBlank_(r.year) || 'UNKNOWN';
    const subject = stringOrBlank_(r.subject) || 'UNKNOWN';
    const status = stringOrBlank_(r.status) || 'UNKNOWN';
    const provider = stringOrBlank_(r.provider) || 'UNKNOWN';
    const language = stringOrBlank_(r.language) || 'UNKNOWN';

    result.by_grade[grade] = (result.by_grade[grade] || 0) + 1;
    result.by_year[year] = (result.by_year[year] || 0) + 1;
    result.by_subject[subject] = (result.by_subject[subject] || 0) + 1;
    result.by_status[status] = (result.by_status[status] || 0) + 1;
    result.by_provider[provider] = (result.by_provider[provider] || 0) + 1;
    result.by_language[language] = (result.by_language[language] || 0) + 1;
  });

  result.expected_papers = result.total_queue_records;
  result.expected_memos = result.total_queue_records;
  result.expected_total_raw_files = result.total_queue_records * 2;
  logRun_('QUEUE_STATS', '', JSON.stringify(result), 'Queue stats generated');
  return result;
}

function showQueueStats_() {
  const stats = queueStats_();
  const msg =
    'Queue Verification Summary\n\n' +
    'Total queue records: ' + stats.total_queue_records + '\n' +
    'Expected papers: ' + stats.expected_papers + '\n' +
    'Expected memos: ' + stats.expected_memos + '\n' +
    'Expected total raw files: ' + stats.expected_total_raw_files + '\n\n' +
    'By grade:\n' + prettyMap_(stats.by_grade) + '\n\n' +
    'By year:\n' + prettyMap_(stats.by_year) + '\n\n' +
    'By status:\n' + prettyMap_(stats.by_status);
  SpreadsheetApp.getUi().alert(msg);
}

function writeQueueStatsSheet_() {
  const ss = getSpreadsheet_();
  const stats = queueStats_();
  let sh = ss.getSheetByName('QueueStats');
  if (!sh) sh = ss.insertSheet('QueueStats');
  else sh.clearContents();

  let row = 1;
  sh.getRange(row++, 1, 1, 2).setValues([['Metric', 'Value']]);
  sh.getRange(row++, 1, 1, 2).setValues([['Total queue records', stats.total_queue_records]]);
  sh.getRange(row++, 1, 1, 2).setValues([['Expected papers', stats.expected_papers]]);
  sh.getRange(row++, 1, 1, 2).setValues([['Expected memos', stats.expected_memos]]);
  sh.getRange(row++, 1, 1, 2).setValues([['Expected total raw files', stats.expected_total_raw_files]]);
  row += 1;

  row = writeMapBlock_(sh, row, 'By Grade', stats.by_grade); row += 1;
  row = writeMapBlock_(sh, row, 'By Year', stats.by_year); row += 1;
  row = writeMapBlock_(sh, row, 'By Subject', stats.by_subject); row += 1;
  row = writeMapBlock_(sh, row, 'By Status', stats.by_status); row += 1;
  row = writeMapBlock_(sh, row, 'By Provider', stats.by_provider); row += 1;
  row = writeMapBlock_(sh, row, 'By Language', stats.by_language);

  logRun_('QUEUE_STATS_SHEET', 'QueueStats', '', 'QueueStats sheet written');
}

function writeMapBlock_(sheet, startRow, title, mapObj) {
  sheet.getRange(startRow, 1).setValue(title);
  sheet.getRange(startRow + 1, 1, 1, 2).setValues([['Key', 'Count']]);
  const entries = Object.keys(mapObj).sort(compareNumericString_).map(function (key) { return [key, mapObj[key]]; });
  if (entries.length > 0) sheet.getRange(startRow + 2, 1, entries.length, 2).setValues(entries);
  else sheet.getRange(startRow + 2, 1, 1, 2).setValues([['(none)', 0]]);
  return startRow + 2 + Math.max(entries.length, 1);
}

function prettyMap_(obj) {
  const keys = Object.keys(obj);
  if (!keys.length) return '(none)';
  return keys.sort(compareNumericString_).map(function (k) { return '- ' + k + ': ' + obj[k]; }).join('\n');
}

function clearQueueDataOnly_() {
  const sh = requireSheet_('Queue');
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).clearContent();
  logRun_('QUEUE_CLEAR', 'DATA_ONLY', '', 'Queue data rows cleared');
}

function hardResetQueue_() {
  const sh = requireSheet_('Queue');
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.deleteRows(2, lastRow - 1);
  logRun_('QUEUE_HARD_RESET', '', '', 'Queue hard reset completed');
}

function hardResetQueueAndStats_() {
  hardResetQueue_();
  const ss = getSpreadsheet_();
  const statsSheet = ss.getSheetByName('QueueStats');
  if (statsSheet) statsSheet.clearContents();
  logRun_('QUEUE_AND_STATS_RESET', '', '', 'Queue and QueueStats reset completed');
}

function deleteTriggersForFunction_(functionName) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === functionName) ScriptApp.deleteTrigger(trigger);
  });
}

function startContinuousScan_() { startDiscoveryRefresh_(); }
function stopContinuousScan_() { stopDiscoveryRefresh_(); }
