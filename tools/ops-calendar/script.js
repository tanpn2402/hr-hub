(function () {
  // 1. Your employee JSON data
  const employeeList = [
    {
      "employeeCode": "510",
      "name": "Nguyen Thanh Thuy Trang",
      "active": true
    },
    {
      "employeeCode": "512",
      "name": "Le Ngoc Hieu",
      "active": true
    },
    {
      "employeeCode": "513",
      "name": "Le Thi Thuy Trang",
      "active": true
    },
    {
      "employeeCode": "514",
      "name": "Nguyen Ngoc Thi Thanh",
      "active": true
    },
    {
      "employeeCode": "515",
      "name": "Pham Thanh Su",
      "active": true
    },
    {
      "employeeCode": "517",
      "name": "Pham Nhat Tan",
      "active": true
    },
    {
      "employeeCode": "518",
      "name": "Lai Hoang Quang Vinh",
      "active": true
    },
    {
      "employeeCode": "520",
      "name": "Pham Thi Ngoc Bich",
      "active": true
    },
    {
      "employeeCode": "523",
      "name": "Le Thanh co",
      "active": true
    },
    {
      "employeeCode": "524",
      "name": "Hoang Nguyen Thuy Quyen",
      "active": true
    },
    {
      "employeeCode": "525",
      "name": "Dinh Duy Chuong",
      "active": true
    },
    {
      "employeeCode": "526",
      "name": "Lam Dinh Ha Ly",
      "active": true
    },
    {
      "employeeCode": "527",
      "name": "Phan Nguyen Minh Kha",
      "active": true
    },
    {
      "employeeCode": "528",
      "name": "Nguyen Ngoc The Vy",
      "active": true
    },
    {
      "employeeCode": "529",
      "name": "Tran Trung Hieu",
      "active": true
    },
    {
      "employeeCode": "530",
      "name": "Nguyen Hoang Long",
      "active": true
    },
    {
      "employeeCode": "531",
      "name": "Le Tuan",
      "active": true
    },
    {
      "employeeCode": "532",
      "name": "Dinh Thanh Tung",
      "active": true
    },
    {
      "employeeCode": "533",
      "name": "Vu Hai Nam",
      "active": true
    },
    {
      "employeeCode": "534",
      "name": "Pham Duc Minh",
      "active": true
    },
    {
      "employeeCode": "536",
      "name": "Tran Van Hoang",
      "active": true
    },
    {
      "employeeCode": "538",
      "name": "Vo Thi Ngoc Hoa",
      "active": true
    },
    {
      "employeeCode": "539",
      "name": "Tran Thi Thanh Tam",
      "active": true
    },
    {
      "employeeCode": "541",
      "name": "Nguyen Thi Hien",
      "active": true
    },
    {
      "employeeCode": "543",
      "name": "Le Ngoc Thanh Trung",
      "active": true
    },
    {
      "employeeCode": "545",
      "name": "Lam Tien Dat",
      "active": true
    },
    {
      "employeeCode": "550",
      "name": "Bui Hai Nam",
      "active": true
    },
    {
      "employeeCode": "553",
      "name": "Le Hoang Phuc",
      "active": true
    },
    {
      "employeeCode": "559",
      "name": "Luu Cong Phuoc",
      "active": true
    },
    {
      "employeeCode": "560",
      "name": "Bui Tan Loc",
      "active": true
    },
    {
      "employeeCode": "562",
      "name": "Nguyen Duc",
      "active": true
    },
    {
      "employeeCode": "565",
      "name": "Tran Van Tu",
      "active": true
    },
    {
      "employeeCode": "566",
      "name": "Nguyen Xuan Truong",
      "active": true
    },
    {
      "employeeCode": "567",
      "name": "Tran Phi Long",
      "active": true
    },
    {
      "employeeCode": "568",
      "name": "Hong Dai Phat",
      "active": true
    },
    {
      "employeeCode": "571",
      "name": "Bui Minh To",
      "active": true
    },
    {
      "employeeCode": "572",
      "name": "Nguyen Thi Tam Phuc",
      "active": true
    },
    {
      "employeeCode": "573",
      "name": "Tran Thi Minh Thuy",
      "active": true
    },
    {
      "employeeCode": "574",
      "name": "Nguyen Thao Huyen",
      "active": true
    },
    {
      "employeeCode": "575",
      "name": "Le Van Thanh",
      "active": true
    },
    {
      "employeeCode": "576",
      "name": "Le Hoang Tan",
      "active": true
    },
    {
      "employeeCode": "579",
      "name": "Nguyen Ngoc Bao Trong",
      "active": true
    },
    {
      "employeeCode": "580",
      "name": "Le Nguyen Thuy Vy",
      "active": true
    },
    {
      "employeeCode": "581",
      "name": "Phan Huu Tinh",
      "active": true
    },
    {
      "employeeCode": "582",
      "name": "Lam Yen Duong",
      "active": true
    },
    {
      "employeeCode": "583",
      "name": "Phung Nguyen Kim Nguyen",
      "active": true
    }
  ];

  // Helper to clean and normalize names for comparison
  const normalize = (str) => {
    return str
      .replace(/\s*\(.*?\)\s*/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Create lookup Map
  const employeeMap = new Map(
    employeeList.map(emp => [normalize(emp.name), emp.employeeCode])
  );

  const table = document.querySelector('table#Calendar');
  if (!table) return console.error("Table #Calendar not found");

  const cells = Array.from(table.querySelectorAll('td[date]'));
  const results = [];

  cells.forEach(td => {
    const dateStr = td.getAttribute('date'); // Format: YYYYMMDD
    const dateFormattedStr = dateStr.substring(4, 6) + '-' + dateStr.substring(6, 8) + '-' + dateStr.substring(0, 4); // Format: MM-DD-YYYY (if needed, can be reformatted)
    const badges = Array.from(td.querySelectorAll('div.media.Badge[placementid]'));
    const seen = new Set();

    badges.forEach(el => {
      const placementId = el.getAttribute('placementid');
      const textLines = el.innerText.trim().split('\n').map(s => s.trim()).filter(s => s.length > 0);

      const rawName = textLines.find(line => line.length > 2 && !line.includes(':')) || 'Unknown';
      const time = textLines.find(line => line.includes(':')) || 'N/A';

      const cleanedName = normalize(rawName);
      const employeeCode = employeeMap.get(cleanedName);

      if (!employeeCode) {
        console.warn(`Employee code not found for name: "${rawName}" (normalized: "${cleanedName}")`);
        return; // Skip this entry if employee code is not found
      }

      // --- Leave Time Logic ---
      let leave_from, leave_to;

      if (time === 'N/A') {
        // Default business hours
        leave_from = `${dateFormattedStr} 08:00:00`;
        leave_to = `${dateFormattedStr} 17:30:00`;
      } else {
        // Parse "HH:mm - HH:mm" or similar from badge
        const timeParts = time.split('-').map(t => t.trim());
        const start = timeParts[0] ? (timeParts[0].includes(':') ? timeParts[0] : '08:00') : '08:00';
        const end = timeParts[1] ? (timeParts[1].includes(':') ? timeParts[1] : '17:30') : '17:30';

        // Ensure format is HH:mm:ss
        const formatTime = (t) => t.split(':').length === 2 ? `${t}:00` : t;

        leave_from = `${dateFormattedStr} ${formatTime(start)}`;
        leave_to = `${dateFormattedStr} ${formatTime(end)}`;
      }

      const key = `${dateFormattedStr}-${placementId}-${cleanedName}-${time}`;
      if (!seen.has(key)) {
        results.push({
          date: dateFormattedStr,
          name: rawName,
          employeeCode,
          // time,
          leave_from,
          leave_to,
          // placementId,
          status: "Approved"
        });
        seen.add(key);
      }
    });
  });

  // --- JSON Export Logic (Commented Out) ---
  // const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  // const url = URL.createObjectURL(blob);
  // const a = document.createElement('a');
  // a.href = url;
  // a.download = 'calendar_export.json';
  // document.body.appendChild(a);
  // a.click();
  // document.body.removeChild(a);
  // URL.revokeObjectURL(url);

  // console.log(`Exported ${results.length} entries with leave times.`);



  // --- CSV Conversion Logic ---
  const headersMap = {
    date: 'Date',
    name: 'Employee Name',
    employeeCode: 'Placement Number',
    // time: 'Time',
    leave_from: 'Leave From',
    leave_to: 'Leave To',
    status: 'Status'
  };
  const headers = Object.keys(results[0]);
  const csvRows = [
    headers.map(fieldName => headersMap[fieldName] || fieldName).join(','), // Header row
    ...results.map(row => headers.map(fieldName => {
      let value = row[fieldName] || '';
      // Escape quotes and wrap in quotes to handle names with commas
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(','))
  ];

  const csvContent = "\ufeff" + csvRows.join('\n'); // Add BOM for Excel UTF-8 support
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'calendar_export.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Exported ${results.length} entries to CSV.`);
})();