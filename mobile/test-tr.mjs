// test-tr.mjs
(async () => {
  try {
    const res = await fetch('https://raw.githubusercontent.com/volkanakin/Turkey-City-And-District-JSON/master/il-ilce.json');
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();
    console.log("Total entries:", data.length);
    console.log("Sample:", data[0]);
  } catch (e) {
    console.error(e);
  }
})();
