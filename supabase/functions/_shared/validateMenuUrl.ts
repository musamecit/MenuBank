export interface ValidationResult {
  action: 'approve' | 'flag' | 'reject';
  reason: string;
}

export async function validateMenuUrl(urlStr: string): Promise<ValidationResult> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { action: 'reject', reason: 'Geçersiz URL formatı.' };
  }

  // 1. Basic Protocol & Length Check
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { action: 'reject', reason: 'Sadece http ve https desteklenir.' };
  }
  if (urlStr.length > 2048) {
    return { action: 'reject', reason: 'URL çok uzun.' };
  }

  // 2. SSRF Protection (Quick Checks)
  const host = url.hostname.toLowerCase();
  const suspiciousHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.'];
  if (suspiciousHosts.some(h => host.includes(h))) {
    return { action: 'reject', reason: 'Geçersiz sunucu adresi (SSRF Koruması).' };
  }

  // 3. Domain Scoring & Blacklist
  const blacklistKeywords = ['casino', 'bet', 'porn', 'escort', 'xxx', 'sex', 'kumar'];
  if (blacklistKeywords.some(kw => urlStr.toLowerCase().includes(kw))) {
    return { action: 'reject', reason: 'URL yasaklı anahtar kelimeler içeriyor.' };
  }

  let score = 0;
  
  const socialDomains = ['instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'youtube.com', 'tiktok.com', 'wa.me', 'whatsapp.com'];
  if (socialDomains.some(d => host.includes(d))) {
    score -= 30; // Sosyal medya hesapları genelde direkt menü değildir, incelemeye düşsün
  }

  // 4. File extension hints
  const path = url.pathname.toLowerCase();
  if (path.endsWith('.pdf')) {
    score += 50; // PDF files strongly indicate menus
  } else if (path.endsWith('.exe') || path.endsWith('.zip') || path.endsWith('.rar') || path.endsWith('.apk')) {
    return { action: 'reject', reason: 'Zararlı dosya uzantısı tespit edildi.' };
  }

  // 5. URL Path/Query Hints
  if (urlStr.toLowerCase().includes('menu') || urlStr.toLowerCase().includes('menü') || urlStr.toLowerCase().includes('qr')) {
    score += 20;
  }

  // 6. Fast Content Fetch
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4 second max wait
    
    // Standard User-Agent to avoid basic anti-bot blocks
    const response = await fetch(urlStr, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (response.ok) {
      // Read at most the first 10KB
      const reader = response.body?.getReader();
      let textChunk = '';
      let bytesRead = 0;
      
      if (reader) {
        while (bytesRead < 10240) { // 10KB
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            bytesRead += value.length;
            textChunk += new TextDecoder('utf-8').decode(value, { stream: true });
          }
        }
        reader.releaseLock();
        
        // Ensure we cancel the stream to stop downloading
        response.body?.cancel();
      }

      const lowerContent = textChunk.toLowerCase();
      
      const positiveKeywords = ['fiyat', '₺', 'tl', 'usd', 'çorba', 'salata', 'pizza', 'kebap', 'içecek', 'burger', 'tatlı', 'kategori'];
      let foundKeywords = 0;
      for (const kw of positiveKeywords) {
        if (lowerContent.includes(kw)) foundKeywords++;
      }
      
      score += (foundKeywords * 5); // Max out around +30-40 easily if it's a food page
      
      if (lowerContent.includes('casino') || lowerContent.includes('bahis')) {
        return { action: 'reject', reason: 'Sayfa içeriğinde yasaklı terimler bulundu.' };
      }
      
    } else {
      // If server rejected us (403, 404, 500) we don't reject outright because we might be blocked by WAF.
      // We just penalize the score slightly.
      score -= 10;
    }
  } catch (err) {
    // Timeout or network error
    // We do not reject because users might submit clunky/slow menus. We just leave score as is.
    score -= 10;
  }

  // 7. Final Decision
  // Base score 0 + any modifiers
  // Require 20 points (e.g. contains 'menu' in URL or a few positive keywords) to pass cleanly.
  // Social media (-30) would need massive keywords to pass, effectively forcing it to 'flag'.
  if (score >= 20) {
    return { action: 'approve', reason: `Score: ${score} - Onaylandı.` };
  } else {
    // If it didn't pass, flag it so it goes to admin Review.
    return { action: 'flag', reason: `Score: ${score} - Doğrulanamadı, inceleme bekleniyor.` };
  }
}
