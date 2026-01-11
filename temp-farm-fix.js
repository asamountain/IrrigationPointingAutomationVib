      farmList = await page.evaluate(() => {
        const farms = [];
        const tabs = document.querySelector('[id*="tabs"][id*="content-point"]');
        if (tabs) {
          // CRITICAL FIX: Find individual <a> elements, not the parent container
          const farmContainer = tabs.querySelector('div > div:first-child > div:nth-child(2)');
          
          if (!farmContainer) {
            console.error('[BROWSER] ❌ Farm container not found!');
            return farms;
          }
          
          // Find all <a> tags (each represents one farm)
          const farmLinks = farmContainer.querySelectorAll('a[href*="/report/point/"]');
          console.log(`[BROWSER] Found ${farmLinks.length} farm links`);
          
          farmLinks.forEach((link, idx) => {
            const text = link.textContent.trim();
            
            // BUGFIX: Filter out invalid elements
            if (!text || text.length < 3 || text.length > 200) return;
            if (/\d{4}년|\d{2}월|\d{2}일/.test(text)) return; // Skip dates
            if (text.includes('전체 보기') || text.includes('저장')) return; // Skip UI buttons
            if (text.includes('Created with') || text.includes('Highcharts')) return; // Skip chart
            if (/^\d{2}:\d{2}/.test(text)) return; // Skip if starts with time
            if (text.startsWith('구역')) return; // Skip table labels
            
            console.log(`[BROWSER] ✓ Valid farm #${idx + 1}: ${text}`);
            farms.push({ index: idx + 1, name: text });
          });
        }
        return farms;
      });
