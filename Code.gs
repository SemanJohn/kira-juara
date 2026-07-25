/**
 * KIRA JUARA — Backend (Google Apps Script + Google Sheets)
 * ---------------------------------------------------------
 * Semua endpoint guna GET + JSONP supaya tiada masalah CORS
 * bila dipanggil dari GitHub Pages.
 *
 * CARA PASANG
 * 1. Buka Google Sheet baharu, namakan "Kira Juara DB".
 * 2. Menu: Extensions → Apps Script. Padam kod sedia ada, tampal fail ini.
 * 3. Simpan. Klik Run → setup() sekali (beri kebenaran bila diminta).
 * 4. Deploy → New deployment → Type: Web app
 *      Execute as      : Me
 *      Who has access  : Anyone
 * 5. Salin "Web app URL" (.../exec) → masukkan dalam index.html (API_URL).
 *
 * PENTING: setiap kali kod diubah, buat Deploy → Manage deployments →
 * Edit (pensil) → Version: New version → Deploy. Kalau tidak, URL lama
 * masih jalankan kod lama.
 */

var SHEET_SCORES = 'Scores';
var SHEET_DAILY  = 'Daily';

var HEAD_SCORES = ['ts','tarikh','id','nama','kelas','mode','operasi','tahap',
                   'markah','betul','silap','soalan','streak','kejituan'];
var HEAD_DAILY  = ['tarikh','id','nama','kelas','sesi','betul','silap',
                   'markahTerbaik','streakTerbaik','markahJumlah'];

/* ---------- utiliti ---------- */
function ss_(){ return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name, head){
  var s = ss_().getSheetByName(name);
  if(!s){
    s = ss_().insertSheet(name);
    s.getRange(1,1,1,head.length).setValues([head]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}

function setup(){
  sheet_(SHEET_SCORES, HEAD_SCORES);
  sheet_(SHEET_DAILY,  HEAD_DAILY);
  var d = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('Helaian1');
  if(d && ss_().getSheets().length > 2) ss_().deleteSheet(d);
  return 'Siap. Sheet Scores & Daily telah dicipta.';
}

function today_(){
  return Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
}

function clean_(v, max){
  return String(v == null ? '' : v).replace(/[<>\t\r\n]/g,'').trim().slice(0, max || 20);
}

function num_(v){ var n = parseInt(v,10); return isNaN(n) ? 0 : n; }

/* JSONP / JSON keluaran */
function out_(obj, callback){
  var json = JSON.stringify(obj);
  if(callback && /^[A-Za-z_$][\w$]*$/.test(callback)){
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- pintu masuk ---------- */
function doGet(e){
  var p  = (e && e.parameter) || {};
  var cb = p.callback;
  try{
    switch(p.action){
      case 'ping'       : return out_({ok:true, time:new Date().toISOString()}, cb);
      case 'submit'     : return out_(submit_(p), cb);
      case 'leaderboard': return out_(leaderboard_(p), cb);
      case 'me'         : return out_(me_(p), cb);
      default           : return out_({ok:false, error:'action tidak dikenali'}, cb);
    }
  }catch(err){
    return out_({ok:false, error:String(err)}, cb);
  }
}

function doPost(e){
  var p = {};
  try{ p = JSON.parse(e.postData.contents); }catch(err){ p = (e && e.parameter) || {}; }
  try{
    if(p.action === 'submit') return out_(submit_(p));
    return out_({ok:false, error:'action tidak dikenali'});
  }catch(err){
    return out_({ok:false, error:String(err)});
  }
}

/* ---------- 1. hantar markah ---------- */
function submit_(p){
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    var id     = clean_(p.id, 40) || Utilities.getUuid().slice(0,8);
    var nama   = clean_(p.nama, 14).toUpperCase() || 'JUARA';
    var kelas  = clean_(p.kelas, 14);
    var mode   = clean_(p.mode, 8)  || 'tt';
    var op     = clean_(p.op, 2)    || 'x';
    var tahap  = clean_(p.tahap, 12)|| 'mudah';
    var markah = num_(p.markah), betul = num_(p.betul), silap = num_(p.silap);
    var streak = num_(p.streak);
    var soalan = betul + silap;
    var acc    = soalan ? Math.round(betul / soalan * 100) : 0;
    var tarikh = today_();

    sheet_(SHEET_SCORES, HEAD_SCORES).appendRow([
      new Date(), tarikh, id, nama, kelas, mode, op, tahap,
      markah, betul, silap, soalan, streak, acc
    ]);

    if(mode === 'tt') bumpDaily_(tarikh, id, nama, kelas, betul, silap, markah, streak);

    return {ok:true, id:id, kedudukan: rankOf_(op, tahap, markah)};
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 2. statistik harian ---------- */
function bumpDaily_(tarikh, id, nama, kelas, betul, silap, markah, streak){
  var s = sheet_(SHEET_DAILY, HEAD_DAILY);
  var v = s.getDataRange().getValues();
  for(var i = 1; i < v.length; i++){
    if(String(v[i][0]) === tarikh && String(v[i][1]) === id){
      s.getRange(i+1, 3, 1, 8).setValues([[
        nama, kelas,
        num_(v[i][4]) + 1,
        num_(v[i][5]) + betul,
        num_(v[i][6]) + silap,
        Math.max(num_(v[i][7]), markah),
        Math.max(num_(v[i][8]), streak),
        num_(v[i][9]) + markah
      ]]);
      return;
    }
  }
  s.appendRow([tarikh, id, nama, kelas, 1, betul, silap, markah, streak, markah]);
}

/* ---------- 3. papan markah ---------- */
/** Markah TERBAIK setiap pemain bagi kombinasi operasi + tahap. */
function leaderboard_(p){
  var op    = clean_(p.op, 2)     || 'x';
  var tahap = clean_(p.tahap, 12) || 'mudah';
  var limit = Math.min(num_(p.limit) || 20, 100);

  var v = sheet_(SHEET_SCORES, HEAD_SCORES).getDataRange().getValues();
  var best = {};
  for(var i = 1; i < v.length; i++){
    if(String(v[i][5]) !== 'tt') continue;
    if(String(v[i][6]) !== op || String(v[i][7]) !== tahap) continue;
    var id = String(v[i][2]), m = num_(v[i][8]);
    if(!best[id] || m > best[id].markah){
      best[id] = {id:id, nama:v[i][3], kelas:v[i][4], markah:m,
                  betul:num_(v[i][9]), tarikh:String(v[i][1])};
    }
  }
  var rows = Object.keys(best).map(function(k){ return best[k]; })
              .sort(function(a,b){ return b.markah - a.markah; })
              .slice(0, limit);
  rows.forEach(function(r,i){ r.no = i + 1; });
  return {ok:true, op:op, tahap:tahap, rows:rows};
}

function rankOf_(op, tahap, markah){
  var lb = leaderboard_({op:op, tahap:tahap, limit:100}).rows;
  for(var i = 0; i < lb.length; i++) if(lb[i].markah <= markah) return i + 1;
  return lb.length + 1;
}

/* ---------- 4. statistik pemain ---------- */
function me_(p){
  var id = clean_(p.id, 40);
  if(!id) return {ok:false, error:'id diperlukan'};

  var v = sheet_(SHEET_DAILY, HEAD_DAILY).getDataRange().getValues();
  var harian = [], jum = {sesi:0, betul:0, silap:0, streak:0};
  for(var i = 1; i < v.length; i++){
    if(String(v[i][1]) !== id) continue;
    harian.push({tarikh:String(v[i][0]), sesi:num_(v[i][4]), betul:num_(v[i][5]),
                 silap:num_(v[i][6]), markahTerbaik:num_(v[i][7]), streakTerbaik:num_(v[i][8])});
    jum.sesi  += num_(v[i][4]);
    jum.betul += num_(v[i][5]);
    jum.silap += num_(v[i][6]);
    jum.streak = Math.max(jum.streak, num_(v[i][8]));
  }
  harian.sort(function(a,b){ return a.tarikh < b.tarikh ? 1 : -1; });
  return {ok:true, id:id, jumlah:jum, harian:harian.slice(0,30), hariIni:today_()};
}
