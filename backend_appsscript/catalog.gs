/**
 * StudyHub — catalog.gs
 * Real Drive bundle creation + Catalog generation + Bundle jobs
 * FULL MERGED VERSION (includes ZIP-delivery aware catalog rebuild)
 */

/** --------------------------
 * Content rules (editable)
 * Only Grades 8–12, Years 2022–2026 (5-year window starting 2022)
 * -------------------------- */
const CONTENT_RULES_ = {
  MIN_GRADE: 8,
  MAX_GRADE: 12,
  MIN_YEAR: 2022,
  YEARS_SPAN: 5
};

function maxYear_() {
  return CONTENT_RULES_.MIN_YEAR + CONTENT_RULES_.YEARS_SPAN - 1;
}

function yearRangeLabel_() {
  return CONTENT_RULES_.MIN_YEAR + '-' + maxYear_();
}

function normalizeGradeValue_(v) {
  const m = String(v || '').match(/(\d{1,2})/);
  return m ? m[1] : '';
}

function normalizeYearValue_(v) {
  const m = String(v || '').match(/(20\d{2})/);
  return m ? m[1] : '';
}

function isAllowedGradeYear_(gradeStr, yearStr) {
  const g = Number(gradeStr);
  const y = Number(yearStr);
  if (isNaN(g) || isNaN(y)) return false;
  return (
    g >= CONTENT_RULES_.MIN_GRADE &&
    g <= CONTENT_RULES_.MAX_GRADE &&
    y >= CONTENT_RULES_.MIN_YEAR &&
    y <= maxYear_()
  );
}

/** --------------------------
 * Full bundle builders
 * -------------------------- */
function buildBundles_() {
  ensureDriveRoots_();
  buildSingleSubjectBundles_();
  buildSingleYearBundles_();
  buildMasterBundles_();
  buildUltimateBundles_();
  logRunIfAvailable_('BUNDLES', 'BUILD_ALL', '', 'All bundle builders completed');
}

function buildBundlesByCode_(code) {
  ensureDriveRoots_();
  const tasks = buildBundleTasksForCodes_([code]);
  let built = 0;

  tasks.forEach(function (task) {
    executeBundleTask_(task);
    built++;
  });

  logRunIfAvailable_(
    'BUNDLE_BUILD',
    code,
    String(built),
    'Built all bundles for code ' + code
  );

  return {
    ok: true,
    code: code,
    built: built,
    ts: nowIso_()
  };
}

function buildSingleSubjectBundles_() {
  return buildBundlesByCode_('SS');
}

function buildSingleYearBundles_() {
  return buildBundlesByCode_('SY');
}

function buildMasterBundles_() {
  return buildBundlesByCode_('MB');
}

function buildUltimateBundles_() {
  return buildBundlesByCode_('UB');
}

function executeBundleTask_(task) {
  const bundleTypeRoot = ensureBundleRoot_(task.bundleFolderName);
  const gradeFolder = ensureSubFolder_(
    bundleTypeRoot,
    'Grade_' + sanitizeFolderName_(task.meta.grade)
  );
  const bundleFolder = ensureSubFolder_(gradeFolder, task.sku);

  clearBundleFolderContents_(bundleFolder);

  (task.records || []).forEach(function (record) {
    copyRecordFilesIntoFolder_(record, bundleFolder);
  });

  finalizeBundleTask_(bundleFolder, task);
  return bundleFolder;
}

function clearBundleFolderContents_(folder) {
  // Trash all files
  const files = folder.getFiles();
  while (files.hasNext()) {
    files.next().setTrashed(true);
  }

  // Trash all child subfolders
  const subs = folder.getFolders();
  while (subs.hasNext()) {
    subs.next().setTrashed(true);
  }
}

function buildBundleFolderFromRecords_(bundleFolder, sku, bundleType, records, meta) {
  clearBundleFolderContents_(bundleFolder);

  (records || []).forEach(function (record) {
    copyRecordFilesIntoFolder_(record, bundleFolder);
  });

  const manifest = {
    sku: sku,
    bundle_type: bundleType,
    grade: meta.grade,
    year_or_range: meta.year_or_range,
    subject_or_all: meta.subject_or_all,
    title: meta.title,
    record_count: (records || []).length,
    generated_at: nowIso_(),
    file_count: countRealFilesRecursive_(bundleFolder),
    queue_records: (records || []).map(function (r) {
      return {
        provider: r.provider,
        province: r.province,
        grade: r.grade,
        subject: r.subject,
        year: r.year,
        language: r.language,
        paper_type: r.paper_type,
        source_url: r.source_url,
        target_folder_url: r.target_folder_url
      };
    })
  };

  writeBundleManifest_(bundleFolder, manifest);
  writeBundleReadme_(bundleFolder, meta.title, records || []);
}

/** --------------------------
 * Catalog generation
 * -------------------------- */
function generateCatalog_() {
  ensureDriveRoots_();
  const payload = rebuildCatalogFromQueue_();
  logRunIfAvailable_(
    'CATALOG',
    'GENERATE',
    '',
    'Generated ' + payload.items.length + ' products from Queue + Drive bundle folders'
  );
  return payload;
}

function getPublishedCatalog_() {
  const sh = requireSheet_('Catalog');
  const rows = sh.getDataRange().getValues();

  if (rows.length <= 1) return rebuildCatalogFromQueue_();

  const items = rowsToObjects_(rows)
    .filter(function (r) {
      return String(r.published).toLowerCase() !== 'false';
    })
    .map(function (r) {
      const driveUrl = stringOrBlank_(r.driveUrl);
      const deliveryUrl = stringOrBlank_(r.deliveryUrl) || driveUrl;

      return {
        sku: stringOrBlank_(r.sku),
        bundle_type: stringOrBlank_(r.bundle_type),
        title: stringOrBlank_(r.title),
        grade: stringOrBlank_(r.grade),
        year_or_range: stringOrBlank_(r.year_or_range),
        subject_or_all: stringOrBlank_(r.subject_or_all),
        price_cents: numberOrZero_(r.price_cents),
        driveUrl: driveUrl,
        deliveryUrl: deliveryUrl,
        file_count: numberOrZero_(r.file_count),
        last_updated: stringOrBlank_(r.last_updated),
        description: stringOrBlank_(r.description),
        published: String(r.published).toLowerCase() !== 'false'
      };
    });

  return { version: '2.1', generated_at: nowIso_(), items: items };
}

/**
 * FULL MERGE:
 * - driveUrl  = bundle folder URL
 * - deliveryUrl = ZIP URL if available, otherwise folder URL
 */
function rebuildCatalogFromQueue_() {
  const queue = getUsableQueueRecords_();
  const catalogSheet = requireSheet_('Catalog');
  const grouped = buildQueueGroups_(queue);
  const items = buildCatalogItemsFromGroups_(grouped);

  // Existing bundle folder URLs
  const bundleFolderUrls = getBundleUrlMap_();

  // New ZIP URLs from bundle_zip_delivery_patch.gs
  const bundleZipUrls =
    typeof getBundleZipUrlMap_ === 'function' ? getBundleZipUrlMap_() : {};

  items.forEach(function (item) {
    const folderUrl = bundleFolderUrls[item.sku] || '';
    const zipUrl = bundleZipUrls[item.sku] || '';

    // Keep bundle folder URL for admin/reference use
    item.driveUrl = folderUrl;

    // Prefer ZIP for customer delivery; fallback to folder if ZIP not built yet
    item.deliveryUrl = zipUrl || folderUrl;
  });

  rewriteCatalogSheet_(catalogSheet, items);
  return { version: '2.1', generated_at: nowIso_(), items: items };
}

/** --------------------------
 * Queue → usable records
 * -------------------------- */
function getUsableQueueRecords_() {
  const queueSheet = requireSheet_('Queue');
  const rows = queueSheet.getDataRange().getValues();
  const queueObjects = rowsToObjects_(rows);

  return queueObjects
    .map(function (r) {
      r.grade = normalizeGradeValue_(r.grade);
      r.year = normalizeYearValue_(r.year);
      r.subject = String(r.subject || '').trim();
      r.province = String(r.province || '').trim();
      r.language = String(r.language || '').trim();
      r.paper_type = String(r.paper_type || '').trim();
      r.paper_url = String(r.paper_url || '').trim();
      r.memo_url = String(r.memo_url || '').trim();
      r.status = String(r.status || '').trim();
      r.target_folder_url = String(r.target_folder_url || '').trim();
      r.source_url = String(r.source_url || '').trim();
      r.provider = String(r.provider || '').trim();
      return r;
    })
    .filter(function (r) {
      const status = String(r.status || '').trim().toUpperCase();
      const hasCore =
        r.grade &&
        r.year &&
        r.subject &&
        r.paper_type &&
        (r.paper_url || r.memo_url);

      const statusOk =
        status === 'VALIDATED' ||
        status === 'DOWNLOADED_PENDING_IMPLEMENTATION' ||
        status === 'DOWNLOADED' ||
        status === 'BUNDLED';

      return hasCore && statusOk && isAllowedGradeYear_(r.grade, r.year);
    });
}

/** --------------------------
 * Grouping
 * -------------------------- */
function buildQueueGroups_(queueRecords) {
  const data = {
    grades: {},
    allYears: {},
    allSubjects: {}
  };

  (queueRecords || []).forEach(function (r) {
    const grade = String(r.grade).trim();
    const year = String(r.year).trim();
    const subject = String(r.subject).trim();

    if (!data.grades[grade]) {
      data.grades[grade] = {
        allRecords: [],
        years: {},
        subjects: {}
      };
    }

    const g = data.grades[grade];
    g.allRecords.push(r);

    if (!g.years[year]) g.years[year] = [];
    g.years[year].push(r);

    if (!g.subjects[subject]) g.subjects[subject] = [];
    g.subjects[subject].push(r);

    if (!data.allYears[year]) data.allYears[year] = [];
    data.allYears[year].push(r);

    if (!data.allSubjects[subject]) data.allSubjects[subject] = [];
    data.allSubjects[subject].push(r);
  });

  return data;
}

function buildCatalogItemsFromGroups_(grouped) {
  const items = [];
  const grades = Object.keys(grouped.grades).sort(compareNumericString_);

  grades.forEach(function (grade) {
    const g = grouped.grades[grade];
    const years = Object.keys(g.years).sort(compareNumericString_);
    const subjects = Object.keys(g.subjects).sort();

    // Single Year bundles
    years.forEach(function (year) {
      const records = g.years[year] || [];
      items.push(
        makeCatalogItem_(
          grade,
          'ALL',
          year,
          'SY',
          'Single Year',
          records
        )
      );
    });

    // Single Subject + Master bundles
    subjects.forEach(function (subject) {
      const subjectRecords = g.subjects[subject] || [];

      // Group subject records by year for SS bundles
      const perYear = {};
      subjectRecords.forEach(function (r) {
        const y = String(r.year);
        if (!perYear[y]) perYear[y] = [];
        perYear[y].push(r);
      });

      Object.keys(perYear)
        .sort(compareNumericString_)
        .forEach(function (year) {
          items.push(
            makeCatalogItem_(
              grade,
              subject,
              year,
              'SS',
              'Single Subject',
              perYear[year]
            )
          );
        });

      // Master bundle = one subject across years
      const actualRange = recordsYearRange_(subjectRecords) || yearRangeLabel_();
      items.push(
        makeCatalogItem_(
          grade,
          subject,
          actualRange,
          'MB',
          'Master Bundle',
          subjectRecords
        )
      );
    });

    // Ultimate bundle = all subjects across years
    if ((g.allRecords || []).length) {
      const actualRange = recordsYearRange_(g.allRecords) || yearRangeLabel_();
      items.push(
        makeCatalogItem_(
          grade,
          'ALL',
          actualRange,
          'UB',
          'Ultimate Bundle',
          g.allRecords
        )
      );
    }
  });

  return items;
}

/** --------------------------
 * Catalog item helpers
 * -------------------------- */
function countExpectedFilesFromRecords_(records) {
  let count = 0;
  (records || []).forEach(function (r) {
    if (String(r.paper_url || '').trim()) count += 1;
    if (String(r.memo_url || '').trim()) count += 1;
  });
  return count;
}

function recordsYearRange_(records) {
  const years = uniqueSorted_(
    (records || []).map(function (r) { return String(r.year || ''); }).filter(Boolean),
    compareNumericString_
  );
  if (!years.length) return '';
  return years.length === 1 ? years[0] : (years[0] + '-' + years[years.length - 1]);
}

function makeCatalogItem_(grade, subjectOrAll, yearOrRange, suffix, bundleType, records) {
  const sku = buildSku_(grade, subjectOrAll, yearOrRange, suffix);
  const title = buildCatalogTitle_(grade, subjectOrAll, yearOrRange, bundleType);

  return {
    sku: sku,
    bundle_type: bundleType,
    title: title,
    grade: grade,
    year_or_range: yearOrRange,
    subject_or_all: subjectOrAll,
    price_cents: getBundlePriceCents_(grade, bundleType),
    driveUrl: '',
    deliveryUrl: '',
    file_count: countExpectedFilesFromRecords_(records || []),
    last_updated: nowIso_(),
    description: buildCatalogDescription_(grade, subjectOrAll, yearOrRange, bundleType, records || [])
  };
}

function buildCatalogTitle_(grade, subjectOrAll, yearOrRange, bundleType) {
  if (bundleType === 'Single Subject') {
    return 'Grade ' + grade + ' ' + subjectOrAll + ' ' + yearOrRange + ' Single Subject Bundle';
  }
  if (bundleType === 'Single Year') {
    return 'Grade ' + grade + ' ' + yearOrRange + ' Single Year Bundle';
  }
  if (bundleType === 'Master Bundle') {
    return 'Grade ' + grade + ' ' + subjectOrAll + ' Master Bundle';
  }
  return 'Grade ' + grade + ' Ultimate Bundle';
}

function buildCatalogDescription_(grade, subjectOrAll, yearOrRange, bundleType, records) {
  const subjects = uniqueSorted_(
    (records || []).map(function (r) { return String(r.subject || ''); }).filter(Boolean),
    compareNumericString_
  );

  const years = uniqueSorted_(
    (records || []).map(function (r) { return String(r.year || ''); }).filter(Boolean),
    compareNumericString_
  );

  const expectedFiles = countExpectedFilesFromRecords_(records || []);

  return [
    'Bundle Type: ' + bundleType,
    'Grade: ' + grade,
    'Subject(s): ' + (subjectOrAll === 'ALL' ? subjects.join(', ') : subjectOrAll),
    'Year(s): ' + (yearOrRange === yearRangeLabel_() ? years.join(', ') : yearOrRange),
    'Included queue records: ' + (records || []).length,
    'Expected files: ' + expectedFiles
  ].join('\n');
}

/** --------------------------
 * Bundle roots / copy logic
 * -------------------------- */
function ensureBundleRoot_(bundleTypeFolderName) {
  const roots = ensureDriveRoots_();
  return ensureSubFolder_(roots.bundlesRoot, bundleTypeFolderName);
}

function copyRecordFilesIntoFolder_(record, targetFolder) {
  const sourceFolder = resolveSourceFolderForRecord_(record);
  if (!sourceFolder) {
    logRunIfAvailable_(
      'BUNDLE_SOURCE_MISSING',
      stringOrBlank_(record.source_url),
      '',
      'Could not resolve source folder for record'
    );
    return;
  }

  const recordFolder = getOrCreateRecordSubfolder_(targetFolder, record);

  const files = sourceFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();

    if (fileName === 'manifest.json' || fileName === 'README.txt') continue;

    const existing = recordFolder.getFilesByName(fileName);
    if (existing.hasNext()) {
      // skip duplicates by file name inside the record subfolder
      continue;
    }

    file.makeCopy(fileName, recordFolder);
  }
}

function getOrCreateRecordSubfolder_(targetFolder, record) {
  const label = [
    record.year || 'NA',
    record.province || 'NA',
    record.subject || 'NA',
    record.language || 'NA',
    record.paper_type || 'NA'
  ].join(' - ');

  return ensureSubFolder_(targetFolder, label);
}

function resolveSourceFolderForRecord_(record) {
  const targetUrl = stringOrBlank_(record.target_folder_url).trim();

  if (targetUrl) {
    const id = extractDriveIdFromUrl_(targetUrl);
    if (id) {
      try {
        return DriveApp.getFolderById(id);
      } catch (err) {
        logRunIfAvailable_(
          'SOURCE_FOLDER_LOOKUP_ERROR',
          targetUrl,
          '',
          String(err)
        );
      }
    }
  }

  // Fallback path lookup inside SourceLibrary
  const roots = ensureDriveRoots_();
  const sourceRoot = roots.sourceLibrary;

  const gradeFolder = findSubFolder_(
    sourceRoot,
    'Grade_' + sanitizeFolderName_(record.grade)
  );
  if (!gradeFolder) return null;

  const yearFolder = findSubFolder_(gradeFolder, sanitizeFolderName_(record.year));
  if (!yearFolder) return null;

  const provinceFolder = findSubFolder_(yearFolder, sanitizeFolderName_(record.province));
  if (!provinceFolder) return null;

  const subjectFolder = findSubFolder_(provinceFolder, sanitizeFolderName_(record.subject));
  if (!subjectFolder) return null;

  const languageFolder = findSubFolder_(subjectFolder, sanitizeFolderName_(record.language));
  if (!languageFolder) return null;

  return findSubFolder_(languageFolder, sanitizeFolderName_(record.paper_type));
}

/** --------------------------
 * Bundle metadata files
 * -------------------------- */
function writeBundleManifest_(folder, manifestObj) {
  upsertTextFileInFolder_(
    folder,
    'manifest.json',
    JSON.stringify(manifestObj, null, 2),
    MimeType.PLAIN_TEXT
  );
}

function writeBundleReadme_(folder, title, records) {
  const lines = [];
  lines.push(title);
  lines.push('');
  lines.push('This bundle folder was generated by StudyHub.');
  lines.push('Included queue records: ' + (records || []).length);
  lines.push('Expected raw files from queue entries: ' + countExpectedFilesFromRecords_(records || []));
  lines.push('');
  lines.push('Subjects:');

  const subjects = {};
  (records || []).forEach(function (r) { subjects[r.subject] = true; });
  Object.keys(subjects).sort().forEach(function (s) { lines.push('- ' + s); });

  upsertTextFileInFolder_(folder, 'README.txt', lines.join('\n'), MimeType.PLAIN_TEXT);
}

function readJsonFileNamedInFolder_(folder, fileName) {
  try {
    const files = folder.getFilesByName(fileName);
    if (!files.hasNext()) return null;
    const file = files.next();
    const text = file.getBlob().getDataAsString('UTF-8');
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

/** --------------------------
 * Bundle URL map (folder URLs)
 * -------------------------- */
function getBundleUrlMap_() {
  const urlMap = {};
  const roots = ensureDriveRoots_();
  const root = roots.bundlesRoot;

  collectSkuFolderUrls_(ensureSubFolder_(root, 'Single_Subject'), urlMap);
  collectSkuFolderUrls_(ensureSubFolder_(root, 'Single_Year'), urlMap);
  collectSkuFolderUrls_(ensureSubFolder_(root, 'Master_Bundle'), urlMap);
  collectSkuFolderUrls_(ensureSubFolder_(root, 'Ultimate_Bundle'), urlMap);

  return urlMap;
}

function collectSkuFolderUrls_(root, urlMap) {
  const gradeFolders = root.getFolders();
  while (gradeFolders.hasNext()) {
    const gradeFolder = gradeFolders.next();
    const bundleFolders = gradeFolder.getFolders();
    while (bundleFolders.hasNext()) {
      const folder = bundleFolders.next();
      const name = String(folder.getName() || '');
      if (name.indexOf('SH-G') === 0) urlMap[name] = folder.getUrl();
    }
  }
}

/** --------------------------
 * Catalog sheet writing
 * -------------------------- */
function rewriteCatalogSheet_(catalogSheet, items) {
  const headers = [
    'sku',
    'bundle_type',
    'title',
    'grade',
    'year_or_range',
    'subject_or_all',
    'price_cents',
    'driveUrl',
    'deliveryUrl',
    'file_count',
    'last_updated',
    'description',
    'published'
  ];

  catalogSheet.clearContents();
  catalogSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (!items.length) return;

  const rows = items.map(function (item) {
    return [
      item.sku,
      item.bundle_type,
      item.title,
      item.grade,
      item.year_or_range,
      item.subject_or_all,
      item.price_cents,
      item.driveUrl || '',
      item.deliveryUrl || '',
      item.file_count || 0,
      item.last_updated || new Date(),
      item.description || '',
      true
    ];
  });

  catalogSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

/** --------------------------
 * Pricing
 * -------------------------- */
function getBundlePriceCents_(grade, bundleType) {
  const pricing = {
    '8':  { 'Single Subject': 3900, 'Single Year': 12900, 'Master Bundle':  9900, 'Ultimate Bundle': 19900 },
    '9':  { 'Single Subject': 3900, 'Single Year': 12900, 'Master Bundle':  9900, 'Ultimate Bundle': 19900 },
    '10': { 'Single Subject': 4900, 'Single Year': 14900, 'Master Bundle': 11900, 'Ultimate Bundle': 24900 },
    '11': { 'Single Subject': 5900, 'Single Year': 17900, 'Master Bundle': 14900, 'Ultimate Bundle': 29900 },
    '12': { 'Single Subject': 9900, 'Single Year': 29900, 'Master Bundle': 19900, 'Ultimate Bundle': 49900 }
  };

  if (pricing[grade] && pricing[grade][bundleType] !== undefined) {
    return pricing[grade][bundleType];
  }
  return 0;
}

function uniqueSorted_(arr, comparator) {
  const seen = {};
  const out = [];

  (arr || []).forEach(function (v) {
    const key = String(v);
    if (!seen[key]) {
      seen[key] = true;
      out.push(key);
    }
  });

  return out.sort(comparator || compareNumericString_);
}

/** --------------------------
 * Bundle status
 * -------------------------- */
function getBundleStatus_() {
  const roots = ensureDriveRoots_();
  const bundlesRoot = roots.bundlesRoot;

  const defs = [
    { folder: 'Single_Subject', bundle_type: 'Single Subject' },
    { folder: 'Single_Year',    bundle_type: 'Single Year' },
    { folder: 'Master_Bundle',  bundle_type: 'Master Bundle' },
    { folder: 'Ultimate_Bundle', bundle_type: 'Ultimate Bundle' }
  ];

  const items = [];
  const totals = { bundles: 0, files: 0, records: 0, missingFolders: [] };

  defs.forEach(function (d) {
    const typeFolder = findSubFolder_(bundlesRoot, d.folder);
    if (!typeFolder) {
      totals.missingFolders.push(d.folder);
      return;
    }

    const gradeIt = typeFolder.getFolders();
    while (gradeIt.hasNext()) {
      const gradeFolder = gradeIt.next();
      const skuIt = gradeFolder.getFolders();

      while (skuIt.hasNext()) {
        const skuFolder = skuIt.next();
        const sku = String(skuFolder.getName() || '');
        if (sku.indexOf('SH-G') !== 0) continue;

        const manifest = readJsonFileNamedInFolder_(skuFolder, 'manifest.json') || {};
        const fileCount = countRealFilesRecursive_(skuFolder);
        const recordCount = Number(manifest.record_count || 0);

        totals.bundles += 1;
        totals.files += fileCount;
        totals.records += recordCount;

        items.push({
          sku: sku,
          bundle_type: d.bundle_type,
          grade: stringOrBlank_(manifest.grade || ''),
          year_or_range: stringOrBlank_(manifest.year_or_range || ''),
          subject_or_all: stringOrBlank_(manifest.subject_or_all || ''),
          record_count: recordCount,
          file_count: fileCount,
          generated_at: stringOrBlank_(manifest.generated_at || ''),
          folderUrl: skuFolder.getUrl()
        });
      }
    }
  });

  items.sort(function (a, b) {
    const g = compareNumericString_(a.grade, b.grade);
    if (g) return g;
    const t = String(a.bundle_type).localeCompare(String(b.bundle_type));
    if (t) return t;
    return String(a.sku).localeCompare(String(b.sku));
  });

  return {
    ok: true,
    scope: { grades: '8-12', years: yearRangeLabel_() },
    totals: totals,
    items: items,
    ts: nowIso_()
  };
}

function writeBundleStatusSheet_() {
  const ss = getSpreadsheet_();
  const name = 'BundleStatus';
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const payload = getBundleStatus_();
  const headers = [
    'sku',
    'bundle_type',
    'grade',
    'year_or_range',
    'subject_or_all',
    'record_count',
    'file_count',
    'generated_at',
    'folderUrl'
  ];

  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);

  const rows = (payload.items || []).map(function (i) {
    return [
      i.sku,
      i.bundle_type,
      i.grade,
      i.year_or_range,
      i.subject_or_all,
      i.record_count,
      i.file_count,
      i.generated_at,
      i.folderUrl
    ];
  });

  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sh.autoResizeColumns(1, headers.length);

  logRunIfAvailable_(
    'BUNDLE_STATUS',
    'WRITE_SHEET',
    String(rows.length),
    'BundleStatus sheet updated'
  );
}

function showBundleStatus_() {
  SpreadsheetApp.getUi().alert(JSON.stringify(getBundleStatus_(), null, 2));
}

/** --------------------------
 * Diagnostics
 * -------------------------- */
function diagnoseMissingUltimateGrades_() {
  const sh = requireSheet_('Queue');
  const rows = sh.getDataRange().getValues();
  const objs = rowsToObjects_(rows);

  const report = {
    allowed_scope: { grades: '8-12', years: yearRangeLabel_() },
    usable_by_grade: { '8': 0, '9': 0, '10': 0, '11': 0, '12': 0 },
    excluded_by_grade: { '8': 0, '9': 0, '10': 0, '11': 0, '12': 0 },
    excluded_examples: []
  };

  objs.forEach(function (r, idx) {
    const grade = normalizeGradeValue_(r.grade);
    const year = normalizeYearValue_(r.year);

    if (!grade) return;
    if (Number(grade) < 8 || Number(grade) > 12) return;

    const usable =
      grade &&
      year &&
      String(r.subject || '').trim() &&
      String(r.paper_type || '').trim() &&
      (String(r.paper_url || '').trim() || String(r.memo_url || '').trim()) &&
      isAllowedGradeYear_(grade, year);

    if (usable) {
      report.usable_by_grade[grade] += 1;
    } else {
      report.excluded_by_grade[grade] += 1;
      if (report.excluded_examples.length < 10) {
        report.excluded_examples.push({
          row: idx + 2,
          grade: grade,
          year: year,
          subject: r.subject || '',
          status: r.status || ''
        });
      }
    }
  });

  const message = JSON.stringify(report, null, 2);
  Logger.log(message);
  SpreadsheetApp.getUi().alert(message);
  return report;
}

/** --------------------------
 * Bundle Job Engine (auto-run until done, pause/resume)
 * -------------------------- */
const BUNDLE_JOB_STATE_KEY_ = 'BUNDLE_JOB_STATE';
const BUNDLE_JOB_ENABLED_KEY_ = 'BUNDLE_JOB_ENABLED';
const BUNDLE_JOB_CADENCE_MIN_KEY_ = 'BUNDLE_JOB_CADENCE_MIN';
const BUNDLE_JOB_LAST_RUN_KEY_ = 'BUNDLE_JOB_LAST_RUN';
const BUNDLE_JOB_TRIGGER_HANDLER_ = 'bundleJobTick_';
const BUNDLE_JOB_MAX_RUNTIME_MS_ = 4 * 60 * 1000;
const BUNDLE_JOB_HEARTBEAT_EVERY_ = 10;

function deleteProjectTriggersByHandler_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(t);
  });
}

function loadBundleJobState_() {
  const raw = PropertiesService.getScriptProperties().getProperty(BUNDLE_JOB_STATE_KEY_);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveBundleJobState_(state) {
  state = state || {};
  state.updated_at = nowIso_();
  PropertiesService.getScriptProperties().setProperty(
    BUNDLE_JOB_STATE_KEY_,
    JSON.stringify(state)
  );
}

function clearBundleJobState_() {
  PropertiesService.getScriptProperties().deleteProperty(BUNDLE_JOB_STATE_KEY_);
}

function bundleModeToCodes_(mode) {
  const key = String(mode || 'ALL').toUpperCase();
  if (key === 'SS') return ['SS'];
  if (key === 'SY') return ['SY'];
  if (key === 'MB') return ['MB'];
  if (key === 'UB') return ['UB'];
  return ['SS', 'SY', 'MB', 'UB'];
}

function bundleTypeRank_(code) {
  const key = String(code || '').toUpperCase();
  if (key === 'SS') return 1;
  if (key === 'SY') return 2;
  if (key === 'MB') return 3;
  if (key === 'UB') return 4;
  return 9;
}

function makeBundleTask_(code, bundleFolderName, bundleTypeName, sku, meta, records) {
  return {
    code: code,
    bundleFolderName: bundleFolderName,
    bundleTypeName: bundleTypeName,
    sku: sku,
    meta: meta,
    records: records || []
  };
}

function buildBundleTasksForCodes_(codes) {
  const tasks = [];
  const queue = getUsableQueueRecords_();
  const wanted = {};
  (codes || []).forEach(function (c) { wanted[String(c).toUpperCase()] = true; });

  // SS
  if (wanted.SS) {
    const groupedSS = {};
    queue.forEach(function (r) {
      const key = [r.grade, r.subject, r.year].join('\n');
      if (!groupedSS[key]) groupedSS[key] = [];
      groupedSS[key].push(r);
    });

    Object.keys(groupedSS).sort().forEach(function (key) {
      const records = groupedSS[key];
      const first = records[0];
      tasks.push(
        makeBundleTask_(
          'SS',
          'Single_Subject',
          'Single Subject',
          buildSku_(first.grade, first.subject, first.year, 'SS'),
          {
            grade: first.grade,
            subject_or_all: first.subject,
            year_or_range: first.year,
            title:
              'Grade ' + first.grade + ' ' + first.subject + ' ' + first.year + ' Single Subject Bundle'
          },
          records
        )
      );
    });
  }

  // SY
  if (wanted.SY) {
    const groupedSY = {};
    queue.forEach(function (r) {
      const key = [r.grade, r.year].join('\n');
      if (!groupedSY[key]) groupedSY[key] = [];
      groupedSY[key].push(r);
    });

    Object.keys(groupedSY).sort().forEach(function (key) {
      const records = groupedSY[key];
      const first = records[0];
      tasks.push(
        makeBundleTask_(
          'SY',
          'Single_Year',
          'Single Year',
          buildSku_(first.grade, 'ALL', first.year, 'SY'),
          {
            grade: first.grade,
            subject_or_all: 'ALL',
            year_or_range: first.year,
            title:
              'Grade ' + first.grade + ' ' + first.year + ' Single Year Bundle'
          },
          records
        )
      );
    });
  }

  // MB
  if (wanted.MB) {
    const groupedMB = {};
    queue.forEach(function (r) {
      const key = [r.grade, r.subject].join('\n');
      if (!groupedMB[key]) groupedMB[key] = [];
      groupedMB[key].push(r);
    });

    Object.keys(groupedMB).sort().forEach(function (key) {
      const records = groupedMB[key];
      const first = records[0];
      const yearRange = recordsYearRange_(records) || yearRangeLabel_();

      tasks.push(
        makeBundleTask_(
          'MB',
          'Master_Bundle',
          'Master Bundle',
          buildSku_(first.grade, first.subject, yearRange, 'MB'),
          {
            grade: first.grade,
            subject_or_all: first.subject,
            year_or_range: yearRange,
            title:
              'Grade ' + first.grade + ' ' + first.subject + ' Master Bundle'
          },
          records
        )
      );
    });
  }

  // UB
  if (wanted.UB) {
    const groupedUB = {};
    queue.forEach(function (r) {
      const key = String(r.grade);
      if (!groupedUB[key]) groupedUB[key] = [];
      groupedUB[key].push(r);
    });

    Object.keys(groupedUB).sort(compareNumericString_).forEach(function (grade) {
      const records = groupedUB[grade];
      const yearRange = recordsYearRange_(records) || yearRangeLabel_();

      tasks.push(
        makeBundleTask_(
          'UB',
          'Ultimate_Bundle',
          'Ultimate Bundle',
          buildSku_(grade, 'ALL', yearRange, 'UB'),
          {
            grade: grade,
            subject_or_all: 'ALL',
            year_or_range: yearRange,
            title: 'Grade ' + grade + ' Ultimate Bundle'
          },
          records
        )
      );
    });
  }

  tasks.sort(function (a, b) {
    const r = bundleTypeRank_(a.code) - bundleTypeRank_(b.code);
    if (r) return r;
    return String(a.sku).localeCompare(String(b.sku));
  });

  return tasks;
}

function finalizeBundleTask_(bundleFolder, task) {
  const manifest = {
    sku: task.sku,
    bundle_type: task.bundleTypeName,
    grade: task.meta.grade,
    year_or_range: task.meta.year_or_range,
    subject_or_all: task.meta.subject_or_all,
    title: task.meta.title,
    record_count: (task.records || []).length,
    generated_at: nowIso_(),
    file_count: countRealFilesRecursive_(bundleFolder),
    queue_records: (task.records || []).map(function (r) {
      return {
        provider: r.provider,
        province: r.province,
        grade: r.grade,
        subject: r.subject,
        year: r.year,
        language: r.language,
        paper_type: r.paper_type,
        source_url: r.source_url,
        target_folder_url: r.target_folder_url
      };
    })
  };

  writeBundleManifest_(bundleFolder, manifest);
  writeBundleReadme_(bundleFolder, task.meta.title, task.records || []);
}

function startBundleJobForMode_(mode) {
  const props = PropertiesService.getScriptProperties();
  const codes = bundleModeToCodes_(mode);
  const cadence = Math.max(
    1,
    Math.floor(Number(props.getProperty(BUNDLE_JOB_CADENCE_MIN_KEY_) || 1))
  );

  const state = {
    mode: String(mode || 'ALL').toUpperCase(),
    codes: codes,
    taskIndex: 0,
    currentTaskSku: '',
    recordIndex: 0,
    paused: false,
    started_at: nowIso_()
  };

  saveBundleJobState_(state);
  props.setProperty(BUNDLE_JOB_ENABLED_KEY_, 'true');
  props.setProperty(BUNDLE_JOB_CADENCE_MIN_KEY_, String(cadence));

  deleteProjectTriggersByHandler_(BUNDLE_JOB_TRIGGER_HANDLER_);
  ScriptApp.newTrigger(BUNDLE_JOB_TRIGGER_HANDLER_)
    .timeBased()
    .everyMinutes(cadence)
    .create();

  logRunIfAvailable_(
    'BUNDLE_JOB',
    'START',
    state.mode,
    'Started bundle job at ' + cadence + ' min cadence'
  );

  bundleJobTick_();
}

function startSingleSubjectBundleJob_() { return startBundleJobForMode_('SS'); }
function startSingleYearBundleJob_()    { return startBundleJobForMode_('SY'); }
function startMasterBundleJob_()        { return startBundleJobForMode_('MB'); }
function startUltimateBundleJob_()      { return startBundleJobForMode_('UB'); }
function startAllBundleJobs_()          { return startBundleJobForMode_('ALL'); }

function pauseBundleJob_() {
  const props = PropertiesService.getScriptProperties();
  const state = loadBundleJobState_();
  if (state) {
    state.paused = true;
    saveBundleJobState_(state);
  }
  props.setProperty(BUNDLE_JOB_ENABLED_KEY_, 'false');
  deleteProjectTriggersByHandler_(BUNDLE_JOB_TRIGGER_HANDLER_);
  logRunIfAvailable_(
    'BUNDLE_JOB',
    'PAUSE',
    state && state.mode ? state.mode : '',
    'Paused bundle job; current run may still finish this chunk'
  );
}

function resumeBundleJob_() {
  const props = PropertiesService.getScriptProperties();
  const state = loadBundleJobState_();
  if (!state) throw new Error('No paused bundle job state found.');

  const cadence = Math.max(
    1,
    Math.floor(Number(props.getProperty(BUNDLE_JOB_CADENCE_MIN_KEY_) || 1))
  );

  state.paused = false;
  saveBundleJobState_(state);

  props.setProperty(BUNDLE_JOB_ENABLED_KEY_, 'true');
  props.setProperty(BUNDLE_JOB_CADENCE_MIN_KEY_, String(cadence));

  deleteProjectTriggersByHandler_(BUNDLE_JOB_TRIGGER_HANDLER_);
  ScriptApp.newTrigger(BUNDLE_JOB_TRIGGER_HANDLER_)
    .timeBased()
    .everyMinutes(cadence)
    .create();

  logRunIfAvailable_(
    'BUNDLE_JOB',
    'RESUME',
    state.mode || '',
    'Resumed bundle job at ' + cadence + ' min cadence'
  );

  bundleJobTick_();
}

function stopBundleJob_() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(BUNDLE_JOB_ENABLED_KEY_, 'false');
  props.deleteProperty(BUNDLE_JOB_LAST_RUN_KEY_);
  deleteProjectTriggersByHandler_(BUNDLE_JOB_TRIGGER_HANDLER_);
  clearBundleJobState_();
  logRunIfAvailable_(
    'BUNDLE_JOB',
    'STOP',
    '',
    'Stopped bundle job and cleared saved progress'
  );
}

function getBundleJobStatus_() {
  const props = PropertiesService.getScriptProperties();
  const state = loadBundleJobState_();
  const enabled = props.getProperty(BUNDLE_JOB_ENABLED_KEY_) === 'true';
  const cadence = Number(props.getProperty(BUNDLE_JOB_CADENCE_MIN_KEY_) || 1);
  const lastRun = props.getProperty(BUNDLE_JOB_LAST_RUN_KEY_) || '';
  const triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === BUNDLE_JOB_TRIGGER_HANDLER_;
  });

  const tasks = state
    ? buildBundleTasksForCodes_(state.codes || bundleModeToCodes_('ALL'))
    : [];

  let currentTask = null;
  if (state && tasks.length) {
    let idx = Number(state.taskIndex || 0);
    if (state.currentTaskSku) {
      const found = tasks.findIndex(function (t) { return t.sku === state.currentTaskSku; });
      if (found >= 0) idx = found;
    }
    currentTask = tasks[idx] || null;
  }

  return {
    ok: true,
    enabled: enabled,
    cadence_minutes: cadence,
    last_run: lastRun,
    trigger_count: triggers.length,
    state: state,
    current_task: currentTask
      ? {
          code: currentTask.code,
          label: currentTask.bundleTypeName,
          sku: currentTask.sku,
          total_records: currentTask.records.length,
          current_record_index: Number((state && state.recordIndex) || 0)
        }
      : null,
    total_tasks: tasks.length,
    ts: nowIso_()
  };
}

function bundleJobTick_() {
  const props = PropertiesService.getScriptProperties();
  const enabled = props.getProperty(BUNDLE_JOB_ENABLED_KEY_) === 'true';

  if (!enabled) {
    deleteProjectTriggersByHandler_(BUNDLE_JOB_TRIGGER_HANDLER_);
    logRunIfAvailable_(
      'BUNDLE_JOB',
      'SKIP_DISABLED',
      '',
      'Bundle job disabled; trigger cleaned up'
    );
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    logRunIfAvailable_(
      'BUNDLE_JOB',
      'SKIP_LOCKED',
      '',
      'Another bundle job tick is already running'
    );
    return;
  }

  try {
    props.setProperty(BUNDLE_JOB_LAST_RUN_KEY_, nowIso_());

    let state = loadBundleJobState_();
    if (!state) {
      props.setProperty(BUNDLE_JOB_ENABLED_KEY_, 'false');
      deleteProjectTriggersByHandler_(BUNDLE_JOB_TRIGGER_HANDLER_);
      logRunIfAvailable_(
        'BUNDLE_JOB',
        'NO_STATE',
        '',
        'No bundle job state found; stopping'
      );
      return;
    }

    if (state.paused) {
      props.setProperty(BUNDLE_JOB_ENABLED_KEY_, 'false');
      deleteProjectTriggersByHandler_(BUNDLE_JOB_TRIGGER_HANDLER_);
      logRunIfAvailable_('BUNDLE_JOB', 'PAUSED', state.mode || '', 'Bundle job is paused');
      return;
    }

    const tasks = buildBundleTasksForCodes_(state.codes || bundleModeToCodes_('ALL'));
    const startMs = Date.now();
    let heartbeat = 0;

    while (state.taskIndex < tasks.length) {
      const task = tasks[state.taskIndex];
      state.currentTaskSku = task.sku;

      const bundleTypeRoot = ensureBundleRoot_(task.bundleFolderName);
      const gradeFolder = ensureSubFolder_(
        bundleTypeRoot,
        'Grade_' + sanitizeFolderName_(task.meta.grade)
      );
      const bundleFolder = ensureSubFolder_(gradeFolder, task.sku);

      // fresh rebuild when starting this task
      if (Number(state.recordIndex || 0) === 0) {
        clearBundleFolderContents_(bundleFolder);
      }

      while (state.recordIndex < task.records.length) {
        copyRecordFilesIntoFolder_(task.records[state.recordIndex], bundleFolder);
        state.recordIndex += 1;
        heartbeat += 1;

        if (heartbeat % BUNDLE_JOB_HEARTBEAT_EVERY_ === 0) {
          saveBundleJobState_(state);
        }

        if (Date.now() - startMs >= BUNDLE_JOB_MAX_RUNTIME_MS_) {
          saveBundleJobState_(state);
          logRunIfAvailable_(
            'BUNDLE_JOB',
            'YIELD',
            task.sku,
            'Yielding due to runtime limit'
          );
          return;
        }
      }

      // finalize task
      finalizeBundleTask_(bundleFolder, task);
      logRunIfAvailable_(
        'BUNDLE_JOB',
        'TASK_DONE',
        task.sku,
        'Completed bundle task'
      );

      state.taskIndex += 1;
      state.recordIndex = 0;
      state.currentTaskSku = '';
      saveBundleJobState_(state);
    }

    // all tasks complete
    props.setProperty(BUNDLE_JOB_ENABLED_KEY_, 'false');
    deleteProjectTriggersByHandler_(BUNDLE_JOB_TRIGGER_HANDLER_);
    clearBundleJobState_();

    logRunIfAvailable_(
      'BUNDLE_JOB',
      'COMPLETE',
      String(tasks.length),
      'Bundle job completed successfully'
    );
  } catch (err) {
    logRunIfAvailable_('BUNDLE_JOB', 'ERROR', '', String(err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}