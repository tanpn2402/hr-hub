(function() {
  const table = document.querySelector('table#Calendar');
  if (!table) return console.error("Table #Calendar not found");

  const cells = Array.from(table.querySelectorAll('td[date]'));
  const results = [];

  cells.forEach(td => {
    const date = td.getAttribute('date');
    const badges = Array.from(td.querySelectorAll('div.media.Badge[placementid]'));
    const seen = new Set();
    
    badges.forEach(el => {
      const placementId = el.getAttribute('placementid');
      const textLines = el.innerText.trim().split('\n').map(s => s.trim()).filter(s => s.length > 0);
      const name = textLines.find(line => line.length > 2 && !line.includes(':')) || 'Unknown';
      const time = textLines.find(line => line.includes(':')) || 'N/A';
      
      const key = `${placementId}-${name}`;
      if (!seen.has(key)) {
        results.push({ date, name, time, placementId });
        seen.add(key);
      }
    });
  });

  // Create a Blob containing the JSON data
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create a temporary hidden link to trigger the download
  const a = document.createElement('a');
  a.href = url;
  a.download = 'calendar_export.json';
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log("Success! Your browser should now download 'calendar_export.json'.");
})();