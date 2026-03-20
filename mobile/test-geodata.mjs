// test-geodata.mjs
(async () => {
  try {
    const res = await fetch('https://countriesnow.space/api/v0.1/countries/states');
    const data = await res.json();
    const tr = data.data.find(c => c.iso3 === 'TUR');
    console.log(tr.states.slice(0, 5));
    
    // Test city for states
    const res2 = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ country: "Turkey", state: "Istanbul" })
    });
    const data2 = await res2.json();
    console.log("Districts in Istanbul:", data2.data.slice(0, 5));
  } catch (e) {
    console.error(e);
  }
})();
