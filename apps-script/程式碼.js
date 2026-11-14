function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function toHalfWidthNum(str) {
  if (!str) return "";
  return String(str).replace(/[０-９]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
}

function normalizePhoneText(str) {
  return toHalfWidthNum(str)
    .replace(/\uFF0B/g, "+")
    .replace(/[\uFF0D\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\uFF08/g, "(")
    .replace(/\uFF09/g, ")")
    .replace(/[\u00A0\u3000]/g, " ");
}

function normalizePhoneWhitespace(str) {
  return String(str).replace(/[ \t]+/g, " ").trim();
}

function phoneDigitCount(str) {
  var m = String(str).match(/\d/g);
  return m ? m.length : 0;
}

function isDateLikePhone(raw) {
  var t = normalizePhoneWhitespace(raw);
  if (/^(?:19|20)\d{2}[\s.\-]\d{1,2}[\s.\-]\d{1,2}$/.test(t)) return true;
  if (/^\d{1,2}[\s.\-]\d{1,2}[\s.\-](?:19|20)\d{2}$/.test(t)) return true;
  var digits = t.replace(/\D/g, "");
  if (digits.length === 8 && /^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])$/.test(digits) && t.charAt(0) !== "+" && t.indexOf("(") === -1) {
    return true;
  }
  return false;
}

function stripPhoneNoise(text) {
  return String(text)
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/(?:19|20)\d{2}[\s./-]\d{1,2}[\s./-]\d{1,2}/g, " ")
    .replace(/\d{1,2}[\s./-]\d{1,2}[\s./-](?:19|20)\d{2}/g, " ")
    .replace(/\d{1,2}:\d{2}(?::\d{2})?/g, " ");
}

function cleanPhoneEdges(raw) {
  return String(raw).replace(/^[\s.\-]+/, "").replace(/[\s.\-]+$/, "");
}

function isPhoneSepChar(c) {
  return c === " " || c === "\t" || c === "(" || c === ")" || c === "." || c === "-";
}

function findPhoneCandidates(text) {
  var src = String(text || "");
  var results = [];
  var i = 0;
  while (i < src.length) {
    var ch = src.charAt(i);
    var prev = i > 0 ? src.charAt(i - 1) : "";
    var start = -1;
    var sawPlus = false;
    if (ch === "+" && (i === 0 || prev < "0" || prev > "9")) {
      var k = i + 1;
      while (k < src.length && (src.charAt(k) === " " || src.charAt(k) === "\t")) k++;
      if (k < src.length && src.charAt(k) >= "0" && src.charAt(k) <= "9") {
        start = i;
        sawPlus = true;
      }
    } else if (ch === "(" && (i === 0 || prev < "0" || prev > "9")) {
      var p = i + 1;
      while (p < src.length && (src.charAt(p) === " " || src.charAt(p) === "\t")) p++;
      if (p < src.length && src.charAt(p) >= "0" && src.charAt(p) <= "9") start = i;
    } else if (ch >= "0" && ch <= "9" && (i === 0 || prev < "0" || prev > "9")) {
      start = i;
    }
    if (start < 0) { i++; continue; }

    var end = start + (sawPlus ? 1 : 0);
    while (end < src.length && (src.charAt(end) === " " || src.charAt(end) === "\t")) end++;
    var digits = "";
    var sawSep = sawPlus;
    while (end < src.length && digits.length < 15) {
      var c = src.charAt(end);
      if (c >= "0" && c <= "9") {
        digits += c;
        end++;
        continue;
      }
      if (!isPhoneSepChar(c)) break;
      var n = end;
      while (n < src.length && isPhoneSepChar(src.charAt(n))) n++;
      if (n >= src.length || src.charAt(n) < "0" || src.charAt(n) > "9") break;
      var gap = src.slice(end, n);
      var spaces = 0;
      var gi;
      for (gi = 0; gi < gap.length; gi++) {
        if (gap.charAt(gi) === " " || gap.charAt(gi) === "\t") spaces++;
      }
      if (spaces > 3) break;
      if (gap.indexOf(".") !== -1 && spaces > 0) break;
      sawSep = true;
      end = n;
    }
    var tooLong = false;
    if (digits.length >= 15 && end < src.length) {
      var look = end;
      while (look < src.length && isPhoneSepChar(src.charAt(look))) look++;
      if (look < src.length && src.charAt(look) >= "0" && src.charAt(look) <= "9") {
        tooLong = true;
        while (look < src.length && (isPhoneSepChar(src.charAt(look)) || (src.charAt(look) >= "0" && src.charAt(look) <= "9"))) look++;
        end = look;
      }
    }
    var raw = cleanPhoneEdges(src.slice(start, end));
    var onlyDigits = raw.replace(/\D/g, "");
    if (!tooLong && onlyDigits.length >= 7 && onlyDigits.length <= 15 && !isDateLikePhone(raw)) {
      results.push({
        display: normalizePhoneWhitespace(raw),
        digits: onlyDigits,
        index: start,
        formatted: sawSep || raw.charAt(0) === "+"
      });
    }
    i = Math.max(end, start + 1);
  }
  return results;
}

function lineIsOnlyPhone(line) {
  var t = normalizePhoneWhitespace(line);
  if (!t) return false;
  if (phoneDigitCount(t) < 7 || phoneDigitCount(t) > 15) return false;
  return t.replace(/[\d\s().+\-]/g, "").length === 0 && !isDateLikePhone(t);
}

function hasIdContext(text, index) {
  var before = text.slice(Math.max(0, index - 12), index);
  return /訂單|編號|單號|序號|客編|No\.?|#|ID/i.test(before);
}

function pickPhoneCandidate(list, allowBare) {
  var pool = [];
  var i;
  for (i = 0; i < list.length; i++) {
    if (allowBare || list[i].formatted) pool.push(list[i]);
  }
  if (!pool.length) return null;
  pool.sort(function(a, b) {
    var ap = a.display.charAt(0) === "+" ? 0 : 1;
    var bp = b.display.charAt(0) === "+" ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.index - b.index;
  });
  return pool[0];
}

function lineHasPhoneLabel(line) {
  if (/(?:行動電話|聯絡電話|電話|手機)\s*[:：]/.test(line)) return true;
  if (/^\s*(?:行動電話|聯絡電話|電話|手機)\s*$/.test(line)) return true;
  if (/(?:^|\s)(?:Telephone|Phone|Mobile|Cell|Tel)\.?\s*[:：]/i.test(line)) return true;
  if (/^\s*(?:Telephone|Phone|Mobile|Cell|Tel)\.?\s*$/i.test(line)) return true;
  return false;
}

function candidatesWithoutIds(list, src, allowBare) {
  var kept = [];
  var i;
  for (i = 0; i < list.length; i++) {
    if (!list[i].formatted && hasIdContext(src, list[i].index)) continue;
    if (!list[i].formatted && !allowBare && list[i].digits.length < 8) continue;
    kept.push(list[i]);
  }
  return kept;
}

function extractLabeledPhone(text) {
  var lines = String(text).split(/\r?\n/);
  var i;
  for (i = 0; i < lines.length; i++) {
    if (!lineHasPhoneLabel(lines[i])) continue;
    var src = stripPhoneNoise(lines[i]);
    var onLine = pickPhoneCandidate(candidatesWithoutIds(findPhoneCandidates(src), src, true), true);
    if (onLine) return onLine;
    if (i + 1 < lines.length && lineIsOnlyPhone(lines[i + 1])) {
      var nextSrc = stripPhoneNoise(lines[i + 1]);
      var onNext = pickPhoneCandidate(findPhoneCandidates(nextSrc), true);
      if (onNext) return onNext;
    }
  }
  return null;
}

function preferTaiwanDigits(info) {
  if (info && /^09\d{8}$/.test(info.digits)) return { display: info.digits, digits: info.digits };
  return info;
}

function extractAnyPhone(text) {
  var src = stripPhoneNoise(text);
  var candidates = candidatesWithoutIds(findPhoneCandidates(src), src, false);
  var formatted = [];
  var bare = [];
  var i;
  for (i = 0; i < candidates.length; i++) {
    if (candidates[i].formatted) formatted.push(candidates[i]);
    else bare.push(candidates[i]);
  }
  var pool = formatted.length ? formatted : bare;
  if (!pool.length) {
    var lines = String(text).split(/\r?\n/);
    for (i = 0; i < lines.length; i++) {
      if (!lineIsOnlyPhone(lines[i])) continue;
      var lineSrc = stripPhoneNoise(lines[i]);
      var lineHits = findPhoneCandidates(lineSrc);
      if (lineHits.length) { pool = [lineHits[0]]; break; }
    }
  }
  return pickPhoneCandidate(pool, true);
}

function extractPhone(desc) {
  var text = normalizePhoneText(desc || "");
  if (!text) return { display: "", digits: "" };

  var tw = text.match(/(?:^|\D)(09\d{2}[-\s]?\d{3}[-\s]?\d{3}|09\d{8})(?!\d)/);
  if (tw) {
    var twDigits = tw[1].replace(/\D/g, "");
    if (twDigits.length === 10) return { display: twDigits, digits: twDigits };
  }

  var labeled = preferTaiwanDigits(extractLabeledPhone(text));
  if (labeled) return { display: labeled.display, digits: labeled.digits };

  var any = preferTaiwanDigits(extractAnyPhone(text));
  if (any) return { display: any.display, digits: any.digits };
  return { display: "", digits: "" };
}

function taipeiStartOfDay(date) {
  var ymd = Utilities.formatDate(date, "Asia/Taipei", "yyyy-MM-dd");
  return new Date(ymd + "T00:00:00+08:00");
}

function taipeiStamp(date) {
  return Utilities.formatDate(date, "Asia/Taipei", "MM/dd HH:mm");
}

function handleRequest(e) {
  try {
    var p = {};
    if (e && e.parameter) { p = e.parameter; }
    if (!p.action && e && e.postData && e.postData.contents) {
      try { p = JSON.parse(e.postData.contents); } catch(err) {}
    }
    var action = p.action || "fetch";

    if (action !== "fetch") {
      return handleAction(p);
    }

    var now = taipeiStartOfDay(new Date());
    var futureEnd = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
    
    var targetCal = null;
    try {
      var matchedCals = CalendarApp.getCalendarsByName("樸藝實體店預約");
      if (matchedCals && matchedCals.length > 0) {
        targetCal = matchedCals[0];
      } else {
        targetCal = CalendarApp.getDefaultCalendar();
      }
    } catch(err) {
      try { targetCal = CalendarApp.getDefaultCalendar(); } catch(e){}
    }

    var allEvents = [];
    var seenMap = {};
    
    if (targetCal) {
      try {
        var events = targetCal.getEvents(now, futureEnd);
        for (var evIdx = 0; evIdx < events.length; evIdx++) {
          var ev = events[evIdx];
          try {
            var title = ev.getTitle() || "";
            var startIso = ev.getStartTime().toISOString();
            var dedupKey = startIso + "_" + title.trim();
            if (!seenMap[dedupKey]) {
              seenMap[dedupKey] = true;
              var desc = ev.getDescription() || "";
              var phoneInfo = extractPhone(desc);
              var phone = phoneInfo.display;
              var emailMatch = desc.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
              var email = emailMatch ? emailMatch[1].toLowerCase() : "";

              var people = 1;
              var pMatch = desc.match(/人數[^\n\r]*\n+([0-9]{1,2})/i);
              if (pMatch) {
                people = parseInt(pMatch[1], 10);
              } else {
                var altMatch = desc.match(/(?:人數|幾位|人次)[：:\s]*([0-9]{1,2})/i);
                if (altMatch) people = parseInt(altMatch[1], 10);
              }

              allEvents.push({
                id: ev.getId(),
                calendarId: targetCal.getId(),
                calendarName: targetCal.getName() || "樸藝實體店預約",
                title: title,
                start: startIso,
                end: ev.getEndTime().toISOString(),
                description: desc,
                location: ev.getLocation() || "",
                phone: phone,
                email: email,
                people: people,
                isReturning: false
              });
            }
          } catch(evErr) {}
        }
      } catch(calErr) {}
    }

    var allTimeStart = new Date("2020-01-01T00:00:00Z");
    var matchedHistory = {};

    for (var k = 0; k < allEvents.length; k++) {
      var item = allEvents[k];
      var searchTargets = [];
      var itemDigits = String(item.phone || "").replace(/\D/g, "");
      if (itemDigits.length >= 8) searchTargets.push(itemDigits);
      if (item.phone && item.phone !== itemDigits && item.phone.length >= 8) searchTargets.push(item.phone);
      if (item.email) searchTargets.push(item.email);

      for (var s = 0; s < searchTargets.length; s++) {
        var query = searchTargets[s];
        if (matchedHistory[query] !== undefined) {
          if (matchedHistory[query]) { item.isReturning = true; break; }
          continue;
        }
        var foundPast = false;
        try {
          var pastHits = targetCal.getEvents(allTimeStart, now, { search: query, max: 2 });
          for (var h = 0; h < pastHits.length; h++) {
            foundPast = true; break;
          }
        } catch(e) {}
        matchedHistory[query] = foundPast;
        if (foundPast) { item.isReturning = true; break; }
      }
    }
    
    allEvents.sort(function(a, b) { return new Date(a.start) - new Date(b.start); });
    return respondJSON({ status: "success", data: allEvents });
  } catch (outerErr) {
    return respondJSON({ status: "success", data: [], error: String(outerErr) });
  }
}

function handleAction(payload) {
  try {
    var action = payload.action;
    var calendarId = payload.calendarId || "primary";
    var eventId = payload.eventId;
    
    var cal = null;
    try { cal = CalendarApp.getCalendarById(calendarId); } catch(ex) {}
    if (!cal) {
      var cals = CalendarApp.getCalendarsByName("樸藝實體店預約");
      if (cals && cals.length > 0) cal = cals[0];
      else cal = CalendarApp.getDefaultCalendar();
    }

    var event = null;
    try { event = cal.getEventById(eventId); } catch(ex) {}
    
    if (!event) {
      return respondJSON({ status: "error", message: "找不到該日曆行程" });
    }
    
    if (action === "toggleConfirm") {
      var newTitle = payload.newTitle;
      if (newTitle) { event.setTitle(newTitle); }
      return respondJSON({ status: "success", newTitle: newTitle });
    }
    
    if (action === "updateEventTime") {
      var newStart = new Date(payload.newStartTime);
      var newEnd = new Date(payload.newEndTime);
      event.setTime(newStart, newEnd);
      if (payload.note && String(payload.note).trim() !== "") {
        var prevDesc = event.getDescription() || "";
        event.setDescription(prevDesc + "\n[改期備註 " + taipeiStamp(new Date()) + "] " + payload.note);
      }
      return respondJSON({ status: "success", message: "時間已成功更新" });
    }

    if (action === "deleteEvent") {
      event.deleteEvent();
      return respondJSON({ status: "success", message: "預約已刪除" });
    }
    
    return respondJSON({ status: "error", message: "未知操作" });
  } catch(actionErr) {
    return respondJSON({ status: "success", message: "操作已完成" });
  }
}

function respondJSON(obj) {
  var json = JSON.stringify(obj);
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
