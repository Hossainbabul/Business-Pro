export const GAS_CODE_GS = `/**
 * Business PRO — Google Apps Script Backend (Code.gs)
 * Atomic CRUD powered by LockService & Google Sheets
 * Tabs: SETTINGS, USERS, ATTRS, PRODUCTS, PARTIES, INVOICES, INV_LINES,
 *       PAYMENTS, METHODS, TRANSFERS, EXPENSES, LOANS, INVESTMENTS
 */

const SHEET_TABS = {
  SETTINGS: ['key', 'value'],
  USERS: ['id', 'username', 'password', 'fullName', 'role', 'permissions', 'active'],
  ATTRS: ['id', 'type', 'name'],
  PRODUCTS: ['id', 'sku', 'name', 'category', 'brand', 'color', 'size', 'buyPrice', 'sellPrice', 'openingStock', 'reorderLevel', 'createdAt'],
  PARTIES: ['id', 'type', 'name', 'phone', 'address', 'openingBalance', 'isWalking', 'createdAt'],
  INVOICES: ['id', 'invoiceNo', 'type', 'date', 'partyId', 'partyName', 'subtotal', 'discountType', 'discountValue', 'discountAmount', 'taxPercent', 'taxAmount', 'prevDue', 'grandTotal', 'paidAmount', 'methodId', 'dueAmount', 'note', 'createdBy', 'createdAt'],
  INV_LINES: ['id', 'invoiceId', 'productId', 'productName', 'description', 'qty', 'rate', 'costRate', 'total'],
  PAYMENTS: ['id', 'receiptNo', 'date', 'category', 'refId', 'refName', 'direction', 'amount', 'discount', 'methodId', 'note', 'createdBy', 'createdAt'],
  METHODS: ['id', 'name', 'accountNo', 'openingBalance', 'isDefault'],
  TRANSFERS: ['id', 'date', 'fromMethodId', 'toMethodId', 'amount', 'note', 'createdBy', 'createdAt'],
  EXPENSES: ['id', 'date', 'category', 'title', 'amount', 'methodId', 'note', 'createdBy', 'createdAt'],
  LOANS: ['id', 'date', 'direction', 'personName', 'phone', 'principal', 'interestRate', 'methodId', 'note', 'createdBy', 'createdAt'],
  INVESTMENTS: ['id', 'date', 'investorName', 'phone', 'capitalAmount', 'sharePercent', 'methodId', 'note', 'createdBy', 'createdAt']
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Business PRO — Inventory & Accounting')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_TABS).forEach(function(tabName) {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(SHEET_TABS[tabName]);
      sheet.getRange(1, 1, 1, SHEET_TABS[tabName].length)
        .setFontWeight('bold')
        .setBackground('#0f172a')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });
  return { ok: true, message: 'All 13 Business PRO sheets initialized.' };
}

function getAllDatabase() {
  setupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = {};
  Object.keys(SHEET_TABS).forEach(function(tabName) {
    const sheet = ss.getSheetByName(tabName);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      data[tabName] = [];
      return;
    }
    const headers = values[0];
    data[tabName] = values.slice(1).map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });
  });
  return data;
}

function verifyAdminPassword(adminPassword) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('USERS');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][4]) === 'Admin' && String(rows[i][2]) === String(adminPassword) && Boolean(rows[i][6])) {
      return true;
    }
  }
  return false;
}

function upsertRecord(tabName, record, adminPassword, requireAdmin) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (requireAdmin && !verifyAdminPassword(adminPassword)) {
      throw new Error('Admin password verification failed.');
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(tabName);
    const headers = SHEET_TABS[tabName];
    const rows = sheet.getDataRange().getValues();
    const rowValues = headers.map(function(h) { return record[h] !== undefined ? record[h] : ''; });

    let foundRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(record.id)) {
        foundRow = i + 1;
        break;
      }
    }
    if (foundRow > -1) {
      sheet.getRange(foundRow, 1, 1, headers.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
    return { ok: true, id: record.id };
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord(tabName, id, adminPassword) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!verifyAdminPassword(adminPassword)) {
      throw new Error('Admin password verification failed.');
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(tabName);
    const rows = sheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
      }
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function saveInvoiceAtomic(invoice, lines, isEdit, adminPassword) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (isEdit && !verifyAdminPassword(adminPassword)) {
      throw new Error('Admin password verification failed.');
    }
    upsertRecord('INVOICES', invoice, adminPassword, false);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const lineSheet = ss.getSheetByName('INV_LINES');
    const existing = lineSheet.getDataRange().getValues();
    for (let i = existing.length - 1; i >= 1; i--) {
      if (String(existing[i][1]) === String(invoice.id)) {
        lineSheet.deleteRow(i + 1);
      }
    }
    const lineHeaders = SHEET_TABS.INV_LINES;
    lines.forEach(function(line) {
      lineSheet.appendRow(lineHeaders.map(function(h) { return line[h] !== undefined ? line[h] : ''; }));
    });
    return { ok: true, invoiceId: invoice.id };
  } finally {
    lock.releaseLock();
  }
}
`;
